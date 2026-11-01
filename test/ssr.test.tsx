// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LogQLQueryBox } from '../src'

describe('server rendering', () => {
  it('runs with no browser globals', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const html = renderToString(<LogQLQueryBox defaultValue="level:error timeout" globalShortcuts executeOnMount autoFocus />)
    expect(html).toContain('Log Level is error')
    expect(html).toContain('role="combobox"')
  })

  it('matches between server and a second render', () => {
    const a = renderToString(<LogQLQueryBox defaultValue="a OR b" defaultLogqlOpen />)
    const b = renderToString(<LogQLQueryBox defaultValue="a OR b" defaultLogqlOpen />)
    expect(a).toBe(b)
  })
})
