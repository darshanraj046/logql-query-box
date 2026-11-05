import { matchesEmpty, reEsc } from './regex'
import type { ResolvedSchema } from './schema'
import { isNegative, listOf, valOf } from './tree'
import type { CompileResult, Cond, QueryNode } from './types'

export const MAX_BRANCHES = 12

const INLINE_I = /^\(\?[imsU]*i[imsU]*(?:-[imsU]+)?\)/
const RAW_SAFE = /^[\w .:,;=-]+$/

function countBranches(n: QueryNode): number {
  if (n.type === 'cond') return 1
  const parts = n.children.map(countBranches)
  return n.op === 'OR' ? parts.reduce((a, b) => a + b, 0) : parts.reduce((a, b) => a * b, 1)
}

function dnf(n: QueryNode): Cond[][] {
  if (n.type === 'cond') return [[n]]
  const parts = n.children.map(dnf)
  if (n.op === 'OR') return parts.flat()
  const total = parts.reduce((product, p) => product * p.length, 1)
  const out: Cond[][] = []
  for (let k = 0; k < total; k++) {
    const branch: Cond[] = []
    let stride = total
    for (const p of parts) {
      stride /= p.length
      for (const c of p[Math.floor(k / stride) % p.length]) branch.push(c)
    }
    out.push(branch)
  }
  return out
}

export function logqlString(s: string): string {
  return `"${String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`
}

function pipelineMatcher(c: Cond): string {
  const n = c.field
  const v = valOf(c)
  switch (c.op) {
    case 'regex':
      return `${n}=~${logqlString(c.anywhere ? `^(?s:.*)(?:${v})(?s:.*)$` : `^(?:${v})$`)}`
    case 'not_regex':
      return `${n}!~${logqlString(c.anywhere ? `^(?s:.*)(?:${v})(?s:.*)$` : `^(?:${v})$`)}`
    case 'starts':
      return `${n}=~${logqlString(`^(?:${reEsc(v)}.*)$`)}`
    case 'ends':
      return `${n}=~${logqlString(`^(?:.*${reEsc(v)})$`)}`
    default:
      return labelMatcher(c)
  }
}

function labelMatcher(c: Cond): string {
  const n = c.field
  const v = valOf(c)
  const L = listOf(c)
  switch (c.op) {
    case 'eq':
      return `${n}=${logqlString(v)}`
    case 'neq':
      return `${n}!=${logqlString(v)}`
    case 'in':
      return `${n}=~${logqlString(L.map(reEsc).join('|'))}`
    case 'not_in':
      return `${n}!~${logqlString(L.map(reEsc).join('|'))}`
    case 'regex':
      return `${n}=~${logqlString(c.anywhere ? `.*(?:${v}).*` : v)}`
    case 'not_regex':
      return `${n}!~${logqlString(c.anywhere ? `.*(?:${v}).*` : v)}`
    case 'contains':
      return `${n}=~${logqlString(`.*${reEsc(v)}.*`)}`
    case 'not_contains':
      return `${n}!~${logqlString(`.*${reEsc(v)}.*`)}`
    case 'starts':
      return `${n}=~${logqlString(`${reEsc(v)}.*`)}`
    case 'ends':
      return `${n}=~${logqlString(`.*${reEsc(v)}`)}`
  }
}

function lineFilter(c: Cond, matchCase: boolean): string {
  const v = valOf(c)
  const pre = matchCase ? '' : '(?i)'
  const L = listOf(c)
  const userRegex = matchCase || INLINE_I.test(v) ? v : `(?i)${v}`
  switch (c.op) {
    case 'contains':
      return matchCase ? `|= ${logqlString(v)}` : `|~ ${logqlString(pre + reEsc(v))}`
    case 'not_contains':
      return matchCase ? `!= ${logqlString(v)}` : `!~ ${logqlString(pre + reEsc(v))}`
    case 'eq':
      return `|~ ${logqlString(`${pre}^${reEsc(v)}$`)}`
    case 'neq':
      return `!~ ${logqlString(`${pre}^${reEsc(v)}$`)}`
    case 'starts':
      return `|~ ${logqlString(`${pre}^${reEsc(v)}`)}`
    case 'ends':
      return `|~ ${logqlString(`${pre}${reEsc(v)}$`)}`
    case 'regex':
      return `|~ ${logqlString(userRegex)}`
    case 'not_regex':
      return `!~ ${logqlString(userRegex)}`
    case 'in':
      return `|~ ${logqlString(pre + L.map(reEsc).join('|'))}`
    case 'not_in':
      return `!~ ${logqlString(pre + L.map(reEsc).join('|'))}`
  }
}

function canAnchorStream(c: Cond): boolean {
  switch (c.op) {
    case 'eq':
    case 'contains':
    case 'starts':
    case 'ends':
      return valOf(c) !== ''
    case 'in':
      return listOf(c).every((v) => v !== '')
    case 'regex':
      return !matchesEmpty(valOf(c))
    default:
      return false
  }
}

function baseMatchers(schema: ResolvedSchema): string[] {
  return schema.baseSelector.filter(([, value]) => value !== '').map(([name, value]) => `${name}=${logqlString(value)}`)
}

function unwrap(n: QueryNode): QueryNode {
  return n.type === 'group' && n.children.length === 1 ? unwrap(n.children[0]) : n
}

function conjuncts(n: QueryNode): QueryNode[] {
  const u = unwrap(n)
  return u.type === 'group' && u.op === 'AND' ? u.children.flatMap(conjuncts) : [u]
}

function leaves(n: QueryNode): Cond[] {
  return n.type === 'cond' ? [n] : n.children.flatMap(leaves)
}

