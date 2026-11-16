import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LogQLQueryBox, type LogQLQueryBoxHandle, type LogQLQueryBoxProps, type SavedQuery, type Schema } from '../src'
import { exact } from './helpers'

const schema: Schema = {
  parser: 'json',
  operator: '=',
  fields: {
    logLevel: { label: 'level', aliases: ['level'], values: ['ERROR', 'INFO', 'WARN', 'DEBUG', 'NONE'], icon: 'bars', valueIcons: { ERROR: 'error', WARN: 'warn' }, color: (v) => (v === 'ERROR' ? '#b42318' : '#5d697c'), example: 'Severity of the log entry' },
    serviceName: { label: 'app', aliases: ['app'], example: 'Application that emitted the log entry' },
    serviceType: { label: 'app.type', aliases: ['app.type'], values: ['JAVA', 'NODE', 'GO', 'PYTHON'], example: 'Type of the application' },
    content: { label: 'content', kind: 'line', parsed: true, aliases: ['content'], example: 'Log message text. Use * as a wildcard' },
    traceId: { label: 'traceId', aliases: ['traceId'], icon: 'trace', example: 'ID of the trace associated with the log entry' },
    spanId: { label: 'spanId', aliases: ['spanId'], icon: 'span', example: 'ID of the span associated with the log entry' }
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
  const view = render(<LogQLQueryBox variant="bar" stacked={false} schema={schema} baseSelector={{ index: 'a' }} saved={SAVED} recentStorageKey={null} onExecute={onExecute} {...props} />)
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
    expect(opts()).toEqual(['level', 'app', 'app.type', 'content', 'traceId', 'spanId'])
    expect(screen.getAllByRole('option').map((o) => [o.querySelector('code')?.textContent, o.querySelector('.lqb-hint')?.textContent])).toEqual([
      ['level', 'Severity of the log entry'],
      ['app', 'Application that emitted the log entry'],
      ['app.type', 'Type of the application'],
      ['content', 'Log message text. Use * as a wildcard'],
      ['traceId', 'ID of the trace associated with the log entry'],
      ['spanId', 'ID of the span associated with the log entry']
    ])
    await user.click(screen.getByText('level'))
    expect(box()).toHaveValue('level ')
    expect(screen.getByText(exact('How should level match?'))).toBeInTheDocument()
    expect(opts()).toEqual(['level =', 'level !=', 'level =~', 'level !~'])
    await user.click(screen.getByText('level !='))
    expect(box()).toHaveValue('level != ')
    expect(opts()).toEqual(['ERROR', 'INFO', 'WARN', 'DEBUG', 'NONE'])
    expect(screen.queryByRole('group', { name: 'Operators' })).toBeNull()
    await user.click(screen.getByText('DEBUG'))
    expect(box()).toHaveValue('level != DEBUG')
    expect(opts()).toEqual(['ERROR', 'INFO', 'WARN', 'NONE'])
  })

  it('works from the keyboard alone', async () => {
    const { user, onExecute } = setup()
    await user.click(box())
    await user.keyboard('app.t{Tab}')
    expect(box()).toHaveValue('app.type ')
    await user.keyboard('{ArrowDown}{Tab}')
    expect(box()).toHaveValue('app.type != ')
    await user.keyboard('{Tab}')
    expect(box()).toHaveValue('app.type != JAVA')
    await user.keyboard('{Escape}{Enter}')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app.type != JAVA' }))
  })

  it('accepts the highlighted value on Enter instead of running a half typed one', async () => {
    const { user, onExecute } = setup({ values: { serviceName: ['gateway-api-security', 'pii-detector'] } })
    await user.click(box())
    await user.keyboard('app = gateway-api-secu{Enter}')
    expect(box()).toHaveValue('app = gateway-api-security')
    expect(onExecute).not.toHaveBeenCalled()
    await user.keyboard('{Escape}{Enter}')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app = gateway-api-security' }))
  })

  it('offers every value containing the typed text', async () => {
    const { user } = setup({ values: { serviceName: ['pii-detector', 'policy-evaluator'] } })
    await user.click(box())
    await user.keyboard('app != pii')
    expect(screen.getByText('Every app containing “pii”')).toBeInTheDocument()
    await user.click(screen.getByText('*pii*'))
    expect(box()).toHaveValue('app != *pii*')
  })

  it('keeps offering the other values after one is picked', async () => {
    const { user, onExecute } = setup({ values: { serviceName: ['loans-service', 'accounts-service', 'cards-service'] } })
    const opts = () => screen.getAllByRole('option').map((o) => o.querySelector('code')?.textContent)
    await user.click(box())
    await user.keyboard('app = loans')
    await user.click(screen.getByText('loans-service'))
    expect(box()).toHaveValue('app = loans-service')
    expect(screen.getByText(exact('Add another app'))).toBeInTheDocument()
    expect(opts()).toEqual(['accounts-service', 'cards-service'])
    await user.click(screen.getByText('accounts-service'))
    expect(box()).toHaveValue('app = loans-service, accounts-service')
    expect(opts()).toEqual(['cards-service'])
    await user.keyboard('{Enter}')
    expect(box()).toHaveValue('app = loans-service, accounts-service, cards-service')
    expect(onExecute).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onExecute).toHaveBeenCalledTimes(1)
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app = loans-service, accounts-service, cards-service' }))
  })

  it('shows the other values after backspacing onto a finished value', async () => {
    const { user } = setup({ values: { serviceName: ['loans-service', 'accounts-service'] } })
    await user.click(box())
    await user.keyboard('app = loans-service, ')
    await user.keyboard('{Backspace}{Backspace}')
    expect(screen.getByText(exact('Add another app'))).toBeInTheDocument()
    expect(screen.getByText('accounts-service')).toBeInTheDocument()
  })

  it('lets arrow keys pick the next value to add', async () => {
    const { user, onExecute } = setup({ values: { serviceName: ['loans-service', 'accounts-service', 'cards-service'] } })
    await user.click(box())
    await user.keyboard('app = loans-service{ArrowDown}{Enter}')
    expect(box()).toHaveValue('app = loans-service, cards-service')
    expect(onExecute).not.toHaveBeenCalled()
  })

  it('tidies spacing around commas and operators when the box loses focus', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('app = loans-service,accounts-service, level =WARN')
    await user.tab()
    expect(box()).toHaveValue('app = loans-service, accounts-service level = WARN')
  })

  it('draws the list as a card with icons, a count and key hints', async () => {
    const { user } = setup({ values: { serviceName: ['loans-service', 'accounts-service', 'cards-service'] } })
    await user.click(box())
    const rows = () => screen.getAllByRole('option')
    expect(document.querySelector('.lqb-sg-keys')).toHaveTextContent('Press Enter to pick a field, then choose a value')
    expect(document.querySelector('.lqb-sg-keys kbd')).toHaveTextContent('Enter')
    expect(rows().every((r) => r.querySelector('.lqb-sg-ic svg'))).toBe(true)
    await user.keyboard('app = ')
    expect(document.querySelector('.lqb-sg-count')).toHaveTextContent('3 available')
    expect(rows()[0].querySelector('.lqb-sg-ic')).not.toBeNull()
    await user.keyboard('loans-service')
    expect(document.querySelector('.lqb-sg-count')).toHaveTextContent('2 available')
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true')
    expect(rows()[0].querySelector('kbd')).toHaveTextContent('Enter')
    expect(rows()[1].querySelector('kbd')).toBeNull()
    expect(document.querySelector('.lqb-sg-keys kbd')).toHaveTextContent('Space')
  })

  it('shows a coloured icon per value and an Enter chip on the highlighted one', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('level = ')
    const rows = screen.getAllByRole('option')
    expect((rows[0].querySelector('.lqb-sg-ic') as HTMLElement).style.color).toBe('rgb(180, 35, 24)')
    expect(rows[0]).toHaveAttribute('aria-selected', 'true')
    expect(rows[0].querySelector('kbd')).toHaveTextContent('Enter')
    expect(rows[1].querySelector('kbd')).toBeNull()
    expect(document.querySelector('.lqb-sg-keys')).toHaveTextContent('Press Esc to go back to fields')
  })

  it('goes back to the field list on Escape before a value is typed', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('level = {Escape}')
    expect(box()).toHaveValue('')
    expect(screen.getAllByRole('option').map((o) => o.querySelector('code')?.textContent)).toEqual(['level', 'app', 'app.type', 'content', 'traceId', 'spanId'])
    await user.keyboard('{Escape}')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  describe('notices under the bar', () => {
    const banking = { serviceName: ['loans-service', 'accounts-service', 'payments-service', 'cards-service'] }
    const run = () => screen.getByRole('button', { name: 'Run query' })
    const note = () => document.querySelector('.lqb-nf') as HTMLElement | null
    const titles = () => [...(note() as HTMLElement).querySelectorAll('.lqb-nf-fix-title')].map((t) => t.textContent)

    it('floats with the bar, so it never changes the height of the row around it', async () => {
      const { user, container } = setup({ defaultValue: 'level = INFO app =~ ^accounts$', values: banking })
      await user.click(run())
      expect(note()).not.toBeNull()
      expect(note()?.parentElement).toHaveClass('lqb-bar-layer')
      expect(container.querySelector('.lqb-v-bar > .lqb-nf')).toBeNull()
      expect(container.querySelector('.lqb-bar-row > .lqb-nf')).toBeNull()
    })

    it('explains an exact pattern that matches nothing and lists the fixes', async () => {
      const { user } = setup({ defaultValue: 'level = INFO app =~ ^accounts$', values: banking })
      await user.click(run())
      expect(note()?.querySelector('.lqb-nf-title')).toHaveTextContent('No app matches ^accounts$')
      expect(note()?.querySelector('.lqb-nf-desc')).toBeNull()
      expect(titles()).toEqual(['Use “accounts-service”', 'Match every app starting with “accounts”'])
      expect(note()?.querySelector('.lqb-nf-fix code')).toBeNull()
      expect(note()?.querySelectorAll('kbd')).toHaveLength(1)
    })

    it('applies a fix with one click', async () => {
      const { user, onExecute } = setup({ defaultValue: 'level = INFO app =~ ^accounts$', values: banking })
      await user.click(run())
      await user.click(within(note() as HTMLElement).getByText('Use “accounts-service”'))
      expect(box()).toHaveValue('level = INFO app = accounts-service')
      expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'level = INFO app = accounts-service' }))
      expect(note()).toBeNull()
    })

    it('keeps the regex and drops the closing anchor for a starts-with match', async () => {
      const { user } = setup({ defaultValue: 'level = INFO app =~ ^accounts$', values: banking })
      await user.click(run())
      await user.click(within(note() as HTMLElement).getByText(exact('Match every app starting with “accounts”')))
      expect(box()).toHaveValue('level = INFO app =~ ^accounts')
      expect(note()).toBeNull()
    })

    it('uses the keyboard: Enter takes the highlighted fix, arrows move, Escape dismisses', async () => {
      const { user } = setup({ defaultValue: 'level = INFO app =~ ^accounts$', values: banking })
      await user.click(run())
      await user.click(box())
      expect(note()).not.toBeNull()
      expect(screen.queryByRole('listbox')).toBeNull()
      await user.keyboard('{ArrowDown}')
      expect(note()?.querySelectorAll('.lqb-nf-fix')[1]).toHaveAttribute('data-selected')
      await user.keyboard('{ArrowUp}{ArrowUp}')
      expect(note()?.querySelectorAll('.lqb-nf-fix')[1]).toHaveAttribute('data-selected')
      await user.keyboard('{ArrowDown}{Enter}')
      expect(box()).toHaveValue('level = INFO app = accounts-service')
      await user.click(box())
      await user.keyboard('{Control>}a{/Control}app = lonas')
      await user.click(run())
      expect(note()).not.toBeNull()
      await user.click(box())
      await user.keyboard('{Escape}')
      expect(note()).toBeNull()
    })

    it('stays quiet when the pattern matches a real app', async () => {
      for (const q of ['app =~ accounts', 'app =~ ^accounts', 'app =~ ^accounts-service$', 'app =~ service$', 'app !~ ^cards']) {
        const { user, unmount } = setup({ defaultValue: q, values: banking })
        await user.click(run())
        expect(note(), q).toBeNull()
        unmount()
      }
    })

    it('words the message for an exclusion and an unanchored pattern', async () => {
      const { user } = setup({ defaultValue: 'app !~ ^zzz', values: banking })
      await user.click(run())
      expect(note()?.querySelector('.lqb-nf-desc')).toHaveTextContent('Nothing was excluded.')
      expect(note()?.querySelectorAll('.lqb-nf-fix')).toHaveLength(0)
    })

    it('says what is wrong with a plain value and suggests a spelling check', async () => {
      const { user } = setup({ defaultValue: 'app = zzz', values: { serviceName: ['a'] } })
      await user.click(run())
      expect(note()?.querySelector('.lqb-nf-title')).toHaveTextContent('No app is exactly zzz')
      expect(note()?.querySelector('.lqb-nf-desc')).toHaveTextContent('Check the spelling.')
    })

    it('shows the field name in its own key-coloured element in the card title', async () => {
      const { user } = setup({ defaultValue: 'app.type =~ java', values: { serviceType: ['JAVA', 'NODE'] } })
      await user.click(run())
      expect([...note()!.querySelectorAll('.lqb-nf-title .lqb-nf-f')].map((n) => n.textContent)).toEqual(['app.type'])
      expect(note()?.querySelector('.lqb-nf-title code')).toHaveTextContent('java')
    })

    it('has no description line for a pattern that matches nothing, and never says "Nothing matches it"', async () => {
      const { user } = setup({ defaultValue: 'app =~ zzz', values: { serviceName: ['a'] } })
      await user.click(run())
      expect(note()?.querySelector('.lqb-nf-title')).toHaveTextContent('No app matches')
      expect(note()?.querySelector('.lqb-nf-desc')).toBeNull()
      expect(note()).not.toHaveTextContent('Nothing matches it')
    })

    it('can be dismissed, and comes back for the next unknown value', async () => {
      const { user } = setup({ defaultValue: 'app = acounts-service', values: banking })
      await user.click(run())
      expect(note()).toHaveTextContent('acounts-service')
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(note()).toBeNull()
      await user.click(box())
      await user.keyboard('{Control>}a{/Control}app = lonas-service')
      await user.click(run())
      expect(note()).toHaveTextContent('lonas-service')
    })

    it('hides while the query is being edited', async () => {
      const { user } = setup({ defaultValue: 'app = acounts-service', values: banking })
      await user.click(run())
      expect(note()).not.toBeNull()
      await user.click(box())
      await user.keyboard('x')
      expect(note()).toBeNull()
    })

    it('offers a fix for one unknown value in a list and keeps the rest', async () => {
      const { user } = setup({ defaultValue: 'app = loans-service, accounts', values: banking })
      await user.click(run())
      expect(note()?.querySelector('.lqb-nf-title')).toHaveTextContent('No app is exactly accounts')
      await user.click(within(note() as HTMLElement).getByText('Use “accounts-service”'))
      expect(box()).toHaveValue('app = loans-service, accounts-service')
    })

    it('offers containing and starts-with fixes when several apps fit', async () => {
      const { user } = setup({ defaultValue: 'app = service', values: banking })
      await user.click(run())
      expect(titles()).toEqual(['Use “loans-service”', 'Use “accounts-service”', 'Use “payments-service”', 'Match every app containing “service”'].slice(0, 4))
    })

    it('shows an invalid query under the bar, not in the row', async () => {
      const { user, container } = setup({ defaultValue: 'level ERROR' })
      await user.click(run())
      const err = container.querySelector('.lqb-error') as HTMLElement
      expect(err).not.toBeNull()
      expect(err.parentElement).toHaveClass('lqb-bar-layer')
    })
  })

  it('moves the highlight to the row under the mouse', async () => {
    const { user } = setup({ values: { serviceName: ['loans-service', 'accounts-service', 'cards-service'] } })
    await user.click(box())
    await user.keyboard('app = ')
    const rows = () => screen.getAllByRole('option')
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true')
    await user.hover(rows()[2])
    expect(rows()[0]).toHaveAttribute('aria-selected', 'false')
    expect(rows()[2]).toHaveAttribute('aria-selected', 'true')
    expect(rows()[2].querySelector('kbd')).toHaveTextContent('Enter')
    expect(rows()[0].querySelector('kbd')).toBeNull()
    await user.keyboard('{Enter}')
    expect(box()).toHaveValue('app = cards-service')
  })

  it('leaves out values that are already in the query for that field', async () => {
    const { user } = setup({ defaultValue: 'app = accounts-service level = ERROR', values: { serviceName: ['loans-service', 'accounts-service', 'cards-service'] } })
    await user.click(box())
    await user.keyboard(' app = ')
    expect(screen.getAllByRole('option').map((o) => o.querySelector('code')?.textContent)).toEqual(['loans-service', 'cards-service'])
    expect(document.querySelector('.lqb-sg-count')).toHaveTextContent('2 available')
    await user.keyboard('acc')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  describe('stacked layout', () => {
    const values = { serviceName: ['loans-service', 'accounts-service', 'cards-service'] }

    it('puts one filter on each line with the operators lined up when the query runs', async () => {
      const { user, onExecute } = setup({ stacked: true, defaultValue: 'app = accounts-service, loans-service level =WARN traceId = abc', values })
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      const text = 'app     = accounts-service, loans-service,\nlevel   = WARN,\ntraceId = abc'
      expect(box()).toHaveValue(text)
      expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: text }))
      expect(onExecute.mock.calls[0][0].logql.branches[0]).toContain('serviceName=~')
    })

    it('stacks as you pick fields and values, so the text is the same before and after a run', async () => {
      const { user } = setup({ stacked: true, values })
      await user.click(box())
      await user.keyboard('app = ')
      await user.click(screen.getByText('accounts-service'))
      await user.keyboard(' ')
      await user.click(screen.getByText('level'))
      expect(box()).toHaveValue('app   = accounts-service\nlevel ')
      await user.click(screen.getByText('level ='))
      expect(box()).toHaveValue('app   = accounts-service,\nlevel = ')
      await user.keyboard('WARN')
      expect(box()).toHaveValue('app   = accounts-service,\nlevel = WARN')
      const typed = (box() as HTMLTextAreaElement).value
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      expect(box()).toHaveValue(typed)
    })

    it('shows no comma in the closed summary where the text has none', async () => {
      const { container } = setup({ stacked: true, defaultValue: 'content = Connection Pool check level = WARN, INFO app.type = JAVA' })
      const summary = container.querySelector('.lqb-summary') as HTMLElement
      expect(summary.textContent).not.toMatch(/Connection,|Pool,|check,|JAVA,/)
      expect(summary.textContent).toContain('WARN, INFO')
    })

    it('shows the closed summary with the same commas', async () => {
      const { container } = setup({ stacked: true, defaultValue: 'app = accounts-service,\nlevel = WARN' })
      const summary = container.querySelector('.lqb-summary') as HTMLElement
      expect([...summary.querySelectorAll('.lqb-piece')].map((p) => p.textContent)).toEqual(['app = accounts-service', ', level = WARN'])
    })

    it('is on by default in the bar and off in the classic variant', async () => {
      const { user, unmount } = setup({ stacked: undefined, defaultValue: 'app = a level = WARN' })
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      expect(box()).toHaveValue('app   = a,\nlevel = WARN')
      unmount()
      const onExecute = vi.fn()
      render(<LogQLQueryBox variant="classic" schema={schema} baseSelector={{ index: 'a' }} recentStorageKey={null} onExecute={onExecute} defaultValue="app = a level = WARN" />)
      await userEvent.setup().click(screen.getByRole('combobox'))
      await userEvent.keyboard('{Escape}{Enter}')
      expect(screen.getByRole('combobox')).toHaveValue('app = a level = WARN')
    })

    it('counts one filter per line in the closed summary, even when a value has spaces', () => {
      const { container } = setup({ stacked: true, defaultValue: 'app = accounts-service,\nlevel = WARN,\ncontent =~ check: active=2 idle=8 w' })
      const pieces = [...container.querySelectorAll('.lqb-summary .lqb-piece')].map((p) => p.textContent)
      expect(pieces).toEqual(['app = accounts-service', ', level = WARN', ', content =~ check: active=2 idle=8 w'])
    })

    it('leaves mixed queries alone', async () => {
      const { user } = setup({ stacked: true, defaultValue: 'timeout level = WARN' })
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      expect(box()).toHaveValue('timeout level = WARN')
    })
  })

  it('offers the pattern anchors for the log line and for traceId too', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('traceId =~ ')
    expect(screen.getAllByRole('option').map((o) => o.querySelector('code')?.textContent)).toEqual(['^ …', '… $', '^ … $', '… | …', '… .* …', '\\b … \\b', '(?i) …', '\\Q … \\E'])
    await user.keyboard('{Control>}a{/Control}content =~ ')
    await user.click(screen.getByText('^ …'))
    expect(box()).toHaveValue('content =~ ^')
    expect((box() as HTMLTextAreaElement).selectionStart).toBe(12)
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent('Now type the text to find.')
  })

  it('inserts a combining pattern with the caret where the text goes', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('app.type =~ ')
    const groups = [...document.querySelectorAll('[role=group] > .lqb-sg-h')].map((h) => h.textContent)
    expect(groups).toEqual(['Position', 'Combining text'])
    await user.click(screen.getByText('\\b … \\b'))
    expect(box()).toHaveValue('app.type =~ \\b\\b')
    expect((box() as HTMLTextAreaElement).selectionStart).toBe(14)
    await user.keyboard('JAVA')
    expect(box()).toHaveValue('app.type =~ \\bJAVA\\b')
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent('Matches 1 of 4: JAVA')
  })

  it('shows each saved query in a box on one line, with the pin on the right', async () => {
    const saved: SavedQuery[] = [{ id: '1', name: 'A very long saved query name that should never wrap onto a second line in the panel', query: 'level = ERROR,\napp = pii-detector', pinned: true }]
    const { user } = setup({ saved, onPinSaved: vi.fn(), onDeleteSaved: vi.fn() })
    await user.click(queriesButton())
    const item = document.querySelector('.lqb-q-item') as HTMLElement
    expect(item.querySelector('.lqb-q-name')).toHaveTextContent('A very long saved query name')
    expect(item.querySelectorAll('.lqb-q-name svg')).toHaveLength(0)
    const query = item.querySelector('.lqb-q-query') as HTMLElement
    expect(query).toHaveTextContent('level = ERROR, app = pii-detector')
    expect([...query.querySelectorAll('.lqb-hl-f')].map((n) => n.textContent)).toEqual(['level', 'app'])
    expect(item.querySelector('.lqb-q-end > .lqb-q-pin')).not.toBeNull()
    expect(item.querySelector('.lqb-q-end > .lqb-q-acts .lqb-act-pin')).not.toBeNull()
  })

  it('blocks an unknown field name and says which fields exist', async () => {
    const { user, onExecute } = setup({ defaultValue: 'nnjnd = ncjsndjc' })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    expect(onExecute).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('“nnjnd” is not a field. Use level, app, app.type, content, traceId or spanId. To search the log text for “nnjnd”, write it in quotes.')
    expect(document.querySelector('.lqb-hl-bad')).toHaveTextContent('nnjnd =')
  })

  describe('bare words with freeText off', () => {
    const strict = { ...schema, freeText: false }

    it('holds the query and offers a content filter, which Enter applies', async () => {
      const { user, onExecute } = setup({ schema: strict, defaultValue: 'cscsdcs' })
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      expect(onExecute).not.toHaveBeenCalled()
      const card = document.querySelector('.lqb-nf') as HTMLElement
      expect(card.querySelector('.lqb-nf-title')).toHaveTextContent('This is not a field cscsdcs')
      expect(card.querySelector('.lqb-nf-desc')).toBeNull()
      expect(card.querySelector('.lqb-nf-fix-title')).toHaveTextContent('Search the log text for cscsdcs')
      await user.click(box())
      await user.keyboard('{Enter}')
      expect(box()).toHaveValue('content = cscsdcs')
      expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'content = cscsdcs' }))
    })

    it('shows the card again when Run is pressed after dismissing it', async () => {
      const { user } = setup({ schema: strict, defaultValue: 'cscsdcs' })
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(document.querySelector('.lqb-nf')).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      expect(document.querySelector('.lqb-nf')).not.toBeNull()
    })

    it('still runs field filters', async () => {
      const { user, onExecute } = setup({ schema: strict, defaultValue: 'content = cscsdcs' })
      await user.click(screen.getByRole('button', { name: 'Run query' }))
      expect(onExecute).toHaveBeenCalledTimes(1)
    })
  })

  describe('tooltips on the bar buttons', () => {
    it('names the clear and copy buttons with the dark tooltip, not a native title', async () => {
      const { user } = setup({ defaultValue: 'level = ERROR' })
      await user.click(box())
      const clear = screen.getByRole('button', { name: 'Clear the filter' })
      const copy = screen.getByRole('button', { name: 'Copy query' })
      expect(clear).not.toHaveAttribute('title')
      expect(copy).not.toHaveAttribute('title')
      await user.hover(clear)
      expect(screen.getByRole('tooltip')).toHaveTextContent('Clear')
      await user.unhover(clear)
      expect(screen.queryByRole('tooltip')).toBeNull()
      await user.hover(copy)
      expect(screen.getByRole('tooltip')).toHaveTextContent('Copy')
    })

    it('drops the tooltip when the clear button goes away', async () => {
      const { user } = setup({ defaultValue: 'level = ERROR' })
      await user.click(box())
      await user.hover(screen.getByRole('button', { name: 'Clear the filter' }))
      await user.click(screen.getByRole('button', { name: 'Clear the filter' }))
      expect(screen.queryByRole('tooltip')).toBeNull()
    })
  })

  describe('saved query tooltips', () => {
    const saved: SavedQuery[] = [{ id: '1', name: 'A long saved query name', query: 'level = ERROR,\napp = pii-detector' }]

    it('names each action on hover instead of using a native title', async () => {
      const { user } = setup({ saved, onPinSaved: vi.fn(), onDeleteSaved: vi.fn(), onCreateAlert: vi.fn(), onUpdateSaved: vi.fn() })
      await user.click(queriesButton())
      const buttons = [...document.querySelectorAll('.lqb-q-acts .lqb-icon-btn')]
      expect(buttons.every((b) => !b.hasAttribute('title'))).toBe(true)
      await user.hover(buttons[0])
      expect(screen.getByRole('tooltip')).toHaveTextContent('Pin')
      await user.unhover(buttons[0])
      expect(screen.queryByRole('tooltip')).toBeNull()
      await user.hover(buttons[3])
      expect(screen.getByRole('tooltip')).toHaveTextContent('Delete')
    })

    it('drops the tooltip when edit, delete, pin or alert is clicked', async () => {
      const { user } = setup({ saved, onPinSaved: vi.fn(), onDeleteSaved: vi.fn(), onCreateAlert: vi.fn(), onUpdateSaved: vi.fn() })
      await user.click(queriesButton())
      for (const i of [2, 3, 0, 1]) {
        const btn = [...document.querySelectorAll('.lqb-q-acts .lqb-icon-btn')][i]
        await user.hover(btn)
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        await user.click(btn)
        expect(screen.queryByRole('tooltip')).toBeNull()
        if (i === 2) await user.click(screen.getByRole('button', { name: 'Cancel' }))
        if (i === 3) await user.click(screen.getByRole('button', { name: 'Cancel' }))
      }
    })

    it('shows the full name and query when the row is cut off, and stays quiet when it is not', async () => {
      const { user } = setup({ saved })
      await user.click(queriesButton())
      const row = document.querySelector('.lqb-q-main') as HTMLElement
      await user.hover(row)
      expect(screen.queryByRole('tooltip')).toBeNull()
      await user.unhover(row)
      const wide = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500)
      const narrow = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
      await user.hover(row)
      const tip = screen.getByRole('tooltip')
      expect(tip).toHaveTextContent('A long saved query name')
      expect(tip).toHaveTextContent('level = ERROR, app = pii-detector')
      wide.mockRestore()
      narrow.mockRestore()
    })
  })

  it('picks fields and operators with Enter', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('{Enter}')
    expect(box()).toHaveValue('level ')
    await user.keyboard('{Enter}')
    expect(box()).toHaveValue('level = ')
  })

  it('asks for the value of a field that has no known values', async () => {
    const { user } = setup()
    await user.click(box())
    await user.keyboard('traceId = ')
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent('Type the traceId you want. Use * as a wildcard.')
    await user.keyboard('abc123')
    await user.tab()
    expect(box()).toHaveValue('traceId = abc123')
  })

  it('explains what to type where there are no values', async () => {
    const { user } = setup()
    await user.click(box())
    await user.click(screen.getByText('content'))
    await user.click(screen.getByText('content ='))
    expect(box()).toHaveValue('content = ""')
    expect((box() as HTMLTextAreaElement).selectionStart).toBe(11)
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent(/exact phrase.*\* as a wildcard/)
    await user.keyboard('{Control>}a{/Control}content =~ ')
    expect(document.querySelector('.lqb-sg-note')).toHaveTextContent(/regular expression, for example timeout\|refused/)
    expect(screen.getAllByRole('option').map((o) => o.querySelector('code')?.textContent)).toEqual(['^ …', '… $', '^ … $', '… | …', '… .* …', '\\b … \\b', '(?i) …', '\\Q … \\E'])
  })

  it('combines repeated filters when the query runs', async () => {
    const { user, onExecute } = setup({ defaultValue: 'app != policy-evaluator app != pii-detector' })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    expect(box()).toHaveValue('app != policy-evaluator, pii-detector')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app != policy-evaluator, pii-detector' }))
  })

  it('tidies operator spacing when the query runs', async () => {
    const { user, onExecute } = setup({ defaultValue: 'content =security level=ERROR' })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    expect(box()).toHaveValue('content = security level = ERROR')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'content = security level = ERROR' }))
  })

  it('after a run, offers fixes for a value that matches nothing', async () => {
    const { user, onExecute } = setup({ defaultValue: 'app != policy-evaluator app != pii', values: { serviceName: ['pii-detector', 'pii-scanner', 'policy-evaluator'] } })
    expect(screen.queryByRole('status')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    const note = document.querySelector('.lqb-nf') as HTMLElement
    expect(note.querySelector('.lqb-nf-title')).toHaveTextContent('No app is exactly pii')
    expect(note.querySelector('.lqb-nf-desc')).toHaveTextContent('Nothing was excluded.')
    expect([...note.querySelectorAll('.lqb-nf-fix-title')].map((b) => b.textContent)).toEqual(['Use “pii-detector”', 'Use “pii-scanner”', 'Exclude every app containing “pii”'])
    await user.click(within(note).getByText(exact('Exclude every app containing “pii”')))
    expect(box()).toHaveValue('app != policy-evaluator, *pii*')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'app != policy-evaluator, *pii*' }))
    expect(document.querySelector('.lqb-nf')).toBeNull()
  })

  it('hides the fix prompt while the query is being edited', async () => {
    const { user } = setup({ defaultValue: 'app = zzz', values: { serviceName: ['a'] } })
    await user.click(screen.getByRole('button', { name: 'Run query' }))
    expect(document.querySelector('.lqb-nf-desc')).toHaveTextContent('Check the spelling.')
    await user.click(box())
    await user.keyboard('z')
    expect(document.querySelector('.lqb-nf')).toBeNull()
  })

  it('shows a one line summary with a hidden count while closed', async () => {
    const { user, container } = setup({ defaultValue: 'level = ERROR\napp = gateway-api-security content = "a b"' })
    const summary = container.querySelector('.lqb-summary') as HTMLElement
    expect([...summary.querySelectorAll('.lqb-piece')].map((p) => p.textContent)).toEqual(['level = ERROR', ' app = gateway-api-security', ' content = "a b"'])
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
    expect(pop.querySelector('.lqb-pop-preview')).toHaveTextContent('level = ERROR app = pii-detector')
    expect([...pop.querySelectorAll('.lqb-pop-preview .lqb-hl-f')].map((n) => n.textContent)).toEqual(['level', 'app'])
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
    const note = document.querySelector('.lqb-nf') as HTMLElement
    expect(note.querySelector('.lqb-nf-title')).toHaveTextContent('No app matches ^passive$')
    expect([...note.querySelectorAll('.lqb-nf-fix-title')].map((b) => b.textContent)).toEqual(['Use “passive-scan-consumer”', 'Match every app starting with “passive”'])
    await user.click(within(note).getByText(exact('Match every app starting with “passive”')))
    expect(box()).toHaveValue('level = INFO app =~ ^passive')
    expect(onExecute).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'level = INFO app =~ ^passive' }))
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
    expect(container.querySelector('.lqb-bar-slot > .lqb-bar-layer > .lqb-bar')).not.toBeNull()
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
