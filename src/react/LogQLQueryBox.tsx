import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode
} from 'react'
import { chipLabel, createEngine, type Analysis, type Span, type Engine, type FieldValue, type FieldValues, type SavedQuery, type Schema, type Suggestion } from '../core'
import { HelpDialog } from './HelpDialog'
import { defaultExamples, defaultLabels, defaultNotes, defaultSyntax, type Labels } from './labels'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const RECENT_LIMIT = 8
const CHIP_LIMIT = 50
const MENU_GAP = 6
const MENU_MAX = 300
const MENU_MIN = 120
const ICON = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export interface LogQLQueryBoxHandle {
  focus(): void
  getQuery(): string
  setQuery(query: string, options?: { run?: boolean }): void
  execute(): boolean
  toggleValue(field: string, value: string, negative?: boolean): void
  clearField(field: string): void
  appendTerm(field: string, values: string[], negative?: boolean): void
  openQueries(): void
  closeQueries(): void
}

export type LogQLQueryBoxSlot = 'bar' | 'field' | 'input' | 'queriesButton' | 'queriesPanel' | 'suggestions' | 'run'

export interface LogQLQueryBoxProps {
  variant?: 'classic' | 'bar'
  classNames?: Partial<Record<LogQLQueryBoxSlot, string>>
  showQueries?: boolean
  showRun?: boolean
  showValueCounts?: boolean
  savedCount?: number
  savedLoading?: boolean
  onSelectSaved?: (saved: SavedQuery) => void
  onPinSaved?: (saved: SavedQuery, pinned: boolean) => void
  onEditSaved?: (saved: SavedQuery) => void
  onUpdateSaved?: (saved: SavedQuery, changes: { name: string; query: string }) => unknown
  onSaveQuery?: (draft: { name: string; query: string; pinned: boolean }, existing?: SavedQuery) => unknown
  onDeleteSaved?: (saved: SavedQuery) => void
  onCreateAlert?: (query: string, saved?: SavedQuery) => void
  onSavedSearch?: (text: string) => void
  value?: string
  defaultValue?: string
  onChange?: (query: string, analysis: Analysis) => void
  onExecute?: (analysis: Analysis) => void
  onSave?: (query: string, existing?: SavedQuery) => void
  engine?: Engine
  schema?: Schema
  values?: FieldValues
  loadValues?: (field: string, context: { signal: AbortSignal }) => Promise<FieldValue[]>
  matchCase?: boolean
  maxBranches?: number
  baseSelector?: Record<string, string>
  saved?: SavedQuery[]
  recent?: string[]
  recentStorageKey?: string | null
  examples?: string[]
  syntax?: [string, string][]
  notes?: string[]
  labels?: Partial<Labels>
  description?: ReactNode | false
  actions?: ReactNode
  statusText?: ReactNode
  dirty?: boolean
  running?: boolean
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  rows?: number
  showHelp?: boolean
  showLogql?: boolean
  defaultLogqlOpen?: boolean
  executeOnMount?: boolean
  globalShortcuts?: boolean
  theme?: 'auto' | 'light' | 'dark'
  className?: string
  style?: CSSProperties
}

