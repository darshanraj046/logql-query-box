import { quoteValue } from './edit'
import type { ResolvedField, ResolvedSchema } from './schema'
import { tokenize } from './tokenize'
import type { SavedQuery, SuggestExtras, Suggestion, SuggestionList, Token } from './types'

const FIELD_TERM = /^([A-Za-z_][A-Za-z0-9_]*):([\s\S]*)$/
const NOTHING: SuggestionList = { head: '', items: [], extra: [] }

export type KnownValues = Map<string, Map<string, number | undefined>>

function hue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

function colorOf(f: ResolvedField, v: string): string {
  if (typeof f.color === 'function') return f.color(v)
  if (f.color === 'level') return `var(--lqb-lv-${v}, var(--lqb-faint))`
  if (f.color === 'hash') return `hsl(${hue(v)} 55% 55%)`
  return 'var(--lqb-accent)'
}

export function tokenAtCaret(src: string, caret: number, schema: ResolvedSchema): { s: number; e: number; text: string; inside: boolean; token?: Token } {
  const { toks, open } = tokenize(src, schema)
  if (open !== undefined && caret > open) return { s: caret, e: caret, text: '', inside: true }
  let found: Token | undefined
  for (const t of toks) {
    if (t.t === '(' || t.t === ')') continue
    if (t.quotes?.some(([a, b]) => a < caret && caret < b)) return { s: caret, e: caret, text: '', inside: true }
    if (t.s <= caret && caret <= t.e) found = t
  }
  if (!found) return { s: caret, e: caret, text: '', inside: false }
  return { s: found.s, e: found.e, text: src.slice(found.s, found.e), inside: false, token: found }
}

function valueNames(field: ResolvedField, known: KnownValues): string[] {
  return [...new Set([...(field.values ?? []), ...(known.get(field.name)?.keys() ?? [])])]
}

function valueOptions(field: ResolvedField, known: KnownValues): { v: string; n?: number }[] {
  const counts = known.get(field.name)
  return valueNames(field, known)
    .map((v) => ({ v, n: counts?.get(v) }))
    .sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
}

function labelFields(schema: ResolvedSchema): ResolvedField[] {
  return [...schema.fields.values()].filter((f) => f.kind === 'label')
}

function exampleOf(f: ResolvedField, known: KnownValues): string {
  if (typeof f.example === 'string') return f.example
  const values = valueNames(f, known)
  if (!values.length) return f.hint ?? ''
  return typeof f.example === 'function' ? f.example(values) : values.slice(0, 2).join(', ') + '…'
}

export function sortedSaved(saved: SavedQuery[]): SavedQuery[] {
  return saved.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.name.localeCompare(b.name))
}

export function suggest(src: string, caret: number, schema: ResolvedSchema, known: KnownValues, extras: SuggestExtras = {}): SuggestionList {
  const tk = tokenAtCaret(src, caret, schema)
  if (tk.inside) return NOTHING
  const items: Suggestion[] = []
  const text = tk.text
  const neg = text[0] === '-' ? '-' : ''
  const body = neg ? text.slice(1) : text
  const replace: [number, number] = [tk.s, tk.e]

  if (text === '-') {
    for (const f of labelFields(schema)) {
      const label = `-${f.primary}:`
      items.push({ kind: 'field', label, hint: f.excludeHint ?? `Hide ${f.label}`, replace, text: label, keep: true })
    }
    return { head: 'Exclude (NOT). You can also type -word to hide lines containing it', items, extra: [] }
  }

  const m = FIELD_TERM.exec(body)
  const name = m ? schema.alias.get(m[1].toLowerCase()) : undefined
  if (m && name && name !== schema.lineField) {
    const field = schema.fields.get(name) as ResolvedField
    const rest = m[2]
    const lc = rest.lastIndexOf(',')
    const prior = lc >= 0 ? rest.slice(0, lc + 1) : ''
    const part = (lc >= 0 ? rest.slice(lc + 1) : rest).toLowerCase()
    const parts = tk.token?.parts ?? []
    const chosen = new Set((rest.endsWith(',') ? parts : parts.slice(0, -1)).map((p) => p.v.toLowerCase()))
    const all = valueOptions(field, known).filter((o) => !chosen.has(o.v.toLowerCase()))
    const pre = all.filter((o) => !part || o.v.toLowerCase().indexOf(part) === 0)
    const hits = pre.length ? pre : all.filter((o) => o.v.toLowerCase().indexOf(part) >= 0)
    const counted = all.some((o) => o.n !== undefined)
    for (const o of hits) {
      items.push({
        kind: 'value',
        label: o.v,
        hint: counted ? `${(o.n ?? 0).toLocaleString('en-US')} lines` : '',
        color: colorOf(field, o.v),
        replace,
        text: `${neg}${m[1]}:${prior}${quoteValue(o.v)} `
      })
    }
    return { head: `Values for ${field.label}`, items, extra: [] }
  }

  if (body) {
    const low = body.toLowerCase()
    for (const f of labelFields(schema)) {
      const label = `${f.primary}:`
      if (label.toLowerCase().indexOf(low) === 0 && label.toLowerCase() !== low) {
        items.push({ kind: 'field', label: neg + label, hint: f.hint ?? `Filter by ${f.label}`, replace, text: neg + label, keep: true })
      }
    }
    return { head: items.length ? 'Fields' : '', items, extra: [] }
  }

  for (const f of labelFields(schema)) {
    const label = `${f.primary}:`
    items.push({ kind: 'field', label, hint: exampleOf(f, known), replace, text: label, keep: true })
  }
  items.push({ kind: 'field', label: '-', hint: `Exclude, for example -${schema.excludeExample}`, replace, text: '-', keep: true })
  const extra: Suggestion[] = []
  for (const s of sortedSaved(extras.saved ?? []).slice(0, 5)) {
    extra.push({ kind: 'saved', label: s.name, sub: s.query, hint: s.pinned ? 'Pinned' : 'Saved', whole: s.query })
  }
  for (const q of (extras.recent ?? []).slice(0, 5)) extra.push({ kind: 'recent', label: q, hint: 'Recent', whole: q })
  return { head: 'Filter by', items, extra }
}
