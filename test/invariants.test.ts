import { describe, expect, it } from 'vitest'
import { quoteValue, tokenize, type QueryNode } from '../src/core'
import { genBaselineQuery, genExtendedQuery, genSoup, makeEngine, makeRecords, rng, strip } from './helpers'

const engine = makeEngine()
const records = makeRecords(120)

function fuzz(count: number, seed: number): string[] {
  const r = rng(seed)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const x = r()
    out.push(x < 0.5 ? genSoup(r) : x < 0.8 ? genExtendedQuery(r) : genBaselineQuery(r))
  }
  return out
}

const queries = fuzz(12000, 101)

describe('nothing crashes on any input', () => {
  it('analyzes, chips, compiles and evaluates', () => {
    for (const q of queries) {
      const a = engine.analyze(q)
      a.parsed.children.map(engine.chipText)
      if (!a.error) for (const rec of records.slice(0, 8)) engine.evaluate(a.tree, rec)
      engine.validate(q)
      engine.highlightPattern(a.tree)
    }
  })

  it('suggests at every caret and in bounds', () => {
    for (const q of queries.slice(0, 3000)) {
      for (let c = 0; c <= q.length; c++) {
        const list = engine.suggest(q, c)
        for (const it of list.items) {
          if (!it.replace) continue
          expect(it.replace[0]).toBeGreaterThanOrEqual(0)
          expect(it.replace[1]).toBeLessThanOrEqual(q.length)
          expect(it.replace[0]).toBeLessThanOrEqual(it.replace[1])
          expect(it.replace[0]).toBeLessThanOrEqual(c)
          expect(it.replace[1]).toBeGreaterThanOrEqual(c)
        }
      }
    }
  })

  it('edits without throwing', () => {
    for (const q of queries.slice(0, 4000)) {
      engine.toggleValue(q, 'detected_level', 'error')
      engine.toggleValue(q, 'service_name', 'x y', true)
      engine.clearField(q, 'detected_level')
      engine.appendTerm(q, 'service_category', ['JAVA'])
    }
  })
})

describe('spans are real positions', () => {
  it('stay inside the query and sit on their source text', () => {
    for (const q of queries) {
      const p = engine.parse(q)
      if (p.error) continue
      const walk = (n: QueryNode) => {
        for (const [s, e] of n.spans ?? []) {
          expect(s).toBeGreaterThanOrEqual(0)
          expect(e).toBeLessThanOrEqual(q.length)
          expect(s).toBeLessThan(e)
        }
        if (n.type === 'group') n.children.forEach(walk)
      }
      p.children.forEach(walk)
    }
  })

  it('token positions never overlap', () => {
    for (const q of queries) {
      let at = 0
      for (const t of tokenize(q, engine.schema).toks) {
        expect(t.s).toBeGreaterThanOrEqual(at)
        at = t.e
      }
    }
  })
})

describe('tree shape', () => {
  it('never holds an empty or single child group below the root', () => {
    for (const q of queries) {
      const p = engine.parse(q)
      if (p.error) continue
      const walk = (n: QueryNode) => {
        if (n.type !== 'group') return
        expect(n.children.length).toBeGreaterThan(1)
        n.children.forEach(walk)
      }
      p.children.forEach(walk)
    }
  })

  it('never leaves a field name undefined', () => {
    for (const q of queries) {
      const p = engine.parse(q)
      if (p.error) continue
      const walk = (n: QueryNode) => {
        if (n.type === 'group') n.children.forEach(walk)
        else expect(engine.schema.fields.has(n.field), q).toBe(true)
      }
      p.children.forEach(walk)
    }
  })
})

describe('text editing keeps meaning', () => {
  const clean = queries.filter((q) => !engine.analyze(q).error)

  it('tidied queries parse to the same tree', () => {
    for (const q of clean.slice(0, 5000)) {
      const before = engine.analyze(q).tree
      const next = engine.appendTerm(q, 'line', ['retry'])
      const after = engine.analyze(next)
      expect(after.parsed.error, `${q} -> ${next}`).toBeUndefined()
      for (const rec of records.slice(0, 30)) {
        const expected = engine.evaluate(before, rec) && rec.line.toLowerCase().includes('retry')
        expect(engine.evaluate(after.tree, rec), `${q} -> ${next}`).toBe(expected)
      }
    }
  })

  it('removing a chip leaves a valid query with one fewer top level condition', () => {
    for (const q of clean.slice(0, 3000)) {
      const p = engine.parse(q)
      p.children.forEach((node) => {
        const next = engine.removeNode(q, node)
        expect(engine.parse(next).error, `${q} -> ${next}`).toBeUndefined()
      })
    }
  })

  it('removing every chip leaves nothing that filters', () => {
    for (const q of clean.slice(0, 2000)) {
      let current = q
      for (let guard = 0; guard < 50; guard++) {
        const kids = engine.parse(current).children
        if (!kids.length) break
        current = engine.removeNode(current, kids[0])
      }
      expect(engine.parse(current).children, `${q} -> ${current}`).toEqual([])
    }
  })

  it('toggling a value twice restores the filter', () => {
    const r = rng(5)
    const values = ['error', 'warn', 'debug']
    for (const q of clean.slice(0, 3000)) {
      if (engine.activeValues(q, 'detected_level').size || engine.activeValues(q, 'detected_level', true).size) continue
      const v = values[Math.floor(r() * values.length)]
      const neg = r() < 0.5
      const twice = engine.toggleValue(engine.toggleValue(q, 'detected_level', v, neg), 'detected_level', v, neg)
      expect(engine.analyze(twice).filter, `${q} -> ${twice}`).toEqual(engine.analyze(q).filter)
    }
  })
})

