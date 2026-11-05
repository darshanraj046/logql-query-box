import { chipText } from './chips'
import { compile, MAX_BRANCHES } from './compile'
import { activeValues, appendTerm, clearField, editSpans, facetEdit, termText } from './edit'
import { parse } from './parse'
import { isRiskyRegex, reEsc, toJsRegex } from './regex'
import { defaultSchema, resolveSchema, type ResolvedSchema, type Schema } from './schema'
import { suggest, tokenAtCaret, type KnownValues } from './suggest'
import { activeTree, evaluate, expandGroups, hasRiskyRegex, isNegative, problems, toFilter, valOf } from './tree'
import type { Analysis, CompileResult, Cond, FieldValues, LogRecord, ParseResult, QueryNode, Span, SuggestExtras, SuggestionList, UnknownValue, ValuePart } from './types'

export interface EngineOptions {
  schema?: Schema
  values?: FieldValues
  matchCase?: boolean
  maxBranches?: number
  baseSelector?: Record<string, string>
}

export interface Engine {
  schema: ResolvedSchema
  parse(query: string): ParseResult
  analyze(query: string): Analysis
  validate(query: string): string
  compile(tree: QueryNode | null): CompileResult
  evaluate(tree: QueryNode | null, record: LogRecord): boolean
  activeTree(node: QueryNode): QueryNode | null
  chipText(node: QueryNode): string
  isNegative(node: QueryNode): boolean
  highlightPattern(tree: QueryNode | null): RegExp | null
  suggest(query: string, caret: number, extras?: SuggestExtras): SuggestionList
  tokenAt(query: string, caret: number): string
  removeNode(query: string, node: QueryNode): string
  appendTerm(query: string, field: string, values: string[], negative?: boolean): string
  toggleValue(query: string, field: string, value: string, negative?: boolean): string
  clearField(query: string, field: string): string
  combine(query: string): string
  replaceValue(query: string, field: string, from: string, to: string, negative?: boolean): string
  activeValues(query: string, field: string, negative?: boolean): Set<string>
}

const NO_LOGQL: CompileResult = { branches: [], tooMany: false, count: 0 }

function indexValues(values: FieldValues = {}): KnownValues {
  const known: KnownValues = new Map()
  for (const [field, list] of Object.entries(values)) {
    const entries = new Map<string, number | undefined>()
    for (const item of list) {
      if (typeof item === 'string') entries.set(item, undefined)
      else entries.set(item.value, item.count)
    }
    known.set(field, entries)
  }
  return known
}

