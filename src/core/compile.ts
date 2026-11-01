import { matchesEmpty, reEsc } from './regex'
import type { ResolvedSchema } from './schema'
import { listOf, valOf } from './tree'
import type { CompileResult, Cond, QueryNode } from './types'

export const MAX_BRANCHES = 12

const INLINE_I = /^\(\?[imsU]*i[imsU]*(?:-[imsU]+)?\)/

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
      return `${n}=~${logqlString(`^(?:${v})$`)}`
    case 'not_regex':
      return `${n}!~${logqlString(`^(?:${v})$`)}`
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
      return `${n}=~${logqlString(v)}`
    case 'not_regex':
      return `${n}!~${logqlString(v)}`
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

function compileBranch(conds: Cond[], schema: ResolvedSchema, matchCase: boolean): string {
  const sel: string[] = []
  const lines: string[] = []
  const labs: string[] = []
  let strong = false
  for (const c of conds) {
    if (c.field === schema.lineField) lines.push(lineFilter(c, matchCase))
    else if (schema.fields.get(c.field)?.indexed) {
      sel.push(labelMatcher(c))
      if (canAnchorStream(c)) strong = true
    } else labs.push(`| ${pipelineMatcher(c)}`)
  }
  if (!strong) sel.push(`${schema.selectorField}=~".+"`)
  return `{${sel.join(', ')}}${lines
    .concat(labs)
    .map((s) => `\n  ${s}`)
    .join('')}`
}

export function compile(tree: QueryNode | null, schema: ResolvedSchema, matchCase: boolean, maxBranches: number): CompileResult {
  if (!tree) return { branches: [`{${schema.selectorField}=~".+"}`], tooMany: false, count: 1 }
  const count = countBranches(tree)
  if (count > maxBranches) return { tooMany: true, count: Math.min(count, Number.MAX_SAFE_INTEGER), branches: [] }
  const branches = [...new Set(dnf(tree).map((b) => compileBranch(b, schema, matchCase)))]
  return { branches, tooMany: false, count: branches.length }
}
