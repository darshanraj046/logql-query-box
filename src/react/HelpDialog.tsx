import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Labels } from './labels'

interface HelpDialogProps {
  labels: Labels
  rootClass: string
  rootStyle?: CSSProperties
  theme?: string
  syntax: [string, string][]
  notes: string[]
  shortcuts: boolean
  onPick: (query: string) => void
  onClose: () => void
}

function withCode(text: string): ReactNode[] {
  return text.split(/`([^`]+)`/).map((piece, i) => (i % 2 ? <code key={i}>{piece}</code> : piece))
}

export function HelpDialog({ labels, rootClass, rootStyle, theme, syntax, notes, shortcuts, onPick, onClose }: HelpDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusable = sheetRef.current.querySelectorAll<HTMLElement>('button')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={`${rootClass} lqb-modal`}
      style={rootStyle}
      data-lqb-theme={theme}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="lqb-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={labels.helpTitle}>
        <h2>
          {labels.helpTitle}
          <button type="button" className="lqb-x" ref={closeRef} aria-label={labels.helpClose} onClick={onClose}>
            &times;
          </button>
        </h2>
        <div>
          <h3>{labels.helpSyntax}</h3>
          <div className="lqb-cheat">
            {syntax.map(([q, text]) => (
              <div className="lqb-cheat-row" key={q}>
                <button type="button" onClick={() => onPick(q)}>
                  {q}
                </button>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
        {notes.length > 0 && (
          <div>
            <h3>{labels.helpCombine}</h3>
            <ul className="lqb-notes">
              {notes.map((n) => (
                <li key={n}>{withCode(n)}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3>{labels.helpKeyboard}</h3>
          <div className="lqb-keys">
            {shortcuts && (
              <div>
                <span>Focus the filter box</span>
                <kbd>/</kbd>
              </div>
            )}
            <div>
              <span>Run the search</span>
              <kbd>Enter</kbd>
            </div>
            <div>
              <span>Run exactly what you typed</span>
              <span>
                <kbd>Ctrl</kbd> <kbd>Enter</kbd>
              </span>
            </div>
            <div>
              <span>New line</span>
              <span>
                <kbd>Shift</kbd> <kbd>Enter</kbd>
              </span>
            </div>
            <div>
              <span>Accept a suggestion</span>
              <kbd>Tab</kbd>
            </div>
            <div>
              <span>Move through suggestions</span>
              <span>
                <kbd>{'↑'}</kbd> <kbd>{'↓'}</kbd>
              </span>
            </div>
            <div>
              <span>Close suggestions or this help</span>
              <kbd>Esc</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
