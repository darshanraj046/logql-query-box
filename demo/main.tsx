import { StrictMode, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createEngine, LogQLQueryBox, type Analysis, type LogQLQueryBoxHandle } from '../src'
import '../src/styles.css'

const values = {
  service_name: [
    { value: 'checkout-api', count: 8123 },
    { value: 'auth-service', count: 2210 },
    { value: 'billing-worker', count: 412 },
    { value: 'payment gateway', count: 96 }
  ],
  service_category: [
    { value: 'JAVA', count: 9800 },
    { value: 'PYTHON', count: 1041 }
  ],
  detected_level: [
    { value: 'info', count: 7300 },
    { value: 'error', count: 1880 },
    { value: 'warn', count: 912 },
    { value: 'debug', count: 640 },
    { value: 'unknown', count: 9 }
  ]
}

const saved = [
  { id: 's1', name: 'Errors and warnings', query: 'level:error,warn', pinned: true },
  { id: 's2', name: 'Timeouts and refused connections', query: 'level:error (timeout OR refused)' },
  { id: 's3', name: 'Java exceptions', query: 'apptype:java /\\w+Exception/' }
]

function App() {
  const box = useRef<LogQLQueryBoxHandle>(null)
  const engine = useMemo(() => createEngine({ values }), [])
  const [dark, setDark] = useState(false)
  const [query, setQuery] = useState('')
  const [lastRun, setLastRun] = useState<Analysis | null>(null)

  return (
    <div data-testid="page" style={{ minHeight: '100vh', background: dark ? '#0e131d' : '#f4f6f9', padding: 16, fontFamily: 'system-ui, sans-serif', color: dark ? '#e6eaf2' : '#18202e' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ flex: 1 }}>logql-query-box</strong>
          <button onClick={() => setDark((d) => !d)}>{dark ? 'Light' : 'Dark'}</button>
          <button onClick={() => box.current?.toggleValue('detected_level', 'error')}>Facet: error</button>
          <button onClick={() => box.current?.toggleValue('detected_level', 'debug', true)}>Facet: hide debug</button>
          <button onClick={() => box.current?.clearField('detected_level')}>Clear level</button>
        </div>
        <div style={{ background: dark ? '#151b29' : '#fff', border: `1px solid ${dark ? '#28314a' : '#e2e7ef'}`, borderRadius: 10, padding: 16 }}>
          <LogQLQueryBox
            ref={box}
            engine={engine}
            value={query}
            onChange={(q) => setQuery(q)}
            onExecute={setLastRun}
            onSave={() => undefined}
            saved={saved}
            theme={dark ? 'dark' : 'light'}
            globalShortcuts
            executeOnMount
          />
        </div>
        <pre data-testid="last-run" style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {lastRun ? JSON.stringify({ query: lastRun.query, filter: lastRun.filter, branches: lastRun.logql.branches }, null, 2) : 'Nothing run yet'}
        </pre>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