function lineRegex(c: Cond): string {
  const v = valOf(c)
  switch (c.op) {
    case 'eq':
    case 'neq':
      return `^${reEsc(v)}$`
    case 'starts':
      return `^${reEsc(v)}`
    case 'ends':
      return `${reEsc(v)}$`
    case 'regex':
    case 'not_regex':
      return v
    case 'in':
    case 'not_in':
      return listOf(c).map(reEsc).join('|')
    default:
      return reEsc(v)
  }
}

function parsedLineMatcher(c: Cond, matchCase: boolean): string {
  const body = lineRegex(c)
  const plain = c.op === 'contains' || c.op === 'not_contains'
  const pattern = plain ? `(?${matchCase ? '' : 'i'}s).*${body}.*` : `${matchCase ? '' : '(?i)'}^(?s:.*)(?:${body})(?s:.*)$`
  return `${c.field}${isNegative(c) ? '!~' : '=~'}${logqlString(pattern)}`
}

function labelExpr(n: QueryNode, schema: ResolvedSchema, matchCase: boolean, nested = false): string {
  const u = unwrap(n)
  if (u.type === 'cond') return u.field === schema.lineField ? parsedLineMatcher(u, matchCase) : pipelineMatcher(u)
  const body = u.children.map((ch) => labelExpr(ch, schema, matchCase, true)).join(u.op === 'OR' ? ' or ' : ' and ')
  return nested ? `(${body})` : body
}

function lineAlternatives(n: QueryNode): string[] | null {
  const u = unwrap(n)
  if (u.type === 'cond') {
    if (isNegative(u)) return null
    return [u.op === 'regex' ? `(?:${lineRegex(u)})` : lineRegex(u)]
  }
  if (u.op !== 'OR') return null
  const parts = u.children.map(lineAlternatives)
  return parts.every(Boolean) ? (parts as string[][]).flat() : null
}

function rawHint(n: QueryNode, schema: ResolvedSchema): string | null {
  const u = unwrap(n)
  if (u.type === 'group') {
    const hints = u.children.map((ch) => rawHint(ch, schema))
    if (u.op === 'OR') return hints.every(Boolean) ? hints.join('|') : null
    return hints.find(Boolean) ?? null
  }
  if (u.field !== schema.lineField || isNegative(u) || u.op === 'regex') return null
  const terms = u.op === 'in' ? listOf(u) : [valOf(u)]
  return terms.every((v) => RAW_SAFE.test(v)) ? terms.map(reEsc).join('|') : null
}

function fitsOneQuery(n: QueryNode, schema: ResolvedSchema): boolean {
  if (n.type === 'cond' || schema.parsedLine) return true
  const conds = leaves(n)
  if (conds.every((c) => c.field !== schema.lineField)) return true
  return conds.every((c) => c.field === schema.lineField) && lineAlternatives(n) !== null
}

function parserStage(schema: ResolvedSchema, fields: Set<string>): string {
  return schema.parser === 'json' ? `| json ${[...fields].join(', ')} | __error__=""` : `| ${schema.parser} | __error__=""`
}

function compileBranch(parts: QueryNode[], schema: ResolvedSchema, matchCase: boolean): string {
  const sel = baseMatchers(schema)
  const lines: string[] = []
  const labs: string[] = []
  const parsed = new Set<string>()
  let strong = sel.length > 0
  const pre = matchCase ? '' : '(?i)'
  const parse = (c: Cond) => {
    if (!schema.fields.get(c.field)?.indexed) parsed.add(c.field)
  }
  for (const part of parts) {
    const hint = schema.parsedLine ? rawHint(part, schema) : null
    if (hint) lines.push(`|~ ${logqlString(pre + hint)}`)
    if (part.type === 'group') {
      if (!schema.parsedLine && leaves(part).every((c) => c.field === schema.lineField)) {
        lines.push(`|~ ${logqlString(pre + (lineAlternatives(part) as string[]).join('|'))}`)
      } else {
        labs.push(`| ${labelExpr(part, schema, matchCase)}`)
        leaves(part).forEach(parse)
      }
    } else if (part.field === schema.lineField && !schema.parsedLine) lines.push(lineFilter(part, matchCase))
    else if (schema.fields.get(part.field)?.indexed) {
      sel.push(labelMatcher(part))
      if (canAnchorStream(part)) strong = true
    } else {
      labs.push(`| ${labelExpr(part, schema, matchCase)}`)
      parse(part)
    }
  }
  if (!strong) sel.push(`${schema.selectorField}=~".+"`)
  const parser = parsed.size && schema.parser ? [parserStage(schema, parsed)] : []
  return `{${sel.join(', ')}}${[...lines, ...parser, ...labs].map((s) => `\n  ${s}`).join('')}`
}

export function compile(tree: QueryNode | null, schema: ResolvedSchema, matchCase: boolean, maxBranches: number): CompileResult {
  if (!tree) return { branches: [compileBranch([], schema, matchCase)], tooMany: false, count: 1 }
  if (schema.parser) {
    const parts = conjuncts(tree)
    if (parts.every((p) => fitsOneQuery(p, schema))) return { branches: [compileBranch(parts, schema, matchCase)], tooMany: false, count: 1 }
  }
  const count = countBranches(tree)
  if (count > maxBranches) return { tooMany: true, count: Math.min(count, Number.MAX_SAFE_INTEGER), branches: [] }
  const branches = [...new Set(dnf(tree).map((b) => compileBranch(b, schema, matchCase)))]
  return { branches, tooMany: false, count: branches.length }
}
