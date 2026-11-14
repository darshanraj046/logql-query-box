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
  if (f.color === 'level') return `var(--lqb-lv-${v.toLowerCase()}, var(--lqb-faint))`
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
      return { head: `How should ${f.label} match?`, items, extra: [], note: 'Press [Enter] to choose how it matches' }
    }
  }

  if (text === '-') {
    for (const f of labelFields(schema)) {
      const label = `-${f.primary}:`
      items.push({ kind: 'field', label, hint: f.excludeHint ?? `Hide ${f.label}`, replace, text: label, keep: true, icon: f.icon })
    }
    return { head: 'Exclude (NOT). You can also type -word to hide lines containing it', items, extra: [] }
  }

  const sep = eq ? ' ' : ':'
  const m = (eq ? FIELD_TERM_EQ : FIELD_TERM).exec(body)
  const name = m ? schema.alias.get(m[1].toLowerCase()) : undefined
  const op = m ? m[2].trim() : ''
  const regexOp = op === '=~' || op === '!~'
  const isLine = name === schema.lineField
  if (eq && m && name && regexOp) {
    const field = schema.fields.get(name) as ResolvedField
    const head = `${neg}${m[1]}${m[2]}`
    if (!m[3]) {
      const anchors: [string, string, number][] = [
        ['^', `${isLine ? 'Line starts' : 'Starts'} with the text you type next`, 1],
        ['$', `${isLine ? 'Line ends' : 'Ends'} with the text you type next`, 0],
        ['^$', `${isLine ? 'Line is' : 'Is'} exactly the text you type next`, 1]
      ]
      for (const [a, hint, at] of anchors) items.push({ kind: 'operator', label: a === '^$' ? '^ … $' : a === '^' ? '^ …' : '… $', hint, replace, text: head + a, caret: head.length + at, keep: true })
      const combine: [string, string, string, number][] = [
        ['… | …', 'Contains either one, for example timeout|refused', '|', 0],
        ['… .* …', 'Contains both, in that order', '.*', 0],
        ['\\b … \\b', 'Contains it as a whole word, so error does not match errors', '\\b\\b', 2],
        ['(?i) …', 'Ignores upper and lower case', '(?i)', 4],
        ['\\Q … \\E', 'Reads what you type as plain text, so . [ ( are not special', '\\Q\\E', 2]
      ]
      const extra: Suggestion[] = combine.map(([label, hint, text, at]) => ({ kind: 'operator', label, hint, replace, text: head + text, caret: head.length + at, keep: true }))
      return { head: 'Position', items, extra, extraHead: 'Combining text', note: isLine ? 'Or just type a regular expression, for example timeout|refused.' : `Or just type some text to match any ${field.label} that contains it.` }
    }
    if (!m[3].replace(/^\^/, '').replace(/\$$/, '')) return { head: '', items: [], extra: [], note: `Now type the ${isLine ? 'text to find' : `${field.label} text`}.` }
    if (isLine) return { head: '', items: [], extra: [] }
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
        ? 'Type a regular expression to find in the log line, for example timeout|refused.'
        : 'Type a regular expression found anywhere in the value, for example security. Use ^ and $ to anchor it, like ^checkout-'
    return { head: '', items: [], extra: [], note: m[3] ? undefined : note }
  }
  if (m && name && name !== schema.lineField) {
    const field = schema.fields.get(name) as ResolvedField
    const rest = m[3]
    const lc = rest.lastIndexOf(',')
    const part = (lc >= 0 ? rest.slice(lc + 1) : rest).trim().toLowerCase()
    const parts = tk.token?.parts ?? []
    const trailing = rest.endsWith(',')
    const last = trailing ? undefined : parts[parts.length - 1]
    const options = valueOptions(field, known)
    const lastLow = last && !last.wild ? last.v.toLowerCase() : ''
    const finished = eq && !!lastLow && options.some((o) => o.v.toLowerCase() === lastLow) && !options.some((o) => o.v.toLowerCase() !== lastLow && o.v.toLowerCase().includes(lastLow))
    const kept = trailing || finished ? parts : parts.slice(0, -1)
    const chosen = new Set(kept.map((p) => p.v.toLowerCase()))
    for (const t of tokenize(src, schema).toks) if (t.t === 'term' && t.field === name && t.s !== tk.s) t.parts?.forEach((p) => chosen.add(p.v.toLowerCase()))
    const all = options.filter((o) => !chosen.has(o.v.toLowerCase()))
    const pre = all.filter((o) => !part || o.v.toLowerCase().indexOf(part) === 0)
    const hits = finished ? all : eq && part ? [...pre, ...all.filter((o) => o.v.toLowerCase().indexOf(part) > 0)] : pre.length ? pre : all.filter((o) => o.v.toLowerCase().indexOf(part) >= 0)
    const counted = all.some((o) => o.n !== undefined)
    const cap = extras.limit && extras.limit > 0 ? extras.limit : hits.length
    const lead = eq ? `${neg}${m[1]} ${op} ` : `${neg}${m[1]}${m[2]}`
    const prior = eq ? kept.map((p) => `${p.wild ? p.v : quoteValue(p.v)}, `).join('') : lc >= 0 ? rest.slice(0, lc + 1) : ''
    for (const o of hits.slice(0, cap)) {
      items.push({
        kind: 'value',
        label: o.v,
        hint: counted ? `${(o.n ?? 0).toLocaleString('en-US')} lines` : '',
        color: colorOf(field, o.v),
        replace,
        text: `${lead}${prior}${quoteValue(o.v)}${eq ? '' : ' '}`,
        keep: eq || undefined,
        icon: field.valueIcons?.[o.v] ?? field.icon,
        iconColor: field.valueIcons?.[o.v] ? colorOf(field, o.v) : undefined
      })
    }
    const typed = (lc >= 0 ? rest.slice(lc + 1) : rest).trim()
    if (eq && !finished && typed.length > 1 && !typed.includes('*') && !all.some((o) => o.v.toLowerCase() === part) && hits.some((o) => o.v.toLowerCase().includes(part))) {
      items.push({ kind: 'value', label: `*${typed}*`, sub: `${op === '!=' ? 'Every' : 'Any'} ${field.label} containing “${typed}”`, replace, text: `${lead}${prior}*${typed}*`, keep: true, icon: field.icon })
    }
    return {
      head: finished ? `Add another ${field.label}` : `Values for ${field.label}`,
      field: name,
      items,
      extra: [],
      search: finished ? '' : typed,
      more: hits.length > cap ? hits.length - cap : undefined,
      count: eq && items.length ? hits.length : undefined,
      finished: finished || undefined,
      back: eq && !typed && !kept.length ? replace : undefined,
      note: !eq
        ? undefined
        : !options.length
          ? `Type the ${field.label} you want. Use * as a wildcard.`
          : !items.length
            ? undefined
            : finished
              ? 'Press [Space] to filter by another field'
              : !typed && !kept.length
                ? 'Press [Esc] to go back to fields'
                : 'Press [Enter] to pick a value, or [,] to add another'
    }
  }

  if (body) {
    const low = body.toLowerCase()
    for (const f of labelFields(schema)) {
      const label = `${f.primary}${sep}`
      if (label.toLowerCase().indexOf(low) === 0 && (eq || label.toLowerCase() !== low)) {
        items.push({ kind: 'field', label: neg + label.trimEnd(), hint: f.hint ?? `Filter by ${f.label}`, replace, text: neg + label, keep: true, icon: f.icon })
      }
    }
    if (eq && schema.fields.get(schema.lineField)?.aliases?.some((a) => a.toLowerCase().indexOf(low) === 0)) {
      const f = schema.fields.get(schema.lineField) as ResolvedField
      items.push({ kind: 'field', label: f.primary, hint: exampleOf(f, known), replace, text: `${neg}${f.primary} `, keep: true, icon: f.icon })
    }
    return { head: items.length ? 'Fields' : '', items, extra: [], note: eq && items.length ? 'Press [Enter] to pick a field, then choose a value' : undefined }
  }

  for (const f of eq ? [...schema.fields.values()] : labelFields(schema)) {
    if (f.name === schema.lineField && !f.aliases?.length) continue
    const label = `${f.primary}${sep}`
    items.push({ kind: 'field', label: label.trimEnd(), hint: exampleOf(f, known), replace, text: label, keep: true, icon: f.icon })
  }
  if (eq) {
    return { head: 'Fields', items, extra: [], note: 'Press [Enter] to pick a field, then choose a value' }
  }
  items.push({ kind: 'field', label: '-', hint: `Exclude, for example -${schema.excludeExample}`, replace, text: '-', keep: true })
  const extra: Suggestion[] = []
  for (const s of sortedSaved(extras.saved ?? []).slice(0, 5)) {
    extra.push({ kind: 'saved', label: s.name, sub: s.query, hint: s.pinned ? 'Pinned' : 'Saved', whole: s.query })
  }
  for (const q of (extras.recent ?? []).slice(0, 5)) extra.push({ kind: 'recent', label: q, hint: 'Recent', whole: q })
  return { head: 'Filter by', items, extra }
}
