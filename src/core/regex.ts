export const UNSUPPORTED_REGEX = 'Loki uses RE2, which does not support lookaround or backreferences.'
export const INVALID_REGEX = 'This is not a valid regular expression.'

const POSIX: Record<string, number[][]> = {
  alnum: [[48, 57], [65, 90], [97, 122]],
  alpha: [[65, 90], [97, 122]],
  ascii: [[0, 127]],
  blank: [[9, 9], [32, 32]],
  cntrl: [[0, 31], [127, 127]],
  digit: [[48, 57]],
  graph: [[33, 126]],
  lower: [[97, 122]],
  print: [[32, 126]],
  punct: [[33, 47], [58, 64], [91, 96], [123, 126]],
  space: [[9, 13], [32, 32]],
  upper: [[65, 90]],
  word: [[48, 57], [65, 90], [95, 95], [97, 122]],
  xdigit: [[48, 57], [65, 70], [97, 102]]
}
const SIMPLE_ESCAPE: Record<string, number> = { a: 7, f: 12, n: 10, r: 13, t: 9, v: 11 }
const CACHE_LIMIT = 500
const LOOP_LIMIT = 4
const LONG_REPEAT = 10
const WIDE_REPEAT_LIMIT = 4
const OVERLAP_SAMPLE = [...Array.from({ length: 118 }, (_, i) => String.fromCharCode(i + 9)), '\u00e9', '\u4e2d', '\ud83d\ude00']
const RISK_ATOM = /\\u\{[0-9a-f]+\}|\\[pP]\{[^}]*\}|\\.|\[(?:\\.|[^\]\\])*\]|[\s\S]/uy
const RISK_REPEAT = /(?:\*|\+|\?|\{(\d+)(?:(,)(\d*))?\})\??/y
const LITERAL_ATOM = /^(?:\\u\{[0-9a-f]+\}|[^\\.[\]])$/u
const WIDE_ATOM = /^(?:\.|\[\^|\\[DSWP])/
const ZERO_WIDTH_ATOM = /^(?:\^|\$|\\[bB])$/

interface Translated {
  source: string
  flags: string
  problem: string | null
  reason?: string
  at?: number
  caseSensitive: boolean
  risky: boolean
}

interface RiskFrame {
  varying: boolean
  firsts: string[]
  first: string | null
  required: boolean
  nullable: boolean
  entry: string[]
  exits: string[]
}

type Failure = { problem: string; reason: string; at: number }
type Escaped = { cp: number; next: number } | Failure

const point = (cp: number) => `\\u{${cp.toString(16)}}`

function readEscape(p: string, i: number): Escaped {
  const d = p[i + 1]
  if (d === undefined) return { problem: INVALID_REGEX, reason: 'a \\ at the end has nothing to escape', at: i }
  if (d === 'k') return { problem: UNSUPPORTED_REGEX, reason: 'back-references such as \\k<name> do not work in Loki, which uses RE2', at: i }
  if (d >= '1' && d <= '9') {
    const octalFollows = d <= '7' && p[i + 2] >= '0' && p[i + 2] <= '7'
    if (!octalFollows) return { problem: UNSUPPORTED_REGEX, reason: `back-references such as \\${d} do not work in Loki, which uses RE2`, at: i }
  }
  if (d >= '0' && d <= '7') {
    let cp = 0
    let j = i + 1
    while (j < i + 4 && p[j] >= '0' && p[j] <= '7') cp = cp * 8 + Number(p[j++])
    return { cp, next: j }
  }
  if (d === 'x') {
    if (p[i + 2] === '{') {
      const end = p.indexOf('}', i + 3)
      const hex = end < 0 ? '' : p.slice(i + 3, end)
      if (!/^[0-9a-fA-F]+$/.test(hex) || parseInt(hex, 16) > 0x10ffff) return { problem: INVALID_REGEX, reason: '\\x{…} needs a hex code point', at: i }
      return { cp: parseInt(hex, 16), next: end + 1 }
    }
    const hex = p.slice(i + 2, i + 4)
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { problem: INVALID_REGEX, reason: '\\x needs two hex digits', at: i }
    return { cp: parseInt(hex, 16), next: i + 4 }
  }
  if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPE, d)) return { cp: SIMPLE_ESCAPE[d], next: i + 2 }
  if (/[\x00-\x7f]/.test(d) && !/[0-9A-Za-z]/.test(d)) return { cp: d.charCodeAt(0), next: i + 2 }
  return { problem: INVALID_REGEX, reason: `\\${d} is not a valid escape`, at: i }
}

