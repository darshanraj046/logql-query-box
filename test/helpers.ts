import { createRequire } from 'node:module'
import { createEngine } from '../src/core/engine'
import type { QueryNode } from '../src/core/types'

const require = createRequire(import.meta.url)
export const createPrototype = require('./oracle/prototype.cjs') as (env: Record<string, unknown>) => any

export const APPS = ['checkout-api', 'auth-service', 'billing-worker', 'ledger.sync', 'search+index']
export const TYPES = ['JAVA', 'PYTHON', 'GO']
export const LEVELS = ['error', 'info', 'warn', 'debug', 'unknown']
export const COUNTS: Record<string, Record<string, number>> = {
  detected_level: { error: 120, info: 4000, warn: 90, debug: 15, unknown: 3 },
  service_name: { 'checkout-api': 900, 'auth-service': 1200, 'billing-worker': 40, 'ledger.sync': 7, 'search+index': 0 },
  service_category: { JAVA: 2000, PYTHON: 90, GO: 5 }
}
export const SAVED = [
  { id: 's1', name: 'Errors and warnings', query: 'level:error,warn', pinned: true },
  { id: 's2', name: 'Timeouts', query: 'level:error (timeout OR refused)', pinned: false },
  { id: 's3', name: 'Java exceptions', query: 'apptype:java /\\w+Exception/', pinned: false }
]
export const RECENT = ['level:error', 'timeout', '-level:debug']

export const engineValues = {
  service_name: APPS.map((value) => ({ value, count: COUNTS.service_name[value] })),
  service_category: TYPES.map((value) => ({ value, count: COUNTS.service_category[value] })),
  detected_level: LEVELS.map((value) => ({ value, count: COUNTS.detected_level[value] }))
}

export function makeEngine(options: Parameters<typeof createEngine>[0] = {}) {
  return createEngine({ values: engineValues, ...options })
}

export function makePrototype(query = '') {
  return createPrototype({ apps: APPS, types: TYPES, counts: COUNTS, saved: SAVED, recent: RECENT, query })
}

export function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MESSAGES = [
  'connection refused by upstream',
  'Connection Timeout after 30s',
  'request timeout on /api/v2/orders',
  'NullPointerException at com.acme.Order.total',
  'IllegalStateException: cart is empty',
  'user 42 logged in',
  'cache miss for key a.b.c',
  'retry 3 of 5',
  'path C:\\temp\\file.log not found',
  'said "hello world" twice',
  'price is 5+3=8 (approx)',
  'value [x] {y} ^z$',
  'tab\tseparated\tvalues',
  'cafe\u0301 caf\u00e9 \u4e2d\u6587 \ud83d\ude00',
  'GET /health 200',
  'x-request-id: abc-123',
  'a,b,c list',
  '-leading dash',
  ''
]

export type LogRow = {
  id: number
  service_name: string
  service_category: string
  detected_level: string
  line: string
}

export function makeRecords(count = 400, seed = 7): LogRow[] {
  const r = rng(seed)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const out: LogRow[] = []
  for (let id = 0; id < count; id++) {
    const message = pick(MESSAGES)
    out.push({
      id,
      service_name: pick(APPS),
      service_category: pick(TYPES),
      detected_level: pick(LEVELS),
      line: message === '' ? `empty case ${id}` : `${message} #${id % 7}`
    })
  }
  return out
}

const WORDS = ['timeout', 'refused', 'Exception', 'retry', 'cache', 'order', '/api/v2/orders', 'a.b.c', 'x-request-id', 'http://host:8080/x', '5+3=8', 'C:\\temp', 'user', 'hello', 'OR1', 'ANDroid', '#3', '42']
const PHRASES = ['"connection refused"', '"hello world"', '"Timeout after"', '"said \\"hello"', '"C:\\\\temp"', '"a b"']
const REGEXES = ['/\\w+Exception/', '/time(out|d)/', '/^GET/', '/(?i)connection/', '/\\d+ of \\d+/', '/retry \\d/', '/a\\/b/', '/[0-9]+/']
const LEVEL_TERMS = ['level:error', 'level:warn', 'level:ERROR', 'severity:warning', 'lvl:info', 'type:debug', 'level:error,warn', 'level:fatal', 'level:none', 'level:info,debug,warn']
const APP_TERMS = ['app:checkout-api', 'app:CHECKOUT-API', 'service:auth-service', 'name:ledger.sync', 'app:checkout-api,auth-service', 'app:search+index']
const TYPE_TERMS = ['apptype:java', 'runtime:python', 'lang:GO', 'kind:java,python']
const WILD_TERMS = ['app:checkout-*', 'app:*-service', 'level:e*']

