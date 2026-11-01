import { Script, createContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { isRiskyRegex, regexProblem, toJsRegex } from '../src/core/regex'
import verdicts from './golden/re2-verdicts.json'
import { makeEngine, rng } from './helpers'

const LIMIT_MS = 1000
const LINE_SIZED = ['a'.repeat(40), `${'a'.repeat(40)}!`, `${'ab'.repeat(20)}!`, `${'1'.repeat(40)}!`, `${'x '.repeat(20)}!`, `${'a'.repeat(200)}!`, `${'a,'.repeat(100)}!`, `${'aB1 '.repeat(50)}!`]
const EXTREME = [`${'a'.repeat(3000)}!`, `${'a,'.repeat(1500)}!`]

const context = createContext({ re: null, s: '' })
const script = new Script('re.test(s)')

function hangs(pattern: string): string | null {
  const sandbox = context as unknown as { re: RegExp; s: string }
  sandbox.re = toJsRegex(pattern, true, false)
  for (const s of [...LINE_SIZED, ...EXTREME]) {
    sandbox.re.lastIndex = 0
    sandbox.s = s
    try {
      script.runInContext(context, { timeout: LIMIT_MS })
    } catch {
      return s.slice(0, 12)
    }
  }
  return null
}

function nested(count: number, seed: number): string[] {
  const r = rng(seed)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const atoms = ['a', 'a', 'b', '.', '\\w', '\\d', '\\s', '[ab]', '[^!]', 'x']
  const repeats = ['', '', '*', '+', '?', '{2,}', '{1,12}', '{5}', '{2,3}', '*?', '+?']
  const expr = (depth: number): string => {
    const parts: string[] = []
    const n = 1 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      const x = r()
      let piece: string
      if (depth > 0 && x < 0.3) piece = `(${expr(depth - 1)})`
      else if (depth > 0 && x < 0.45) piece = `(?:${expr(depth - 1)})`
      else if (depth > 0 && x < 0.6) piece = `(${expr(depth - 1)}|${expr(depth - 1)})`
      else piece = pick(atoms)
      parts.push(piece + pick(repeats))
    }
    return parts.join('')
  }
  const out = new Set<string>()
  while (out.size < count) out.add(expr(3))
  return [...out]
}

describe('patterns that backtrack badly are detected', () => {
  it.each([
    '(a+)+',
    '(a+)+b',
    '(a*)*',
    '(a*)*b',
    '(a+)*',
    '(a|a)*',
    '(a|aa)+',
    '(a|a?)+',
    '(a|b|ab)*c',
    '(\\w|\\d)+x',
    '(.*a){20}',
    '(.+)+$',
    '([a-zA-Z]+)*',
    '^(([a-z])+.)+[A-Z]([a-z])+$',
    '(x+x+)+y',
    '(\\w+\\s?)*$',
    '^(\\w+\\s?)*$',
    '(a?){30}',
    '([ab]*?\\s*?\\w?){2,3}x',
    '(a{1,30}){1,30}',
    'a*a*a*a*b',
    '.*.*.*x',
    '.+a+?\\d',
    '[ab]{2,}a*x',
    '\\w+\\d+x',
    'a*]*(a)+',
    'a*(x)?a*b',
    'a*^?(?:a)+',
    'a+a+b',
    '(a*|b*)a*c',
    '(a*)?a*b',
    '(a){2,}(a)a{2}(?:a)*?',
    '(.*)(.*)(.*)x',
    'a.*b.*c.*d.*e',
    '(?:a+)+',
    '(?i)(A+)+',
    '(?P<x>a+)+'
  ])('%s', (p) => {
    expect(regexProblem(p)).toBeNull()
    expect(isRiskyRegex(p)).toBe(true)
  })
})

