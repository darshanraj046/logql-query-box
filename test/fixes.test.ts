import { describe, expect, it } from 'vitest'
import { editSpans } from '../src/core/edit'
import type { QueryNode } from '../src/core/types'
import { makeEngine, makePrototype, strip } from './helpers'

const engine = makeEngine()
const proto = makePrototype()

const oldTree = (q: string) => {
  const p = proto.parse(q)
  return p.error ? { error: p.error } : strip(p.root)
}
const newTree = (q: string) => {
  const p = engine.parse(q)
  return p.error ? { error: p.error } : strip(p.root)
}
const oldLogql = (q: string) => proto.compileAll(proto.activeTree(proto.parse(q).root), false)
const newLogql = (q: string) => engine.analyze(q).logql
const cond = (field: string, op: string, value: unknown) => ({ field, op, value })
const and = (...children: unknown[]) => ({ op: 'AND', children })
const or = (...children: unknown[]) => ({ op: 'OR', children })

describe('negated groups', () => {
  it('no longer drops the minus in front of a bracket', () => {
    expect(oldTree('-(a b)')).toEqual(and(cond('line', 'contains', 'a'), cond('line', 'contains', 'b')))
    expect(newTree('-(a b)')).toEqual(and(or(cond('line', 'not_contains', 'a'), cond('line', 'not_contains', 'b'))))
  })

  it('applies De Morgan through nesting', () => {
    expect(newTree('-(a OR level:error)')).toEqual(and(cond('line', 'not_contains', 'a'), cond('detected_level', 'neq', 'error')))
    expect(newTree('-(-a)')).toEqual(and(cond('line', 'contains', 'a')))
    expect(newTree('-(a (b OR c))')).toEqual(and(or(cond('line', 'not_contains', 'a'), and(cond('line', 'not_contains', 'b'), cond('line', 'not_contains', 'c')))))
  })

  it('negates a merged list as a whole', () => {
    expect(newTree('-(level:error level:warn)')).toEqual(and(cond('detected_level', 'not_in', ['error', 'warn'])))
  })
})

describe('object prototype keys', () => {
  it('does not treat constructor as a field', () => {
    expect(() => oldLogql('constructor:x')).toThrow()
    expect(newTree('constructor:x')).toEqual(and(cond('line', 'contains', 'constructor:x')))
    expect(newLogql('constructor:x').branches).toHaveLength(1)
  })

  it('does not treat constructor as a level synonym', () => {
    expect(oldTree('level:constructor')).toEqual({ error: 'v.indexOf is not a function' })
    expect(newTree('level:constructor')).toEqual(and(cond('detected_level', 'eq', 'constructor')))
  })

  it.each(['__proto__', 'toString', 'hasOwnProperty', 'valueOf'])('survives %s everywhere', (k) => {
    for (const q of [`${k}:x`, `level:${k}`, `app:${k}`, k, `-${k}`]) {
      expect(engine.analyze(q).error).toBeNull()
      expect(() => engine.suggest(q, q.length)).not.toThrow()
    }
  })
})

describe('quoted values in lists', () => {
  it('keeps a comma inside quotes', () => {
    expect(oldTree('app:"a,b"')).toEqual(and(cond('service_name', 'in', ['a', 'b'])))
    expect(newTree('app:"a,b"')).toEqual(and(cond('service_name', 'eq', 'a,b')))
  })

  it('keeps padding inside quotes', () => {
    expect(newTree('app:" a "')).toEqual(and(cond('service_name', 'eq', ' a ')))
  })

  it('reads a list that mixes quoted and bare values', () => {
    expect(oldTree('app:"a b",c')).toEqual(and(cond('service_name', 'eq', 'a b'), cond('line', 'contains', ',c')))
    expect(newTree('app:"a b",c')).toEqual(and(cond('service_name', 'in', ['a b', 'c'])))
    expect(newTree('app:x,"y z",w')).toEqual(and(cond('service_name', 'in', ['x', 'y z', 'w'])))
  })

  it('removes duplicate list values', () => {
    expect(oldTree('level:error,error')).toEqual(and(cond('detected_level', 'in', ['error', 'error'])))
    expect(newTree('level:error,error')).toEqual(and(cond('detected_level', 'eq', 'error')))
  })
})

describe('empty quoted values', () => {
  it('never join a list', () => {
    expect(newTree('app:"",foo')).toEqual(and(cond('service_name', 'eq', 'foo')))
    expect(newTree('level:"" level:warn')).toEqual(and(cond('detected_level', 'eq', 'warn')))
    expect(newTree('-level:"" -level:warn')).toEqual(and(cond('detected_level', 'neq', 'warn')))
    expect(newLogql('-(level:"") -level:warn').branches).toEqual(['{service_name=~".+"}\n  | detected_level!="warn"'])
  })

  it('stay inactive on their own', () => {
    expect(engine.analyze('level:""').tree).toBeNull()
    expect(engine.analyze('-level:""').tree).toBeNull()
  })
})