function readUnicodeClass(p: string, i: number): { js: string; next: number } | null {
  let negative = p[i + 1] === 'P'
  let name: string
  let next: number
  if (p[i + 2] === '{') {
    const end = p.indexOf('}', i + 3)
    if (end < 0) return null
    name = p.slice(i + 3, end)
    next = end + 1
    if (name[0] === '^') {
      negative = !negative
      name = name.slice(1)
    }
  } else {
    if (p[i + 2] === undefined) return null
    name = p[i + 2]
    next = i + 3
  }
  const letter = negative ? 'P' : 'p'
  for (const body of [name, `Script=${name}`]) {
    const js = `\\${letter}{${body}}`
    try {
      new RegExp(js, 'u')
      return { js, next }
    } catch {
      continue
    }
  }
  return null
}

function readClass(p: string, start: number): { js: string; next: number } | Failure {
  let i = start + 1
  let out = '['
  if (p[i] === '^') {
    out += '^'
    i++
  }
  let first = true
  const single = (): { cp: number } | Failure => {
    if (p[i] === '\\') {
      const e = readEscape(p, i)
      if ('problem' in e) return e
      i = e.next
      return { cp: e.cp }
    }
    const cp = p.codePointAt(i) as number
    i += cp > 0xffff ? 2 : 1
    return { cp }
  }
  while (i < p.length && (p[i] !== ']' || first)) {
    first = false
    if (p.startsWith('[:', i)) {
      const end = p.indexOf(':]', i + 2)
      if (end >= 0) {
        const raw = p.slice(i + 2, end)
        const name = raw.replace(/^\^/, '')
        if (!Object.prototype.hasOwnProperty.call(POSIX, name)) return { problem: INVALID_REGEX, reason: `[:${name}:] is not a known character class`, at: i }
        const ranges = POSIX[name]
        if (raw[0] === '^') {
          let from = 0
          for (const [lo, hi] of ranges) {
            if (lo > from) out += `${point(from)}-${point(lo - 1)}`
            from = hi + 1
          }
          out += `${point(from)}-${point(0x10ffff)}`
        } else {
          for (const [lo, hi] of ranges) out += `${point(lo)}-${point(hi)}`
        }
        i = end + 2
        continue
      }
    }
    if (p[i] === '\\' && /[dDsSwW]/.test(p[i + 1] ?? '')) {
      out += p[i + 1] === 's' ? '\\t\\n\\f\\r ' : `\\${p[i + 1]}`
      i += 2
      continue
    }
    if (p[i] === '\\' && (p[i + 1] === 'p' || p[i + 1] === 'P')) {
      const u = readUnicodeClass(p, i)
      if (!u) return { problem: INVALID_REGEX, reason: 'this is not a known Unicode class', at: i }
      out += u.js
      i = u.next
      continue
    }
    const from = i
    const lo = single()
    if ('problem' in lo) return lo
    if (p[i] === '-' && i + 1 < p.length && p[i + 1] !== ']') {
      i++
      const hi = single()
      if ('problem' in hi) return hi
      if (hi.cp < lo.cp) return { problem: INVALID_REGEX, reason: `the range ${p.slice(from, i)} runs backwards`, at: from }
      out += `${point(lo.cp)}-${point(hi.cp)}`
    } else {
      out += point(lo.cp)
    }
  }
  if (i >= p.length) return { problem: INVALID_REGEX, reason: 'this [ is never closed', at: start }
  return { js: `${out}]`, next: i + 1 }
}

function sharesCharacters(a: string, b: string): boolean {
  if (!a || !b || a === b) return true
  try {
    const left = new RegExp(`^(?:${a})$`, 'iu')
    const right = new RegExp(`^(?:${b})$`, 'iu')
    return OVERLAP_SAMPLE.some((ch) => left.test(ch) && right.test(ch))
  } catch {
    return true
  }
}