describe('everyday patterns are left alone', () => {
  it.each([
    'timeout',
    '\\w+Exception',
    'time(out|d)',
    '(foo|bar)+',
    '(GET|POST|PUT) /api',
    '^GET',
    '\\d+ of \\d+',
    '\\d+\\.\\d+\\.\\d+\\.\\d+',
    '(\\d+\\.){3}\\d+',
    '([0-9a-f]{2}:){5}[0-9a-f]{2}',
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    '^[a-z]+://[^/]+/.*',
    '(?i)connection (refused|reset)',
    'status=[45]\\d\\d',
    'user=(\\w+) id=(\\d+)',
    '(?:https?://)?example\\.com',
    '.*timeout.*',
    '\\w+\\s+\\w+',
    '\\s*\\w+',
    'a.*b.*c',
    '(ab)+',
    '[[:digit:]]+',
    '\\bOrder\\b',
    'checkout-.*|.*-service',
    'a.*|b.*|c.*|d.*|e.*',
    '(checkout-.*|.*-service) done'
  ])('%s', (p) => {
    expect(regexProblem(p)).toBeNull()
    expect(isRiskyRegex(p)).toBe(false)
  })

  it('does not treat invalid regexes as risky', () => {
    expect(isRiskyRegex('(a+')).toBe(false)
    expect(isRiskyRegex('(?=a)')).toBe(false)
  })
})

describe('anything judged safe finishes quickly on worst case input', () => {
  it('holds for the recorded RE2 corpus', () => {
    const valid = (verdicts as [string, boolean][]).filter(([p, ok]) => ok && !regexProblem(p)).map(([p]) => p)
    const slow = valid.filter((p) => !isRiskyRegex(p)).flatMap((p) => {
      const on = hangs(p)
      return on ? [`${JSON.stringify(p)} on ${on}`] : []
    })
    expect(slow.slice(0, 20).join('\n')).toBe('')
  }, 300000)

  it('holds for generated nested patterns', () => {
    const patterns = nested(12000, 4242).filter((p) => !regexProblem(p))
    const safe = patterns.filter((p) => !isRiskyRegex(p))
    const slow = safe.flatMap((p) => {
      const on = hangs(p)
      return on ? [`${JSON.stringify(p)} on ${on}`] : []
    })
    expect(slow.slice(0, 20).join('\n')).toBe('')
    expect(safe.length).toBeGreaterThan(patterns.length / 10)
  }, 300000)
})

describe('risky regexes never run in the browser', () => {
  const engine = makeEngine()
  const line = 'a'.repeat(40)

  it('still validates and compiles for Loki', () => {
    const a = engine.analyze('/(a+)+b/')
    expect(a.error).toBeNull()
    expect(a.logql.branches[0]).toContain('|~ "(?i)(a+)+b"')
    expect(a.riskyRegex).toBe(true)
  })

  it('flags a risky regex anywhere in the filter', () => {
    expect(engine.analyze('x (y OR -/(a+)+b/)').riskyRegex).toBe(true)
    expect(engine.analyze('app:/(a+)+b/').riskyRegex).toBe(true)
    expect(engine.analyze('/timeout/ level:error').riskyRegex).toBe(false)
    expect(engine.analyze('"(a+)+b"').riskyRegex).toBe(false)
    expect(engine.analyze('"oops').riskyRegex).toBe(false)
    expect(engine.analyze('/(?=a)/').riskyRegex).toBe(false)
    expect(engine.analyze('').riskyRegex).toBe(false)
  })

  it('does not apply the risky condition in evaluate', () => {
    const t = performance.now()
    expect(engine.evaluate(engine.analyze('/(a+)+b/').tree, { line })).toBe(true)
    expect(engine.evaluate(engine.analyze('-/(a+)+b/').tree, { line })).toBe(true)
    expect(engine.evaluate(engine.analyze('app:/(a+)+b/').tree, { service_name: line })).toBe(true)
    expect(performance.now() - t).toBeLessThan(200)
  })

  it('still applies the safe conditions next to it', () => {
    const tree = engine.analyze('/(a+)+b/ level:error').tree
    expect(engine.evaluate(tree, { line, detected_level: 'error' })).toBe(true)
    expect(engine.evaluate(tree, { line, detected_level: 'info' })).toBe(false)
  })

  it('leaves the risky regex out of highlighting and keeps the rest', () => {
    expect(engine.highlightPattern(engine.analyze('/(a+)+b/').tree)).toBeNull()
    const re = engine.highlightPattern(engine.analyze('/(a+)+b/ timeout').tree) as RegExp
    expect(`${line} timeout`.match(re)).toEqual(['timeout'])
  })
})