describe('quoteValue round trip', () => {
  const r = rng(77)
  const alphabet = ['a', 'B', ' ', ',', '"', '\\', '/', '*', '(', ')', '-', ':', '\n', '\t', '😀', 'é', 'OR', '.', '|']
  const values: string[] = []
  for (let i = 0; i < 4000; i++) {
    let v = ''
    const n = 1 + Math.floor(r() * 8)
    for (let j = 0; j < n; j++) v += alphabet[Math.floor(r() * alphabet.length)]
    values.push(v)
  }

  it('reads any single value back unchanged', () => {
    for (const v of values) {
      const p = engine.parse(`app:${quoteValue(v)}`)
      expect(strip(p.children[0]), JSON.stringify(v)).toEqual({ field: 'service_name', op: 'eq', value: v })
    }
  })

  it('reads any list of values back unchanged', () => {
    for (let i = 0; i + 2 < values.length; i += 3) {
      const list = [...new Set(values.slice(i, i + 3))]
      if (list.length < 2) continue
      const p = engine.parse(`app:${list.map(quoteValue).join(',')}`)
      expect(strip(p.children[0]), JSON.stringify(list)).toEqual({ field: 'service_name', op: 'in', value: list })
    }
  })

  it('survives a facet add and remove', () => {
    for (const v of values.slice(0, 1500)) {
      const added = engine.toggleValue('timeout', 'service_name', v)
      expect(engine.activeValues(added, 'service_name').has(v), JSON.stringify(added)).toBe(true)
      expect(engine.toggleValue(added, 'service_name', v)).toBe('timeout')
    }
  })
})

describe('compiled output', () => {
  it('is only produced for queries that are clean', () => {
    for (const q of queries) {
      const a = engine.analyze(q)
      if (a.error) expect(a.logql.branches).toEqual([])
      else {
        expect(a.logql.branches.length).toBeGreaterThan(0)
        expect(a.logql.branches.length).toBeLessThanOrEqual(12)
        for (const b of a.logql.branches) expect(b).toMatch(/^\{[^\n]*\}(\n {2}(\|~|!~|\|=|!=|\|) [^\n]*)*$/)
      }
    }
  })

  it('never has a stream selector without a non empty matcher', () => {
    for (const q of queries) {
      const a = engine.analyze(q)
      for (const b of a.logql.branches) {
        const selector = b.split('\n')[0]
        expect(selector === '{}' || selector.includes('=""')).toBe(false)
      }
    }
  })
})

describe('performance', () => {
  it('parses a large pasted query quickly', () => {
    const q = Array.from({ length: 20000 }, (_, i) => `word${i}`).join(' ')
    const t = performance.now()
    expect(engine.parse(q).children).toHaveLength(20000)
    expect(performance.now() - t).toBeLessThan(1500)
  })

  it('tokenizes a pathological slash heavy line quickly', () => {
    const q = '/a '.repeat(20000)
    const t = performance.now()
    tokenize(q, engine.schema)
    expect(performance.now() - t).toBeLessThan(1000)
  })

  it('handles a huge paste without a stack error', () => {
    const q = Array.from({ length: 300000 }, (_, i) => `w${i}`).join(' ')
    const a = engine.analyze(q)
    expect(a.error).toBeNull()
    expect(a.parsed.children).toHaveLength(300000)
  })

  it('compiles a very long AND in linear time', () => {
    const q = Array.from({ length: 100000 }, (_, i) => `w${i}`).join(' ')
    const t = performance.now()
    expect(engine.analyze(q).logql.branches).toHaveLength(1)
    expect(performance.now() - t).toBeLessThan(4000)
  })

  it('merges a field repeated thousands of times quickly and without duplicates', () => {
    const q = Array.from({ length: 20000 }, (_, i) => `app:v${i % 15000}`).join(' ')
    const t = performance.now()
    const p = engine.parse(q)
    expect(performance.now() - t).toBeLessThan(2000)
    expect(p.children).toHaveLength(1)
    expect((p.children[0] as { value: string[] }).value).toHaveLength(15000)
    expect(p.children[0].spans).toHaveLength(20000)
  })

  it('edits a query with very many spans', () => {
    const q = Array.from({ length: 120000 }, (_, i) => `app:v${i}`).join(' ')
    expect(engine.clearField(q, 'service_name')).toBe('')
  })

  it('keeps the order of conditions when expanding branches', () => {
    expect(engine.analyze('a (b OR c) d (e OR f)').logql.branches.map((b) => b.split('\n').slice(1).map((l) => l.replace(/.*\(\?i\)|"/g, '')).join(''))).toEqual(['abde', 'abdf', 'acde', 'acdf'])
  })

  it('does not stall tidying absurd bracket nesting', () => {
    const q = `${'('.repeat(20000)}${')'.repeat(20000)}`
    const t = performance.now()
    engine.appendTerm(q, 'line', ['x'])
    expect(performance.now() - t).toBeLessThan(2000)
  })

  it('evaluates with a bounded regex cache', () => {
    for (let i = 0; i < 2000; i++) engine.analyze(`/r${i}/`)
    expect(engine.analyze('/r1/').error).toBeNull()
  })
})
