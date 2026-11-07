import { quoteValue } from './edit'
import type { ResolvedField, ResolvedSchema } from './schema'
import { isRiskyRegex, toJsRegex } from './regex'
import { tokenize } from './tokenize'
import type { SavedQuery, SuggestExtras, Suggestion, SuggestionList, Token } from './types'

const FIELD_TERM = /^([A-Za-z_][A-Za-z0-9_.]*)(:)([\s\S]*)$/
const FIELD_TERM_EQ = /^([A-Za-z_][A-Za-z0-9_.]*)(\s*(?:!=|!~|=~|=|:)\s*)([\s\S]*)$/
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
  const eq = schema.operator === '='

  if (eq && !text) {
    const gap = (t?: Token) => !!t && /^\s+$/.test(src.slice(t.e, caret))
    const lead = tokenize(src.slice(0, caret), schema)
      .toks.filter((t) => t.t !== 'skip')
      .pop()
    const target = lead && gap(lead) && lead.t === 'term' && !lead.field && lead.kind === 'word' ? schema.alias.get((lead.value as string).toLowerCase()) : undefined
    if (lead && target) {
      const f = schema.fields.get(target) as ResolvedField
      const choices: [string, string][] =
        target === schema.lineField
          ? [
              ['=', 'Contains this text. Use * as a wildcard'],
              ['!=', 'Does not contain this text'],
              ['=~', 'Matches a pattern (regular expression)'],
              ['!~', 'Does not match a pattern']
            ]
          : [
              ['=', 'Is one of the values you pick'],
              ['!=', 'Is not one of the values you pick'],
              ['=~', 'Contains some text, or matches a pattern'],
              ['!~', 'Does not contain the text or match the pattern']
            ]
      for (const [o, hint] of choices) items.push({ kind: 'operator', label: `${lead.value} ${o}`, hint, replace: [lead.s, caret], text: `${src.slice(lead.s, lead.e)} ${o} `, keep: true })
      return { head: `How should ${f.label} match?`, items, extra: [] }
    }
  }

  if (text === '-') {
    for (const f of labelFields(schema)) {
      const label = `-${f.primary}:`
      items.push({ kind: 'field', label, hint: f.excludeHint ?? `Hide ${f.label}`, replace, text: label, keep: true })
    }
    return { head: 'Exclude (NOT). You can also type -word to hide lines containing it', items, extra: [] }
  }

  const sep = eq ? ' ' : ':'
  const m = (eq ? FIELD_TERM_EQ : FIELD_TERM).exec(body)
  const name = m ? schema.alias.get(m[1].toLowerCase()) : undefined
  const op = m ? m[2].trim() : ''
  const regexOp = op === '=~' || op === '!~'
  const isLine = name === schema.lineField
  if (eq && m && name && regexOp && !isLine) {
    const field = schema.fields.get(name) as ResolvedField
    const head = `${neg}${m[1]}${m[2]}`
    if (!m[3]) {
      const anchors: [string, string, number][] = [
        ['^', `Starts with the text you type next`, 1],
        ['$', `Ends with the text you type next`, 0],
        ['^$', `Is exactly the text you type next`, 1]
      ]
      for (const [a, hint, at] of anchors) items.push({ kind: 'operator', label: a === '^$' ? '^ … $' : a === '^' ? '^ …' : '… $', hint, replace, text: head + a, caret: head.length + at, keep: true })
      return { head: 'Pattern', items, extra: [], note: `Or just type some text to match any ${field.label} that contains it.` }
    }
    if (!m[3].replace(/^\^/, '').replace(/\$$/, '')) return { head: '', items: [], extra: [], note: `Now type the ${field.label} text.` }
    const names = valueNames(field, known)
    if (!names.length) return NOTHING
    let hits: string[] = []
    try {
      if (isRiskyRegex(m[3])) return NOTHING
      const re = toJsRegex(m[3], false, false)
      hits = names.filter((v) => re.test(v))
    } catch {
      return { head: '', items: [], extra: [], note: 'This is not a complete pattern yet.' }
    }
    const shown = hits.slice(0, 3).join(', ') + (hits.length > 3 ? ` and ${hits.length - 3} more` : '')
    return { head: '', items: [], extra: [], note: hits.length ? `Matches ${hits.length} of ${names.length}: ${shown}` : `Matches no ${field.label}. ^ means starts with and $ means ends with, so ^text$ needs an exact name.` }
  }
  if (eq && m && name && (regexOp || isLine)) {
    const note = !regexOp
      ? 'Type text to find in the log line. Use * as a wildcard and "quotes" for an exact phrase.'
      : isLine
        ? 'Type a regular expression (RE2) to find in the log line, for example timeout|refused.'
        : 'Type a regular expression (RE2) found anywhere in the value, for example security. Use ^ and $ to anchor it, like ^checkout-'
    return { head: '', items: [], extra: [], note: m[3] ? undefined : note }
  }
  if (m && name && name !== schema.lineField) {
    const field = schema.fields.get(name) as ResolvedField
    const rest = m[3]
    const lc = rest.lastIndexOf(',')
    const prior = lc >= 0 ? rest.slice(0, lc + 1) : ''
    const part = (lc >= 0 ? rest.slice(lc + 1) : rest).toLowerCase()
    const parts = tk.token?.parts ?? []
    const chosen = new Set((rest.endsWith(',') ? parts : parts.slice(0, -1)).map((p) => p.v.toLowerCase()))
    const all = valueOptions(field, known).filter((o) => !chosen.has(o.v.toLowerCase()))
    const pre = all.filter((o) => !part || o.v.toLowerCase().indexOf(part) === 0)
    const hits = eq && part ? [...pre, ...all.filter((o) => o.v.toLowerCase().indexOf(part) > 0)] : pre.length ? pre : all.filter((o) => o.v.toLowerCase().indexOf(part) >= 0)
    const counted = all.some((o) => o.n !== undefined)
    const cap = extras.limit && extras.limit > 0 ? extras.limit : hits.length
    for (const o of hits.slice(0, cap)) {
      items.push({ kind: 'value', label: o.v, hint: counted ? `${(o.n ?? 0).toLocaleString('en-US')} lines` : '', color: colorOf(field, o.v), replace, text: `${neg}${m[1]}${m[2]}${prior}${quoteValue(o.v)} `, keep: eq || undefined })
    }
    const typed = (lc >= 0 ? rest.slice(lc + 1) : rest).trim()
    if (eq && typed.length > 1 && !typed.includes('*') && !all.some((o) => o.v.toLowerCase() === part) && hits.some((o) => o.v.toLowerCase().includes(part))) {
      items.push({ kind: 'value', label: `*${typed}*`, sub: `${op === '!=' ? 'Every' : 'Any'} ${field.label} containing “${typed}”`, replace, text: `${neg}${m[1]}${m[2]}${prior}*${typed}* `, keep: true })
    }
    return { head: `Values for ${field.label}`, field: name, items, extra: [], search: typed, more: hits.length > cap ? hits.length - cap : undefined }
  }

  if (body) {
    const low = body.toLowerCase()
    for (const f of labelFields(schema)) {
      const label = `${f.primary}${sep}`
      if (label.toLowerCase().indexOf(low) === 0 && (eq || label.toLowerCase() !== low)) {
        items.push({ kind: 'field', label: neg + label.trimEnd(), hint: f.hint ?? `Filter by ${f.label}`, replace, text: neg + label, keep: true })
      }
    }
    if (eq && schema.fields.get(schema.lineField)?.aliases?.some((a) => a.toLowerCase().indexOf(low) === 0)) {
      const f = schema.fields.get(schema.lineField) as ResolvedField
      items.push({ kind: 'field', label: f.primary, hint: exampleOf(f, known), replace, text: `${neg}${f.primary} `, keep: true })
    }
    return { head: items.length ? 'Fields' : '', items, extra: [] }
  }

  for (const f of labelFields(schema)) {
    const label = `${f.primary}${sep}`
    items.push({ kind: 'field', label: label.trimEnd(), hint: exampleOf(f, known), replace, text: label, keep: true })
  }
  if (eq) {
    const f = schema.fields.get(schema.lineField) as ResolvedField
    if (f.aliases?.length) items.push({ kind: 'field', label: f.primary, hint: exampleOf(f, known), replace, text: `${f.primary} `, keep: true })
    return { head: 'Fields', items, extra: [] }
  }
  items.push({ kind: 'field', label: '-', hint: `Exclude, for example -${schema.excludeExample}`, replace, text: '-', keep: true })
  const extra: Suggestion[] = []
  for (const s of sortedSaved(extras.saved ?? []).slice(0, 5)) {
    extra.push({ kind: 'saved', label: s.name, sub: s.query, hint: s.pinned ? 'Pinned' : 'Saved', whole: s.query })
  }
  for (const q of (extras.recent ?? []).slice(0, 5)) extra.push({ kind: 'recent', label: q, hint: 'Recent', whole: q })
  return { head: 'Filter by', items, extra }
}