export function genBaselineQuery(r: () => number): string {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const nested = new Set<string>()
  const ever = new Set<string>()
  const blocked = new Set<string>()
  let topUsed = new Set<string>()

  const fieldTerm = (depth: number, repeats: boolean, used: Set<string>): string => {
    const [slot, list] = pick([
      ['level', LEVEL_TERMS],
      ['app', APP_TERMS],
      ['type', TYPE_TERMS],
      ['wild', WILD_TERMS]
    ] as [string, string[]][])
    const term = pick(list)
    const name = slot === 'wild' ? (term.startsWith('level') ? 'level' : 'app') : slot
    if (blocked.has(name)) return pick(WORDS)
    if (slot === 'wild') {
      if (ever.has(name)) return pick(WORDS)
      blocked.add(name)
    }
    if (depth > 0) {
      if (nested.has(name) || topUsed.has(name)) return pick(WORDS)
      nested.add(name)
    } else if (!repeats) {
      if (used.has(name) || nested.has(name)) return pick(WORDS)
      used.add(name)
    }
    ever.add(name)
    return (r() < 0.25 ? '-' : '') + term
  }

  const gen = (depth: number): string => {
    const allowOr = r() < 0.4
    const used = new Set<string>()
    if (depth === 0) topUsed = used
    const term = (): string => {
      const x = r()
      if (x < 0.34) return (r() < 0.2 ? '-' : '') + pick(WORDS)
      if (x < 0.48) return (r() < 0.2 ? '-' : '') + pick(PHRASES)
      if (x < 0.62) return (r() < 0.2 ? '-' : '') + pick(REGEXES)
      if (x < 0.9) return fieldTerm(depth, depth === 0 && !allowOr, used)
      if (depth < 3) return `(${gen(depth + 1)})`
      return pick(WORDS)
    }
    const count = 1 + Math.floor(r() * 4)
    const parts: string[] = []
    for (let i = 0; i < count; i++) {
      if (i) {
        const x = r()
        if (allowOr && x < 0.35) {
          parts.push('OR')
          used.clear()
        } else if (x < 0.45) parts.push('AND')
      }
      parts.push(term())
    }
    return parts.join(pick([' ', ' ', '  ']))
  }
  return gen(0)
}

export function strip(n: QueryNode | null | undefined): unknown {
  if (!n) return null
  if (n.type === 'cond') return { field: n.field, op: n.op, value: n.value }
  return { op: n.op, children: n.children.map(strip) }
}

export const SOUP = ['(', ')', '"', '/', '\\', '-', ',', ':', ' ', '\n', '\t', '*', '|', 'OR', 'AND', 'a', 'level', 'app', 'msg', 'error', 'level:', 'app:', '-level:', 'constructor', '__proto__', 'toString', 'hasOwnProperty', '\ud83d\ude00', '[', ']', '{', '}', '?', '^', '$', '.', '+', '\u0000', '\u2028']

export function genSoup(r: () => number): string {
  const n = Math.floor(r() * 14)
  let s = ''
  for (let i = 0; i < n; i++) s += SOUP[Math.floor(r() * SOUP.length)]
  return s
}

const EXTENDED_TERMS = [
  'app:*', '-app:*', 'app:checkout-*,auth-service', '-app:checkout-*,auth-service', 'app:*-service,ledger.sync', 'app:"checkout-api",auth-service', 'app:"a,b",checkout-api',
  'level:error level:warn', 'level:e* level:warn', '-level:e* -level:info', 'app:/.*/', 'app:/(checkout-api)?/', 'app:/|checkout-api/', 'app:/check.*/', '-app:/auth.*/', 'apptype:/(?i)java/',
  'level:/e.*/', '-level:/e.*/', 'level:""', 'app:"",checkout-api', '/(?:timeout|refused)/', '/(?s)cache.*key/', '/(?-i)Connection/', '/(?P<word>retry) \\d/', '/\\Acache/', '/\\.log\\z/', '/\\bOrder\\b/', '/[[:digit:]]+/', '/[[:^alpha:]]{3}/',
  '/[/]health/', '/\\d+/', '-/\\d+/', '"C:\\\\temp"', '"\\"hello"', '"[x] {y}"', '"5+3=8"', '"(approx)"', '"tab\tseparated"', '/tab\\tseparated/', 'caf\u00e9', '\u4e2d\u6587', '\ud83d\ude00', '"a,b,c"', 'msg:"a,b,c"', 'msg:timeout', '-msg:timeout', 'msg:/time/', '-msg:/time/', 'text:retry', 'service_name:checkout-api', 'detected_level:error', 'service_category:JAVA'
]

export function genExtendedQuery(r: () => number, depth = 0): string {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const term = (): string => {
    const x = r()
    if (x < 0.3) return (r() < 0.2 ? '-' : '') + pick(WORDS)
    if (x < 0.4) return (r() < 0.2 ? '-' : '') + pick(PHRASES)
    if (x < 0.5) return (r() < 0.2 ? '-' : '') + pick(REGEXES)
    if (x < 0.65) return (r() < 0.25 ? '-' : '') + pick([...LEVEL_TERMS, ...APP_TERMS, ...TYPE_TERMS, ...WILD_TERMS])
    if (x < 0.85) return pick(EXTENDED_TERMS)
    if (depth < 3) return `${r() < 0.35 ? '-' : ''}(${genExtendedQuery(r, depth + 1)})`
    return pick(WORDS)
  }
  const count = 1 + Math.floor(r() * 3)
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    if (i) {
      const x = r()
      if (x < 0.3) parts.push('OR')
      else if (x < 0.4) parts.push('AND')
    }
    parts.push(term())
  }
  return parts.join(' ')
}