function isRisky(source: string): boolean {
  let pending: string[] = []
  const frame = (): RiskFrame => ({ varying: false, firsts: [], first: null, required: false, nullable: false, entry: pending, exits: [] })
  const stack: RiskFrame[] = [frame()]
  let wide = 0
  let i = 0
  while (i < source.length) {
    const c = source[i]
    if (c === '(') {
      i += source[i + 1] === '?' ? 3 : 1
      stack.push(frame())
      continue
    }
    if (c === '|') {
      const top = stack[stack.length - 1]
      top.firsts.push(top.first ?? '')
      top.first = null
      if (!top.required) top.nullable = true
      top.required = false
      top.exits.push(...pending)
      pending = top.entry
      wide = 0
      i++
      continue
    }
    let atom = ''
    let group: RiskFrame | undefined
    if (c === ')') {
      group = stack.pop()
      i++
    } else {
      RISK_ATOM.lastIndex = i
      atom = (RISK_ATOM.exec(source) as RegExpExecArray)[0]
      i += atom.length
    }
    RISK_REPEAT.lastIndex = i
    const q = RISK_REPEAT.exec(source)
    let min = 1
    let max = 1
    if (q) {
      i += q[0].length
      const head = q[0][0]
      min = head === '+' || head === '{' ? Number(q[1] ?? 1) : 0
      max = head === '?' ? 1 : head !== '{' ? Infinity : q[2] ? (q[3] ? Number(q[3]) : Infinity) : min
    }
    const parent = stack[stack.length - 1]
    let repeated = atom
    if (group) {
      const branches = [...group.firsts, group.first ?? '']
      repeated = branches.length === 1 ? branches[0] : ''
      const exits = [...group.exits, ...pending]
      pending = max >= LONG_REPEAT ? group.entry : min === 0 ? [...group.entry, ...exits] : exits
      const overlap = branches.length > 1 && (branches.includes('') || new Set(branches).size < branches.length)
      const nullable = group.nullable || !group.required
      if (max >= LOOP_LIMIT && (group.varying || overlap)) return true
      if (max > 1 && group.varying && nullable) return true
      if (group.varying) parent.varying = true
      if (min > 0 && !nullable) parent.required = true
    } else if (min > 0) {
      parent.required = true
    }
    if (min !== max) parent.varying = true
    if (parent.first === null) parent.first = !group && min > 0 && LITERAL_ATOM.test(atom) ? atom.toLowerCase() : ''
    if (max >= LONG_REPEAT) {
      if (pending.some((earlier) => sharesCharacters(earlier, repeated))) return true
      if (WIDE_ATOM.test(atom) && ++wide >= WIDE_REPEAT_LIMIT) return true
      pending = min > 0 ? [repeated] : [...pending, repeated]
    } else if (!group && min > 0 && !ZERO_WIDTH_ATOM.test(atom)) {
      pending = pending.filter((earlier) => !WIDE_ATOM.test(earlier) && sharesCharacters(earlier, atom))
    }
  }
  return false
}

function structure(p: string): [string, number] {
  const open: number[] = []
  let prev: 'start' | 'atom' | 'repeat' | 'lazy' = 'start'
  let i = 0
  while (i < p.length) {
    const c = p[i]
    if (c === '\\') {
      const end = p[i + 1] === 'Q' ? p.indexOf('\\E', i + 2) : i
      i = end < 0 ? p.length : end + 2
      prev = 'atom'
      continue
    }
    if (c === '[') {
      const k = readClass(p, i)
      i = 'next' in k ? k.next : p.length
      prev = 'atom'
      continue
    }
    if (c === '(') {
      open.push(i)
      const group = /^\((?:\?(?:P?<[A-Za-z0-9_]+>|[imsU]*(?:-[imsU]+)?[:)]))?/.exec(p.slice(i)) as RegExpExecArray
      i += group[0].length
      if (group[0].endsWith(')')) {
        open.pop()
        continue
      }
      prev = 'start'
      continue
    }
    if (c === ')') {
      if (!open.length) return ['this ) has no matching (', i]
      open.pop()
      prev = 'atom'
      i++
      continue
    }
    if (c === '|') {
      prev = 'start'
      i++
      continue
    }
    const count = c === '{' ? /^\{\d+(?:,\d*)?\}/.exec(p.slice(i)) : null
    if (c === '*' || c === '+' || c === '?' || count) {
      const len = count ? count[0].length : 1
      if (prev === 'start') return [`${count ? count[0] : c} has nothing before it to repeat`, i]
      if (prev === 'repeat' && c === '?') prev = 'lazy'
      else if (prev === 'repeat' || prev === 'lazy') return [`${count ? count[0] : c} cannot follow another repeat`, i]
      else prev = 'repeat'
      i += len
      continue
    }
    prev = 'atom'
    i++
  }
  if (open.length) return ['this ( is never closed', open[open.length - 1]]
  return ['it is not valid', 0]
}