describe('wildcards', () => {
  it('expands a wildcard inside a comma list', () => {
    expect(oldTree('app:foo*,bar')).toEqual(and(cond('service_name', 'in', ['foo*', 'bar'])))
    expect(newTree('app:foo*,bar')).toEqual(and(cond('service_name', 'regex', 'foo.*|bar')))
  })

  it('treats a repeated field with a wildcard as OR, as the help says', () => {
    expect(oldTree('app:foo* app:bar')).toEqual(and(cond('service_name', 'regex', 'foo.*'), cond('service_name', 'eq', 'bar')))
    expect(newTree('app:foo* app:bar')).toEqual(and(cond('service_name', 'regex', 'foo.*|bar')))
  })

  it('evaluates a list of wildcards without treating it as risky', () => {
    const a = engine.analyze('app:checkout-* app:*-service')
    expect(a.riskyRegex).toBe(false)
    expect(engine.evaluate(a.tree, { service_name: 'checkout-api' })).toBe(true)
    expect(engine.evaluate(a.tree, { service_name: 'auth-service' })).toBe(true)
    expect(engine.evaluate(a.tree, { service_name: 'billing-worker' })).toBe(false)
  })

  it('keeps a star literal when it is quoted', () => {
    expect(oldTree('app:"a*b"')).toEqual(and(cond('service_name', 'regex', 'a.*b')))
    expect(newTree('app:"a*b"')).toEqual(and(cond('service_name', 'eq', 'a*b')))
  })
})

describe('repeated fields inside groups', () => {
  it('merges them at every level, not only the top', () => {
    expect(oldTree('x (level:a level:b)')).toEqual(and(cond('line', 'contains', 'x'), and(cond('detected_level', 'eq', 'a'), cond('detected_level', 'eq', 'b'))))
    expect(newTree('x (level:a level:b)')).toEqual(and(cond('line', 'contains', 'x'), cond('detected_level', 'in', ['a', 'b'])))
  })
})

describe('LogQL that Loki rejects or answers wrongly', () => {
  it('adds a real selector when a label regex can match nothing', () => {
    expect(oldLogql('app:*').branches).toEqual(['{service_name=~".*"}'])
    expect(newLogql('app:*').branches).toEqual(['{service_name=~".*", service_name=~".+"}'])
  })

  it.each([
    ['app:/(foo)?/', '{service_name=~"(foo)?", service_name=~".+"}'],
    ['app:/|foo/', '{service_name=~"|foo", service_name=~".+"}']
  ])('treats %s as unable to select a stream', (q, logql) => {
    expect(newLogql(q).branches).toEqual([logql])
  })

  it('anchors pipeline label regexes explicitly', () => {
    expect(oldLogql('level:e*').branches[0]).toContain('| detected_level=~"e.*"')
    expect(newLogql('level:e*').branches[0]).toContain('| detected_level=~"^(?:e.*)$"')
    expect(newLogql('-level:e*').branches[0]).toContain('| detected_level!~"^(?:e.*)$"')
    expect(newLogql('level:/e.*/').branches[0]).toContain('| detected_level=~"^(?:e.*)$"')
  })

  it('leaves plain value lists alone, since Loki matches those exactly', () => {
    expect(newLogql('level:error,warn').branches[0]).toContain('| detected_level=~"error|warn"')
  })

  it('leaves stream selector regexes alone', () => {
    expect(newLogql('app:check*').branches).toEqual(['{service_name=~"check.*"}'])
  })

  it('keeps regexes case insensitive when they start with a non flag group', () => {
    expect(oldLogql('/(?:foo|bar)/').branches[0]).toContain('|~ "(?:foo|bar)"')
    expect(newLogql('/(?:foo|bar)/').branches[0]).toContain('|~ "(?i)(?:foo|bar)"')
  })

  it('keeps regexes case insensitive when they set an unrelated flag', () => {
    expect(oldLogql('/(?s)foo/').branches[0]).toContain('|~ "(?s)foo"')
    expect(newLogql('/(?s)foo/').branches[0]).toContain('|~ "(?i)(?s)foo"')
  })

  it('does not add (?i) twice', () => {
    expect(newLogql('/(?i)foo/').branches[0]).toContain('|~ "(?i)foo"')
    expect(newLogql('/(?is)foo/').branches[0]).toContain('|~ "(?is)foo"')
  })

  it('escapes tabs and carriage returns', () => {
    expect(oldLogql('"a\tb"').branches[0]).toContain('"(?i)a\tb"')
    expect(newLogql('"a\tb"').branches[0]).toContain('"(?i)a\\tb"')
    expect(newLogql('"a\rb"').branches[0]).toContain('"(?i)a\\rb"')
  })
})

