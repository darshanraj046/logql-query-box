export type Op =
  | 'contains'
  | 'not_contains'
  | 'eq'
  | 'neq'
  | 'starts'
  | 'ends'
  | 'regex'
  | 'not_regex'
  | 'in'
  | 'not_in'

export type Span = [number, number]

export interface ValuePart {
  v: string
  wild: boolean
}

export interface Cond {
  id: number
  type: 'cond'
  field: string
  op: Op
  value: string | string[]
  spans?: Span[]
  parts?: ValuePart[]
  anywhere?: boolean
}

export interface Group {
  id: number
  type: 'group'
  op: 'AND' | 'OR'
  children: QueryNode[]
  spans?: Span[]
}

export type QueryNode = Cond | Group

export interface ParseResult {
  root?: Group
  children: QueryNode[]
  error?: string
}

export interface Token {
  t: '(' | ')' | 'or' | 'and' | 'term' | 'skip'
  s: number
  e: number
  neg?: boolean
  field?: string | null
  kind?: 'word' | 'phrase' | 'regex'
  value?: string
  parts?: ValuePart[]
  quotes?: Span[]
}

export interface TokenizeResult {
  toks: Token[]
  error?: string
  open?: number
}

export interface CompileResult {
  branches: string[]
  tooMany: boolean
  count: number
}

export type ApiFilter =
  | { field: string; operator: Op; value: string | string[] }
  | { logic: 'AND' | 'OR'; filters: ApiFilter[] }

export interface Analysis {
  query: string
  parsed: ParseResult
  error: string | null
  tree: QueryNode | null
  logql: CompileResult
  filter: ApiFilter | null
  riskyRegex: boolean
  unknownValues: UnknownValue[]
}

export interface UnknownValue {
  field: string
  value: string
  negative: boolean
  matches: string[]
  regex?: boolean
}

export interface SavedQuery {
  id?: string
  name: string
  query: string
  pinned?: boolean
}

export interface Suggestion {
  kind: 'field' | 'value' | 'saved' | 'recent' | 'operator'
  label: string
  hint?: string
  sub?: string
  color?: string
  replace?: [number, number]
  text?: string
  keep?: boolean
  caret?: number
  whole?: string
}

export interface SuggestionList {
  head: string
  field?: string
  items: Suggestion[]
  extra: Suggestion[]
  extraHead?: string
  note?: string
}

export interface SuggestExtras {
  saved?: SavedQuery[]
  recent?: string[]
}

export type FieldValue = string | { value: string; count?: number }
export type FieldValues = Record<string, FieldValue[]>
export type LogRecord = Record<string, unknown>