function readRecent(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeRecent(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    return
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

export const LogQLQueryBox = forwardRef<LogQLQueryBoxHandle, LogQLQueryBoxProps>(function LogQLQueryBox(props, ref) {
  const {
    value,
    defaultValue = '',
    onChange,
    onExecute,
    onSave,
    schema,
    values,
    loadValues,
    matchCase,
    maxBranches,
    baseSelector,
    saved,
    recent,
    recentStorageKey = 'logql-query-box.recent',
    examples,
    syntax,
    notes,
    description,
    actions,
    statusText,
    dirty = false,
    running = false,
    disabled = false,
    readOnly = false,
    autoFocus = false,
    variant = 'classic',
    classNames = {},
    showQueries = true,
    showRun = true,
    showValueCounts = true,
    savedCount,
    savedLoading = false,
    onSelectSaved,
    onPinSaved,
    onEditSaved,
    onUpdateSaved,
    onSaveQuery,
    onDeleteSaved,
    onCreateAlert,
    onSavedSearch,
    showHelp = false,
    showLogql = false,
    defaultLogqlOpen = false,
    executeOnMount = false,
    globalShortcuts = false,
    theme = 'auto',
    className,
    style
  } = props
  const bar = variant === 'bar'
  const rows = props.rows ?? (bar ? 1 : 2)
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels])
  const baseKey = JSON.stringify(baseSelector)
  const [loaded, setLoaded] = useState<FieldValues>({})
  const [loading, setLoading] = useState<string[]>([])
  const allValues = useMemo(() => ({ ...values, ...loaded }), [values, loaded])
  const engine = useMemo(() => props.engine ?? createEngine({ schema, values: allValues, matchCase, maxBranches, baseSelector }), [props.engine, schema, allValues, matchCase, maxBranches, baseKey])

  const controlled = value !== undefined
  const [inner, setInner] = useState(defaultValue)
  const query = controlled ? value : inner
  const [ran, setRan] = useState(query)
  const [checked, setChecked] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ caret: number; at: number } | null>(null)
  const [logqlOpen, setLogqlOpen] = useState(defaultLogqlOpen)
  const [helpOpen, setHelpOpen] = useState(false)
  const [copied, setCopied] = useState<{ index: number; text: string } | null>(null)
  const [storedRecent, setStoredRecent] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const [qOpen, setQOpen] = useState(false)
  const [qText, setQText] = useState('')

  const qBtnRef = useRef<HTMLButtonElement>(null)
  const qPanelRef = useRef<HTMLDivElement>(null)
  const hlRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountRan = useRef(false)
  const loader = useRef(loadValues)
  const requested = useRef(new Set<string>())
  const loadAbort = useRef<AbortController | null>(null)
  loader.current = loadValues

  const baseId = useId()
  const listId = `${baseId}-list`
  const errorId = `${baseId}-error`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const analysis = useMemo(() => engine.analyze(query), [engine, query])
  const recentList = recent ?? storedRecent
  const interactive = !disabled && !readOnly

  const sugg = useMemo(() => (menu && interactive ? engine.suggest(query, menu.caret, bar ? {} : { saved, recent: recentList }) : null), [menu, interactive, engine, query, saved, recentList, bar])
  const items = useMemo<Suggestion[]>(() => (sugg ? [...sugg.items, ...sugg.extra] : []), [sugg])
  const open = items.length > 0
  const at = menu ? Math.min(menu.at, items.length - 1) : -1
  const valueField = sugg?.field
  const waiting = !!valueField && loading.includes(valueField)
  const note = sugg?.note
  const shown = open || waiting || !!note

  const usable = (text: string) => [...text.matchAll(/(?:^|[\s(`-])([A-Za-z_][A-Za-z0-9_]*):/g)].every((m) => engine.schema.alias.has(m[1].toLowerCase()))
  const shownExamples = examples ?? defaultExamples.filter(usable)
  const shownSyntax = syntax ?? defaultSyntax.filter((s) => usable(s[0]))
  const shownNotes = notes ?? defaultNotes.filter(usable)

  useEffect(() => {
    if (recent === undefined && recentStorageKey) setStoredRecent(readRecent(recentStorageKey))
  }, [recent, recentStorageKey])

  useEffect(() => {
    const controller = new AbortController()
    loadAbort.current = controller
    requested.current.clear()
    setLoaded((x) => (Object.keys(x).length ? {} : x))
    setLoading((x) => (x.length ? [] : x))
    return () => controller.abort()
  }, [baseKey])

  useEffect(() => {
    const load = loader.current
    const controller = loadAbort.current
    if (!valueField || !load || !controller || props.engine || requested.current.has(valueField)) return
    const field = valueField
    requested.current.add(field)
    setLoading((x) => [...x, field])
    const finish = (list?: FieldValue[]) => {
      if (controller.signal.aborted) return
      if (Array.isArray(list)) setLoaded((x) => ({ ...x, [field]: list }))
      else requested.current.delete(field)
      setLoading((x) => x.filter((f) => f !== field))
    }
    Promise.resolve()
      .then(() => load(field, { signal: controller.signal }))
      .then(finish, () => finish())
  }, [valueField, baseKey, props.engine])

  useIsoLayoutEffect(() => {
    if (pendingCaret.current === null) return
    const el = inputRef.current
    const pos = pendingCaret.current
    pendingCaret.current = null
    if (el) {
      el.focus()
      el.setSelectionRange(pos, pos)
    }
  })

  useIsoLayoutEffect(() => {
    const list = listRef.current
    if (!shown || !list || !('showPopover' in list)) return
    list.setAttribute('popover', 'manual')
    list.showPopover()
  }, [shown])

  useIsoLayoutEffect(() => {
    const list = listRef.current
    const anchor = wrapRef.current
    if (!shown || !list || !anchor) return
    const place = () => {
      const box = anchor.getBoundingClientRect()
      const below = window.innerHeight - box.bottom - MENU_GAP * 2
      const above = box.top - MENU_GAP * 2
      const upward = below < Math.min(list.scrollHeight, MENU_MAX) && above > below
      list.style.left = `${box.left}px`
      list.style.width = `${box.width}px`
      list.style.top = upward ? 'auto' : `${box.bottom + MENU_GAP}px`
      list.style.bottom = upward ? `${window.innerHeight - box.top + MENU_GAP}px` : 'auto'
      list.style.maxHeight = `${Math.max(MENU_MIN, Math.min(MENU_MAX, upward ? above : below))}px`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [shown, items, waiting])

  const [draft, setDraft] = useState<{ name: string; pinned: boolean; error: string; busy: boolean } | null>(null)
  const [removing, setRemoving] = useState<{ key: string; error: string; busy: boolean } | null>(null)
  const [editing, setEditing] = useState<{ key: string; name: string; query: string; error: string; busy: boolean } | null>(null)
  const saveBtnRef = useRef<HTMLButtonElement>(null)
  const savePopRef = useRef<HTMLDivElement>(null)
  const expanded = bar && (focused || !!draft) && !qOpen && !!query

  useEffect(() => {
    if (qOpen) return
    setEditing(null)
    setRemoving(null)
  }, [qOpen])

  useIsoLayoutEffect(() => {
    const pop = savePopRef.current
    const btn = saveBtnRef.current
    if (!draft || !pop || !btn) return
    if ('showPopover' in pop && !pop.matches(':popover-open')) {
      pop.setAttribute('popover', 'manual')
      pop.showPopover()
    }
    const place = () => {
      const box = btn.getBoundingClientRect()
      const width = Math.min(360, window.innerWidth - 16)
      pop.style.width = `${width}px`
      pop.style.left = `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`
      pop.style.top = `${box.bottom + MENU_GAP}px`
    }
    place()
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!pop.contains(t) && !btn.contains(t)) setDraft(null)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', outside)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', outside)
    }
  }, [!!draft])
  const summarize = bar && !expanded && !!query
  const sumRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ hidden: 0, over: false })

  useIsoLayoutEffect(() => {
    const el = sumRef.current
    if (!summarize || !el) return
    const measure = () => {
      const width = el.clientWidth
      let hidden = 0
      el.querySelectorAll<HTMLElement>('.lqb-piece').forEach((p) => {
        if (p.offsetLeft + p.offsetWidth > width + 1) hidden++
      })
      const over = el.scrollWidth > width + 1
      setFit((f) => (f.hidden === hidden && f.over === over ? f : { hidden, over }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [summarize, query])

  useIsoLayoutEffect(() => {
    const el = inputRef.current
    if (!bar || !el) return
    el.style.height = ''
    if (expanded) el.style.height = `${Math.min(260, Math.max(el.scrollHeight, el.offsetHeight))}px`
  }, [bar, expanded, query])

  useIsoLayoutEffect(() => {
    const panel = qPanelRef.current
    const btn = qBtnRef.current
    if (!qOpen || !panel || !btn) return
    if ('showPopover' in panel) {
      panel.setAttribute('popover', 'manual')
      panel.showPopover()
    }
    const place = () => {
      const box = btn.getBoundingClientRect()
      const width = Math.min(400, window.innerWidth - 16)
      panel.style.width = `${width}px`
      panel.style.left = `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`
      panel.style.top = `${box.bottom + MENU_GAP + 4}px`
      panel.style.maxHeight = `${Math.max(200, Math.min(520, window.innerHeight - box.bottom - MENU_GAP * 3))}px`
    }
    place()
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.contains(t) && !btn.contains(t)) setQOpen(false)
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('mousedown', outside)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('mousedown', outside)
    }
  }, [qOpen])

  useEffect(() => {
    if (!open || at < 0) return
    document.getElementById(optionId(at))?.scrollIntoView?.({ block: 'nearest' })
  }, [open, at])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const change = (next: string) => {
    if (!controlled) setInner(next)
    onChange?.(next, engine.analyze(next))
  }

  const remember = (q: string) => {
    const text = q.trim()
    if (!text || recent !== undefined || !recentStorageKey) return
    const next = [text, ...readRecent(recentStorageKey).filter((x) => x !== text)].slice(0, RECENT_LIMIT)
    writeRecent(recentStorageKey, next)
    setStoredRecent(next)
  }

  const execute = (raw: string = query): boolean => {
    const q = engine.schema.operator === '=' ? engine.combine(raw) : raw
    const result = engine.analyze(q)
    if (result.error) return false
    if (q !== raw) change(q)
    setRan(q)
    setChecked(q)
    remember(q)
    onExecute?.(result)
    return true
  }

  const commit = (q: string) => {
    change(q)
    execute(q)
  }

  const openMenu = () => {
    const el = inputRef.current
    if (!el || !interactive) return
    setMenu({ caret: el.selectionStart ?? el.value.length, at: 0 })
  }

  const accept = (i: number) => {
    const it = items[i]
    if (!it) return
    if (it.whole != null) {
      setMenu(null)
      commit(it.whole)
      return
    }
    const [s, e] = it.replace as [number, number]
    const text = it.text as string
    const pos = s + (it.caret ?? text.length)
    pendingCaret.current = pos
    change(query.slice(0, s) + text + query.slice(e))
    setMenu(it.keep ? { caret: pos, at: 0 } : null)
  }

  const currentToken = () => engine.tokenAt(query, inputRef.current?.selectionStart ?? query.length)

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown') {
      if (open) {
        e.preventDefault()
        setMenu((m) => m && { ...m, at: (at + 1) % items.length })
      } else if (!query.includes('\n')) {
        e.preventDefault()
        openMenu()
      }
    } else if (e.key === 'ArrowUp') {
      if (open) {
        e.preventDefault()
        setMenu((m) => m && { ...m, at: (at - 1 + items.length) % items.length })
      }
    } else if (e.key === 'Tab') {
      if (open && !e.shiftKey && (currentToken() || items[at]?.kind === 'operator')) {
        e.preventDefault()
        accept(at)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const it = open ? items[at] : undefined
      const cur = currentToken()
      if (it?.kind === 'value' && (cur.indexOf(':') > 0 || (engine.schema.operator === '=' && cur.indexOf('=') > 0)) && it.text?.trim() !== cur) accept(at)
      else if (it?.whole != null && !cur && !query.trim()) accept(at)
      else {
        setMenu(null)
        if (!running) execute()
      }
    } else if (e.key === 'Escape') {
      if (shown) {
        e.stopPropagation()
        setMenu(null)
      } else {
        inputRef.current?.blur()
      }
    }
  }

  useEffect(() => {
    if (!globalShortcuts) return
    const handler = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = (target.tagName || '').toLowerCase()
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) return
      if (e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === '?' && showHelp) {
        setHelpOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [globalShortcuts, showHelp])

  useEffect(() => {
    if (!executeOnMount || mountRan.current) return
    mountRan.current = true
    execute(query)
  })

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    getQuery: () => query,
    setQuery: (q, options) => (options?.run === false ? change(q) : commit(q)),
    execute: () => execute(),
    toggleValue: (field, v, negative) => commit(engine.toggleValue(query, field, v, negative)),
    clearField: (field) => commit(engine.clearField(query, field)),
    appendTerm: (field, list, negative) => commit(engine.appendTerm(query, field, list, negative)),
    openQueries: () => setQOpen(true),
    closeQueries: () => setQOpen(false)
  }))

  const savedMatch = query.trim() ? saved?.find((s) => s.query.trim() === query.trim()) : undefined
  const isDirty = query !== ran || dirty
  const blocked = !!analysis.error
  const status = blocked ? labels.fixFilter : (statusText ?? (query !== ran ? labels.filterChanged : ''))

  const closeHelp = () => {
    setHelpOpen(false)
    helpButtonRef.current?.focus()
  }

  const copyBranch = async (index: number, text: string) => {
    const ok = await copyText(text)
    clearTimeout(copyTimer.current)
    setCopied({ index, text: ok ? labels.copied : labels.copyFailed })
    copyTimer.current = setTimeout(() => setCopied(null), 1300)
  }

  const rootClass = ['lqb', className].filter(Boolean).join(' ')
  const themeAttr = theme === 'auto' ? undefined : theme
  const blurb = description === undefined ? labels.description : description

  const row = (it: Suggestion, i: number) => (
    <div
      key={`${it.kind}-${it.label}-${i}`}
      className="lqb-sg"
      role="option"
      id={optionId(i)}
      aria-selected={i === at}
      onMouseDown={(e) => {
        e.preventDefault()
        accept(i)
      }}
    >
      {it.color && <i style={{ '--lqb-c': it.color } as CSSProperties} />}
      <code>{it.label}</code>
      {it.sub && <span className="lqb-hint lqb-sub">{it.sub}</span>}
      <span className="lqb-hint">{it.kind === 'value' && !showValueCounts ? '' : (it.hint ?? '')}</span>
    </div>
  )

  const textarea = (
    <textarea
      ref={inputRef}
      rows={rows}
      className={classNames.input}
      role="combobox"
      aria-expanded={shown}
      aria-controls={shown ? listId : undefined}
      aria-activedescendant={open && at >= 0 ? optionId(at) : undefined}
      aria-autocomplete="list"
      aria-label={labels.ariaLabel}
      aria-invalid={blocked || undefined}
      aria-describedby={blocked ? errorId : undefined}
      placeholder={bar && !props.labels?.placeholder ? labels.filterPlaceholder : labels.placeholder}
      spellCheck={false}
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      readOnly={readOnly}
      value={query}
      onChange={(e) => {
        change(e.target.value)
        if (interactive) setMenu({ caret: e.target.selectionStart ?? e.target.value.length, at: 0 })
      }}
      onFocus={() => {
        setFocused(true)
        openMenu()
      }}
      onClick={openMenu}
      onBlur={() => {
        setFocused(false)
        setMenu(null)
      }}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') openMenu()
      }}
      onScroll={(e) => {
        if (hlRef.current) hlRef.current.scrollTop = e.currentTarget.scrollTop
      }}
    />
  )

  const suggestions = shown && sugg && (
    <div className={['lqb-sugg', classNames.suggestions].filter(Boolean).join(' ')} ref={listRef} id={listId} role="listbox" aria-label={labels.ariaLabel} onMouseDown={(e) => e.preventDefault()}>
      {sugg.items.length > 0 && (
        <div role="group" aria-label={sugg.head || labels.ariaLabel}>
          {sugg.head && (
            <div className="lqb-sg-h" aria-hidden="true">
              {sugg.head}
            </div>
          )}
          {sugg.items.map((it, i) => row(it, i))}
        </div>
      )}
      {note && <div className="lqb-sg-note">{note}</div>}
      {sugg.extra.length > 0 && (
        <div role="group" aria-label={sugg.extraHead ?? labels.savedAndRecent}>
          <div className="lqb-sg-h" aria-hidden="true">
            {sugg.extraHead ?? labels.savedAndRecent}
          </div>
          {sugg.extra.map((it, i) => row(it, i + sugg.items.length))}
        </div>
      )}
      {waiting && (
        <div className="lqb-sg-h" aria-hidden="true">
          {labels.loadingValues}
        </div>
      )}
    </div>
  )

  const liveRegion = (
    <span className="lqb-sr" aria-live="polite">
      {waiting ? labels.loadingValues : open ? labels.suggestionCount(items.length) : (note ?? '')}
    </span>
  )

  const unknown = query === checked && interactive ? analysis.unknownValues[0] : undefined
  const unknownLabel = unknown ? (engine.schema.fields.get(unknown.field)?.label ?? unknown.field) : ''
  const unknownBox = unknown && (
    <div className="lqb-unknown" role="status">
      <span>{unknown.regex ? labels.unknownPattern(unknownLabel, unknown.value, unknown.negative, unknown.matches.length > 0) : labels.unknownValue(unknownLabel, unknown.value, unknown.negative, unknown.matches.length > 0)}</span>
      {unknown.matches.map((v) => (
        <button type="button" key={v} className="lqb-fix" onClick={() => commit(engine.replaceValue(query, unknown.field, unknown.value, v, unknown.negative))}>
          {v}
        </button>
      ))}
      {unknown.regex && /^\^[\w.-]+\$?$/.test(unknown.value) && unknown.matches.length > 0 && (
        <button type="button" className="lqb-fix" onClick={() => commit(engine.replaceValue(query, unknown.field, unknown.value, `${unknown.value.replace(/^\^/, '').replace(/\$$/, '')}*`, unknown.negative))}>
          {labels.startingWith(unknownLabel, unknown.value.replace(/^\^/, '').replace(/\$$/, ''), unknown.negative)}
        </button>
      )}
      {unknown.matches.length > 1 && (
        <button type="button" className="lqb-fix" onClick={() => commit(engine.replaceValue(query, unknown.field, unknown.value, `*${unknown.value.replace(/^\^/, '').replace(/\$$/, '')}*`, unknown.negative))}>
          {labels.containing(unknownLabel, unknown.value.replace(/^\^/, '').replace(/\$$/, ''), unknown.negative)}
        </button>
      )}
    </div>
  )

  const errorBox = analysis.error && (
    <div className="lqb-error" id={errorId} role="alert">
      {analysis.error}
    </div>
  )

  const logqlPanel = showLogql && logqlOpen && !analysis.error && (
    <div className="lqb-logql">
      {analysis.logql.branches.map((branch, i) => (
        <div key={i}>
          <div className="lqb-pre-h">
            <span>{analysis.logql.branches.length > 1 ? labels.branch(i + 1, analysis.logql.branches.length) : labels.logQuery}</span>
            <button type="button" className="lqb-mini" onClick={() => copyBranch(i, branch)}>
              {copied?.index === i ? copied.text : labels.copy}
            </button>
          </div>
          <pre>{branch}</pre>
        </div>
      ))}
      {analysis.logql.branches.length > 1 && <p className="lqb-note">{labels.mergeNote}</p>}
    </div>
  )

  const logqlToggle = showLogql && (
    <button type="button" className="lqb-link" aria-expanded={logqlOpen} onClick={() => setLogqlOpen((x) => !x)}>
      {logqlOpen ? labels.hideLogql : labels.showLogql}
    </button>
  )

  const helpButton = showHelp && (
    <button type="button" className="lqb-link" ref={helpButtonRef} onClick={() => setHelpOpen(true)}>
      {labels.help}
    </button>
  )

  const runButton = (
    <button type="button" className={[isDirty || blocked ? 'lqb-run' : 'lqb-run lqb-run-idle', classNames.run].filter(Boolean).join(' ')} disabled={blocked || disabled || running} onClick={() => execute()}>
      <svg {...ICON} width={14} height={14}>
        <path d="M7 4l13 8-13 8z" />
      </svg>
      {bar ? labels.runQuery : labels.execute}
    </button>
  )

  const helpDialog = helpOpen && (
    <HelpDialog
      labels={labels}
      rootClass={rootClass}
      rootStyle={style}
      theme={themeAttr}
      syntax={shownSyntax}
      notes={shownNotes}
      shortcuts={globalShortcuts}
      onPick={(q) => {
        setHelpOpen(false)
        commit(q)
      }}
      onClose={closeHelp}
    />
  )

  if (bar) {
    const needle = qText.trim().toLowerCase()
    const matches = (saved ?? []).filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.query.toLowerCase().includes(needle))
    const pinnedList = matches.filter((s) => s.pinned)
    const restList = matches.filter((s) => !s.pinned)
    const count = savedCount ?? saved?.length ?? 0
    const keep = (e: { preventDefault(): void }) => e.preventDefault()
    const paint = (text: string, key: string): ReactNode[] => {
      const out: ReactNode[] = []
      let last = 0
      for (const m of text.matchAll(/(^|[\s(,])(-?)([A-Za-z_][A-Za-z0-9_.]*)(\s*(?:!=|!~|=~|=|:))/g)) {
        if (!engine.schema.alias.has(m[3].toLowerCase())) continue
        const s = (m.index as number) + m[1].length + m[2].length
        out.push(
          text.slice(last, s),
          <span key={`${key}${s}`} className="lqb-hl-f">
            {m[3]}
          </span>,
          <span key={`${key}${s}o`} className="lqb-hl-op">
            {m[4]}
          </span>
        )
        last = s + m[3].length + m[4].length
      }
      out.push(text.slice(last))
      return out
    }
    const hl = [...paint(query, 'q'), '\u200b']
    const flat = (text: string) => text.replace(/\s+/g, ' ').trim()
    const pieces = analysis.parsed.children.length ? analysis.parsed.children.map((n) => flat((n.spans as Span[]).map(([a, b]) => query.slice(a, b)).join(' '))) : [flat(query)]
    const autoName = analysis.parsed.children
      .map((n) => (n.type === 'cond' ? (n.parts ? n.parts.map((p) => p.v).join(', ') : String(n.value)) : engine.chipText(n)))
      .filter(Boolean)
      .join(' · ')
      .slice(0, 80)
    const failed = (e: unknown) => (e instanceof Error ? e.message : String(e))
    const submitDraft = () => {
      if (!draft || draft.busy || !onSaveQuery || !draft.name.trim() || blocked) return
      const next = { name: draft.name.trim(), query, pinned: draft.pinned }
      setDraft({ ...draft, busy: true, error: '' })
      Promise.resolve()
        .then(() => onSaveQuery(next, savedMatch))
        .then(
          () => setDraft(null),
          (e) => setDraft((d) => d && { ...d, busy: false, error: failed(e) })
        )
    }
    const submitEdit = (s: SavedQuery) => {
      if (!editing || editing.busy || !onUpdateSaved || !editing.name.trim() || !editing.query.trim() || engine.analyze(editing.query).error) return
      const changes = { name: editing.name.trim(), query: editing.query }
      setEditing({ ...editing, busy: true, error: '' })
      Promise.resolve()
        .then(() => onUpdateSaved(s, changes))
        .then(
          () => setEditing(null),
          (e) => setEditing((d) => d && { ...d, busy: false, error: failed(e) })
        )
    }
    const confirmRemove = (s: SavedQuery) => {
      if (!removing || removing.busy || !onDeleteSaved) return
      setRemoving({ ...removing, busy: true, error: '' })
      Promise.resolve()
        .then(() => onDeleteSaved(s))
        .then(
          () => setRemoving(null),
          (e) => setRemoving((d) => d && { ...d, busy: false, error: failed(e) })
        )
    }
    const item = (s: SavedQuery) =>
      removing?.key === (s.id ?? s.name) ? (
        <div
          key={s.id ?? s.name}
          className="lqb-q-confirm"
          role="group"
          aria-label={labels.confirmRemove(s.name)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setRemoving(null)
            }
          }}
        >
          <span>{removing.error || labels.confirmRemove(s.name)}</span>
          <button type="button" className="lqb-btn lqb-btn-danger" disabled={removing.busy} onClick={() => confirmRemove(s)}>
            {removing.busy ? labels.removing : labels.removeShort}
          </button>
          <button type="button" className="lqb-btn lqb-btn-outline" autoFocus onClick={() => setRemoving(null)}>
            {labels.cancel}
          </button>
        </div>
      ) : editing?.key === (s.id ?? s.name) ? (
        <div
          key={s.id ?? s.name}
          className="lqb-q-edit"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setEditing(null)
            } else if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault()
              submitEdit(s)
            }
          }}
        >
          <input className="lqb-input" aria-label={labels.nameLabel} autoFocus value={editing.name} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <textarea className="lqb-q-edit-query" aria-label={labels.queryLabel} rows={3} spellCheck={false} value={editing.query} onChange={(e) => setEditing({ ...editing, query: e.target.value })} />
          {(editing.error || engine.analyze(editing.query).error) && <div className="lqb-error">{editing.error || engine.analyze(editing.query).error}</div>}
          <div className="lqb-pop-acts">
            <button type="button" className="lqb-btn" onClick={() => setEditing(null)}>
              {labels.cancel}
            </button>
            <button type="button" className="lqb-btn lqb-btn-primary" disabled={editing.busy || !editing.name.trim() || !editing.query.trim() || !!engine.analyze(editing.query).error} onClick={() => submitEdit(s)}>
              {editing.busy ? labels.saving : labels.saveShort}
            </button>
          </div>
        </div>
      ) : (
        <div key={s.id ?? s.name} className="lqb-q-item">
          <button
            type="button"
            className="lqb-q-main"
            title={s.query}
            onClick={() => {
              setQOpen(false)
              setQText('')
              commit(s.query)
              onSelectSaved?.(s)
            }}
          >
            <span className="lqb-q-name">
              {s.name}
              {s.pinned && (
                <svg {...ICON} width={14} height={14} aria-label={labels.pinnedBadge} role="img">
                  <path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" fill="currentColor" />
                </svg>
              )}
            </span>
            <code>{s.query}</code>
          </button>
          {interactive && (onPinSaved || onCreateAlert || onEditSaved || onUpdateSaved || onDeleteSaved) && (
            <span className="lqb-q-acts">
              {onPinSaved && (
                <button type="button" className="lqb-icon-btn" aria-label={s.pinned ? labels.unpin(s.name) : labels.pin(s.name)} title={s.pinned ? labels.unpinShort : labels.pinShort} onClick={() => onPinSaved(s, !s.pinned)}>
                  <svg {...ICON}>
                    <path d={s.pinned ? 'M9 3h6l-1 6 4 4H6l4-4zM12 13v8M4 4l16 16' : 'M9 3h6l-1 6 4 4H6l4-4zM12 13v8'} />
                  </svg>
                </button>
              )}
              {onCreateAlert && (
                <button type="button" className="lqb-icon-btn" aria-label={labels.alertFor(s.name)} title={labels.createAlert} onClick={() => onCreateAlert(s.query, s)}>
                  <svg {...ICON}>
                    <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
                  </svg>
                </button>
              )}
              {(onEditSaved || onUpdateSaved) && (
                <button
                  type="button"
                  className="lqb-icon-btn"
                  aria-label={labels.edit(s.name)}
                  title={labels.editShort}
                  onClick={() => (onUpdateSaved ? setEditing({ key: s.id ?? s.name, name: s.name, query: s.query, error: '', busy: false }) : onEditSaved?.(s))}
                >
                  <svg {...ICON}>
                    <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
                  </svg>
                </button>
              )}
              {onDeleteSaved && (
                <button type="button" className="lqb-icon-btn lqb-danger" aria-label={labels.remove(s.name)} title={labels.removeShort} onClick={() => setRemoving({ key: s.id ?? s.name, error: '', busy: false })}>
                  <svg {...ICON}>
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                </button>
              )}
            </span>
          )}
        </div>
      )

    return (
      <div className={`${rootClass} lqb-v-bar`} style={style} data-lqb-theme={themeAttr} aria-busy={running || undefined}>
        {blurb !== false && description !== undefined && <p className="lqb-desc">{blurb}</p>}
        <div className="lqb-bar-row">
          <div className="lqb-bar-slot">
            <div ref={wrapRef} className={['lqb-bar', classNames.bar].filter(Boolean).join(' ')} data-open={expanded || undefined} data-focus={focused || undefined} data-invalid={blocked || undefined}>
              <div className={['lqb-field', classNames.field].filter(Boolean).join(' ')} onMouseDown={(e) => e.target === e.currentTarget && (keep(e), inputRef.current?.focus())}>
                <svg {...ICON} className="lqb-funnel">
                  <path d="M3 5h18l-7 8v6l-4 2v-8z" />
                </svg>
                <div className="lqb-edit">
                  {summarize ? (
                    <div className="lqb-summary" ref={sumRef} data-overflow={fit.over || undefined} aria-hidden="true">
                      {pieces.map((p, i) => (
                        <span key={i} className="lqb-piece">
                          {i > 0 && <span className="lqb-sep">, </span>}
                          {paint(p, `p${i}`)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="lqb-hl" ref={hlRef} aria-hidden="true">
                      {hl}
                    </div>
                  )}
                  {textarea}
                </div>
                {summarize && fit.hidden > 0 && <span className="lqb-more">{labels.hiddenFilters(fit.hidden)}</span>}
                {query && interactive && (
                  <span className="lqb-field-acts">
                    <button
                      type="button"
                      className="lqb-icon-btn"
                      aria-label={labels.clearAria}
                      title={labels.clear}
                      onMouseDown={keep}
                      onClick={() => {
                        commit('')
                        inputRef.current?.focus()
                      }}
                    >
                      <svg {...ICON}>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                    {expanded && (
                      <button type="button" className="lqb-icon-btn" aria-label={labels.copyQuery} title={copied?.index === -1 ? copied.text : labels.copyQuery} onMouseDown={keep} onClick={() => copyBranch(-1, query)}>
                        <svg {...ICON}>
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V6a2 2 0 0 1 2-2h8" />
                        </svg>
                      </button>
                    )}
                  </span>
                )}
              </div>
              {showQueries && (
                <div className="lqb-qside">
                  <button type="button" ref={qBtnRef} className={['lqb-qbtn', classNames.queriesButton].filter(Boolean).join(' ')} aria-haspopup="dialog" aria-expanded={qOpen} onClick={() => setQOpen((x) => !x)}>
                    <svg {...ICON}>
                      <path d="M6 3h12v18l-6-4-6 4z" />
                    </svg>
                    <span>{labels.queries}</span>
                    <span className="lqb-count">{count}</span>
                    <svg {...ICON} width={15} height={15}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {expanded && interactive && (onSave || onSaveQuery || onCreateAlert) && (
                    <div className="lqb-qside-acts">
                      {(onSave || onSaveQuery) && (
                        <button
                          type="button"
                          ref={saveBtnRef}
                          className="lqb-side-btn"
                          aria-expanded={onSaveQuery ? !!draft : undefined}
                          title={savedMatch ? labels.savedAs(savedMatch.name) : labels.save}
                          disabled={!query.trim()}
                          onMouseDown={keep}
                          onClick={() => (onSaveQuery ? setDraft((d) => (d ? null : { name: savedMatch?.name ?? autoName, pinned: savedMatch?.pinned ?? false, error: '', busy: false })) : onSave?.(query, savedMatch))}
                        >
                          <svg {...ICON}>
                            <path d="M6 3h12v18l-6-4-6 4z" />
                          </svg>
                          {labels.saveShort}
                        </button>
                      )}
                      {onCreateAlert && (
                        <button type="button" className="lqb-side-btn" disabled={blocked || !query.trim()} onMouseDown={keep} onClick={() => onCreateAlert(query, savedMatch)}>
                          <svg {...ICON}>
                            <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
                          </svg>
                          {labels.createAlert}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {suggestions}
              {liveRegion}
            </div>
          </div>
          {showRun && runButton}
          {actions}
        </div>
        {errorBox}
        {unknownBox}
        {(showHelp || showLogql) && (
          <div className="lqb-tools">
            {helpButton}
            {logqlToggle}
          </div>
        )}
        {logqlPanel}
        {draft && (
          <div
            className="lqb-savepop"
            ref={savePopRef}
            role="dialog"
            aria-label={labels.saveAs}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setDraft(null)
                inputRef.current?.focus()
              } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
                e.preventDefault()
                submitDraft()
              }
            }}
          >
            <div className="lqb-pop-title">{labels.saveAs}</div>
            <input className="lqb-input" aria-label={labels.nameLabel} autoFocus value={draft.name} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <label className="lqb-check">
              <input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} />
              {labels.pinToTop}
            </label>
            <code className="lqb-pop-preview" title={query}>
              {flat(query)}
            </code>
            {draft.error && <div className="lqb-error">{draft.error}</div>}
            <div className="lqb-pop-acts">
              <button
                type="button"
                className="lqb-btn"
                onClick={() => {
                  setDraft(null)
                  inputRef.current?.focus()
                }}
              >
                {labels.cancel}
              </button>
              <button type="button" className="lqb-btn lqb-btn-primary" disabled={draft.busy || !draft.name.trim() || blocked} onClick={submitDraft}>
                {draft.busy ? labels.saving : savedMatch ? labels.update : labels.saveShort}
              </button>
            </div>
          </div>
        )}
        {qOpen && (
          <div className={['lqb-qpanel', classNames.queriesPanel].filter(Boolean).join(' ')} ref={qPanelRef} role="dialog" aria-label={labels.queries}>
            <div className="lqb-q-search">
              <svg {...ICON}>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                autoFocus
                value={qText}
                placeholder={labels.searchSaved}
                aria-label={labels.searchSaved}
                onChange={(e) => {
                  setQText(e.target.value)
                  onSavedSearch?.(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setQOpen(false)
                    qBtnRef.current?.focus()
                  } else if (e.key === 'Enter' && matches[0]) {
                    e.preventDefault()
                    setQOpen(false)
                    setQText('')
                    commit(matches[0].query)
                    onSelectSaved?.(matches[0])
                  }
                }}
              />
            </div>
            <div className="lqb-q-list">
              {savedLoading && <div className="lqb-q-empty">{labels.loadingSaved}</div>}
              {!savedLoading && !matches.length && <div className="lqb-q-empty">{needle ? labels.noSavedMatch : labels.noSaved}</div>}
              {pinnedList.length > 0 && (
                <div role="group" aria-label={labels.pinnedHead}>
                  <div className="lqb-sg-h">{labels.pinnedHead}</div>
                  {pinnedList.map(item)}
                </div>
              )}
              {restList.length > 0 && (
                <div role="group" aria-label={labels.allSavedHead} className={pinnedList.length ? 'lqb-q-sep' : undefined}>
                  <div className="lqb-sg-h">{labels.allSavedHead}</div>
                  {restList.map(item)}
                </div>
              )}
            </div>
          </div>
        )}
        {helpDialog}
      </div>
    )
  }

  return (
    <div className={rootClass} style={style} data-lqb-theme={themeAttr} aria-busy={running || undefined}>
      {(blurb !== false || showHelp) && (
        <div className="lqb-head">
          {blurb !== false ? <p className="lqb-desc">{blurb}</p> : <span />}
          {helpButton}
        </div>
      )}

      <div className="lqb-wrap" ref={wrapRef}>
        <div className="lqb-box">
          <div className="lqb-row">
            {textarea}
            {query && interactive && (
              <button
                type="button"
                className="lqb-text-btn"
                aria-label={labels.clearAria}
                onClick={() => {
                  commit('')
                  inputRef.current?.focus()
                }}
              >
                {labels.clear}
              </button>
            )}
            {onSave && interactive && (
              <button type="button" className="lqb-icon-btn" aria-label={labels.save} title={savedMatch ? labels.savedAs(savedMatch.name) : labels.save} onClick={() => onSave(query, savedMatch)}>
                <svg {...ICON}>
                  <path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />
                </svg>
              </button>
            )}
          </div>
          {analysis.parsed.children.length > 0 && (
            <div className="lqb-chips">
              {analysis.parsed.children.slice(0, CHIP_LIMIT).map((node, i) => {
                const text = engine.chipText(node)
                return (
                  <span key={`${node.id}-${i}`} className={engine.isNegative(node) ? 'lqb-chip lqb-chip-neg' : 'lqb-chip'}>
                    <span title={text}>{chipLabel(text)}</span>
                    {interactive && (
                      <button
                        type="button"
                        aria-label={labels.removeFilter(text)}
                        onClick={() => {
                          commit(engine.removeNode(query, node))
                          if (analysis.parsed.children.length === 1) inputRef.current?.focus()
                        }}
                      >
                        <svg {...ICON} width={10} height={10}>
                          <path d="M5 5l14 14M19 5L5 19" />
                        </svg>
                      </button>
                    )}
                  </span>
                )
              })}
              {analysis.parsed.children.length > CHIP_LIMIT && <span className="lqb-chip lqb-chip-more">{labels.moreFilters(analysis.parsed.children.length - CHIP_LIMIT)}</span>}
            </div>
          )}
        </div>
        {suggestions}
        {liveRegion}
      </div>

      {errorBox}
      {unknownBox}

      {!query.trim() && shownExamples.length > 0 && interactive && (
        <div className="lqb-try">
          <span>{labels.tryLabel}</span>
          {shownExamples.map((q) => (
            <button type="button" key={q} onClick={() => commit(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {logqlPanel}

      <div className="lqb-runbar">
        <span className={blocked ? 'lqb-status lqb-status-warn' : 'lqb-status'} role="status">
          {status}
        </span>
        {logqlToggle}
        {actions}
        {runButton}
      </div>

      {helpDialog}
    </div>
  )
})