function translate(p: string): Translated {
  let out = ''
  let flags = 'u'
  let i = 0
  let caseSensitive = false
  const stop = (problem: string, reason: string, at: number): Translated => ({ source: '', flags: '', problem, reason, at, caseSensitive, risky: false })
  const failed = (f: Failure): Translated => stop(f.problem, f.reason, f.at)
  while (i < p.length) {
    const c = p[i]
    if (c === '\\') {
      const d = p[i + 1]
      if (d === 'Q') {
        const end = p.indexOf('\\E', i + 2)
        const literal = p.slice(i + 2, end < 0 ? p.length : end)
        for (const ch of literal) out += point(ch.codePointAt(0) as number)
        i = end < 0 ? p.length : end + 2
        continue
      }
      if (d === 'A') {
        out += '(?:^)'
        i += 2
        continue
      }
      if (d === 'z') {
        out += '(?:(?![\\s\\S]))'
        i += 2
        continue
      }
      if (d === 'b' || d === 'B') {
        out += `(?:\\${d})`
        i += 2
        continue
      }
      if (d === 'd' || d === 'D' || d === 'w' || d === 'W') {
        out += `\\${d}`
        i += 2
        continue
      }
      if (d === 's' || d === 'S') {
        out += d === 's' ? '[\\t\\n\\f\\r ]' : '[^\\t\\n\\f\\r ]'
        i += 2
        continue
      }
      if (d === 'p' || d === 'P') {
        const u = readUnicodeClass(p, i)
        if (!u) return stop(INVALID_REGEX, 'this is not a known Unicode class', i)
        out += u.js
        i = u.next
        continue
      }
      const e = readEscape(p, i)
      if ('problem' in e) return failed(e)
      out += point(e.cp)
      i = e.next
      continue
    }
    if (c === '[') {
      const k = readClass(p, i)
      if ('problem' in k) return failed(k)
      out += k.js
      i = k.next
      continue
    }
    if (c === '(' && p[i + 1] === '?') {
      const rest = p.slice(i)
      if (/^\(\?(?:=|!|<=|<!)/.test(rest)) return stop(UNSUPPORTED_REGEX, `${rest[2] === '<' ? 'lookbehind' : 'lookahead'} does not work in Loki, which uses RE2`, i)
      const named = /^\(\?P?<([A-Za-z0-9_]+)>/.exec(rest)
      if (named) {
        out += '('
        i += named[0].length
        continue
      }
      const inline = /^\(\?([imsU]*)(-[imsU]+)?([:)])/.exec(rest)
      if (!inline) return stop(INVALID_REGEX, '(? must start a group such as (?: or flags such as (?i)', i)
      i += inline[0].length
      if (inline[3] === ':') {
        out += '(?:'
      } else if (out === '') {
        for (const f of inline[1]) if ('ims'.includes(f) && !flags.includes(f)) flags += f
        if (inline[2]?.includes('i')) {
          caseSensitive = true
          flags = flags.replace('i', '')
        }
      } else if (/[*+?}]$/.test(out)) {
        out += '(?:)'
      }
      continue
    }
    if (c === '^' || c === '$') {
      out += `(?:${c})`
      i++
      continue
    }
    if (c === '{') {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(p.slice(i))
      if (!m) {
        out += '\\{'
        i++
        continue
      }
      const min = Number(m[1])
      const max = m[2] ? (m[3] === '' ? -1 : Number(m[3])) : min
      if (min > 1000 || max > 1000) return stop(INVALID_REGEX, 'repeat counts go up to 1000', i)
      if (max >= 0 && min > max) return stop(INVALID_REGEX, `the first count in ${m[0]} is larger than the second`, i)
      out += m[0]
      i += m[0].length
      continue
    }
    if (c === '}' || c === ']') {
      out += `\\${c}`
      i++
      continue
    }
    out += c
    i++
  }
  try {
    new RegExp(out, flags)
  } catch {
    const [reason, at] = structure(p)
    return stop(INVALID_REGEX, reason, at)
  }
  return { source: out, flags, problem: null, caseSensitive, risky: isRisky(out) }
}

const cache = new Map<string, Translated>()

function translated(p: string): Translated {
  let t = cache.get(p)
  if (!t) {
    if (cache.size >= CACHE_LIMIT) cache.clear()
    t = translate(p)
    cache.set(p, t)
  }
  return t
}

export function regexProblem(p: string): string | null {
  return translated(p).problem
}

export function regexError(p: string): { reason: string; at: number; unsupported: boolean } | null {
  const t = translated(p)
  if (!t.problem) return null
  return { reason: t.reason ?? 'it is not valid', at: t.at ?? 0, unsupported: t.problem === UNSUPPORTED_REGEX }
}

export function isRiskyRegex(p: string): boolean {
  return translated(p).risky
}

export function toJsRegex(p: string, ci: boolean, anchored: boolean): RegExp {
  const t = translated(p)
  if (t.problem) throw new Error(t.problem)
  const flags = ci && !t.caseSensitive && !t.flags.includes('i') ? `${t.flags}i` : t.flags
  return new RegExp(anchored ? `^(?:${t.source})$` : t.source, flags)
}

export function matchesEmpty(p: string): boolean {
  try {
    return toJsRegex(p, false, true).test('')
  } catch {
    return true
  }
}

export function reEsc(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