describe('regex validation', () => {
  const problem = (q: string) => engine.analyze(q).error
  const oldProblem = (q: string) => proto.condProblem(proto.parse(q).root.children[0])

  it('accepts RE2 syntax the JS engine rejects', () => {
    expect(oldProblem('/(?P<x>a)/')).toBeTruthy()
    expect(problem('/(?P<x>a)/')).toBeNull()
  })

  it('stops flagging text that only looks like lookaround or a backreference', () => {
    expect(oldProblem('/\\\\1/')).toBeTruthy()
    expect(oldProblem('/[(?=]/')).toBeTruthy()
    expect(problem('/\\\\1/')).toBeNull()
    expect(problem('/[(?=]/')).toBeNull()
  })

  it('rejects syntax JS allows and RE2 does not', () => {
    expect(oldProblem('/\\y/')).toBeNull()
    expect(problem('/\\y/')).toBeTruthy()
    expect(problem('/a{1001}/')).toBeTruthy()
  })

  it('does not blame RE2 for an ordinary typo', () => {
    expect(problem('/[a/')).toBe('One of the /regular expressions/ is not valid.')
    expect(problem('/(?=a)/')).toBe('One of the /regular expressions/ is not valid for Loki. Loki uses RE2, so lookaround and backreferences do not work.')
  })

  it('reads a slash inside a character class as part of the regex', () => {
    expect(oldTree('/[/]/')).toEqual(and(cond('line', 'contains', '/[/]/')))
    expect(newTree('/[/]/')).toEqual(and(cond('line', 'regex', '[/]')))
    expect(newTree('/[^/]+/')).toEqual(and(cond('line', 'regex', '[^/]+')))
    expect(newTree('/[]/]/')).toEqual(and(cond('line', 'regex', '[]/]')))
  })

  it('still reports an unfinished class as a bad regex', () => {
    expect(newTree('/[a/')).toEqual(and(cond('line', 'regex', '[a')))
  })
})

describe('editing the query text', () => {
  it('keeps double spaces inside phrases and regexes', () => {
    const q = '"a  b" level:error'
    expect(proto.editSpans(q, proto.parse(q).children[1].spans, '')).toBe('"a b"')
    expect(engine.removeNode(q, engine.parse(q).children[1])).toBe('"a  b"')
    const r = '/a  b/ level:error'
    expect(engine.removeNode(r, engine.parse(r).children[1])).toBe('/a  b/')
  })

  it('keeps meaning when a facet is added to an OR query', () => {
    const q = 'level:error OR timeout'
    expect(proto.facetEdit(q, 'service_name', 'x', false)).toBe('level:error OR timeout app:x')
    const next = engine.toggleValue(q, 'service_name', 'x')
    expect(next).toBe('(level:error OR timeout) app:x')
  })

  it('does not wrap an OR that is already bracketed', () => {
    expect(engine.toggleValue('(a OR b)', 'service_name', 'x')).toBe('(a OR b) app:x')
    expect(engine.toggleValue('(a) OR (b)', 'service_name', 'x')).toBe('((a) OR (b)) app:x')
  })

  it('escapes backslashes when writing a value back', () => {
    const v = 'a\\ b'
    expect(oldTree(`app:${proto.qv(v)}`)).toEqual(and(cond('service_name', 'eq', 'a b')))
    const q = engine.toggleValue('', 'service_name', v)
    expect(newTree(q)).toEqual(and(cond('service_name', 'eq', v)))
  })

  it('quotes values that would otherwise be read as syntax', () => {
    for (const v of ['/x/', 'a*b', 'a,b', 'a b', 'a(b', 'a"b', '-x', 'OR']) {
      const q = engine.toggleValue('', 'service_name', v)
      expect(newTree(q), q).toEqual(and(cond('service_name', 'eq', v)))
    }
  })

  it('cleans up after removing a term', () => {
    const remove = (q: string, i: number) => engine.removeNode(q, engine.parse(q).children[i])
    expect(remove('a AND b', 0)).toBe('b')
    expect(remove('a AND b', 1)).toBe('a')
    expect(remove('(a b) c', 2 - 2)).toBe('c')
    expect(remove('(a b)', 0)).toBe('(b)')
    expect(remove('(a)', 0)).toBe('')
    expect(remove('a  b   c', 1)).toBe('a c')
  })

  it('toggles values inside a wildcard term without losing it', () => {
    expect(engine.toggleValue('app:foo*', 'service_name', 'bar')).toBe('app:foo*,bar')
    expect(engine.toggleValue('app:foo*,bar', 'service_name', 'bar')).toBe('app:foo*')
  })

  it('edits every span of a merged term at once', () => {
    const q = 'level:error x level:warn'
    expect(engine.toggleValue(q, 'detected_level', 'warn')).toBe('level:error x')
    expect(engine.clearField(q, 'detected_level')).toBe('x')
  })

  it('moves a value between include and exclude', () => {
    expect(engine.toggleValue('level:error', 'detected_level', 'error', true)).toBe('-level:error')
    expect(engine.toggleValue('-level:error', 'detected_level', 'error')).toBe('level:error')
  })

  it('uses the shared edit helper for multi span replacement', () => {
    expect(editSpans('a b c', [[0, 1], [4, 5]], 'x', engine.schema)).toBe('x b')
  })
})

