import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createEngine, LogQLQueryBox, type LogQLQueryBoxHandle, type LogQLQueryBoxProps } from '../src'
import { engineValues, SAVED } from './helpers'

const box = () => screen.getByRole('combobox') as HTMLTextAreaElement
const options = () => screen.queryAllByRole('option')
const optionLabels = () => options().map((o) => o.querySelector('code')?.textContent)
const selected = () => options().find((o) => o.getAttribute('aria-selected') === 'true')?.querySelector('code')?.textContent
const execute = () => screen.getByRole('button', { name: 'Execute' })

function setup(props: LogQLQueryBoxProps = {}) {
  const onExecute = vi.fn()
  const onChange = vi.fn()
  const user = userEvent.setup()
  const view = render(<LogQLQueryBox showHelp showLogql values={engineValues} recentStorageKey={null} onExecute={onExecute} onChange={onChange} {...props} />)
  return { user, onExecute, onChange, ...view }
}

describe('first render', () => {
  it('shows the same pieces as the prototype', () => {
    setup()
    expect(box()).toHaveAttribute('placeholder', 'Filter your logs, for example: timeout level:error -debug')
    expect(screen.getByText('Build log queries using filters, operators, and real-time search conditions.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search help' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show LogQL' })).toBeInTheDocument()
    expect(execute()).toBeEnabled()
    expect(execute()).toHaveClass('lqb-run-idle')
  })

  it('hides clear, save, chips and errors until needed', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Clear the filter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save this filter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(document.querySelector('.lqb-chips')).toBeNull()
  })

  it('shows the example queries only while empty', async () => {
    const { user } = setup()
    expect(screen.getByRole('button', { name: 'level:error,warn' })).toBeInTheDocument()
    await user.type(box(), 'a')
    expect(screen.queryByRole('button', { name: 'level:error,warn' })).not.toBeInTheDocument()
  })

  it('does not treat a default value as unsaved work', () => {
    setup({ defaultValue: 'level:error' })
    expect(box()).toHaveValue('level:error')
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(execute()).toHaveClass('lqb-run-idle')
  })
})

describe('typing', () => {
  it('reports each change with its analysis', async () => {
    const { user, onChange } = setup()
    await user.type(box(), 'a')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toBe('a')
    expect(onChange.mock.calls[0][1].logql.branches).toEqual(['{service_name=~".+"}\n  |~ "(?i)a"'])
  })

  it('renders chips live with dashed style for exclusions', async () => {
    const { user } = setup()
    await user.type(box(), 'timeout -level:debug')
    expect(screen.getByText('“timeout”')).toBeInTheDocument()
    const neg = screen.getByText('Log Level is not debug').closest('.lqb-chip')
    expect(neg).toHaveClass('lqb-chip-neg')
  })

  it('truncates long chips but keeps the full text in the title', async () => {
    const long = 'x'.repeat(100)
    setup({ defaultValue: long })
    const chip = screen.getByTitle(`“${long}”`)
    expect(chip.textContent?.endsWith('…')).toBe(true)
    expect(chip.textContent).toHaveLength(69)
  })

  it('flags an unfinished quote and blocks running', async () => {
    const { user, onExecute } = setup()
    await user.type(box(), '"abc')
    expect(screen.getByRole('alert')).toHaveTextContent('The quote that starts at character 1 is never closed.')
    expect(screen.getByRole('status')).toHaveTextContent('Fix the filter before running it.')
    expect(box()).toHaveAttribute('aria-invalid', 'true')
    expect(execute()).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('flags regexes Loki cannot run', async () => {
    const { user } = setup()
    fireEvent.change(box(), { target: { value: '/(?=a)/' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Loki uses RE2')
    await user.click(execute()).catch(() => undefined)
    expect(execute()).toBeDisabled()
  })

  it('clears the error as soon as the filter is valid again', async () => {
    const { user } = setup()
    await user.type(box(), '"abc')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.type(box(), '"')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(execute()).toBeEnabled()
  })

  it('announces a changed filter until it runs', async () => {
    const { user } = setup()
    await user.type(box(), 'a')
    expect(screen.getByRole('status')).toHaveTextContent('Filter changed. Press Execute.')
    expect(execute()).not.toHaveClass('lqb-run-idle')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(execute()).toHaveClass('lqb-run-idle')
  })
})

describe('running', () => {
  it('runs on Enter with everything the host needs', async () => {
    const { user, onExecute } = setup()
    await user.type(box(), 'timeout level:error{Enter}')
    expect(onExecute).toHaveBeenCalledTimes(1)
    const result = onExecute.mock.calls[0][0]
    expect(result.query).toBe('timeout level:error')
    expect(result.logql.branches).toEqual(['{service_name=~".+"}\n  |~ "(?i)timeout"\n  | detected_level="error"'])
    expect(result.filter).toEqual({
      logic: 'AND',
      filters: [
        { field: 'line', operator: 'contains', value: 'timeout' },
        { field: 'detected_level', operator: 'eq', value: 'error' }
      ]
    })
    expect(result.error).toBeNull()
  })

  it('runs an empty query as match everything', async () => {
    const { user, onExecute } = setup()
    await user.click(execute())
    expect(onExecute.mock.calls[0][0].logql.branches).toEqual(['{service_name=~".+"}'])
    expect(onExecute.mock.calls[0][0].filter).toBeNull()
  })

  it('runs from the button and keeps focus rules simple', async () => {
    const { user, onExecute } = setup({ defaultValue: 'a' })
    await user.click(execute())
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('inserts a new line on Shift+Enter without running', async () => {
    const { user, onExecute } = setup()
    await user.type(box(), 'a{Shift>}{Enter}{/Shift}b')
    expect(box()).toHaveValue('a\nb')
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('blocks a filter with too many branches', async () => {
    const q = Array.from({ length: 13 }, (_, i) => `t${i}`).join(' OR ')
    const { onExecute } = setup({ defaultValue: q })
    expect(screen.getByRole('alert')).toHaveTextContent('This filter expands into 13 OR branches.')
    expect(execute()).toBeDisabled()
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('does not run while the host reports a run in progress', async () => {
    const { user, onExecute } = setup({ running: true })
    expect(execute()).toBeDisabled()
    await user.type(box(), 'a{Enter}')
    expect(onExecute).not.toHaveBeenCalled()
    expect(document.querySelector('.lqb')).toHaveAttribute('aria-busy', 'true')
  })

  it('ignores Enter during IME composition', () => {
    const { onExecute } = setup()
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true })
    fireEvent.keyDown(box(), { key: 'Enter', keyCode: 229 })
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('runs once on mount when asked, even in StrictMode', () => {
    const onExecute = vi.fn()
    render(
      <StrictMode>
        <LogQLQueryBox recentStorageKey={null} defaultValue="a" executeOnMount onExecute={onExecute} />
      </StrictMode>
    )
    expect(onExecute).toHaveBeenCalledTimes(1)
  })
})

describe('suggestions', () => {
  it('opens on focus with fields, then saved and recent', async () => {
    const { user } = setup({ saved: SAVED, recent: ['recent one'] })
    await user.click(box())
    expect(optionLabels()).toEqual(['level:', 'app:', 'apptype:', '-', 'Errors and warnings', 'Java exceptions', 'Timeouts', 'recent one'])
    expect(screen.getByText('Filter by')).toBeInTheDocument()
    expect(screen.getByText('Saved and recent')).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-expanded', 'true')
  })

  it('wires the listbox up for screen readers', async () => {
    const { user } = setup()
    await user.click(box())
    const list = screen.getByRole('listbox')
    expect(box()).toHaveAttribute('aria-controls', list.id)
    expect(box()).toHaveAttribute('aria-activedescendant', options()[0].id)
    await user.keyboard('{ArrowDown}')
    expect(box()).toHaveAttribute('aria-activedescendant', options()[1].id)
  })

  it('removes the aria links when closed', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('{Escape}')
    expect(box()).toHaveAttribute('aria-expanded', 'false')
    expect(box()).not.toHaveAttribute('aria-controls')
    expect(box()).not.toHaveAttribute('aria-activedescendant')
  })

  it('moves with arrows and wraps both ways', async () => {
    const { user } = setup()
    await user.click(box())
    expect(selected()).toBe('level:')
    await user.keyboard('{ArrowUp}')
    expect(selected()).toBe('-')
    await user.keyboard('{ArrowDown}')
    expect(selected()).toBe('level:')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(selected()).toBe('apptype:')
  })

  it('completes a field with Tab and then lists its values', async () => {
    const { user } = setup()
    await user.type(box(), 'le{Tab}')
    expect(box()).toHaveValue('level:')
    expect(box().selectionStart).toBe(6)
    expect(box()).toHaveFocus()
    expect(screen.getByText('Values for Log Level')).toBeInTheDocument()
    expect(optionLabels()).toEqual(['info', 'error', 'warn', 'debug', 'unknown'])
  })

  it('completes a value with Enter and runs on the next Enter', async () => {
    const { user, onExecute } = setup()
    await user.type(box(), 'level:er{Enter}')
    expect(box()).toHaveValue('level:error ')
    expect(onExecute).not.toHaveBeenCalled()
    expect(options()).toHaveLength(0)
    await user.keyboard('{Enter}')
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('runs straight away when the value is already complete', async () => {
    const { user, onExecute } = setup()
    await user.type(box(), 'level:error{Enter}')
    expect(box()).toHaveValue('level:error')
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('does not accept a highlighted field on Enter', async () => {
    const { user, onExecute } = setup()
    await user.type(box(), 'le{Enter}')
    expect(box()).toHaveValue('le')
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('shows line counts and colour dots for values', async () => {
    const { user } = setup()
    await user.type(box(), 'level:')
    expect(screen.getByText('4,000 lines')).toBeInTheDocument()
    expect(options()[0].querySelector('i')).toHaveStyle('--lqb-c: var(--lqb-lv-info, var(--lqb-faint))')
  })

  it('continues a comma list without repeating a chosen value', async () => {
    const { user } = setup()
    await user.type(box(), 'level:error,')
    expect(optionLabels()).not.toContain('error')
    await user.type(box(), 'wa{Enter}')
    expect(box()).toHaveValue('level:error,warn ')
  })

  it('offers exclusions after a minus', async () => {
    const { user } = setup()
    await user.type(box(), '-')
    expect(optionLabels()).toEqual(['-level:', '-app:', '-apptype:'])
    await user.keyboard('{Tab}')
    expect(box()).toHaveValue('-level:')
    expect(optionLabels()).toContain('debug')
  })

  it('accepts with a click and keeps focus and the caret', async () => {
    const { user } = setup()
    await user.type(box(), 'x ap')
    await user.click(options()[1])
    expect(box()).toHaveValue('x apptype:')
    expect(box()).toHaveFocus()
    expect(box().selectionStart).toBe(10)
  })

  it('replaces the token in the middle of a query', async () => {
    const { user } = setup({ defaultValue: 'alpha level:er omega' })
    await user.click(box())
    box().setSelectionRange(14, 14)
    fireEvent.click(box())
    await user.keyboard('{Enter}')
    expect(box()).toHaveValue('alpha level:error  omega')
    expect(box().selectionStart).toBe(18)
  })

  it('runs a saved query on click and closes', async () => {
    const { user, onExecute } = setup({ saved: SAVED })
    await user.click(box())
    await user.click(screen.getByText('Java exceptions'))
    expect(box()).toHaveValue('apptype:java /\\w+Exception/')
    expect(onExecute).toHaveBeenCalledTimes(1)
    expect(options()).toHaveLength(0)
  })

  it('accepts a saved query with Enter when the box is empty', async () => {
    const { user, onExecute } = setup({ saved: SAVED })
    await user.click(box())
    await user.keyboard('{ArrowUp}{Enter}')
    expect(box()).toHaveValue('level:error (timeout OR refused)')
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape, then blurs on a second Escape', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('{Escape}')
    expect(options()).toHaveLength(0)
    expect(box()).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(box()).not.toHaveFocus()
  })

  it('does not let Escape reach a host dialog while the list is open', async () => {
    const hostEscape = vi.fn()
    const user = userEvent.setup()
    render(
      <div onKeyDown={(e) => e.key === 'Escape' && hostEscape()}>
        <LogQLQueryBox recentStorageKey={null} />
      </div>
    )
    await user.click(box())
    await user.keyboard('{Escape}')
    expect(hostEscape).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(hostEscape).toHaveBeenCalledTimes(1)
  })

  it('closes on blur', async () => {
    const { user } = setup()
    await user.click(box())
    expect(options().length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Search help' }))
    expect(options()).toHaveLength(0)
  })

  it('reopens with ArrowDown after closing', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('{Escape}{ArrowDown}')
    expect(options().length).toBeGreaterThan(0)
  })

  it('follows the caret on arrow keys', async () => {
    const { user } = setup({ defaultValue: 'le ap' })
    await user.click(box())
    box().setSelectionRange(1, 1)
    await user.keyboard('{ArrowLeft}')
    box().setSelectionRange(2, 2)
    fireEvent.keyUp(box(), { key: 'ArrowRight' })
    expect(optionLabels()).toEqual(['level:'])
  })

  it('stays out of the way inside a phrase', async () => {
    const { user } = setup()
    await user.type(box(), '"foo le')
    expect(options()).toHaveLength(0)
  })

  it('picks up values that arrive while the list is open', async () => {
    const { user, rerender } = setup({ values: {} })
    await user.type(box(), 'app:')
    expect(options()).toHaveLength(0)
    rerender(<LogQLQueryBox values={{ service_name: ['late-app'] }} recentStorageKey={null} />)
    expect(optionLabels()).toEqual(['late-app'])
  })

  it('clamps the highlight when the list shrinks', async () => {
    const { user } = setup()
    await user.type(box(), 'level:')
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(selected()).toBe('unknown')
    await user.type(box(), 'e')
    expect(selected()).toBe('error')
  })
})

describe('keyboard traps the prototype had', () => {
  it('lets Shift+Tab leave the box', async () => {
    const { user } = setup({ defaultValue: 'le' })
    await user.click(box())
    expect(options().length).toBeGreaterThan(0)
    await user.tab({ shift: true })
    expect(box()).toHaveValue('le')
    expect(box()).not.toHaveFocus()
  })

  it('lets Tab leave an empty box', async () => {
    const { user } = setup()
    await user.click(box())
    await user.tab()
    expect(box()).not.toHaveFocus()
  })

  it('leaves ArrowUp and ArrowDown to the textarea in multi line text when closed', async () => {
    const { user } = setup({ defaultValue: 'a\nb' })
    await user.click(box())
    await user.keyboard('{Escape}')
    expect(fireEvent.keyDown(box(), { key: 'ArrowUp' })).toBe(true)
    expect(fireEvent.keyDown(box(), { key: 'ArrowDown' })).toBe(true)
  })
})

describe('chips', () => {
  it('removes a term, tidies the text and runs', async () => {
    const { user, onExecute } = setup({ defaultValue: 'timeout level:error' })
    await user.click(screen.getByRole('button', { name: 'Remove filter Log Level is error' }))
    expect(box()).toHaveValue('timeout')
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('removes every span of a merged term', async () => {
    const { user } = setup({ defaultValue: 'level:error x level:warn' })
    await user.click(screen.getByRole('button', { name: 'Remove filter Log Level is error or warn' }))
    expect(box()).toHaveValue('x')
  })

  it('keeps spacing inside phrases', async () => {
    const { user } = setup({ defaultValue: '"a  b" level:error' })
    await user.click(screen.getByRole('button', { name: 'Remove filter Log Level is error' }))
    expect(box()).toHaveValue('"a  b"')
  })

  it('removes the last chip and shows examples again', async () => {
    const { user } = setup({ defaultValue: 'a' })
    await user.click(screen.getByRole('button', { name: 'Remove filter “a”' }))
    expect(box()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'level:error,warn' })).toBeInTheDocument()
  })
})

describe('clear and examples', () => {
  it('clears, runs and returns focus', async () => {
    const { user, onExecute } = setup({ defaultValue: 'a' })
    await user.click(screen.getByRole('button', { name: 'Clear the filter' }))
    expect(box()).toHaveValue('')
    expect(box()).toHaveFocus()
    expect(onExecute.mock.calls[0][0].query).toBe('')
  })

  it('runs an example on click', async () => {
    const { user, onExecute } = setup()
    await user.click(screen.getByRole('button', { name: '-level:debug' }))
    expect(box()).toHaveValue('-level:debug')
    expect(onExecute.mock.calls[0][0].query).toBe('-level:debug')
  })

  it('accepts custom examples and can hide them', () => {
    const { rerender } = setup({ examples: ['foo:bar'] })
    expect(screen.getByRole('button', { name: 'foo:bar' })).toBeInTheDocument()
    rerender(<LogQLQueryBox examples={[]} recentStorageKey={null} />)
    expect(screen.queryByText('Try')).not.toBeInTheDocument()
  })
})

describe('LogQL panel', () => {
  it('toggles and updates as you type', async () => {
    const { user } = setup({ defaultValue: 'a' })
    await user.click(screen.getByRole('button', { name: 'Show LogQL' }))
    expect(screen.getByRole('button', { name: 'Hide LogQL' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Log query')).toBeInTheDocument()
    expect(document.querySelector('pre')).toHaveTextContent('|~ "(?i)a"')
    await user.type(box(), 'b')
    expect(document.querySelector('pre')).toHaveTextContent('|~ "(?i)ab"')
  })

  it('labels each branch and explains the merge', () => {
    setup({ defaultValue: 'a OR b', defaultLogqlOpen: true })
    expect(screen.getByText('Branch 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('Branch 2 of 2')).toBeInTheDocument()
    expect(screen.getByText(/Each branch is a separate Loki query/)).toBeInTheDocument()
  })

  it('shows nothing misleading for a broken filter', async () => {
    setup({ defaultValue: '"oops', defaultLogqlOpen: true })
    expect(document.querySelector('pre')).toBeNull()
  })

  it('can be switched off', () => {
    setup({ showLogql: false, defaultLogqlOpen: true })
    expect(screen.queryByRole('button', { name: 'Show LogQL' })).not.toBeInTheDocument()
    expect(document.querySelector('.lqb-logql')).toBeNull()
  })

  it('copies a branch and flashes the result', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<LogQLQueryBox defaultValue="a" defaultLogqlOpen showLogql recentStorageKey={null} />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('{service_name=~".+"}\n  |~ "(?i)a"')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('falls back to execCommand when the clipboard API fails', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    document.execCommand = vi.fn().mockReturnValue(true)
    render(<LogQLQueryBox defaultValue="a" defaultLogqlOpen showLogql recentStorageKey={null} />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(document.execCommand).toHaveBeenCalledWith('copy')
  })

  it('says so when copying fails completely', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn().mockReturnValue(false)
    render(<LogQLQueryBox defaultValue="a" defaultLogqlOpen showLogql recentStorageKey={null} />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument()
  })

  it('does not throw when the flash timer outlives the component', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { unmount } = render(<LogQLQueryBox defaultValue="a" defaultLogqlOpen showLogql recentStorageKey={null} />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    unmount()
  })
})

describe('help', () => {
  it('opens as a modal and focuses the close button', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Search help' }))
    const dialog = screen.getByRole('dialog', { name: 'Search help' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close help' })).toHaveFocus()
  })

  it('runs an example and closes', async () => {
    const { user, onExecute } = setup()
    await user.click(screen.getByRole('button', { name: 'Search help' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '"connection refused"' }))
    expect(box()).toHaveValue('"connection refused"')
    expect(onExecute).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns focus', async () => {
    const { user } = setup()
    const help = screen.getByRole('button', { name: 'Search help' })
    await user.click(help)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(help).toHaveFocus()
  })

  it('closes on the backdrop but not on the sheet', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Search help' }))
    await user.click(screen.getByText('Search syntax (click an example to run it)'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(document.querySelector('.lqb-modal') as Element)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps Tab inside the dialog', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Search help' }))
    const all = within(screen.getByRole('dialog')).getAllByRole('button')
    await user.tab({ shift: true })
    expect(all[all.length - 1]).toHaveFocus()
    await user.tab()
    expect(all[0]).toHaveFocus()
  })

  it('carries host styling into the portal', async () => {
    const { user } = setup({ className: 'mine', style: { color: 'red' }, theme: 'dark' })
    await user.click(screen.getByRole('button', { name: 'Search help' }))
    const modal = document.querySelector('.lqb-modal') as HTMLElement
    expect(modal).toHaveClass('lqb', 'mine')
    expect(modal).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(modal).toHaveAttribute('data-lqb-theme', 'dark')
    expect(modal.parentElement).toBe(document.body)
  })

  it('can be switched off', () => {
    setup({ showHelp: false })
    expect(screen.queryByRole('button', { name: 'Search help' })).not.toBeInTheDocument()
  })
})

describe('global shortcuts', () => {
  it('are off by default', async () => {
    const { user } = setup()
    await user.keyboard('/')
    expect(box()).not.toHaveFocus()
    await user.keyboard('?')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('focus on / and open help on ? when enabled', async () => {
    const { user } = setup({ globalShortcuts: true })
    await user.keyboard('/')
    expect(box()).toHaveFocus()
    expect(box()).toHaveValue('')
    await user.keyboard('{Escape}{Escape}')
    await user.keyboard('?')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('ignore other inputs and modifier keys', async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label="other" />
        <LogQLQueryBox globalShortcuts recentStorageKey={null} />
      </>
    )
    await user.click(screen.getByLabelText('other'))
    await user.keyboard('/')
    expect(screen.getByLabelText('other')).toHaveFocus()
    expect(screen.getByLabelText('other')).toHaveValue('/')
    fireEvent.keyDown(document.body, { key: '/', ctrlKey: true })
    expect(box()).not.toHaveFocus()
  })

  it('stop when unmounted', () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = setup({ globalShortcuts: true })
    unmount()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
    spy.mockRestore()
  })
})

describe('controlled mode', () => {
  function Controlled({ onExecute }: { onExecute?: LogQLQueryBoxProps['onExecute'] }) {
    const [q, setQ] = useState('start')
    return (
      <>
        <button onClick={() => setQ('from parent')}>set</button>
        <LogQLQueryBox value={q} onChange={setQ} onExecute={onExecute} recentStorageKey={null} />
      </>
    )
  }

  it('follows the value prop', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    expect(box()).toHaveValue('start')
    await user.click(screen.getByRole('button', { name: 'set' }))
    expect(box()).toHaveValue('from parent')
    expect(screen.getByRole('status')).toHaveTextContent('Filter changed. Press Execute.')
  })

  it('still types normally', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.type(box(), '!')
    expect(box()).toHaveValue('start!')
  })

  it('holds its value if the parent ignores a change', async () => {
    const user = userEvent.setup()
    render(<LogQLQueryBox value="fixed" onChange={() => undefined} recentStorageKey={null} />)
    await user.type(box(), 'x')
    expect(box()).toHaveValue('fixed')
  })

  it('accepts suggestions through the parent', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.clear(box())
    await user.type(box(), 'le{Tab}')
    expect(box()).toHaveValue('level:')
    expect(box().selectionStart).toBe(6)
  })
})

describe('imperative handle', () => {
  function withRef(props: LogQLQueryBoxProps = {}) {
    const ref = createRef<LogQLQueryBoxHandle>()
    const onExecute = vi.fn()
    render(<LogQLQueryBox ref={ref} onExecute={onExecute} recentStorageKey={null} {...props} />)
    return { handle: () => ref.current as LogQLQueryBoxHandle, onExecute }
  }

  it('focuses and reads the query', () => {
    const { handle } = withRef({ defaultValue: 'a' })
    act(() => handle().focus())
    expect(box()).toHaveFocus()
    expect(handle().getQuery()).toBe('a')
  })

  it('sets a query and runs it', () => {
    const { handle, onExecute } = withRef()
    act(() => handle().setQuery('level:error'))
    expect(box()).toHaveValue('level:error')
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('sets a query without running it', () => {
    const { handle, onExecute } = withRef()
    act(() => handle().setQuery('level:error', { run: false }))
    expect(box()).toHaveValue('level:error')
    expect(onExecute).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Filter changed. Press Execute.')
  })

  it('reports whether execute ran', () => {
    const { handle, onExecute } = withRef({ defaultValue: '"bad' })
    expect(handle().execute()).toBe(false)
    expect(onExecute).not.toHaveBeenCalled()
    act(() => handle().setQuery('good', { run: false }))
    let ran = false
    act(() => {
      ran = handle().execute()
    })
    expect(ran).toBe(true)
  })

  it('drives facets from outside', () => {
    const { handle } = withRef()
    act(() => handle().toggleValue('detected_level', 'error'))
    expect(box()).toHaveValue('level:error')
    act(() => handle().toggleValue('detected_level', 'warn'))
    expect(box()).toHaveValue('level:error,warn')
    act(() => handle().toggleValue('detected_level', 'debug', true))
    expect(box()).toHaveValue('level:error,warn -level:debug')
    act(() => handle().clearField('detected_level'))
    expect(box()).toHaveValue('')
    act(() => handle().appendTerm('service_name', ['a', 'b c']))
    expect(box()).toHaveValue('app:a,"b c"')
  })
})

describe('recent queries', () => {
  const stored = (key: string) => JSON.parse(localStorage.getItem(key) as string)

  it('stores what ran, newest first, without duplicates, capped at 8', async () => {
    const user = userEvent.setup()
    render(<LogQLQueryBox recentStorageKey="k" />)
    for (const q of ['one', 'two', 'one', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']) {
      await user.clear(box())
      await user.type(box(), `${q}{Enter}`)
    }
    expect(stored('k')).toEqual(['nine', 'eight', 'seven', 'six', 'five', 'four', 'three', 'one'])
  })

  it('shows the newest five in suggestions', async () => {
    localStorage.setItem('k', JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f', 'g']))
    const user = userEvent.setup()
    render(<LogQLQueryBox recentStorageKey="k" />)
    await user.click(box())
    expect(optionLabels()).toEqual(['level:', 'app:', 'apptype:', '-', 'a', 'b', 'c', 'd', 'e'])
  })

  it('skips empty queries', async () => {
    const user = userEvent.setup()
    render(<LogQLQueryBox recentStorageKey="k" />)
    await user.click(execute())
    expect(localStorage.getItem('k')).toBeNull()
  })

  it.each([['not json'], ['{"a":1}'], ['[1,2,"ok"]']])('tolerates corrupt storage %s', async (raw) => {
    localStorage.setItem('k', raw)
    const user = userEvent.setup()
    render(<LogQLQueryBox recentStorageKey="k" />)
    await user.click(box())
    expect(options().length).toBeGreaterThan(0)
  })

  it('keeps working when storage throws', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const onExecute = vi.fn()
    const user = userEvent.setup()
    render(<LogQLQueryBox recentStorageKey="k" onExecute={onExecute} />)
    await user.type(box(), 'a{Enter}')
    expect(onExecute).toHaveBeenCalledTimes(1)
    get.mockRestore()
    set.mockRestore()
  })

  it('leaves storage alone when disabled or controlled', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<LogQLQueryBox recentStorageKey={null} />)
    await user.type(box(), 'a{Enter}')
    unmount()
    render(<LogQLQueryBox recent={['x']} recentStorageKey="k" />)
    await user.type(box(), 'b{Enter}')
    expect(localStorage.length).toBe(0)
  })
})

describe('saving', () => {
  it('passes the query to the host', async () => {
    const onSave = vi.fn()
    const { user } = setup({ defaultValue: 'a', onSave })
    await user.click(screen.getByRole('button', { name: 'Save this filter' }))
    expect(onSave).toHaveBeenCalledWith('a', undefined)
  })

  it('says when the query is already saved and passes the match', async () => {
    const onSave = vi.fn()
    const { user } = setup({ defaultValue: ' level:error,warn ', onSave, saved: SAVED })
    const button = screen.getByRole('button', { name: 'Save this filter' })
    expect(button).toHaveAttribute('title', 'Already saved as “Errors and warnings”. Click to edit it')
    await user.click(button)
    expect(onSave).toHaveBeenCalledWith(' level:error,warn ', SAVED[0])
  })
})

describe('disabled and read only', () => {
  it('disabled blocks everything', async () => {
    const { user, onExecute } = setup({ defaultValue: 'a', disabled: true })
    expect(box()).toBeDisabled()
    expect(execute()).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear the filter' })).not.toBeInTheDocument()
    await user.click(box())
    expect(options()).toHaveLength(0)
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('read only keeps the query runnable but not editable', async () => {
    const { user, onExecute } = setup({ defaultValue: 'a', readOnly: true })
    await user.click(box())
    expect(options()).toHaveLength(0)
    await user.keyboard('z')
    expect(box()).toHaveValue('a')
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument()
    await user.click(execute())
    expect(onExecute).toHaveBeenCalledTimes(1)
  })
})

describe('customisation', () => {
  it('overrides labels', () => {
    setup({ labels: { execute: 'Run', placeholder: 'Search' }, description: false })
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    expect(box()).toHaveAttribute('placeholder', 'Search')
    expect(screen.queryByText(/Build log queries/)).not.toBeInTheDocument()
  })

  it('renders host actions and status text', () => {
    setup({ actions: <button>Live</button>, statusText: 'Time range changed', dirty: true })
    expect(screen.getByRole('button', { name: 'Live' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Time range changed')
    expect(execute()).not.toHaveClass('lqb-run-idle')
  })

  it('keeps the error status above host status text', () => {
    setup({ defaultValue: '"bad', statusText: 'Time range changed' })
    expect(screen.getByRole('status')).toHaveTextContent('Fix the filter before running it.')
  })

  it('sets the theme attribute and class', () => {
    setup({ theme: 'dark', className: 'mine' })
    expect(document.querySelector('.lqb')).toHaveAttribute('data-lqb-theme', 'dark')
    expect(document.querySelector('.lqb')).toHaveClass('mine')
  })

  it('does not set a theme on auto', () => {
    setup()
    expect(document.querySelector('.lqb')).not.toHaveAttribute('data-lqb-theme')
  })

  it('hides default examples that do not fit a custom schema', () => {
    render(
      <LogQLQueryBox
        recentStorageKey={null}
        schema={{ fields: { ns: { label: 'Namespace', indexed: true }, body: { label: 'Body', kind: 'line' } } }}
      />
    )
    expect(screen.queryByText('Try')).not.toBeInTheDocument()
  })

  it('applies matchCase and maxBranches from props', () => {
    setup({ defaultValue: 'a', defaultLogqlOpen: true, matchCase: true })
    expect(document.querySelector('pre')).toHaveTextContent('|= "a"')
  })

  it('throws a clear error for a broken schema', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<LogQLQueryBox schema={{ fields: {} }} />)).toThrow('needs one field with kind "line"')
    spy.mockRestore()
  })
})

describe('screen readers', () => {
  it('links the error to the input', async () => {
    const { user } = setup({ defaultValue: '"bad' })
    const alert = screen.getByRole('alert')
    expect(alert.id).toBeTruthy()
    expect(box()).toHaveAttribute('aria-describedby', alert.id)
    await user.type(box(), '"')
    expect(box()).not.toHaveAttribute('aria-describedby')
  })

  it('announces how many suggestions there are', async () => {
    const { user } = setup()
    const live = document.querySelector('.lqb-sr') as HTMLElement
    expect(live).toHaveAttribute('aria-live', 'polite')
    expect(live).toHaveTextContent('')
    await user.click(box())
    expect(live).toHaveTextContent('4 suggestions available')
    await user.type(box(), 'le')
    expect(live).toHaveTextContent('1 suggestion available')
    await user.keyboard('{Escape}')
    expect(live).toHaveTextContent('')
  })

  it('groups suggestions under named headings', async () => {
    const { user } = setup({ saved: SAVED })
    await user.click(box())
    const fields = screen.getByRole('group', { name: 'Filter by' })
    expect(within(fields).getAllByRole('option')).toHaveLength(4)
    expect(within(screen.getByRole('group', { name: 'Saved and recent' })).getAllByRole('option')).toHaveLength(3)
    expect(options().map((o) => o.id)).toHaveLength(new Set(options().map((o) => o.id)).size)
  })

  it('keeps option ids continuous across groups for the arrow keys', async () => {
    const { user } = setup({ saved: SAVED })
    await user.click(box())
    await user.keyboard('{ArrowUp}')
    expect(selected()).toBe('Timeouts')
    expect(box()).toHaveAttribute('aria-activedescendant', options()[options().length - 1].id)
  })

  it('moves focus to the box when the last chip is removed', async () => {
    const { user } = setup({ defaultValue: 'a' })
    screen.getByRole('button', { name: 'Remove filter \u201ca\u201d' }).focus()
    await user.keyboard('{Enter}')
    expect(box()).toHaveFocus()
  })

  it('leaves focus alone when other chips remain', async () => {
    const { user } = setup({ defaultValue: 'a b' })
    await user.click(screen.getByRole('button', { name: 'Remove filter \u201ca\u201d' }))
    expect(box()).not.toHaveFocus()
  })
})

describe('many chips', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
  const chips = () => document.querySelectorAll('.lqb-chip:not(.lqb-chip-more)')

  it('shows all chips up to the limit', () => {
    setup({ defaultValue: words(50) })
    expect(chips()).toHaveLength(50)
    expect(document.querySelector('.lqb-chip-more')).toBeNull()
  })

  it('shows the first 50 and counts the rest', () => {
    setup({ defaultValue: words(5000) })
    expect(chips()).toHaveLength(50)
    expect(document.querySelector('.lqb-chip-more')).toHaveTextContent('+4950 more')
  })

  it('still runs and compiles the whole filter', async () => {
    const { user, onExecute } = setup({ defaultValue: words(60) })
    await user.click(execute())
    expect(onExecute.mock.calls[0][0].logql.branches[0].split('\n')).toHaveLength(61)
  })

  it('removing a chip brings the next one into view', async () => {
    const { user } = setup({ defaultValue: words(51) })
    await user.click(screen.getByRole('button', { name: 'Remove filter \u201cw0\u201d' }))
    expect(chips()).toHaveLength(50)
    expect(document.querySelector('.lqb-chip-more')).toBeNull()
    expect(screen.getByText('\u201cw50\u201d')).toBeInTheDocument()
  })

  it('can be translated', () => {
    setup({ defaultValue: words(52), labels: { moreFilters: (n) => `y ${n} mas` } })
    expect(document.querySelector('.lqb-chip-more')).toHaveTextContent('y 2 mas')
  })
})

describe('suggestion placement', () => {
  const rect = (top: number, bottom: number, left = 20, width = 500) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top, bottom, left, width, right: left + width, height: bottom - top, x: left, y: top, toJSON: () => ({}) })
  const list = () => screen.getByRole('listbox')

  it('opens in the top layer so a parent cannot clip it', async () => {
    const showPopover = vi.fn()
    HTMLElement.prototype.showPopover = showPopover
    const { user } = setup()
    await user.click(box())
    expect(document.querySelector('.lqb-sugg')).toHaveAttribute('popover', 'manual')
    expect(showPopover).toHaveBeenCalledTimes(1)
    await user.type(box(), 'l')
    expect(showPopover).toHaveBeenCalledTimes(1)
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover
  })

  it('works in browsers without popover support', async () => {
    const { user } = setup()
    await user.click(box())
    expect('showPopover' in list()).toBe(false)
    expect(list()).not.toHaveAttribute('popover')
    expect(options().length).toBeGreaterThan(0)
  })

  it('stays inside the box element in the DOM, so host dialogs keep working', async () => {
    const { user } = setup({ className: 'host' })
    await user.click(box())
    expect(list().closest('.lqb.host')).toBeTruthy()
  })

  it('opens below the box and matches its width', async () => {
    const spy = rect(100, 160)
    const { user } = setup()
    await user.click(box())
    expect(list()).toHaveStyle({ left: '20px', width: '500px', top: '166px', bottom: 'auto', maxHeight: '300px' })
    spy.mockRestore()
  })

  it('flips above the box near the bottom of the screen', async () => {
    const spy = rect(700, 760)
    const { user } = setup()
    await user.click(box())
    expect(list()).toHaveStyle({ top: 'auto', bottom: `${window.innerHeight - 700 + 6}px`, maxHeight: '300px' })
    spy.mockRestore()
  })

  it('stays below when there is more room there', async () => {
    const spy = rect(5, 700)
    const { user } = setup()
    await user.click(box())
    expect(list()).toHaveStyle({ top: '706px', bottom: 'auto' })
    spy.mockRestore()
  })

  it('never gets too short to use', async () => {
    const spy = rect(10, window.innerHeight - 10)
    const { user } = setup()
    await user.click(box())
    expect(list()).toHaveStyle({ maxHeight: '120px' })
    spy.mockRestore()
  })

  it('follows the box on scroll and resize, then stops', async () => {
    const spy = rect(100, 160)
    const remove = vi.spyOn(window, 'removeEventListener')
    const { user } = setup()
    await user.click(box())
    spy.mockRestore()
    const moved = rect(50, 110, 40, 300)
    fireEvent.scroll(document.body)
    expect(list()).toHaveStyle({ top: '116px', left: '40px', width: '300px' })
    moved.mockRestore()
    const resized = rect(200, 260, 10, 200)
    fireEvent(window, new Event('resize'))
    expect(list()).toHaveStyle({ top: '266px', left: '10px', width: '200px' })
    resized.mockRestore()
    await user.keyboard('{Escape}')
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    remove.mockRestore()
  })
})

describe('baseSelector prop', () => {
  const pre = () => document.querySelector('.lqb-logql pre')

  it('scopes the LogQL panel and what onExecute receives', async () => {
    const { user, onExecute } = setup({ baseSelector: { index: 'payments' }, defaultValue: 'timeout', defaultLogqlOpen: true })
    expect(pre()).toHaveTextContent('{index="payments"}')
    await user.click(execute())
    expect(onExecute.mock.calls[0][0].logql.branches[0]).toContain('{index="payments"}')
  })

  it('updates when the index changes', () => {
    const { rerender } = setup({ baseSelector: { index: 'one' }, defaultLogqlOpen: true })
    expect(pre()).toHaveTextContent('{index="one"}')
    rerender(<LogQLQueryBox baseSelector={{ index: 'two' }} defaultLogqlOpen showLogql recentStorageKey={null} />)
    expect(pre()).toHaveTextContent('{index="two"}')
  })

  it('accepts a new object with the same value on every render', () => {
    const { rerender } = setup({ baseSelector: { index: 'one' }, defaultValue: 'x', defaultLogqlOpen: true })
    const first = pre()?.textContent
    rerender(<LogQLQueryBox baseSelector={{ index: 'one' }} defaultValue="x" defaultLogqlOpen showLogql recentStorageKey={null} />)
    expect(pre()?.textContent).toBe(first)
  })

  it('shows no index field in the suggestions', async () => {
    const { user } = setup({ baseSelector: { index: 'payments' } })
    await user.click(box())
    expect(optionLabels()).not.toContain('index:')
  })
})

describe('loadValues prop', () => {
  const deferred = () => {
    let resolve!: (list: { value: string; count?: number }[]) => void
    let reject!: (e: Error) => void
    const promise = new Promise<{ value: string; count?: number }[]>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  it('loads a field once and shows its values with counts', async () => {
    const loadValues = vi.fn(async () => [{ value: 'from-api', count: 7 }])
    const { user } = setup({ values: {}, loadValues })
    await user.type(box(), 'app:')
    expect(await screen.findByRole('option', { name: /from-api/ })).toHaveTextContent('7 lines')
    await user.type(box(), 'f')
    expect(loadValues).toHaveBeenCalledTimes(1)
    expect(loadValues.mock.calls[0]).toEqual(['service_name', { signal: expect.any(AbortSignal) }])
  })

  it('does not load until a value is being picked', async () => {
    const loadValues = vi.fn(async () => [])
    const { user } = setup({ loadValues })
    await user.type(box(), 'ap')
    expect(loadValues).not.toHaveBeenCalled()
  })

  it('shows a loading row, then replaces it', async () => {
    const d = deferred()
    const { user } = setup({ values: {}, loadValues: () => d.promise })
    await user.type(box(), 'app:')
    expect(await screen.findAllByText('Loading values…')).not.toHaveLength(0)
    expect(box()).toHaveAttribute('aria-expanded', 'true')
    d.resolve([{ value: 'late' }])
    expect(await screen.findByRole('option', { name: /late/ })).toBeInTheDocument()
    expect(screen.queryByText('Loading values…')).not.toBeInTheDocument()
  })

  it('keeps the values it already has while loading', async () => {
    const d = deferred()
    const { user } = setup({ loadValues: () => d.promise })
    await user.type(box(), 'app:')
    expect(optionLabels()).toContain('checkout-api')
    expect(await screen.findAllByText('Loading values…')).not.toHaveLength(0)
    d.resolve([{ value: 'late' }])
    await screen.findByRole('option', { name: /late/ })
  })

  it('uses loaded values to fold what was typed', async () => {
    const { user } = setup({ values: {}, loadValues: async () => [{ value: 'Billing' }], defaultLogqlOpen: true })
    await user.type(box(), 'app:billing')
    await waitFor(() => expect(document.querySelector('.lqb-logql pre')).toHaveTextContent('service_name="Billing"'))
  })

  it('closes on Escape while loading', async () => {
    const d = deferred()
    const { user } = setup({ values: {}, loadValues: () => d.promise })
    await user.type(box(), 'app:')
    await screen.findAllByText('Loading values…')
    await user.keyboard('{Escape}')
    expect(box()).toHaveAttribute('aria-expanded', 'false')
    expect(box()).toHaveFocus()
  })

  it('keeps working when loading fails, and tries again next time', async () => {
    const loadValues = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue([{ value: 'second-try' }])
    const { user } = setup({ loadValues })
    await user.type(box(), 'app:')
    await waitFor(() => expect(loadValues).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Loading values…')).not.toBeInTheDocument())
    expect(optionLabels()).toContain('checkout-api')
    await user.keyboard('{Escape}')
    await user.click(box())
    expect(await screen.findByRole('option', { name: /second-try/ })).toBeInTheDocument()
    expect(loadValues).toHaveBeenCalledTimes(2)
  })

  it('treats a bad result as a failure', async () => {
    const loadValues = vi.fn(async () => 'nope' as unknown as { value: string }[])
    const { user } = setup({ loadValues })
    await user.type(box(), 'app:')
    await waitFor(() => expect(screen.queryByText('Loading values…')).not.toBeInTheDocument())
    expect(optionLabels()).toContain('checkout-api')
  })

  it('survives a loader that throws straight away', async () => {
    const { user } = setup({
      loadValues: () => {
        throw new Error('bad')
      }
    })
    await user.type(box(), 'app:')
    await waitFor(() => expect(screen.queryByText('Loading values…')).not.toBeInTheDocument())
    expect(optionLabels()).toContain('checkout-api')
  })

  it('drops a late answer and loads again when the index changes', async () => {
    const first = deferred()
    const loadValues = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue([{ value: 'new-index' }])
    const { user, rerender } = setup({ values: {}, loadValues, baseSelector: { index: 'one' } })
    await user.type(box(), 'app:')
    await waitFor(() => expect(loadValues).toHaveBeenCalledTimes(1))
    const signal = loadValues.mock.calls[0][1].signal as AbortSignal
    rerender(<LogQLQueryBox values={{}} loadValues={loadValues} baseSelector={{ index: 'two' }} recentStorageKey={null} defaultValue="app:" />)
    expect(signal.aborted).toBe(true)
    first.resolve([{ value: 'old-index' }])
    expect(await screen.findByRole('option', { name: /new-index/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /old-index/ })).not.toBeInTheDocument()
  })

  it('cancels on unmount', async () => {
    const d = deferred()
    const loadValues = vi.fn(() => d.promise)
    const { user, unmount } = setup({ values: {}, loadValues })
    await user.type(box(), 'app:')
    await waitFor(() => expect(loadValues).toHaveBeenCalled())
    const signal = (loadValues.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal
    unmount()
    expect(signal.aborted).toBe(true)
    d.resolve([{ value: 'gone' }])
  })

  it('is ignored when a ready engine is passed', async () => {
    const loadValues = vi.fn(async () => [])
    const { user } = setup({ engine: createEngine(), loadValues })
    await user.type(box(), 'app:')
    expect(loadValues).not.toHaveBeenCalled()
  })
})

describe('more than one box on a page', () => {
  it('keeps ids unique and state separate', async () => {
    const user = userEvent.setup()
    render(
      <>
        <LogQLQueryBox recentStorageKey={null} defaultValue="le" />
        <LogQLQueryBox recentStorageKey={null} defaultValue="ap" />
      </>
    )
    const [a, b] = screen.getAllByRole('combobox') as HTMLTextAreaElement[]
    await user.click(a)
    const first = a.getAttribute('aria-controls')
    expect(first).toBeTruthy()
    await user.click(b)
    expect(b.getAttribute('aria-controls')).toBeTruthy()
    expect(b.getAttribute('aria-controls')).not.toBe(first)
    expect(a).toHaveValue('le')
    expect(b).toHaveValue('ap')
  })
})

describe('resilience', () => {
  it('renders every fuzz shaped query without crashing', async () => {
    const samples = ['constructor:x', '__proto__', '()', '-(', '(((', ')))', '"', '/', '\\', ',', ':', '*', '\u0000', '-(a OR b)', 'app:*']
    for (const q of samples) {
      const { unmount } = render(<LogQLQueryBox defaultValue={q} defaultLogqlOpen showLogql recentStorageKey={null} />)
      await waitFor(() => expect(box()).toHaveValue(q))
      unmount()
    }
  })

  it('does not lose the caret when typing in the middle', async () => {
    const user = userEvent.setup()
    render(<LogQLQueryBox recentStorageKey={null} defaultValue="ab" />)
    await user.click(box())
    box().setSelectionRange(1, 1)
    await user.keyboard('x')
    expect(box()).toHaveValue('axb')
    expect(box().selectionStart).toBe(2)
  })
})
