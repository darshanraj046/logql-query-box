import type { ResolvedSchema } from './schema'
import type { Span, Token, TokenizeResult, ValuePart } from './types'

const FIELD = /([A-Za-z_][A-Za-z0-9_]*):/y
const WORD = /[^\s()]*/y
const LIST_ITEM = /[^\s(),]*/y
const SPACE = /\s/

function closingSlash(src: string, i: number, classAware: boolean): number {
  let j = i + 1
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') {
      j += 2
      continue
    }
    if (classAware && c === '[') {
      j++
      if (src[j] === '^') j++
      if (src[j] === ']') j++
      while (j < src.length && src[j] !== ']') j += src[j] === '\\' ? 2 : 1
      j++
      continue
    }
    if (c === '/') return j + 1 >= src.length || /[\s()]/.test(src[j + 1]) ? j : -1
    j++
  }
  return -1
}

export function regexEndAt(src: string, i: number): number {
  const end = closingSlash(src, i, true)
  return end > 0 ? end : closingSlash(src, i, false)
}

function readPhrase(src: string, i: number): { value: string; end: number } | null {
  const n = src.length
  let j = i + 1
  let v = ''
  while (j < n && src[j] !== '"') {
    if (src[j] === '\\' && j + 1 < n) {
      v += src[j + 1]
      j += 2
    } else {
      v += src[j++]
    }
  }
  return j >= n ? null : { value: v, end: j + 1 }
}

function sticky(re: RegExp, src: string, i: number): string {
  re.lastIndex = i
  const m = re.exec(src)
  return m ? m[0] : ''
}

export function tokenize(src: string, schema: ResolvedSchema): TokenizeResult {
  const toks: Token[] = []
  const n = src.length
  let i = 0
  while (i < n) {
    const ch = src[i]
    if (SPACE.test(ch)) {
      i++
      continue
    }
    if (ch === '(' || ch === ')') {
      toks.push({ t: ch, s: i, e: i + 1 })
      i++
      continue
    }
    const s = i
    let neg = false
    let field: string | null = null
    if (ch === '-' && i + 1 < n && !SPACE.test(src[i + 1])) {
      neg = true
      i++
    }
    if (neg && src[i] === '(') {
      toks.push({ t: '(', s, e: i + 1, neg: true })
      i++
      continue
    }
    FIELD.lastIndex = i
    const m = FIELD.exec(src)
    const known = m ? schema.alias.get(m[1].toLowerCase()) : undefined
    if (m && known) {
      field = known
      i += m[0].length
    }

    if (field && field !== schema.lineField && !(src[i] === '/' && regexEndAt(src, i) > 0)) {
      const parts: ValuePart[] = []
      const quotes: Span[] = []
      while (i < n) {
        if (src[i] === '"') {
          const p = readPhrase(src, i)
          if (!p) return { toks, open: s, error: `The quote that starts at character ${i + 1} is never closed.` }
          parts.push({ v: p.value, wild: false })
          quotes.push([i, p.end])
          i = p.end
        } else {
          const bare = sticky(LIST_ITEM, src, i)
          if (bare) parts.push({ v: bare, wild: bare.includes('*') })
          i += bare.length
        }
        if (src[i] !== ',') break
        i++
      }
      toks.push(parts.length ? { t: 'term', neg, field, kind: 'word', parts, quotes, s, e: i } : { t: 'skip', s, e: i })
      continue
    }

    let kind: Token['kind'] = 'word'
    let value = ''
    let quotes: Span[] = []
    if (src[i] === '"') {
      const p = readPhrase(src, i)
      if (!p) return { toks, open: s, error: `The quote that starts at character ${i + 1} is never closed.` }
      quotes = [[i, p.end]]
      value = p.value
      i = p.end
      kind = 'phrase'
    } else if (src[i] === '/' && regexEndAt(src, i) > 0) {
      const end = regexEndAt(src, i)
      for (let j = i + 1; j < end; j++) {
        if (src[j] === '\\' && src[j + 1] === '/') {
          value += '/'
          j++
        } else {
          value += src[j]
        }
      }
      quotes = [[i, end + 1]]
      i = end + 1
      kind = 'regex'
    } else {
      value = sticky(WORD, src, i)
      i += value.length
    }
    if (!field && !neg && kind === 'word') {
      if (value === 'OR') {
        toks.push({ t: 'or', s, e: i })
        continue
      }
      if (value === 'AND') {
        toks.push({ t: 'and', s, e: i })
        continue
      }
    }
    if (value === '' && kind === 'word') {
      toks.push({ t: 'skip', s, e: i })
      continue
    }
    toks.push({ t: 'term', neg, field, kind, value, quotes, s, e: i })
  }
  return { toks }
}
