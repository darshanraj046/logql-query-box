import type { ResolvedSchema } from './schema'
import { listOf, valOf } from './tree'
import type { QueryNode } from './types'

export function chipText(n: QueryNode, schema: ResolvedSchema): string {
  if (n.type === 'group') return `(${n.children.map((c) => chipText(c, schema)).join(n.op === 'OR' ? ' OR ' : ' ')})`
  const v = valOf(n)
  const L = listOf(n)
  if (n.field === schema.lineField) {
    if (n.op === 'contains') return `“${v}”`
    if (n.op === 'not_contains') return `not “${v}”`
    if (n.op === 'regex') return `/${v}/`
    return `not /${v}/`
  }
  const l = schema.fields.get(n.field)?.label ?? n.field
  switch (n.op) {
    case 'eq':
      return `${l} is ${v}`
    case 'neq':
      return `${l} is not ${v}`
    case 'in':
      return `${l} is ${L.join(' or ')}`
    case 'not_in':
      return `${l} is not ${L.join(' or ')}`
    case 'regex':
      return `${l} matches /${v}/`
    default:
      return `${l} does not match /${v}/`
  }
}

export function chipLabel(text: string): string {
  return text.length > 70 ? `${text.slice(0, 68)}…` : text
}
