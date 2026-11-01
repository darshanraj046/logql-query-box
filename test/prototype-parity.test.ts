import { describe, expect, it } from 'vitest'
import type { QueryNode } from '../src/core/types'
import { APPS, LEVELS, makeEngine, makePrototype, makeRecords, RECENT, rng, SAVED, genBaselineQuery, strip, TYPES } from './helpers'

const engine = makeEngine()
const proto = makePrototype()
const records = makeRecords()
const CASES = 6000

function corpus(count: number, seed: number): string[] {
  const r = rng(seed)
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(genBaselineQuery(r))
  return out
}

function protoTree(q: string) {
  const p = proto.parse(q)
  return p.error ? { error: p.error } : { root: strip(p.root), children: p.children.map(strip) }
}

function newTree(q: string) {
  const p = engine.parse(q)
  return p.error ? { error: p.error } : { root: strip(p.root), children: p.children.map(strip) }
}

function normalize(tree: any): unknown {
  return JSON.parse(JSON.stringify(tree))
}

function equivalent(q: string): unknown {
  const stripIds = (n: any): any => {
    if (!n) return n
    if (n.children) {
      const kids = n.children.map(stripIds)
      return kids.length === 1 ? kids[0] : { op: n.op, children: kids }
    }
    return n
  }
  const t = newTree(q) as any
  return t.error ? t : stripIds(t.root)
}

