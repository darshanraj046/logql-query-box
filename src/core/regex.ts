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

interface Translated {
  source: string
  flags: string
  problem: string | null
  caseSensitive: boolean
}

type Escaped = { cp: number; next: number } | { problem: string }

const point = (cp: number) => `\\u{${cp.toString(16)}}`

function readEscape(p: string, i: number): Escaped {
  const d = p[i + 1]
  if (d === undefined) return { problem: INVALID_REGEX }
  if (d === 'k') return { problem: UNSUPPORTED_REGEX }
  if (d >= '1' && d <= '9') {
    const octalFollows = d <= '7' && p[i + 2] >= '0' && p[i + 2] <= '7'
    if (!octalFollows) return { problem: UNSUPPORTED_REGEX }
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
      if (!/^[0-9a-fA-F]+$/.test(hex) || parseInt(hex, 16) > 0x10ffff) return { problem: INVALID_REGEX }
      return { cp: parseInt(hex, 16), next: end + 1 }
    }
    const hex = p.slice(i + 2, i + 4)
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { problem: INVALID_REGEX }
    return { cp: parseInt(hex, 16), next: i + 4 }
  }
  if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPE, d)) return { cp: SIMPLE_ESCAPE[d], next: i + 2 }
  if (/[\x00-\x7f]/.test(d) && !/[0-9A-Za-z]/.test(d)) return { cp: d.charCodeAt(0), next: i + 2 }
  return { problem: INVALID_REGEX }
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

function readClass(p: string, start: number): { js: string; next: number } | { problem: string } {
  let i = start + 1
  let out = '['
  if (p[i] === '^') {
    out += '^'
    i++
  }
  let first = true
  const single = (): { cp: number } | { problem: string } => {
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
        if (!Object.prototype.hasOwnProperty.call(POSIX, name)) return { problem: INVALID_REGEX }
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
      if (!u) return { problem: INVALID_REGEX }
      out += u.js
      i = u.next
      continue
    }
    const lo = single()
    if ('problem' in lo) return lo
    if (p[i] === '-' && i + 1 < p.length && p[i + 1] !== ']') {
      i++
      const hi = single()
      if ('problem' in hi) return hi
      if (hi.cp < lo.cp) return { problem: INVALID_REGEX }
      out += `${point(lo.cp)}-${point(hi.cp)}`
    } else {
      out += point(lo.cp)
    }
  }
  if (i >= p.length) return { problem: INVALID_REGEX }
  return { js: `${out}]`, next: i + 1 }
}

function translate(p: string): Translated {
  let out = ''
  let flags = 'u'
  let i = 0
  let caseSensitive = false
  const stop = (problem: string): Translated => ({ source: '', flags: '', problem, caseSensitive })
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
        if (!u) return stop(INVALID_REGEX)
        out += u.js
        i = u.next
        continue
      }
      const e = readEscape(p, i)
      if ('problem' in e) return stop(e.problem)
      out += point(e.cp)
      i = e.next
      continue
    }
    if (c === '[') {
      const k = readClass(p, i)
      if ('problem' in k) return stop(k.problem)
      out += k.js
      i = k.next
      continue
    }
    if (c === '(' && p[i + 1] === '?') {
      const rest = p.slice(i)
      if (/^\(\?(?:=|!|<=|<!)/.test(rest)) return stop(UNSUPPORTED_REGEX)
      const named = /^\(\?P?<([A-Za-z0-9_]+)>/.exec(rest)
      if (named) {
        out += '('
        i += named[0].length
        continue
      }
      const inline = /^\(\?([imsU]*)(-[imsU]+)?([:)])/.exec(rest)
      if (!inline) return stop(INVALID_REGEX)
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
      if (min > 1000 || max > 1000 || (max >= 0 && min > max)) return stop(INVALID_REGEX)
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
    return stop(INVALID_REGEX)
  }
  return { source: out, flags, problem: null, caseSensitive }
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
