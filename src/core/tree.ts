import { regexProblem, toJsRegex } from './regex'
import type { ResolvedSchema } from './schema'
import type { ApiFilter, Cond, Group, LogRecord, Op, QueryNode } from './types'

const FLIP: Partial<Record<Op, Op>> = {
  contains: 'not_contains',
  not_contains: 'contains',
  eq: 'neq',
  neq: 'eq',
  regex: 'not_regex',
  not_regex: 'regex',
  in: 'not_in',
  not_in: 'in'
}

export function splitList(s: string): string[] {
  return String(s)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function listOf(c: Cond): string[] {
  return Array.isArray(c.value) ? c.value : splitList(c.value)
}

export function valOf(c: Cond): string {
  if (Array.isArray(c.value)) return c.value[0] == null ? '' : String(c.value[0])
  return String(c.value == null ? '' : c.value)
}

export function isEmpty(c: Cond): boolean {
  if (c.op === 'in' || c.op === 'not_in') return listOf(c).length === 0
  return valOf(c).trim() === ''
}

export function condProblem(c: Cond): string | null {
  if (c.op !== 'regex' && c.op !== 'not_regex') return null
  const p = valOf(c)
  return p ? regexProblem(p) : null
}

export function activeTree(n: QueryNode): QueryNode | null {
  if (n.type === 'cond') return !isEmpty(n) && !condProblem(n) ? n : null
  const kids = n.children.map(activeTree).filter(Boolean) as QueryNode[]
  return kids.length ? { id: n.id, type: 'group', op: n.op, children: kids } : null
}

export function problems(n: QueryNode): string[] {
  if (n.type === 'cond') {
    const p = condProblem(n)
    return p ? [p] : []
  }
  return n.children.flatMap(problems)
}

export function negate(n: QueryNode): QueryNode {
  if (n.type === 'cond') {
    n.op = FLIP[n.op] ?? n.op
    return n
  }
  n.op = n.op === 'AND' ? 'OR' : 'AND'
  n.children.forEach(negate)
  return n
}

export function isNegative(n: QueryNode): boolean {
  return n.type === 'cond' && (n.op === 'neq' || n.op === 'not_in' || n.op === 'not_contains' || n.op === 'not_regex')
}

function testCond(c: Cond, r: LogRecord, schema: ResolvedSchema, matchCase: boolean): boolean {
  const raw = r[c.field]
  const hay = String(raw == null ? '' : raw)
  const isLine = c.field === schema.lineField
  const ci = isLine && !matchCase
  const H = ci ? hay.toLowerCase() : hay
  const N = (s: string) => (ci ? String(s).toLowerCase() : String(s))
  const v = valOf(c)
  switch (c.op) {
    case 'contains':
      return H.indexOf(N(v)) >= 0
    case 'not_contains':
      return H.indexOf(N(v)) < 0
    case 'eq':
      return H === N(v)
    case 'neq':
      return H !== N(v)
    case 'starts':
      return H.indexOf(N(v)) === 0
    case 'ends':
      return H.length >= N(v).length && H.slice(H.length - N(v).length) === N(v)
    case 'regex':
      return toJsRegex(v, ci, !isLine).test(hay)
    case 'not_regex':
      return !toJsRegex(v, ci, !isLine).test(hay)
    case 'in':
      return isLine ? listOf(c).some((x) => H.indexOf(N(x)) >= 0) : listOf(c).indexOf(hay) >= 0
    case 'not_in':
      return isLine ? !listOf(c).some((x) => H.indexOf(N(x)) >= 0) : listOf(c).indexOf(hay) < 0
  }
}

export function evaluate(n: QueryNode, r: LogRecord, schema: ResolvedSchema, matchCase: boolean): boolean {
  if (n.type === 'cond') return testCond(n, r, schema, matchCase)
  if (n.op === 'OR') return n.children.some((ch) => evaluate(ch, r, schema, matchCase))
  return n.children.every((ch) => evaluate(ch, r, schema, matchCase))
}

export function toFilter(n: QueryNode): ApiFilter {
  if (n.type === 'cond') return { field: n.field, operator: n.op, value: n.op === 'in' || n.op === 'not_in' ? listOf(n) : valOf(n) }
  return { logic: n.op, filters: n.children.map(toFilter) }
}

export function isGroup(n: QueryNode): n is Group {
  return n.type === 'group'
}