describe('new engine matches the prototype on the baseline grammar', () => {
  const queries = corpus(CASES, 11)

  it('produces the same parse tree or the same error', () => {
    for (const q of queries) expect(normalize(newTree(q)), q).toEqual(normalize(protoTree(q)))
  })

  it('keeps the same term spans', () => {
    for (const q of queries) {
      const a = proto.parse(q)
      const b = engine.parse(q)
      if (a.error) continue
      const pick = (kids: any[]) => kids.filter((k) => k.type === 'cond').map((k) => k.spans)
      expect(pick(b.children), q).toEqual(pick(a.children))
    }
  })

  it('compiles to identical LogQL in both case modes', () => {
    for (const q of queries) {
      const p = proto.parse(q)
      if (p.error) continue
      const bad = (function walk(n: any): boolean {
        return n.type === 'cond' ? !!proto.condProblem(n) : n.children.some(walk)
      })(p.root)
      if (bad || /level:e\*/.test(q)) continue
      const tree = engine.activeTree(engine.parse(q).root as QueryNode)
      const old = proto.compileAll(proto.activeTree(p.root), false)
      expect(engine.compile(tree), q).toEqual({ branches: old.branches, tooMany: old.tooMany, count: old.count })
      const oldMc = proto.compileAll(proto.activeTree(p.root), true)
      const mc = makeEngine({ matchCase: true })
      expect(mc.compile(mc.activeTree(mc.parse(q).root as QueryNode)), q).toEqual({ branches: oldMc.branches, tooMany: oldMc.tooMany, count: oldMc.count })
    }
  })

  it('evaluates records identically', () => {
    for (const q of queries.slice(0, 1500)) {
      const p = proto.parse(q)
      if (p.error) continue
      const oldTree = proto.activeTree(p.root)
      const tree = engine.activeTree(engine.parse(q).root as QueryNode)
      for (const rec of records.slice(0, 80)) {
        const was = oldTree ? proto.evalNode(oldTree, rec, false) : true
        expect(engine.evaluate(tree, rec), `${q} :: ${rec.line}`).toBe(was)
      }
    }
  })

  it('produces the same chip text and negative flags', () => {
    for (const q of queries) {
      const a = proto.parse(q)
      if (a.error) continue
      const b = engine.parse(q)
      expect(b.children.map(engine.chipText), q).toEqual(a.children.map(proto.chipText))
      expect(b.children.map(engine.isNegative), q).toEqual(a.children.map(proto.isNeg))
    }
  })

  it('produces the same API filter', () => {
    for (const q of queries.slice(0, 2000)) {
      const a = proto.parse(q)
      if (a.error) continue
      const hasBad = engine.analyze(q).error
      if (hasBad && !engine.analyze(q).logql.tooMany) continue
      const oldTree = proto.activeTree(a.root)
      const analysis = engine.analyze(q)
      expect(analysis.filter, q).toEqual(oldTree ? proto.toApi(oldTree) : null)
    }
  })

  it('removes chips to the same meaning', () => {
    for (const q of queries.slice(0, 2500)) {
      const a = proto.parse(q)
      if (a.error) continue
      const b = engine.parse(q)
      b.children.forEach((node, i) => {
        const old = proto.editSpans(q, a.children[i].spans, '')
        const next = engine.removeNode(q, node)
        expect(equivalent(next), `${q} -> ${next}`).toEqual(equivalent(old))
      })
    }
  })

  it('clears a field to the same meaning', () => {
    for (const q of queries.slice(0, 2500)) {
      for (const field of ['detected_level', 'service_name', 'service_category']) {
        const next = engine.clearField(q, field)
        const old = proto.clearField(q, field)
        expect(equivalent(next), `${q} -> ${next}`).toEqual(equivalent(old))
      }
    }
  })

  it('reports the same active facet values', () => {
    for (const q of queries.slice(0, 2500)) {
      const p = proto.parse(q)
      if (p.error) continue
      proto.state.parsed = p
      for (const field of ['detected_level', 'service_name', 'service_category']) {
        const wildcard = /\*/.test(q)
        if (wildcard) continue
        expect([...engine.activeValues(q, field, false)].sort(), q).toEqual(Object.keys(proto.activeValues(field, false)).sort())
        expect([...engine.activeValues(q, field, true)].sort(), q).toEqual(Object.keys(proto.activeValues(field, true)).sort())
      }
    }
  })

  it('toggles facets to the same meaning', () => {
    const r = rng(23)
    const choices: [string, string][] = [
      ...LEVELS.map((v) => ['detected_level', v] as [string, string]),
      ...APPS.map((v) => ['service_name', v] as [string, string]),
      ...TYPES.map((v) => ['service_category', v] as [string, string])
    ]
    for (const q of queries.slice(0, 3000)) {
      const p = proto.parse(q)
      if (p.error || /\*/.test(q) || (p.children.length === 1 && p.children[0].type === 'group')) continue
      const [field, value] = choices[Math.floor(r() * choices.length)]
      const neg = r() < 0.4
      proto.state.query = q
      proto.state.parsed = p
      proto.facetToggle(field, value, neg)
      const next = engine.toggleValue(q, field, value, neg)
      expect(equivalent(next), `${q} -> ${next} vs ${proto.state.query}`).toEqual(equivalent(proto.state.query))
    }
  })

  it('offers the same suggestions at every caret', () => {
    const extras = { saved: SAVED, recent: RECENT }
    const clean = (list: any) => ({
      head: list.head,
      items: list.items.map(({ color: _c, ...rest }: any) => rest),
      extra: (list.extra ?? []).map(({ color: _c, ...rest }: any) => rest)
    })
    const samples = [
      '', ' ', '-', '-l', '-le', 'l', 'le', 'lev', 'level', 'level:', 'level:e', 'level:er', 'level:error', 'level:error ', '-level:', '-level:d', 'lvl:wa', 'a', 'ap', 'app', 'app:', 'app:c', 'app:CHECK', 'app:serv', 'apptype:', 'apptype:j', 'msg:', 'msg:foo', 'foo', 'foo ', 'foo level:', '(level:e', '(lev', 'a OR ', 'a OR b', 'OR', 'AND', 'x level:w y', 'unknownfield:', 'http://x'
    ]
    for (const q of samples) {
      for (let c = 0; c <= q.length; c++) {
        proto.input.value = q
        proto.input.selectionStart = c
        const old = clean(proto.buildSuggestions())
        expect(clean(engine.suggest(q, c, extras)), `${JSON.stringify(q)} @${c}`).toEqual(old)
      }
    }
  })

  it('produces the same highlight regex matches', () => {
    for (const q of queries.slice(0, 1500)) {
      const p = proto.parse(q)
      if (p.error) continue
      const tree = proto.activeTree(p.root)
      proto.setHighlight(tree)
      const old: RegExp | null = proto.state.hl
      const next = engine.highlightPattern(engine.activeTree(engine.parse(q).root as QueryNode))
      expect(next === null, q).toBe(old === null)
      if (!old || !next) continue
      for (const rec of records.slice(0, 20)) {
        expect(rec.line.match(next) ?? [], `${q} :: ${rec.line}`).toEqual(rec.line.match(old) ?? [])
      }
    }
  })
})
