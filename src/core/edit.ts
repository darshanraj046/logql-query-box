import { MAX_DEPTH } from './parse'
import type { ResolvedSchema } from './schema'
import { tokenize } from './tokenize'
import { isNegative } from './tree'
import type { Cond, ParseResult, QueryNode, Span, Token, ValuePart } from './types'

export function quoteValue(v: string): string {
  if (v !== '' && !/[\s(),"\\*]/.test(v) && v[0] !== '/') return v
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function termText(schema: ResolvedSchema, field: string, parts: ValuePart[], neg: boolean): string {
  const primary = schema.fields.get(field)?.primary ?? field
  const head = schema.operator === '=' ? `${primary}${neg ? ' != ' : ' = '}` : `${neg ? '-' : ''}${primary}:`
  return `${head}${parts.map((p) => (p.wild ? p.v : quoteValue(p.v))).join(',')}`
}

export function tidy(q: string, schema: ResolvedSchema): string {
  const tk = tokenize(q, schema)
  if (tk.error) return q.trim()
  let toks: Token[] = tk.toks
  for (let pass = 0, changed = true; changed && pass <= MAX_DEPTH; pass++) {
    changed = false
    const real = toks.filter((t) => t.t !== 'skip')
    const drop = new Set<Token>()
    real.forEach((t, i) => {
      const prev = real[i - 1]
      const next = real[i + 1]
      const isOp = (x?: Token) => x?.t === 'and' || x?.t === 'or'
      if (t.t === '(' && next?.t === ')') {
        drop.add(t)
        drop.add(next)
      } else if (isOp(t) && (!prev || prev.t === '(' || isOp(prev) || !next || next.t === ')')) {
        drop.add(t)
      }
    })
    if (drop.size) {
      toks = toks.filter((t) => !drop.has(t))
      changed = true
    }
  }
  let out = ''
  toks.forEach((t, i) => {
    const prev = toks[i - 1]
    if (prev && prev.e !== t.s && prev.t !== '(' && t.t !== ')') out += ' '
    out += q.slice(t.s, t.e)
  })
  return out
}

export function editSpans(q: string, spans: Span[], text: string, schema: ResolvedSchema): string {
  const pieces: string[] = []
  let at = 0
  spans
    .slice()
    .sort((a, b) => a[0] - b[0])
    .forEach(([start, end], i) => {
      pieces.push(q.slice(at, start), i === 0 ? text : ' ')
      at = end
    })
  pieces.push(q.slice(at))
  return tidy(pieces.join(''), schema)
}

export function appendTerm(q: string, text: string, schema: ResolvedSchema): string {
  const base = tidy(q, schema)
  if (!base) return text
  const tk = tokenize(base, schema)
  let depth = 0
  let topLevelOr = false
  for (const t of tk.toks) {
    if (t.t === '(') depth++
    else if (t.t === ')') depth--
    else if (t.t === 'or' && depth === 0) topLevelOr = true
  }
  return topLevelOr ? `(${base}) ${text}` : `${base} ${text}`
}

function isValueTerm(n: QueryNode, field: string, neg: boolean): n is Cond {
  return n.type === 'cond' && n.field === field && !!n.parts && isNegative(n) === neg
}

export function activeValues(parsed: ParseResult, field: string, neg: boolean): Set<string> {
  const set = new Set<string>()
  for (const n of parsed.children) if (isValueTerm(n, field, neg)) (n.parts as ValuePart[]).forEach((p) => set.add(p.v))
  return set
}

export function facetEdit(q: string, parsed: ParseResult, schema: ResolvedSchema, field: string, value: string, neg: boolean): string {
  const single: ValuePart = { v: value, wild: false }
  if (parsed.error) return appendTerm(q, termText(schema, field, [single], neg), schema)
  const found = parsed.children.find((n) => isValueTerm(n, field, neg)) as Cond | undefined
  if (!found) return appendTerm(q, termText(schema, field, [single], neg), schema)
  const parts = (found.parts as ValuePart[]).slice()
  const at = parts.findIndex((p) => p.v === value)
  if (at >= 0) parts.splice(at, 1)
  else parts.push(single)
  return editSpans(q, found.spans as Span[], parts.length ? termText(schema, field, parts, neg) : '', schema)
}

export function clearField(q: string, parsed: ParseResult, schema: ResolvedSchema, field: string): string {
  if (parsed.error) return q
  const spans = parsed.children.flatMap((n) => (n.type === 'cond' && n.field === field ? (n.spans as Span[]) : []))
  return spans.length ? editSpans(q, spans, '', schema) : q
}