export function createEngine(options: EngineOptions = {}): Engine {
  const schema = resolveSchema(options.schema ?? defaultSchema, options.baseSelector)
  const known = indexValues(options.values)
  const matchCase = !!options.matchCase
  const maxBranches = options.maxBranches ?? MAX_BRANCHES
  const parseQuery = (q: string) => parse(q, schema, known)
  const compileTree = (tree: QueryNode | null) => compile(tree, schema, matchCase, maxBranches)
  const activeExpanded = (node: QueryNode) => {
    const tree = activeTree(node)
    return tree && expandGroups(tree, schema)
  }

  const toggleValue = (query: string, field: string, value: string, negative = false) => {
    let q = query
    if (activeValues(parseQuery(q), field, !negative).has(value)) q = facetEdit(q, parseQuery(q), schema, field, value, !negative)
    return facetEdit(q, parseQuery(q), schema, field, value, negative)
  }

  return {
    schema,
    parse: parseQuery,
    compile: compileTree,
    activeTree: activeExpanded,
    chipText: (node) => chipText(node, schema),
    isNegative,
    analyze(query) {
      const parsed = parseQuery(query)
      if (parsed.error) return { query, parsed, error: parsed.error, tree: null, logql: NO_LOGQL, filter: null, riskyRegex: false, unknownValues: [] }
      const found = problems(parsed.root as QueryNode)
      if (found.length) {
        const error = found.some((p) => p.startsWith('Loki'))
          ? 'One of the /regular expressions/ is not valid for Loki. Loki uses RE2, so lookaround and backreferences do not work.'
          : 'One of the /regular expressions/ is not valid.'
        return { query, parsed, error, tree: null, logql: NO_LOGQL, filter: null, riskyRegex: false, unknownValues: [] }
      }
      const tree = activeExpanded(parsed.root as QueryNode)
      const logql = compileTree(tree)
      const error = logql.tooMany
        ? `This filter expands into ${logql.count} OR branches. Use comma lists such as level:error,warn to stay under ${maxBranches}.`
        : null
      const unknownValues: UnknownValue[] = []
      for (const n of parsed.children) {
        if (n.type !== 'cond') continue
        const f = schema.fields.get(n.field)
        const names = [...new Set([...(f?.values ?? []), ...(known.get(n.field)?.keys() ?? [])])]
        if (!f || !names.length || n.field === schema.lineField) continue
        if (!n.parts) {
          const v = valOf(n)
          if ((n.op !== 'regex' && n.op !== 'not_regex') || isRiskyRegex(v)) continue
          const re = toJsRegex(v, false, !n.anywhere)
          if (names.some((name) => re.test(name))) continue
          const lit = v.replace(/^\^/, '').replace(/\$$/, '').toLowerCase()
          const matches = /^[\w.-]+$/.test(lit) ? names.filter((name) => name.toLowerCase().includes(lit)).slice(0, 3) : []
          unknownValues.push({ field: n.field, value: v, negative: isNegative(n), matches, regex: true })
          continue
        }
        for (const p of n.parts) {
          const low = p.v.toLowerCase()
          if (p.wild || !low || f.groups.has(low) || names.some((v) => v.toLowerCase() === low)) continue
          unknownValues.push({ field: n.field, value: p.v, negative: isNegative(n), matches: names.filter((v) => v.toLowerCase().includes(low)).slice(0, 3) })
        }
      }
      return { query, parsed, error, tree, logql, filter: tree ? toFilter(tree) : null, riskyRegex: !!tree && hasRiskyRegex(tree), unknownValues }
    },
    validate(query) {
      const parsed = parseQuery(query)
      if (parsed.error) return `This filter is not valid: ${parsed.error}`
      return problems(parsed.root as QueryNode).length ? 'A regular expression in this filter is not valid for Loki.' : ''
    },
    evaluate: (tree, record) => (tree ? evaluate(tree, record, schema, matchCase) : true),
    highlightPattern(tree) {
      const sources: string[] = []
      const walk = (n: QueryNode): void => {
        if (n.type === 'group') return n.children.forEach(walk)
        if (n.field !== schema.lineField) return
        if (n.op === 'contains') sources.push(reEsc(valOf(n)))
        else if (n.op === 'regex' && !isRiskyRegex(valOf(n))) sources.push(toJsRegex(valOf(n), false, false).source)
      }
      if (tree) walk(tree)
      if (!sources.length) return null
      try {
        return new RegExp(sources.join('|'), 'giu')
      } catch {
        return null
      }
    },
    suggest: (query, caret, extras) => suggest(query, caret, schema, known, extras),
    tokenAt: (query, caret) => tokenAtCaret(query, caret, schema).text,
    removeNode: (query, node) => editSpans(query, node.spans as Span[], '', schema),
    appendTerm: (query, field, values, negative = false) =>
      appendTerm(query, termText(schema, field, values.map((v) => ({ v, wild: false })), negative), schema),
    toggleValue,
    clearField: (query, field) => clearField(query, parseQuery(query), schema, field),
    combine(query) {
      let q = query
      for (let pass = 0; pass < 50; pass++) {
        const parsed = parseQuery(q)
        const node = parsed.error ? undefined : (parsed.children.find((n) => n.type === 'cond' && !!n.parts && (n.spans as Span[]).length > 1) as Cond | undefined)
        if (!node) return q
        q = editSpans(q, node.spans as Span[], termText(schema, node.field, node.parts as ValuePart[], isNegative(node)), schema)
      }
      return q
    },
    replaceValue(query, field, from, to, negative = false) {
      const parsed = parseQuery(query)
      const node = parsed.error ? undefined : (parsed.children.find((n) => n.type === 'cond' && n.field === field && isNegative(n) === negative && (n.parts ? n.parts.some((p) => p.v === from) : valOf(n) === from)) as Cond | undefined)
      if (!node) return query
      if (!node.parts) return editSpans(query, node.spans as Span[], termText(schema, field, [{ v: to, wild: to.includes('*') }], negative), schema)
      const parts = (node.parts as ValuePart[]).map((p) => (p.v === from ? { v: to, wild: to.includes('*') } : p))
      return editSpans(query, node.spans as Span[], termText(schema, field, parts, negative), schema)
    },
    activeValues: (query, field, negative = false) => activeValues(parseQuery(query), field, negative)
  }
}
