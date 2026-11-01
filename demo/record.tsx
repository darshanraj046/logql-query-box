import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createEngine, LogQLQueryBox } from '../src'
import '../src/styles.css'

interface StageState {
  scene: 'problem' | 'box' | 'end'
  title: string
  sub: string
  step: number
  key: string
  pointer: [number, number] | null
}

const STEPS = 6

const HAND_WRITTEN = `{service_name=~"checkout-.*"}
  |~ "(?i)timeout"
  !~ "(?i)debug"
  | detected_level=~"error|warn"`

const values = {
  service_name: [
    { value: 'checkout-api', count: 8123 },
    { value: 'checkout-worker', count: 2210 },
    { value: 'auth-service', count: 412 }
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

function Stage() {
  const engine = useMemo(() => createEngine({ values }), [])
  const [state, setState] = useState<StageState>({ scene: 'problem', title: '', sub: '', step: 0, key: '', pointer: null })

  useEffect(() => {
    const host = window as unknown as { stage: (patch: Partial<StageState>) => void }
    host.stage = (patch) => setState((current) => ({ ...current, ...patch }))
  }, [])

  return (
    <div className="stage">
      {state.scene !== 'end' && (
        <div>
          <h2 className="caption">{state.title}</h2>
          {state.sub && <p className="caption-sub">{state.sub}</p>}
        </div>
      )}

      {state.scene === 'problem' && (
        <div>
          <p className="code-label">One filter, written by hand as LogQL</p>
          <pre className="code">{HAND_WRITTEN}</pre>
        </div>
      )}

      {state.scene === 'problem' && (
        <ul className="pains">
          <li>Regex escaping</li>
          <li>Stream selectors</li>
          <li>Case flags</li>
          <li>Pipeline syntax</li>
        </ul>
      )}

      {state.scene === 'box' && (
        <div className="card" id="card">
          <LogQLQueryBox engine={engine} description={false} showHelp={false} recentStorageKey={null} theme="light" examples={[]} />
        </div>
      )}

      {state.scene === 'end' && (
        <div className="end">
          <h1>logql-query-box</h1>
          <p>A friendly search box for Grafana Loki</p>
          <code>npm install logql-query-box</code>
        </div>
      )}

      <div className="dots">
        {Array.from({ length: STEPS }, (_, i) => (
          <i key={i} className={i === state.step ? 'on' : undefined} />
        ))}
      </div>

      {state.key && <div className="key">{state.key}</div>}

      {state.pointer && (
        <svg className="pointer" width="26" height="26" viewBox="0 0 24 24" style={{ transform: `translate(${state.pointer[0]}px, ${state.pointer[1]}px)` }}>
          <path d="M5 3l14 9.5-6.2 1.3 3.7 6.7-2.7 1.5-3.7-6.8L5.5 19.5z" fill="#18202e" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(<Stage />)
