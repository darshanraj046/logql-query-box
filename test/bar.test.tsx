import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LogQLQueryBox, type LogQLQueryBoxHandle, type LogQLQueryBoxProps, type SavedQuery, type Schema } from '../src'

const schema: Schema = {
  parser: 'json',
  operator: '=',
  fields: {
    logLevel: { label: 'level', aliases: ['level'], values: ['ERROR', 'INFO', 'WARN', 'DEBUG', 'NONE'], example: 'Log level: ERROR, WARN, INFO, DEBUG, NONE' },
    serviceName: { label: 'app', aliases: ['app'], example: 'App that wrote the log line' },
    serviceType: { label: 'app.type', aliases: ['app.type'], values: ['JAVA', 'NODE', 'GO', 'PYTHON'], example: 'Runtime: JAVA, NODE, GO, PYTHON' },
    content: { label: 'content', kind: 'line', parsed: true, aliases: ['content'], example: 'Text in the log line, use * as wildcard' }
  }
}

const SAVED: SavedQuery[] = [
  { id: '1', name: 'Errors only', query: 'level = ERROR', pinned: true },
  { id: '2', name: 'Gateway timeouts', query: 'content = *SocketTimeoutException*', pinned: true },
  { id: '3', name: 'Python apps', query: 'app.type = PYTHON' },
  { id: '4', name: 'PII detector', query: 'app = pii-detector' }
]

const box = () => screen.getByRole('combobox') as HTMLTextAreaElement
const container = () => document.body
const queriesButton = () => screen.getByRole('button', { name: /Queries/ })

function setup(props: LogQLQueryBoxProps = {}) {
  const onExecute = vi.fn()
  const user = userEvent.setup()
  const view = render(<LogQLQueryBox variant="bar" schema={schema} baseSelector={{ index: 'a' }} saved={SAVED} recentStorageKey={null} onExecute={onExecute} {...props} />)
  return { user, onExecute, ...view }
}

