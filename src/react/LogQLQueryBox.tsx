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
import { chipLabel, createEngine, type Analysis, type Engine, type FieldValues, type SavedQuery, type Schema, type Suggestion } from '../core'
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
}

export interface LogQLQueryBoxProps {
  value?: string
  defaultValue?: string
  onChange?: (query: string, analysis: Analysis) => void
  onExecute?: (analysis: Analysis) => void
  onSave?: (query: string, existing?: SavedQuery) => void
  engine?: Engine
  schema?: Schema
  values?: FieldValues
  matchCase?: boolean
  maxBranches?: number
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
    matchCase,
    maxBranches,
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
    rows = 2,
    showHelp = true,
    showLogql = true,
    defaultLogqlOpen = false,
    executeOnMount = false,
    globalShortcuts = false,
    theme = 'auto',
    className,
    style
  } = props
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels])
  const engine = useMemo(() => props.engine ?? createEngine({ schema, values, matchCase, maxBranches }), [props.engine, schema, values, matchCase, maxBranches])

  const controlled = value !== undefined
  const [inner, setInner] = useState(defaultValue)
  const query = controlled ? value : inner
  const [ran, setRan] = useState(query)
  const [menu, setMenu] = useState<{ caret: number; at: number } | null>(null)
  const [logqlOpen, setLogqlOpen] = useState(defaultLogqlOpen)
  const [helpOpen, setHelpOpen] = useState(false)
  const [copied, setCopied] = useState<{ index: number; text: string } | null>(null)
  const [storedRecent, setStoredRecent] = useState<string[]>([])

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const pendingCaret = useRef<number | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountRan = useRef(false)

  const baseId = useId()
  const listId = `${baseId}-list`
  const errorId = `${baseId}-error`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const analysis = useMemo(() => engine.analyze(query), [engine, query])
  const recentList = recent ?? storedRecent
  const interactive = !disabled && !readOnly

  const sugg = useMemo(() => (menu && interactive ? engine.suggest(query, menu.caret, { saved, recent: recentList }) : null), [menu, interactive, engine, query, saved, recentList])
  const items = useMemo<Suggestion[]>(() => (sugg ? [...sugg.items, ...sugg.extra] : []), [sugg])
  const open = items.length > 0
  const at = menu ? Math.min(menu.at, items.length - 1) : -1

  const usable = (text: string) => [...text.matchAll(/(?:^|[\s(`-])([A-Za-z_][A-Za-z0-9_]*):/g)].every((m) => engine.schema.alias.has(m[1].toLowerCase()))
  const shownExamples = examples ?? defaultExamples.filter(usable)
  const shownSyntax = syntax ?? defaultSyntax.filter((s) => usable(s[0]))
  const shownNotes = notes ?? defaultNotes.filter(usable)

  useEffect(() => {
    if (recent === undefined && recentStorageKey) setStoredRecent(readRecent(recentStorageKey))
  }, [recent, recentStorageKey])

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
    if (!open || !list || !('showPopover' in list)) return
    list.setAttribute('popover', 'manual')
    list.showPopover()
  }, [open])

  useIsoLayoutEffect(() => {
    const list = listRef.current
    const anchor = wrapRef.current
    if (!open || !list || !anchor) return
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
  }, [open, items])

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

  const execute = (q: string = query): boolean => {
    const result = engine.analyze(q)
    if (result.error) return false
    setRan(q)
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
    const pos = s + text.length
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
      if (open && !e.shiftKey && currentToken()) {
        e.preventDefault()
        accept(at)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const it = open ? items[at] : undefined
      const cur = currentToken()
      if (it?.kind === 'value' && cur.indexOf(':') > 0 && it.text?.trim() !== cur) accept(at)
      else if (it?.whole != null && !cur && !query.trim()) accept(at)
      else {
        setMenu(null)
        if (!running) execute()
      }
    } else if (e.key === 'Escape') {
      if (open) {
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
    appendTerm: (field, list, negative) => commit(engine.appendTerm(query, field, list, negative))
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
      <span className="lqb-hint">{it.hint ?? ''}</span>
    </div>
  )

  return (
    <div className={rootClass} style={style} data-lqb-theme={themeAttr} aria-busy={running || undefined}>
      {(blurb !== false || showHelp) && (
        <div className="lqb-head">
          {blurb !== false ? <p className="lqb-desc">{blurb}</p> : <span />}
          {showHelp && (
            <button type="button" className="lqb-link" ref={helpButtonRef} onClick={() => setHelpOpen(true)}>
              {labels.help}
            </button>
          )}
        </div>
      )}

      <div className="lqb-wrap" ref={wrapRef}>
        <div className="lqb-box">
          <div className="lqb-row">
            <textarea
              ref={inputRef}
              rows={rows}
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-activedescendant={open && at >= 0 ? optionId(at) : undefined}
              aria-autocomplete="list"
              aria-label={labels.ariaLabel}
              aria-invalid={blocked || undefined}
              aria-describedby={blocked ? errorId : undefined}
              placeholder={labels.placeholder}
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
              onFocus={openMenu}
              onClick={openMenu}
              onBlur={() => setMenu(null)}
              onKeyDown={onKeyDown}
              onKeyUp={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') openMenu()
              }}
            />
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
        {open && sugg && (
          <div className="lqb-sugg" ref={listRef} id={listId} role="listbox" aria-label={labels.ariaLabel} onMouseDown={(e) => e.preventDefault()}>
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
            {sugg.extra.length > 0 && (
              <div role="group" aria-label={labels.savedAndRecent}>
                <div className="lqb-sg-h" aria-hidden="true">
                  {labels.savedAndRecent}
                </div>
                {sugg.extra.map((it, i) => row(it, i + sugg.items.length))}
              </div>
            )}
          </div>
        )}
        <span className="lqb-sr" aria-live="polite">
          {open ? labels.suggestionCount(items.length) : ''}
        </span>
      </div>

      {analysis.error && (
        <div className="lqb-error" id={errorId} role="alert">
          {analysis.error}
        </div>
      )}

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

      {showLogql && logqlOpen && !analysis.error && (
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
      )}

      <div className="lqb-runbar">
        <span className={blocked ? 'lqb-status lqb-status-warn' : 'lqb-status'} role="status">
          {status}
        </span>
        {showLogql && (
          <button type="button" className="lqb-link" aria-expanded={logqlOpen} onClick={() => setLogqlOpen((x) => !x)}>
            {logqlOpen ? labels.hideLogql : labels.showLogql}
          </button>
        )}
        {actions}
        <button type="button" className={isDirty || blocked ? 'lqb-run' : 'lqb-run lqb-run-idle'} disabled={blocked || disabled || running} onClick={() => execute()}>
          <svg {...ICON} width={14} height={14}>
            <path d="M7 4l13 8-13 8z" />
          </svg>
          {labels.execute}
        </button>
      </div>

      {helpOpen && (
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
      )}
    </div>
  )
})