describe('branch explosion and nesting', () => {
  it('rejects an exponential filter without building it', () => {
    const q = Array.from({ length: 40 }, (_, i) => `(a${i} OR b${i})`).join(' ')
    const t = performance.now()
    const a = engine.analyze(q)
    expect(performance.now() - t).toBeLessThan(200)
    expect(a.logql.tooMany).toBe(true)
    expect(a.error).toContain('OR branches')
  })

  it('reports the same count as the prototype for small overflows', () => {
    const q = '(a OR b) (c OR d) (e OR f) (g OR h)'
    expect(newLogql(q).count).toBe(oldLogql(q).count)
  })

  it('stays finite when the count overflows', () => {
    const q = Array.from({ length: 1100 }, (_, i) => `(a${i} OR b${i})`).join(' ')
    expect(Number.isFinite(newLogql(q).count)).toBe(true)
  })

  it('gives a readable error for absurd nesting', () => {
    const q = `${'('.repeat(200000)}a${')'.repeat(200000)}`
    expect(proto.parse(q).error).toBe('Maximum call stack size exceeded')
    expect(engine.parse(q).error).toBe('This filter nests brackets too deeply. The limit is 100.')
  })

  it('allows nesting up to the limit', () => {
    const q = `${'('.repeat(100)}a${')'.repeat(100)}`
    expect(engine.parse(q).error).toBeUndefined()
  })
})

describe('suggestions', () => {
  const labels = (q: string, c = q.length) => engine.suggest(q, c).items.map((i) => i.label)

  it('stays quiet inside a phrase or regex', () => {
    proto.input.value = '"foo le'
    proto.input.selectionStart = 7
    expect(proto.buildSuggestions().items.map((i: any) => i.label)).toEqual(['level:'])
    expect(labels('"foo le')).toEqual([])
    expect(labels('"foo le bar"', 7)).toEqual([])
    expect(labels('/foo le bar/', 7)).toEqual([])
    expect(labels('app:"my le')).toEqual([])
  })

  it('offers suggestions again after the closing quote', () => {
    expect(labels('"foo bar" le')).toEqual(['level:'])
  })

  it('quotes a value that contains spaces', () => {
    const e = makeEngine({ values: { service_name: ['payment gateway'] } })
    expect(e.suggest('app:pay', 7).items[0].text).toBe('app:"payment gateway" ')
  })

  it('does not offer a value that is already in the list', () => {
    expect(labels('level:error,')).not.toContain('error')
    expect(labels('level:error,w')).toEqual(['warn'])
    expect(labels('app:"checkout-api",')).not.toContain('checkout-api')
  })

  it('omits line counts when none are known', () => {
    const e = makeEngine({ values: { service_name: ['a'] } })
    expect(e.suggest('app:', 4).items[0].hint).toBe('')
  })
})

describe('analysis on a broken filter', () => {
  it('does not present a match everything query', () => {
    const a = engine.analyze('"oops')
    expect(a.error).toBeTruthy()
    expect(a.logql.branches).toEqual([])
    expect(a.tree).toBeNull()
  })
})

describe('field names', () => {
  it('accepts the real label name as well as aliases', () => {
    expect(oldTree('service_name:x')).toEqual(and(cond('line', 'contains', 'service_name:x')))
    expect(newTree('service_name:x')).toEqual(and(cond('service_name', 'eq', 'x')))
  })

  it('compiles a tree with no matching field without crashing', () => {
    const tree: QueryNode = { id: 1, type: 'cond', field: 'ghost', op: 'eq', value: 'x' }
    expect(engine.compile(tree).branches[0]).toContain('| ghost="x"')
  })
})
