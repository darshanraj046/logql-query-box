import { reEsc } from './regex'
import type { ResolvedSchema } from './schema'
import { tokenize } from './tokenize'
import { isNegative, negate } from './tree'
import type { Cond, Group, ParseResult, QueryNode, Span, Token, ValuePart } from './types'

export const MAX_DEPTH = 100

export function canon(schema: ResolvedSchema, known: Map<string, Map<string, number | undefined>>, field: string, v: string): string {
  const f = schema.fields.get(field)
  const low = v.toLowerCase()
  const synonym = f?.synonyms.get(low)
  if (synonym) return synonym
  for (const k of f?.values ?? []) if (k.toLowerCase() === low) return k
  for (const k of known.get(field)?.keys() ?? []) if (k.toLowerCase() === low) return k
  return f?.lowercase ? low : v
}

function shape(c: Cond, neg: boolean): void {
  const parts = (c.parts as ValuePart[]).filter((p) => p.v !== '')
  if (parts.some((p) => p.wild)) {
    c.op = neg ? 'not_regex' : 'regex'
    c.value = parts.map((p) => (p.wild ? reEsc(p.v).replace(/\\\*/g, '.*') : reEsc(p.v))).join('|')
  } else if (parts.length > 1) {
    c.op = neg ? 'not_in' : 'in'
    c.value = parts.map((p) => p.v)
  } else {
    c.op = neg ? 'neq' : 'eq'
    c.value = parts.length ? parts[0].v : ''
  }
}

function partKey(p: ValuePart): string {
  return `${p.wild ? '*' : '='}${p.v}`
}

function mergeSame(kids: QueryNode[]): QueryNode[] {
  const out: QueryNode[] = []
  const bags = new Map<string, { node: Cond; seen: Set<string>; neg: boolean; merged: boolean }>()
  for (const n of kids) {
    if (n.type !== 'cond' || !n.parts) {
      out.push(n)
      continue
    }
    const neg = isNegative(n)
    const key = `${neg ? '-' : '+'}${n.field}`
    const bag = bags.get(key)
    if (!bag) {
      bags.set(key, { node: n, seen: new Set(n.parts.map(partKey)), neg, merged: false })
      out.push(n)
      continue
    }
    bag.merged = true
    for (const p of n.parts) {
      if (bag.seen.has(partKey(p))) continue
      bag.seen.add(partKey(p))
      ;(bag.node.parts as ValuePart[]).push(p)
    }
    for (const span of n.spans as Span[]) (bag.node.spans as Span[]).push(span)
  }
  for (const bag of bags.values()) if (bag.merged) shape(bag.node, bag.neg)
  return out
}

function spanOf(nodes: QueryNode[]): Span {
  let start = Infinity
  let end = -Infinity
  for (const n of nodes) {
    for (const [s, e] of n.spans as Span[]) {
      start = Math.min(start, s)
      end = Math.max(end, e)
    }
  }
  return [start, end]
}

export function parse(src: string, schema: ResolvedSchema, known: Map<string, Map<string, number | undefined>>): ParseResult {
  const tk = tokenize(src, schema)
  if (tk.error) return { error: tk.error, errorAt: tk.errorAt, children: [] }
  const toks = tk.toks.filter((t) => t.t !== 'skip')
  let p = 0
  let uid = 0
  let depth = 0

  const G = (op: Group['op'], children: QueryNode[]): Group => ({ id: ++uid, type: 'group', op, children })
  const C = (field: string, op: Cond['op'], value: string): Cond => ({ id: ++uid, type: 'cond', field, op, value })

  const termToNode = (t: Token): Cond => {
    const f = t.field
    const neg = !!t.neg
    if (f == null || f === schema.lineField) {
      if (t.kind === 'regex') return C(schema.lineField, neg ? 'not_regex' : 'regex', t.value as string)
      const v = t.value as string
      if (schema.operator === '=' && f === schema.lineField && t.kind === 'word' && v.includes('*')) {
        const pieces = v.replace(/^\*+|\*+$/g, '').split(/\*+/)
        if (pieces.length > 1) return C(schema.lineField, neg ? 'not_regex' : 'regex', pieces.map(reEsc).join('.*'))
        return C(schema.lineField, neg ? 'not_contains' : 'contains', pieces[0])
      }
      return C(schema.lineField, neg ? 'not_contains' : 'contains', v)
    }
    if (t.kind === 'regex') {
      const c = C(f, neg ? 'not_regex' : 'regex', t.value as string)
      if (schema.operator === '=') c.anywhere = true
      return c
    }
    const parts: ValuePart[] = []
    const seen = new Set<string>()
    for (const part of t.parts as ValuePart[]) {
      const next = { v: canon(schema, known, f, part.v), wild: part.wild }
      if (seen.has(partKey(next))) continue
      seen.add(partKey(next))
      parts.push(next)
    }
    const c = C(f, 'eq', '')
    c.parts = parts
    shape(c, neg)
    return c
  }

  const parseOr = (): QueryNode | null => {
    const parts = [parseAnd()]
    while (toks[p]?.t === 'or') {
      p++
      parts.push(parseAnd())
    }
    const kept = parts.filter(Boolean) as QueryNode[]
    if (!kept.length) return null
    if (kept.length === 1) return kept[0]
    const g = G('OR', kept)
    g.spans = [spanOf(kept)]
    return g
  }

  const parseAnd = (): QueryNode | null => {
    const items: QueryNode[] = []
    while (toks[p] && toks[p].t !== 'or' && toks[p].t !== ')') {
      if (toks[p].t === 'and') {
        p++
        continue
      }
      const u = parseUnary()
      if (u) items.push(u)
    }
    if (!items.length) return null
    const merged = mergeSame(items)
    if (merged.length === 1) return merged[0]
    const g = G('AND', merged)
    g.spans = [spanOf(merged)]
    return g
  }

  const parseUnary = (): QueryNode | null => {
    const t = toks[p]
    if (t.t === '(') {
      if (++depth > MAX_DEPTH) throw Object.assign(new Error(`This filter nests brackets too deeply. The limit is ${MAX_DEPTH}.`), { at: [t.s, t.e] })
      p++
      const e = parseOr()
      const c = toks[p]
      if (!c || c.t !== ')') throw Object.assign(new Error('A ( is missing its closing ).'), { at: [t.s, t.e] })
      p++
      depth--
      if (e) {
        e.spans = [[t.s, c.e]]
        if (t.neg) negate(e)
      }
      return e
    }
    const node = termToNode(t)
    node.spans = [[t.s, t.e]]
    p++
    return node
  }

  try {
    const top = parseOr()
    if (p < toks.length) throw Object.assign(new Error('There is a ) without a matching (.'), { at: [toks[p].s, toks[p].e] })
    const kids = !top ? [] : top.type === 'group' && top.op === 'AND' ? top.children : [top]
    return { root: G('AND', kids), children: kids }
  } catch (e) {
    return { error: (e as Error).message, errorAt: (e as { at?: Span }).at, children: [] }
  }
}
