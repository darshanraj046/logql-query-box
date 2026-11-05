import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createEngine, LogQLQueryBox, type Analysis, type LogQLQueryBoxHandle } from '../src'
import '../src/styles.css'
import './site.css'

interface SampleLog {
  id: number
  time: string
  service_name: string
  service_category: string
  detected_level: string
  line: string
}

const TOTAL = 400
const SHOWN = 25
const INSTALL = 'npm install logql-query-box'

const APPS = [
  { name: 'checkout-api', type: 'JAVA' },
  { name: 'billing-worker', type: 'JAVA' },
  { name: 'auth-service', type: 'PYTHON' },
  { name: 'ledger-sync', type: 'GO' }
]

const LEVELS: [string, number][] = [
  ['info', 62],
  ['debug', 16],
  ['warn', 11],
  ['error', 10],
  ['unknown', 1]
]

const MESSAGES = [
  (n: number) => `request completed in ${40 + (n % 900)}ms`,
  (n: number) => `order ${10000 + n} created`,
  (n: number) => `cache miss for key session:${n % 500}`,
  (n: number) => `user ${n % 2000} signed in`,
  (n: number) => `retry ${1 + (n % 5)} of 5 for invoice ${70000 + n}`,
  () => 'payment gateway timeout after 30s',
  () => 'connection refused by upstream ledger-db',
  () => 'customer said "card declined" at checkout',
  () => 'java.net.SocketTimeoutException: Read timed out'
]

function buildLogs(): SampleLog[] {
  let state = 21
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  const pickLevel = () => {
    let roll = random() * 100
    for (const [level, weight] of LEVELS) {
      roll -= weight
      if (roll < 0) return level
    }
    return 'info'
  }
  const start = Date.now()
  return Array.from({ length: TOTAL }, (_, id) => {
    const app = APPS[Math.floor(random() * APPS.length)]
    return {
      id,
      time: new Date(start - id * 41000).toLocaleTimeString('en-US', { hour12: false }),
      service_name: app.name,
      service_category: app.type,
      detected_level: pickLevel(),
      line: MESSAGES[Math.floor(random() * MESSAGES.length)](id)
    }
  })
}

const logs = buildLogs()

function countsOf(field: 'service_name' | 'service_category' | 'detected_level') {
  const counts = new Map<string, number>()
  for (const log of logs) counts.set(log[field], (counts.get(log[field]) ?? 0) + 1)
  return [...counts].map(([value, count]) => ({ value, count }))
}

const values = {
  service_name: countsOf('service_name'),
  service_category: countsOf('service_category'),
  detected_level: countsOf('detected_level')
}

function App() {
  const box = useRef<LogQLQueryBoxHandle>(null)
  const engine = useMemo(() => createEngine({ values }), [])
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [run, setRun] = useState<Analysis | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const matches = useMemo(() => (run ? logs.filter((log) => engine.evaluate(run.tree, { ...log })) : logs), [engine, run])

  const copyInstall = async () => {
    await navigator.clipboard?.writeText(INSTALL)
    setCopied(true)
    setTimeout(() => setCopied(false), 1300)
  }

  return (
    <div className="site">
      <header className="top">
        <strong>logql-query-box</strong>
        <nav>
          <a href="https://github.com/darshanraj046/logql-query-box">GitHub</a>
          <a href="https://www.npmjs.com/package/logql-query-box">npm</a>
          <button type="button" onClick={() => setDark((value) => !value)}>
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
        </nav>
      </header>

      <section className="intro">
        <h1>Give your whole team Loki search without teaching them LogQL</h1>
        <p>Type a simple filter. The box suggests fields and values, catches mistakes, and writes the LogQL for your backend. Try it below.</p>
      </section>

      <section className="card">
        <LogQLQueryBox
          ref={box}
          engine={engine}
          defaultValue="level:error,warn timeout"
          defaultLogqlOpen
          showLogql
          showHelp
          executeOnMount
          description={false}
          globalShortcuts
          theme={dark ? 'dark' : 'light'}
          recentStorageKey={null}
          onExecute={setRun}
        />
      </section>

      <section className="results" aria-label="Sample log results">
        <div className="results-head">
          <strong>
            {matches.length} of {TOTAL} sample logs match
          </strong>
          <span>Click a level or app to add it to the filter</span>
        </div>
        {matches.length === 0 ? (
          <p className="none">No sample logs match this filter.</p>
        ) : (
          <ul>
            {matches.slice(0, SHOWN).map((log) => (
              <li key={log.id}>
                <time>{log.time}</time>
                <button type="button" className={`level lv-${log.detected_level}`} onClick={() => box.current?.toggleValue('detected_level', log.detected_level)}>
                  {log.detected_level}
                </button>
                <button type="button" className="app" onClick={() => box.current?.toggleValue('service_name', log.service_name)}>
                  {log.service_name}
                </button>
                <code>{log.line}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="install">
        <code>{INSTALL}</code>
        <button type="button" onClick={copyInstall}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </section>

      <footer>This page runs in your browser on made-up sample logs. Nothing you type is sent anywhere. In your app, the box hands you the LogQL and your backend calls Loki.</footer>
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