describe('defaults', () => {
  it('hides search help and the LogQL toggle unless asked', () => {
    const { unmount } = render(<LogQLQueryBox recentStorageKey={null} />)
    expect(screen.queryByRole('button', { name: 'Search help' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show LogQL' })).toBeNull()
    unmount()
    render(<LogQLQueryBox showHelp showLogql recentStorageKey={null} />)
    expect(screen.getByRole('button', { name: 'Search help' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show LogQL' })).toBeInTheDocument()
  })
})

describe('bar variant', () => {
  it('renders the compact bar', () => {
    setup()
    expect(box()).toHaveAttribute('placeholder', 'Type to filter')
    expect(queriesButton()).toHaveTextContent('Queries4')
    expect(screen.getByRole('button', { name: 'Run query' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Search help' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('walks field, operator, value, with no saved or recent rows', async () => {
    const { user } = setup()
    await user.click(box())
    const opts = () => screen.getAllByRole('option').map((o) => o.querySelector('code')?.textContent)
    expect(opts()).toEqual(['level', 'app', 'app.type', 'content'])
    await user.click(screen.getByText('level'))
    expect(box()).toHaveValue('level ')
    expect(screen.getByText('How should level match?')).toBeInTheDocument()
    expect(opts()).toEqual(['level =', 'level !=', 'level =~', 'level !~'])
    await user.click(screen.getByText('level !='))
    expect(box()).toHaveValue('level != ')
    expect(opts()).toEqual(['ERROR', 'INFO', 'WARN', 'DEBUG', 'NONE'])
    expect(screen.queryByRole('group', { name: 'Operators' })).toBeNull()
    await user.click(screen.getByText('DEBUG'))
    expect(box()).toHaveValue('level != DEBUG ')
    expect(opts()).toEqual(['level', 'app', 'app.type', 'content'])
  })

  it('works from the keyboard alone', async () => {
    const { user, onExecute } = setup()
    await user.click(box())
    await user.keyboard('app.t{Tab}')
    expect(box()).toHaveValue('app.type ')
    await user.keyboard('{ArrowDown}{Tab}')
    expect(box()).toHaveValue('app.type != ')
    await user.keyboard('{Tab}')
    expect(box()).toHaveValue('app.type != JAVA ')
    await user.keyboard('{Escape}{Enter}')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app.type != JAVA ' }))
  })

  it('accepts the highlighted value on Enter instead of running a half typed one', async () => {
    const { user, onExecute } = setup({ values: { serviceName: ['apiwiz-api-security', 'pii-detector'] } })
    await user.click(box())
    await user.keyboard('app = apiwiz-api-secu{Enter}')
    expect(box()).toHaveValue('app = apiwiz-api-security ')
    expect(onExecute).not.toHaveBeenCalled()
    await user.keyboard('{Escape}{Enter}')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app = apiwiz-api-security ' }))
  })

  it('offers every value containing the typed text', async () => {
    const { user } = setup({ values: { serviceName: ['pii-detector', 'policy-evaluator'] } })
    await user.click(box())
    await user.keyboard('app != pii')
    expect(screen.getByText('Every app containing “pii”')).toBeInTheDocument()
    await user.click(screen.getByText('*pii*'))
    expect(box()).toHaveValue('app != *pii* ')
  })

  it('explains what to type where there are no values', async () => {
    const { user } = setup()
    await user.click(box())
    await user.click(screen.getByText('content'))
    await user.click(screen.getByText('content ='))
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent(/Use \* as a wildcard/)
    await user.keyboard('{Control>}a{/Control}content =~ ')
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent(/regular expression \(RE2\) to find in the log line/)
  })

  it('combines repeated filters when the query runs', async () => {
    const { user, onExecute } = setup({ defaultValue: 'app != policy-evaluator app != pii-detector' })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    expect(box()).toHaveValue('app != policy-evaluator,pii-detector')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app != policy-evaluator,pii-detector' }))
  })

  it('after a run, offers fixes for a value that matches nothing', async () => {
    const { user, onExecute } = setup({ defaultValue: 'app != policy-evaluator app != pii', values: { serviceName: ['pii-detector', 'pii-scanner', 'policy-evaluator'] } })
    expect(screen.queryByRole('status')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    const note = screen.getByText(/No app is exactly “pii”, so nothing was excluded\. Did you mean:/).closest('.lqb-unknown') as HTMLElement
    expect(within(note).getAllByRole('button').map((b) => b.textContent)).toEqual(['pii-detector', 'pii-scanner', 'Every app containing “pii”'])
    await user.click(within(note).getByText('Every app containing “pii”'))
    expect(box()).toHaveValue('app != policy-evaluator,*pii*')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app != policy-evaluator,*pii*' }))
    expect(document.querySelector('.lqb-unknown')).toBeNull()
  })

  it('hides the fix prompt while the query is being edited', async () => {
    const { user } = setup({ defaultValue: 'app = zzz', values: { serviceName: ['a'] } })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    expect(screen.getByText(/No app is exactly “zzz”, so nothing matches it\. Check the spelling\./)).toBeInTheDocument()
    await user.click(box())
    await user.keyboard('z')
    expect(document.querySelector('.lqb-unknown')).toBeNull()
  })

  it('shows a one line summary with a hidden count while closed', async () => {
    const { user, container } = setup({ defaultValue: 'level = ERROR\napp = apiwiz-api-security content = "a b"' })
    const summary = container.querySelector('.lqb-summary') as HTMLElement
    expect([...summary.querySelectorAll('.lqb-piece')].map((p) => p.textContent)).toEqual(['level = ERROR', ', app = apiwiz-api-security', ', content = "a b"'])
    expect([...summary.querySelectorAll('.lqb-hl-f')].map((n) => n.textContent)).toEqual(['level', 'app', 'content'])
    expect(container.querySelector('.lqb-hl')).toBeNull()
    expect(screen.getByRole('button', { name: 'Clear the filter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy query' })).toBeNull()
    await user.click(box())
    expect(container.querySelector('.lqb-summary')).toBeNull()
    expect(container.querySelector('.lqb-hl')).toHaveTextContent('level = ERROR')
    expect(screen.getByRole('button', { name: 'Copy query' })).toBeInTheDocument()
  })

  it('counts the filters that do not fit', () => {
    const widths = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
    const lefts = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      return [...(this.parentElement?.children ?? [])].indexOf(this) * 120
    })
    const sizes = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(110)
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600)
    const { container } = setup({ defaultValue: 'level = ERROR app = a app.type = GO content = x timeout' })
    expect(container.querySelector('.lqb-more')).toHaveTextContent('+3 filters')
    expect(container.querySelector('.lqb-summary')).toHaveAttribute('data-overflow')
    ;[widths, lefts, sizes, scroll].forEach((s) => s.mockRestore())
  })

  it('clears from the closed bar', async () => {
    const { user, onExecute } = setup({ defaultValue: 'level = ERROR' })
    await user.click(screen.getByRole('button', { name: 'Clear the filter' }))
    expect(box()).toHaveValue('')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: '' }))
  })

  it('opening Queries does not expand or highlight the bar', async () => {
    const { user, container } = setup({ defaultValue: 'level = ERROR app = pii-detector' })
    await user.click(queriesButton())
    expect(container.querySelector('.lqb-bar')).not.toHaveAttribute('data-open')
    expect(container.querySelector('.lqb-bar')).not.toHaveAttribute('data-focus')
    expect(container.querySelector('.lqb-summary')).not.toBeNull()
    await user.keyboard('{Escape}')
    await user.click(box())
    expect(container.querySelector('.lqb-bar')).toHaveAttribute('data-open')
    await user.click(queriesButton())
    expect(container.querySelector('.lqb-bar')).not.toHaveAttribute('data-open')
  })

  it('saves through the Save query as popover', async () => {
    const onSaveQuery = vi.fn()
    const { user } = setup({ defaultValue: 'level = ERROR app = pii-detector', onSaveQuery })
    await user.click(box())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const pop = screen.getByRole('dialog', { name: 'Save query as' })
    const name = within(pop).getByRole('textbox', { name: 'Name' })
    expect(name).toHaveValue('ERROR · pii-detector')
    expect(name).toHaveFocus()
    expect(within(pop).getByText('level = ERROR app = pii-detector')).toBeInTheDocument()
    expect(container().querySelector('.lqb-bar')).toHaveAttribute('data-open')
    await user.keyboard('{Control>}a{/Control}PII errors')
    await user.click(within(pop).getByRole('checkbox', { name: 'Pin to the top of Queries' }))
    await user.keyboard('{Enter}')
    expect(onSaveQuery).toHaveBeenCalledWith({ name: 'PII errors', query: 'level = ERROR app = pii-detector', pinned: true }, undefined)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save query as' })).toBeNull())
  })

  it('keeps the popover open with the error when saving fails', async () => {
    const onSaveQuery = vi.fn().mockRejectedValue(new Error('A saved query named x already exists.'))
    const { user } = setup({ defaultValue: 'level = WARN', onSaveQuery })
    await user.click(box())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await user.keyboard('{Enter}')
    expect(await screen.findByText('A saved query named x already exists.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Save query as' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Save query as' })).toBeNull()
  })

  it('prefills an existing saved query and offers Update', async () => {
    const onSaveQuery = vi.fn()
    const { user } = setup({ defaultValue: 'level = ERROR', onSaveQuery })
    await user.click(box())
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const pop = screen.getByRole('dialog', { name: 'Save query as' })
    expect(within(pop).getByRole('textbox', { name: 'Name' })).toHaveValue('Errors only')
    expect(within(pop).getByRole('checkbox')).toBeChecked()
    await user.click(within(pop).getByRole('button', { name: 'Update' }))
    expect(onSaveQuery).toHaveBeenCalledWith({ name: 'Errors only', query: 'level = ERROR', pinned: true }, SAVED[0])
  })

  it('edits a saved query inline in the panel', async () => {
    const onUpdateSaved = vi.fn()
    const { user } = setup({ onUpdateSaved })
    await user.click(queriesButton())
    await user.click(screen.getByRole('button', { name: 'Edit Python apps' }))
    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(name).toHaveValue('Python apps')
    expect(name).toHaveFocus()
    const q = screen.getByRole('textbox', { name: 'Query' })
    expect(q).toHaveValue('app.type = PYTHON')
    await user.clear(q)
    await user.type(q, 'app.type = (')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.clear(q)
    await user.type(q, 'app.type = GO')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onUpdateSaved).toHaveBeenCalledWith(SAVED[2], { name: 'Python apps', query: 'app.type = GO' })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Queries' })).toBeInTheDocument()
  })

  it('cancels an inline edit with Escape without closing the panel', async () => {
    const { user } = setup({ onUpdateSaved: vi.fn(), onEditSaved: vi.fn() })
    await user.click(queriesButton())
    await user.click(screen.getByRole('button', { name: 'Edit PII detector' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Queries' })).toBeInTheDocument()
  })

  it('cancels a delete with Cancel or Escape and shows a failed delete', async () => {
    const onDeleteSaved = vi.fn().mockRejectedValueOnce(new Error('Delete failed, try again.'))
    const { user } = setup({ onDeleteSaved })
    await user.click(queriesButton())
    await user.click(screen.getByRole('button', { name: 'Delete Python apps' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Delete “Python apps”?' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Delete Python apps' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Delete “Python apps”?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Queries' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete Python apps' }))
    await user.click(within(screen.getByRole('group', { name: 'Delete “Python apps”?' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Delete failed, try again.')).toBeInTheDocument()
  })

  it('anchors a pattern with the caret in the middle', async () => {
    const { user } = setup({ values: { serviceName: ['passive-scan-consumer', 'pii-detector'] } })
    await user.click(box())
    await user.keyboard('app =~ ')
    await user.click(screen.getByText('^ … $'))
    expect(box()).toHaveValue('app =~ ^$')
    expect(box().selectionStart).toBe(8)
    await user.keyboard('passive-scan-consumer')
    expect(box()).toHaveValue('app =~ ^passive-scan-consumer$')
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent('Matches 1 of 2: passive-scan-consumer')
  })

  it('offers fixes when a pattern matches nothing', async () => {
    const { user, onExecute } = setup({ defaultValue: 'level = INFO app =~ ^passive$', values: { serviceName: ['passive-scan-consumer', 'pii-detector'] } })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    const note = document.querySelector('.lqb-unknown') as HTMLElement
    expect(note).toHaveTextContent('No app matches “^passive$”, so nothing matches it. ^ means starts with and $ means ends with. Did you mean:')
    expect(within(note).getAllByRole('button').map((b) => b.textContent)).toEqual(['passive-scan-consumer', 'Any app starting with “passive”'])
    await user.click(within(note).getByText('Any app starting with “passive”'))
    expect(box()).toHaveValue('level = INFO app = passive*')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'level = INFO app = passive*' }))
  })

  it('hides value counts when asked', async () => {
    const values = { serviceName: [{ value: 'a', count: 12 }] }
    const { user, unmount } = setup({ values })
    await user.click(box())
    await user.keyboard('app = ')
    expect(screen.getByText('12 lines')).toBeInTheDocument()
    unmount()
    setup({ values, showValueCounts: false })
    await user.click(box())
    await user.keyboard('app = ')
    expect(screen.queryByText('12 lines')).toBeNull()
  })

  it('stays one line while focused and empty, and grows over the page with a query', async () => {
    const { user, container } = setup()
    await user.click(box())
    expect(container.querySelector('.lqb-bar')).not.toHaveAttribute('data-open')
    expect(screen.queryByRole('button', { name: 'Clear the filter' })).toBeNull()
    await user.keyboard('timeout')
    expect(container.querySelector('.lqb-bar')).toHaveAttribute('data-open')
    expect(container.querySelector('.lqb-bar-slot > .lqb-bar')).not.toBeNull()
  })

  it('shows copy, Save and Create alert only while focused', async () => {
    const onSave = vi.fn()
    const onCreateAlert = vi.fn()
    const { user } = setup({ defaultValue: 'level = ERROR', onSave, onCreateAlert })
    expect(screen.queryByRole('button', { name: 'Copy query' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    await user.click(box())
    expect(screen.getByRole('button', { name: 'Clear the filter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy query' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('level = ERROR', SAVED[0])
    await user.click(screen.getByRole('button', { name: 'Create alert' }))
    expect(onCreateAlert).toHaveBeenCalledWith('level = ERROR', SAVED[0])
    expect(box()).toHaveFocus()
  })

  it('highlights known field names', () => {
    const { container } = setup({ defaultValue: 'level = ERROR nope = x app.type != GO' })
    expect([...container.querySelectorAll('.lqb-hl-f')].map((n) => n.textContent)).toEqual(['level', 'app.type'])
  })

  it('lists pinned then the rest, filters and runs a saved query', async () => {
    const onSelectSaved = vi.fn()
    const onSavedSearch = vi.fn()
    const { user, onExecute } = setup({ onSelectSaved, onSavedSearch })
    await user.click(queriesButton())
    const panel = screen.getByRole('dialog', { name: 'Queries' })
    const groups = within(panel).getAllByRole('group')
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Pinned', 'All saved'])
    expect(within(groups[0]).getAllByRole('button').map((b) => b.querySelector('.lqb-q-name')?.textContent)).toEqual(['Errors only', 'Gateway timeouts'])
    await user.type(within(panel).getByRole('textbox'), 'python')
    expect(onSavedSearch).toHaveBeenLastCalledWith('python')
    expect(within(panel).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['All saved'])
    await user.click(within(panel).getByText('Python apps'))
    expect(box()).toHaveValue('app.type = PYTHON')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app.type = PYTHON' }))
    expect(onSelectSaved).toHaveBeenCalledWith(SAVED[2])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows row actions only for the callbacks given', async () => {
    const onPinSaved = vi.fn()
    const onDeleteSaved = vi.fn()
    const onEditSaved = vi.fn()
    const { user } = setup({ onPinSaved, onDeleteSaved, onEditSaved })
    await user.click(queriesButton())
    expect(screen.queryByRole('button', { name: 'Create an alert from Python apps' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Pin Python apps' }))
    expect(onPinSaved).toHaveBeenCalledWith(SAVED[2], true)
    await user.click(screen.getByRole('button', { name: 'Unpin Errors only' }))
    expect(onPinSaved).toHaveBeenLastCalledWith(SAVED[0], false)
    await user.click(screen.getByRole('button', { name: 'Edit PII detector' }))
    expect(onEditSaved).toHaveBeenCalledWith(SAVED[3])
    await user.click(screen.getByRole('button', { name: 'Delete PII detector' }))
    expect(onDeleteSaved).not.toHaveBeenCalled()
    const confirm = screen.getByRole('group', { name: 'Delete “PII detector”?' })
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(onDeleteSaved).toHaveBeenCalledWith(SAVED[3])
  })

  it('closes on Escape, outside click, and through the handle', async () => {
    const ref = createRef<LogQLQueryBoxHandle>()
    const { user } = setup({ ref } as LogQLQueryBoxProps)
    await user.click(queriesButton())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(queriesButton()).toHaveFocus()
    await user.click(queriesButton())
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
    ref.current?.openQueries()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    ref.current?.closeQueries()
  })

  it('shows empty and loading states, and respects savedCount and showQueries', async () => {
    const { user, rerender } = setup({ saved: [], savedCount: 12 })
    expect(queriesButton()).toHaveTextContent('Queries12')
    await user.click(queriesButton())
    expect(screen.getByText('No saved queries yet. Type a filter and press Save.')).toBeInTheDocument()
    rerender(<LogQLQueryBox variant="bar" schema={schema} baseSelector={{ index: 'a' }} saved={[]} savedLoading recentStorageKey={null} />)
    expect(screen.getByText('Loading saved queries…')).toBeInTheDocument()
    rerender(<LogQLQueryBox variant="bar" schema={schema} baseSelector={{ index: 'a' }} showQueries={false} recentStorageKey={null} />)
    expect(screen.queryByRole('button', { name: /Queries/ })).toBeNull()
  })

  it('applies slot class names', () => {
    const { container } = setup({ classNames: { bar: 'my-bar', input: 'my-input', run: 'my-run', queriesButton: 'my-q' } })
    expect(container.querySelector('.lqb-bar.my-bar')).not.toBeNull()
    expect(box()).toHaveClass('my-input')
    expect(screen.getByRole('button', { name: 'Run query' })).toHaveClass('my-run')
    expect(queriesButton()).toHaveClass('my-q')
  })
})

describe('0.5.0', () => {
  const many = Array.from({ length: 2500 }, (_, i) => `svc-${String(i).padStart(4, '0')}`)

  it('caps the value list and says how many more there are', async () => {
    const { user } = setup({ values: { serviceName: many } })
    await user.click(box())
    await user.keyboard('app = ')
    expect(screen.getAllByRole('option')).toHaveLength(100)
    expect(screen.getByText('2,400 more. Keep typing to narrow the list.')).toBeInTheDocument()
    await user.keyboard('svc-2')
    expect(screen.getAllByRole('option')).toHaveLength(101)
    expect(screen.getAllByRole('option').at(-1)).toHaveTextContent('*svc-2*')
    expect(screen.getByText('400 more. Keep typing to narrow the list.')).toBeInTheDocument()
    await user.keyboard('49')
    expect(screen.getAllByRole('option')).toHaveLength(11)
    expect(screen.queryByText(/Keep typing/)).toBeNull()
  })

  it('takes maxSuggestions', async () => {
    const { user } = setup({ values: { serviceName: many }, maxSuggestions: 5 })
    await user.click(box())
    await user.keyboard('app = ')
    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(screen.getByText('2,495 more. Keep typing to narrow the list.')).toBeInTheDocument()
  })

  it('runs exactly what was typed on Ctrl or Cmd Enter', async () => {
    const { user, onExecute } = setup({ values: { serviceName: ['pii-detector'] } })
    await user.click(box())
    await user.keyboard('app != pii{Control>}{Enter}{/Control}')
    expect(box()).toHaveValue('app != pii')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app != pii' }))
    await user.keyboard(' {Meta>}{Enter}{/Meta}')
    expect(onExecute).toHaveBeenCalledTimes(2)
  })

  it('passes the typed text to loadValues when searchValues is on, and keeps the latest answer', async () => {
    const pending = new Map<string, (list: string[]) => void>()
    const loadValues = vi.fn((_field: string, ctx: { signal: AbortSignal; search: string }) => new Promise<string[]>((res) => pending.set(ctx.search, res)))
    const { user } = setup({ values: {}, loadValues, searchValues: true })
    await user.click(box())
    await user.keyboard('app = che')
    await waitFor(() => expect(pending.has('che')).toBe(true))
    expect(loadValues.mock.calls.map((c) => c[1].search)).toEqual(['che'])
    await user.keyboard('c')
    await waitFor(() => expect(pending.has('chec')).toBe(true))
    pending.get('chec')?.(['checkout-api'])
    expect(await screen.findByRole('option', { name: /checkout-api/ })).toBeInTheDocument()
    pending.get('che')?.(['chess-old'])
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('option', { name: /chess-old/ })).toBeNull()
    await user.keyboard('{Backspace}')
    await new Promise((r) => setTimeout(r, 300))
    expect(loadValues).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('option', { name: /chess-old/ })).toBeInTheDocument()
  })

  it('accepts numeric saved query ids', async () => {
    const onDeleteSaved = vi.fn()
    const { user } = setup({ saved: [{ id: 7, name: 'Seven', query: 'level = ERROR' }], onDeleteSaved })
    await user.click(queriesButton())
    await user.click(screen.getByRole('button', { name: 'Delete Seven' }))
    const confirm = screen.getByRole('group', { name: 'Delete “Seven”?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(onDeleteSaved).toHaveBeenCalledWith({ id: 7, name: 'Seven', query: 'level = ERROR' })
  })
})

describe('0.5.1 errors', () => {
  it('underlines a field used without an operator and fixes it in one click', async () => {
    const { user, onExecute } = setup()
    await user.click(box())
    await user.keyboard('level, ERROR')
    expect(screen.getByRole('alert')).toHaveTextContent('“level” is a field, so it needs an operator, like level = ERROR.')
    expect(document.querySelector('.lqb-hl-bad')).toHaveTextContent('level')
    expect(document.querySelector('.lqb-sg-err')).toHaveTextContent('“level” is a field, so it needs an operator')
    expect(screen.getByRole('button', { name: 'Run query' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Change the filter to level = ERROR and run it' }))
    expect(box()).toHaveValue('level = ERROR')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'level = ERROR' }))
    expect(document.querySelector('.lqb-hl-bad')).toBeNull()
  })

  it('underlines the bad character of a regex', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('content =~ time(out')
    expect(screen.getByRole('alert')).toHaveTextContent('In /time(out/, this ( is never closed (character 5).')
    expect(document.querySelector('.lqb-hl-bad')?.textContent).toBe('(')
    expect(screen.queryByRole('button', { name: /Change the filter/ })).toBeNull()
  })
})
