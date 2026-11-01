import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createEngine, defaultSchema, logqlString, MAX_BRANCHES, type Cond, type Group, type QueryNode, type Schema } from '../src/core'
import { makeEngine, strip } from './helpers'

const engine = makeEngine()
const tree = (q: string) => {
  const p = engine.parse(q)
  return p.error ? { error: p.error } : strip(p.root)
}
const cond = (field: string, op: string, value: unknown) => ({ field, op, value })
const and = (...children: unknown[]) => ({ op: 'AND', children })
const or = (...children: unknown[]) => ({ op: 'OR', children })
const logql = (q: string) => engine.analyze(q).logql.branches

describe('documented search language', () => {
  it.each([
    ['timeout', and(cond('line', 'contains', 'timeout'))],
    ['"connection refused"', and(cond('line', 'contains', 'connection refused'))],
    ['-debug', and(cond('line', 'not_contains', 'debug'))],
    ['/\\w+Exception/', and(cond('line', 'regex', '\\w+Exception'))],
    ['level:error,warn', and(cond('detected_level', 'in', ['error', 'warn']))],
    ['level:error level:warn', and(cond('detected_level', 'in', ['error', 'warn']))],
    ['-level:debug', and(cond('detected_level', 'neq', 'debug'))],
    ['app:checkout-*', and(cond('service_name', 'regex', 'checkout-.*'))],
    ['apptype:java', and(cond('service_category', 'eq', 'JAVA'))],
    ['level:error (timeout OR refused)', and(cond('detected_level', 'eq', 'error'), or(cond('line', 'contains', 'timeout'), cond('line', 'contains', 'refused')))],
    ['timeout refused', and(cond('line', 'contains', 'timeout'), cond('line', 'contains', 'refused'))],
    ['timeout OR refused', and(or(cond('line', 'contains', 'timeout'), cond('line', 'contains', 'refused')))],
    ['-app:a,b', and(cond('service_name', 'not_in', ['a', 'b']))],
    ['a AND b', and(cond('line', 'contains', 'a'), cond('line', 'contains', 'b'))]
  ])('%s', (q, expected) => {
    expect(tree(q)).toEqual(expected)
  })
})

describe('README', () => {
  it('shows real output for its headline example', () => {
    const readme = readFileSync('README.md', 'utf8')
    const q = (readme.match(/```text\n([^\n]+)\n```/) as RegExpMatchArray)[1]
    const out = (readme.match(/```logql\n([\s\S]+?)\n```/) as RegExpMatchArray)[1]
    expect(logql(q)).toEqual([out])
  })
})

describe('precedence and structure', () => {
  it('binds AND tighter than OR', () => {
    expect(tree('a OR b c')).toEqual(and(or(cond('line', 'contains', 'a'), and(cond('line', 'contains', 'b'), cond('line', 'contains', 'c')))))
    expect(tree('a b OR c')).toEqual(and(or(and(cond('line', 'contains', 'a'), cond('line', 'contains', 'b')), cond('line', 'contains', 'c'))))
  })

  it('lets brackets override', () => {
    expect(tree('(a OR b) c')).toEqual(and(or(cond('line', 'contains', 'a'), cond('line', 'contains', 'b')), cond('line', 'contains', 'c')))
  })

  it('only treats uppercase OR and AND as operators', () => {
    expect(tree('a or b')).toEqual(and(cond('line', 'contains', 'a'), cond('line', 'contains', 'or'), cond('line', 'contains', 'b')))
    expect(tree('"OR"')).toEqual(and(cond('line', 'contains', 'OR')))
    expect(tree('msg:OR')).toEqual(and(cond('line', 'contains', 'OR')))
    expect(tree('-OR')).toEqual(and(cond('line', 'not_contains', 'OR')))
  })
})

describe('half typed queries stay valid', () => {
  it.each(['', ' ', '\n\t', 'OR', 'AND', 'a OR', 'OR a', 'a AND', 'AND a', 'a OR OR b', '()', '( )', '(())', '() a', 'a ()', 'level:', '-level:', '-', 'a -', '- a', 'a OR ()', '(OR)', '(AND a)'])('%j', (q) => {
    expect(engine.analyze(q).error).toBeNull()
  })

  it('reads a lone minus as the text itself', () => {
    expect(tree('a -')).toEqual(and(cond('line', 'contains', 'a'), cond('line', 'contains', '-')))
    expect(tree('(a -)')).toEqual(and(cond('line', 'contains', 'a')))
  })
})

describe('errors', () => {
  it('points at an unterminated quote', () => {
    expect(engine.parse('abc "def').error).toBe('The quote that starts at character 5 is never closed.')
    expect(engine.parse('app:"def').error).toBe('The quote that starts at character 5 is never closed.')
    expect(engine.parse('app:a,"b').error).toBe('The quote that starts at character 7 is never closed.')
    expect(engine.parse('"a\\').error).toBe('The quote that starts at character 1 is never closed.')
  })

  it('reports bracket mismatches', () => {
    expect(engine.parse('(a').error).toBe('A ( is missing its closing ).')
    expect(engine.parse('a)').error).toBe('There is a ) without a matching (.')
    expect(engine.parse('(a))').error).toBe('There is a ) without a matching (.')
    expect(engine.parse('-(a').error).toBe('A ( is missing its closing ).')
  })

  it('validate gives the short form used by saved query forms', () => {
    expect(engine.validate('level:error')).toBe('')
    expect(engine.validate('(a')).toBe('This filter is not valid: A ( is missing its closing ).')
    expect(engine.validate('/(?=a)/')).toBe('A regular expression in this filter is not valid for Loki.')
  })

  it('finds a bad regex nested inside a group', () => {
    expect(engine.analyze('a (b OR /(?=x)/)').error).toContain('Loki uses RE2')
  })
})

describe('tokens', () => {
  it('splits words on spaces and brackets only', () => {
    expect(tree('foo(bar)')).toEqual(and(cond('line', 'contains', 'foo'), cond('line', 'contains', 'bar')))
    expect(tree('a,b')).toEqual(and(cond('line', 'contains', 'a,b')))
    expect(tree('msg:a,b')).toEqual(and(cond('line', 'contains', 'a,b')))
  })

  it('leaves unknown prefixes alone', () => {
    expect(tree('http://a:80/b')).toEqual(and(cond('line', 'contains', 'http://a:80/b')))
    expect(tree('foo:bar')).toEqual(and(cond('line', 'contains', 'foo:bar')))
  })

  it('keeps colons inside values', () => {
    expect(tree('app:a:b')).toEqual(and(cond('service_name', 'eq', 'a:b')))
  })

  it('accepts aliases in any case', () => {
    expect(tree('LEVEL:error')).toEqual(and(cond('detected_level', 'eq', 'error')))
    expect(tree('App:x')).toEqual(and(cond('service_name', 'eq', 'x')))
  })

  it('reads paths as words but whole slashes as regex', () => {
    expect(tree('/api/v2')).toEqual(and(cond('line', 'contains', '/api/v2')))
    expect(tree('/api/')).toEqual(and(cond('line', 'regex', 'api')))
    expect(tree('(/api/)')).toEqual(and(cond('line', 'regex', 'api')))
    expect(tree('/unfinished')).toEqual(and(cond('line', 'contains', '/unfinished')))
    expect(tree('/a b/')).toEqual(and(cond('line', 'regex', 'a b')))
    expect(tree('/a\\/b/')).toEqual(and(cond('line', 'regex', 'a/b')))
    expect(tree('app:/x.*/')).toEqual(and(cond('service_name', 'regex', 'x.*')))
    expect(tree('app:/a/b')).toEqual(and(cond('service_name', 'eq', '/a/b')))
  })

  it('handles escapes in phrases', () => {
    expect(tree('"a\\"b"')).toEqual(and(cond('line', 'contains', 'a"b')))
    expect(tree('"a\\\\b"')).toEqual(and(cond('line', 'contains', 'a\\b')))
  })

  it('treats newlines as separators but keeps them in phrases', () => {
    expect(tree('a\nb')).toEqual(and(cond('line', 'contains', 'a'), cond('line', 'contains', 'b')))
    expect(tree('"a\nb"')).toEqual(and(cond('line', 'contains', 'a\nb')))
  })

  it('handles non ASCII text', () => {
    expect(tree('\u4e2d\u6587 caf\u00e9 \ud83d\ude00')).toEqual(and(cond('line', 'contains', '\u4e2d\u6587'), cond('line', 'contains', 'caf\u00e9'), cond('line', 'contains', '\ud83d\ude00')))
  })
})

describe('value normalization', () => {
  it('maps level synonyms and casing', () => {
    expect(tree('level:WARNING')).toEqual(and(cond('detected_level', 'eq', 'warn')))
    expect(tree('level:err,fatal,critical')).toEqual(and(cond('detected_level', 'eq', 'error')))
    expect(tree('level:none')).toEqual(and(cond('detected_level', 'eq', 'unknown')))
    expect(tree('level:Mystery')).toEqual(and(cond('detected_level', 'eq', 'mystery')))
  })

  it('folds known values and keeps unknown ones', () => {
    expect(tree('app:CHECKOUT-API')).toEqual(and(cond('service_name', 'eq', 'checkout-api')))
    expect(tree('app:Mystery')).toEqual(and(cond('service_name', 'eq', 'Mystery')))
  })
})

describe('LogQL output', () => {
  it('matches the shape the backend expects', () => {
    expect(logql('')).toEqual(['{service_name=~".+"}'])
    expect(logql('timeout')).toEqual(['{service_name=~".+"}\n  |~ "(?i)timeout"'])
    expect(logql('-timeout')).toEqual(['{service_name=~".+"}\n  !~ "(?i)timeout"'])
    expect(logql('app:x')).toEqual(['{service_name="x"}'])
    expect(logql('-app:x')).toEqual(['{service_name!="x", service_name=~".+"}'])
    expect(logql('app:x,y')).toEqual(['{service_name=~"x|y"}'])
    expect(logql('-app:x,y')).toEqual(['{service_name!~"x|y", service_name=~".+"}'])
    expect(logql('apptype:java app:x')).toEqual(['{service_category="JAVA", service_name="x"}'])
    expect(logql('level:error')).toEqual(['{service_name=~".+"}\n  | detected_level="error"'])
    expect(logql('timeout level:error')).toEqual(['{service_name=~".+"}\n  |~ "(?i)timeout"\n  | detected_level="error"'])
  })

  it('expands OR into one query per branch', () => {
    expect(logql('a OR b')).toHaveLength(2)
    expect(logql('(a OR b) (c OR d)')).toHaveLength(4)
    expect(logql('a OR a')).toHaveLength(1)
  })

  it('stops at the branch limit', () => {
    const q = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`).join(' OR ')
    expect(engine.analyze(q(MAX_BRANCHES)).logql.tooMany).toBe(false)
    expect(engine.analyze(q(MAX_BRANCHES + 1)).logql.tooMany).toBe(true)
    expect(engine.analyze(q(MAX_BRANCHES + 1)).error).toBe(`This filter expands into ${MAX_BRANCHES + 1} OR branches. Use comma lists such as level:error,warn to stay under ${MAX_BRANCHES}.`)
  })

  it('escapes regex and string syntax in literal text', () => {
    expect(logql('"a.b"')[0]).toContain('"(?i)a\\\\.b"')
    expect(logql('"say \\"hi\\""')[0]).toContain('"(?i)say \\"hi\\""')
    expect(logql('"C:\\\\x"')[0]).toContain('"(?i)C:\\\\\\\\x"')
    expect(logql('"a\nb"')[0]).toContain('"(?i)a\\nb"')
    expect(logql('app:a.b,c')[0]).toContain('service_name=~"a\\\\.b|c"')
  })

  it('cannot be broken out of with a crafted value', () => {
    const attack = 'x"} | drop level {y="'
    const q = `app:"${attack.replace(/"/g, '\\"')}"`
    expect(logql(q)).toEqual([`{service_name=${JSON.stringify(attack)}}`])
  })

  it('logqlString stays a valid double quoted Go string', () => {
    for (const s of ['plain', 'a"b', 'a\\b', 'a\nb', 'a\tb', 'a\rb', '\\"', 'caf\u00e9']) {
      expect(JSON.parse(logqlString(s))).toBe(s)
    }
  })

  it('uses plain line filters when matching case', () => {
    const e = makeEngine({ matchCase: true })
    expect(e.analyze('timeout').logql.branches).toEqual(['{service_name=~".+"}\n  |= "timeout"'])
    expect(e.analyze('-timeout').logql.branches).toEqual(['{service_name=~".+"}\n  != "timeout"'])
    expect(e.analyze('/Time/').logql.branches).toEqual(['{service_name=~".+"}\n  |~ "Time"'])
  })

  it('compiles the operators the text language cannot reach', () => {
    const node = (field: string, op: any, value: any): QueryNode => ({ id: 1, type: 'cond', field, op, value })
    const line = (op: any, value: any) => engine.compile(node('line', op, value)).branches[0]
    const label = (op: any, value: any) => engine.compile(node('service_name', op, value)).branches[0]
    const pipe = (op: any, value: any) => engine.compile(node('detected_level', op, value)).branches[0]
    expect(line('eq', 'a')).toContain('|~ "(?i)^a$"')
    expect(line('neq', 'a')).toContain('!~ "(?i)^a$"')
    expect(line('starts', 'a')).toContain('|~ "(?i)^a"')
    expect(line('ends', 'a')).toContain('|~ "(?i)a$"')
    expect(line('in', ['a', 'b'])).toContain('|~ "(?i)a|b"')
    expect(line('not_in', ['a', 'b'])).toContain('!~ "(?i)a|b"')
    expect(label('contains', 'a')).toBe('{service_name=~".*a.*"}')
    expect(label('not_contains', 'a')).toBe('{service_name!~".*a.*", service_name=~".+"}')
    expect(label('starts', 'a')).toBe('{service_name=~"a.*"}')
    expect(label('ends', 'a')).toBe('{service_name=~".*a"}')
    expect(pipe('starts', 'a')).toContain('| detected_level=~"^(?:a.*)$"')
    expect(pipe('ends', 'a')).toContain('| detected_level=~"^(?:.*a)$"')
    expect(pipe('contains', 'a')).toContain('| detected_level=~".*a.*"')
  })

  it('accepts comma strings in hand built list conditions', () => {
    const node: QueryNode = { id: 1, type: 'cond', field: 'service_name', op: 'in', value: 'a, b' }
    expect(engine.compile(node).branches[0]).toBe('{service_name=~"a|b"}')
  })
})

describe('evaluate', () => {
  const row = { service_name: 'x', service_category: 'JAVA', detected_level: 'error', line: 'Connection Refused at 10.0.0.1' }
  const pass = (q: string, r: Record<string, unknown> = row) => engine.evaluate(engine.analyze(q).tree, r)

  it('matches everything when the tree is empty', () => {
    expect(pass('')).toBe(true)
  })

  it('ignores case on the line and not on labels', () => {
    expect(pass('connection')).toBe(true)
    expect(pass('app:X')).toBe(false)
    expect(makeEngine({ matchCase: true }).evaluate(engine.analyze('connection').tree, row)).toBe(false)
  })

  it('treats missing fields as empty', () => {
    expect(pass('level:error', {})).toBe(false)
    expect(pass('-level:error', {})).toBe(true)
    expect(pass('x', { line: null })).toBe(false)
  })

  it('anchors label regexes and not line regexes', () => {
    expect(pass('/fused/')).toBe(true)
    expect(pass('app:/y|x/')).toBe(true)
    expect(pass('level:/rr/')).toBe(false)
  })

  it('runs every operator', () => {
    const go = (field: string, op: any, value: any) => engine.evaluate({ id: 1, type: 'cond', field, op, value }, row)
    expect(go('line', 'starts', 'connection')).toBe(true)
    expect(go('line', 'ends', '10.0.0.1')).toBe(true)
    expect(go('line', 'ends', 'a very long string that is longer than the line at hand, by a lot')).toBe(false)
    expect(go('line', 'eq', 'connection refused at 10.0.0.1')).toBe(true)
    expect(go('line', 'in', ['nope', 'refused'])).toBe(true)
    expect(go('line', 'not_in', ['nope', 'refused'])).toBe(false)
    expect(go('service_name', 'in', ['x', 'y'])).toBe(true)
    expect(go('service_name', 'not_in', ['x', 'y'])).toBe(false)
  })
})

describe('active tree', () => {
  it('drops empty conditions but keeps the rest', () => {
    expect(engine.analyze('""').tree).toBeNull()
    expect(engine.analyze('"" a').logql.branches).toEqual(['{service_name=~".+"}\n  |~ "(?i)a"'])
    expect(engine.analyze('// a').logql.branches).toEqual(['{service_name=~".+"}\n  |~ "(?i)a"'])
    expect(engine.analyze('level:""').tree).toBeNull()
  })
})

describe('API filter', () => {
  it('produces the tree the backend consumes', () => {
    expect(engine.analyze('level:error,warn (a OR -b)').filter).toEqual({
      logic: 'AND',
      filters: [
        { field: 'detected_level', operator: 'in', value: ['error', 'warn'] },
        { logic: 'OR', filters: [{ field: 'line', operator: 'contains', value: 'a' }, { field: 'line', operator: 'not_contains', value: 'b' }] }
      ]
    })
    expect(engine.analyze('').filter).toBeNull()
  })
})

describe('highlight pattern', () => {
  const hl = (q: string) => engine.highlightPattern(engine.analyze(q).tree)

  it('covers positive line terms only', () => {
    expect(hl('')).toBeNull()
    expect(hl('-a')).toBeNull()
    expect(hl('level:error')).toBeNull()
    expect('A timeout here'.match(hl('timeout') as RegExp)).toEqual(['timeout'])
    expect('A TIMEOUT here'.match(hl('timeout') as RegExp)).toEqual(['TIMEOUT'])
  })

  it('combines regex and literal terms', () => {
    expect('foo 12 a.b'.match(hl('/\\d+/ a.b') as RegExp)).toEqual(['12', 'a.b'])
    expect('axb'.match(hl('a.b') as RegExp)).toBeNull()
  })

  it('handles RE2 only syntax', () => {
    expect('FOO'.match(hl('/(?P<x>foo)/') as RegExp)).toEqual(['FOO'])
    expect('a{x'.match(hl('/a{x/') as RegExp)).toEqual(['a{x'])
  })
})

describe('chip text', () => {
  const chips = (q: string) => engine.parse(q).children.map(engine.chipText)

  it.each([
    ['timeout', ['\u201ctimeout\u201d']],
    ['-timeout', ['not \u201ctimeout\u201d']],
    ['/x/', ['/x/']],
    ['-/x/', ['not /x/']],
    ['level:error', ['Log Level is error']],
    ['-level:error', ['Log Level is not error']],
    ['level:error,warn', ['Log Level is error or warn']],
    ['-level:error,warn', ['Log Level is not error or warn']],
    ['app:/x/', ['App Name matches /x/']],
    ['-app:/x/', ['App Name does not match /x/']],
    ['a OR b', ['(\u201ca\u201d OR \u201cb\u201d)']],
    ['(a b) OR c', ['((\u201ca\u201d \u201cb\u201d) OR \u201cc\u201d)']]
  ])('%s', (q, expected) => {
    expect(chips(q)).toEqual(expected)
  })
})

describe('active values', () => {
  it('reads included and excluded values', () => {
    expect([...engine.activeValues('level:error,warn -level:debug', 'detected_level')]).toEqual(['error', 'warn'])
    expect([...engine.activeValues('level:error,warn -level:debug', 'detected_level', true)]).toEqual(['debug'])
    expect([...engine.activeValues('"unclosed', 'detected_level')]).toEqual([])
  })
})

describe('appendTerm', () => {
  it('adds a term and keeps precedence', () => {
    expect(engine.appendTerm('', 'detected_level', ['error'])).toBe('level:error')
    expect(engine.appendTerm('a', 'detected_level', ['error', 'warn'])).toBe('a level:error,warn')
    expect(engine.appendTerm('a OR b', 'service_name', ['x'], true)).toBe('(a OR b) -app:x')
    expect(engine.appendTerm('a OR', 'service_name', ['x'])).toBe('a app:x')
  })

  it('does not lose a broken query', () => {
    expect(engine.appendTerm('"unclosed', 'service_name', ['x'])).toBe('"unclosed app:x')
    expect(engine.toggleValue('"unclosed', 'service_name', 'x')).toBe('"unclosed app:x')
    expect(engine.clearField('"unclosed', 'service_name')).toBe('"unclosed')
  })
})

describe('custom schema', () => {
  const schema: Schema = {
    fields: {
      namespace: { label: 'Namespace', indexed: true, aliases: ['ns'], values: ['prod', 'stage'] },
      pod: { label: 'Pod', indexed: false, aliases: ['p'] },
      trace_id: { label: 'Trace', indexed: false },
      body: { label: 'Body', kind: 'line', aliases: ['b'] }
    }
  }
  const e = createEngine({ schema })

  it('uses the configured fields', () => {
    expect(e.analyze('ns:prod').logql.branches).toEqual(['{namespace="prod"}'])
    expect(e.analyze('b:x').logql.branches).toEqual(['{namespace=~".+"}\n  |~ "(?i)x"'])
    expect(e.analyze('word').logql.branches).toEqual(['{namespace=~".+"}\n  |~ "(?i)word"'])
    expect(e.analyze('trace_id:abc').logql.branches).toEqual(['{namespace=~".+"}\n  | trace_id="abc"'])
  })

  it('no longer recognises the default aliases', () => {
    expect(e.analyze('level:x').logql.branches).toEqual(['{namespace=~".+"}\n  |~ "(?i)level:x"'])
  })

  it('suggests its own fields', () => {
    expect(e.suggest('', 0).items.map((i) => i.label)).toEqual(['ns:', 'p:', 'trace_id:', '-'])
    expect(e.suggest('', 0).items[3].hint).toBe('Exclude, for example -ns:value')
    expect(e.suggest('-', 1).items[0].hint).toBe('Hide Namespace')
    expect(e.suggest('n', 1).items[0].hint).toBe('Filter by Namespace')
  })

  it('writes terms with the primary alias', () => {
    expect(e.toggleValue('', 'namespace', 'prod')).toBe('ns:prod')
    expect(e.toggleValue('', 'trace_id', 'abc')).toBe('trace_id:abc')
  })

  it('honours an explicit selector field', () => {
    const custom = createEngine({ schema: { ...schema, fields: { ...schema.fields, cluster: { label: 'Cluster', indexed: true } }, selectorField: 'cluster' } })
    expect(custom.analyze('').logql.branches).toEqual(['{cluster=~".+"}'])
  })

  it('supports custom colours and synonyms', () => {
    const c = createEngine({
      schema: {
        fields: {
          env: { label: 'Env', indexed: true, values: ['production'], synonyms: { prod: 'production' }, color: (v) => `#${v.length}` },
          line: { label: 'Line', kind: 'line' }
        }
      }
    })
    expect(strip(c.parse('env:PROD').root)).toEqual(and(cond('env', 'eq', 'production')))
    expect(c.suggest('env:', 4).items[0].color).toBe('#10')
  })

  it.each([
    ['a bad label name', { fields: { 'bad-name': { label: 'x', indexed: true }, line: { label: 'l', kind: 'line' } } }, 'not a valid Loki label name'],
    ['a bad alias', { fields: { a: { label: 'x', indexed: true, aliases: ['b-c'] }, line: { label: 'l', kind: 'line' } } }, 'not a valid field alias'],
    ['a shared alias', { fields: { a: { label: 'x', indexed: true, aliases: ['z'] }, b: { label: 'y', aliases: ['Z'] }, line: { label: 'l', kind: 'line' } } }, 'used by both'],
    ['two line fields', { fields: { a: { label: 'x', kind: 'line' }, b: { label: 'y', kind: 'line' } } }, 'only have one line field'],
    ['no line field', { fields: { a: { label: 'x', indexed: true } } }, 'needs one field with kind "line"'],
    ['no indexed label', { fields: { a: { label: 'x' }, line: { label: 'l', kind: 'line' } } }, 'needs an indexed label'],
    ['a selector that is not indexed', { fields: { a: { label: 'x', indexed: true }, b: { label: 'y' }, line: { label: 'l', kind: 'line' } }, selectorField: 'b' }, 'needs an indexed label']
  ] as [string, Schema, string][])('rejects %s', (_name, bad, message) => {
    expect(() => createEngine({ schema: bad })).toThrow(message)
  })

  it('does not mutate the shared default schema', () => {
    const before = JSON.stringify(Object.keys(defaultSchema.fields))
    createEngine({ values: { service_name: ['z'] } })
    expect(JSON.stringify(Object.keys(defaultSchema.fields))).toBe(before)
  })
})

describe('baseSelector', () => {
  const scoped = createEngine({ baseSelector: { index: 'payments' } })
  const logql = (q: string) => scoped.analyze(q).logql.branches

  it('scopes every query instead of using the fallback selector', () => {
    expect(logql('')).toEqual(['{index="payments"}'])
    expect(logql('timeout')).toEqual(['{index="payments"}\n  |~ "(?i)timeout"'])
    expect(logql('level:error')).toEqual(['{index="payments"}\n  | detected_level="error"'])
  })

  it('combines with indexed fields and needs no fallback for exclusions', () => {
    expect(logql('app:x')).toEqual(['{index="payments", service_name="x"}'])
    expect(logql('-app:x')).toEqual(['{index="payments", service_name!="x"}'])
    expect(logql('app:*')).toEqual(['{index="payments", service_name=~".*"}'])
  })

  it('applies to every OR branch', () => {
    expect(logql('a OR b')).toEqual(['{index="payments"}\n  |~ "(?i)a"', '{index="payments"}\n  |~ "(?i)b"'])
  })

  it('accepts several labels in order', () => {
    const e = createEngine({ baseSelector: { index: 'a', env: 'prod' } })
    expect(e.analyze('').logql.branches).toEqual(['{index="a", env="prod"}'])
  })

  it('escapes values so a selector cannot be broken out of', () => {
    const value = 'x"} | drop level {y="\\\n'
    const e = createEngine({ baseSelector: { index: value } })
    expect(e.analyze('').logql.branches).toEqual([`{index=${JSON.stringify(value)}}`])
  })

  it('falls back to a valid selector while the value is empty', () => {
    const schema: Schema = { fields: { line: { label: 'Line', kind: 'line' } } }
    expect(createEngine({ schema, baseSelector: { index: '' } }).analyze('').logql.branches).toEqual(['{index=~".+"}'])
    expect(createEngine({ baseSelector: { index: '' } }).analyze('a').logql.branches[0]).toContain('{service_name=~".+"}')
  })

  it('removes the need for an indexed field in the schema', () => {
    const schema: Schema = { fields: { app: { label: 'App' }, line: { label: 'Line', kind: 'line' } } }
    expect(() => createEngine({ schema })).toThrow('needs an indexed label or a baseSelector')
    expect(createEngine({ schema, baseSelector: { index: 'a' } }).analyze('').logql.branches).toEqual(['{index="a"}'])
  })

  it('rejects a bad label name', () => {
    expect(() => createEngine({ baseSelector: { 'bad-label': 'a' } })).toThrow('not a valid Loki label name')
  })

  it('never appears in suggestions or chips', () => {
    expect(scoped.suggest('', 0).items.map((i) => i.label)).not.toContain('index:')
    expect(scoped.parse('level:error').children).toHaveLength(1)
  })

  it('leaves the default behaviour unchanged when absent', () => {
    expect(createEngine().analyze('').logql.branches).toEqual(['{service_name=~".+"}'])
  })
})

describe('schema parser', () => {
  const schema: Schema = {
    parser: 'json',
    fields: {
      logLevel: { label: 'Log Level', aliases: ['level'], values: ['ERROR', 'WARN', 'INFO'] },
      serviceName: { label: 'App Name', aliases: ['app'] },
      content: { label: 'Content', kind: 'line', aliases: ['msg'] }
    }
  }
  const e = createEngine({ schema, baseSelector: { index: 'loki_21_july' } })
  const logql = (q: string) => e.analyze(q).logql.branches

  it('produces the query verified on real Loki for JSON logs', () => {
    expect(logql('level:error app:checkout-* timeout -debug')).toEqual([
      '{index="loki_21_july"}\n  |~ "(?i)timeout"\n  !~ "(?i)debug"\n  | json logLevel, serviceName | __error__=""\n  | logLevel="ERROR"\n  | serviceName=~"^(?:checkout-.*)$"'
    ])
  })

  it('skips the parser when nothing filters on a field', () => {
    expect(logql('')).toEqual(['{index="loki_21_july"}'])
    expect(logql('timeout -debug')).toEqual(['{index="loki_21_july"}\n  |~ "(?i)timeout"\n  !~ "(?i)debug"'])
  })

  it('adds the parser once, only to the branches that need it', () => {
    expect(logql('timeout OR level:error')).toEqual(['{index="loki_21_july"}\n  |~ "(?i)timeout"', '{index="loki_21_july"}\n  | json logLevel | __error__=""\n  | logLevel="ERROR"'])
    expect(logql('level:error app:a').join('').match(/\| json/g)).toHaveLength(1)
  })

  it('keeps line filters ahead of the parser', () => {
    const q = logql('level:error timeout')[0]
    expect(q.indexOf('|~')).toBeLessThan(q.indexOf('| json'))
  })

  it('supports logfmt', () => {
    const logfmt = createEngine({ schema: { ...schema, parser: 'logfmt' }, baseSelector: { index: 'a' } })
    expect(logfmt.analyze('level:error').logql.branches).toEqual(['{index="a"}\n  | logfmt | __error__=""\n  | logLevel="ERROR"'])
  })

  it('does not parse for indexed fields', () => {
    const indexed = createEngine({ schema: { ...schema, fields: { ...schema.fields, serviceName: { label: 'App', aliases: ['app'], indexed: true } } } })
    expect(indexed.analyze('app:a').logql.branches).toEqual(['{serviceName="a"}'])
  })

  it('folds lowercase input to the stored uppercase level', () => {
    expect(logql('level:error,warn')[0]).toContain('| logLevel=~"ERROR|WARN"')
  })

  it('evaluates records the same way with or without a parser', () => {
    const a = e.analyze('level:error timeout')
    expect(e.evaluate(a.tree, { logLevel: 'ERROR', content: 'a timeout' })).toBe(true)
    expect(e.evaluate(a.tree, { logLevel: 'INFO', content: 'a timeout' })).toBe(false)
  })
})

describe('one query for OR when a parser is set', () => {
  const schema: Schema = {
    parser: 'json',
    fields: {
      logLevel: { label: 'Log Level', aliases: ['level'], values: ['ERROR', 'WARN', 'INFO'] },
      serviceName: { label: 'App Name', aliases: ['app'] },
      content: { label: 'Content', kind: 'line', aliases: ['msg'] }
    }
  }
  const e = createEngine({ schema, baseSelector: { index: 'a' } })
  const logql = (q: string) => e.analyze(q).logql.branches

  it('keeps OR between fields in one query', () => {
    expect(logql('level:error OR app:billing')).toEqual(['{index="a"}\n  | json logLevel, serviceName | __error__=""\n  | logLevel="ERROR" or serviceName="billing"'])
  })

  it('brackets groups inside an OR', () => {
    expect(logql('(level:error app:a) OR app:b')).toEqual(['{index="a"}\n  | json logLevel, serviceName | __error__=""\n  | (logLevel="ERROR" and serviceName="a") or serviceName="b"'])
  })

  it('writes one stage for each AND part', () => {
    expect(logql('(level:error OR app:a) (level:warn OR app:b)')).toEqual(['{index="a"}\n  | json logLevel, serviceName | __error__=""\n  | logLevel="ERROR" or serviceName="a"\n  | logLevel="WARN" or serviceName="b"'])
  })

  it('joins plain words into one line filter', () => {
    expect(logql('timeout OR refused')).toEqual(['{index="a"}\n  |~ "(?i)timeout|refused"'])
    expect(logql('level:error (timeout OR refused)')).toEqual(['{index="a"}\n  |~ "(?i)timeout|refused"\n  | json logLevel | __error__=""\n  | logLevel="ERROR"'])
  })

  it('keeps a regex and its flags inside their own group', () => {
    expect(logql('/(?-i)Foo/ OR bar')).toEqual(['{index="a"}\n  |~ "(?i)(?:(?-i)Foo)|bar"'])
  })

  it('splits into branches when raw line text and a field share an OR', () => {
    expect(logql('timeout OR level:error')).toHaveLength(2)
  })

  it('splits into branches when an OR excludes a word', () => {
    expect(logql('-timeout OR refused')).toHaveLength(2)
  })

  it('has no branch limit in one query', () => {
    const q = Array.from({ length: 40 }, (_, i) => `app:a${i}`).join(' OR ')
    const a = e.analyze(q)
    expect(a.error).toBeNull()
    expect(a.logql.branches).toHaveLength(1)
  })

  it('still limits queries that need branches', () => {
    const q = Array.from({ length: 13 }, (_, i) => `word${i}`).join(' OR ') + ' OR level:error'
    expect(e.analyze(q).logql.tooMany).toBe(true)
  })

  it('never changes the default schema', () => {
    expect(makeEngine().analyze('timeout OR refused').logql.branches).toHaveLength(2)
  })

  it('filters stream labels in the pipeline when they share an OR', () => {
    const indexed = createEngine({ schema: { ...schema, fields: { ...schema.fields, serviceName: { label: 'App', aliases: ['app'], indexed: true } } } })
    expect(indexed.analyze('app:a OR level:error').logql.branches).toEqual(['{serviceName=~".+"}\n  | json logLevel | __error__=""\n  | serviceName="a" or logLevel="ERROR"'])
  })
})

describe('parsed line field', () => {
  const schema: Schema = {
    parser: 'json',
    fields: {
      logLevel: { label: 'Log Level', aliases: ['level'], values: ['ERROR', 'WARN', 'INFO'] },
      content: { label: 'Content', kind: 'line', parsed: true, aliases: ['msg'] }
    }
  }
  const e = createEngine({ schema, baseSelector: { index: 'a' } })
  const logql = (q: string) => e.analyze(q).logql.branches

  it('searches the field after a fast raw filter', () => {
    expect(logql('timeout')).toEqual(['{index="a"}\n  |~ "(?i)timeout"\n  | json content | __error__=""\n  | content=~"(?is).*timeout.*"'])
  })

  it('keeps a word and a field in one query', () => {
    expect(logql('timeout OR level:error')).toEqual(['{index="a"}\n  | json content, logLevel | __error__=""\n  | content=~"(?is).*timeout.*" or logLevel="ERROR"'])
  })

  it('uses one raw filter for an OR of words', () => {
    expect(logql('timeout OR refused')).toEqual(['{index="a"}\n  |~ "(?i)timeout|refused"\n  | json content | __error__=""\n  | content=~"(?is).*timeout.*" or content=~"(?is).*refused.*"'])
  })

  it('has no raw filter for an excluded word', () => {
    expect(logql('-debug')).toEqual(['{index="a"}\n  | json content | __error__=""\n  | content!~"(?is).*debug.*"'])
  })

  it.each(['"said \\"hi"', '"C:\\\\temp"', 'a/b', 'caf\u00e9', '"a&b"', '"a+b"', '"tab\there"'])('has no raw filter when encoders may escape %s', (q) => {
    expect(logql(q)[0]).not.toContain('|~')
  })

  it('has no raw filter for a regex', () => {
    expect(logql('/time.ut/')).toEqual(['{index="a"}\n  | json content | __error__=""\n  | content=~"(?i)^(?s:.*)(?:time.ut)(?s:.*)$"'])
  })

  it('keeps inline regex flags local', () => {
    expect(logql('/(?-i)Foo/')[0]).toContain('content=~"(?i)^(?s:.*)(?:(?-i)Foo)(?s:.*)$"')
  })

  it('follows matchCase', () => {
    const exact = createEngine({ schema, baseSelector: { index: 'a' }, matchCase: true })
    expect(exact.analyze('Timeout').logql.branches).toEqual(['{index="a"}\n  |~ "Timeout"\n  | json content | __error__=""\n  | content=~"(?s).*Timeout.*"'])
  })

  it('keeps the full parser for logfmt', () => {
    const logfmt = createEngine({ schema: { ...schema, parser: 'logfmt' }, baseSelector: { index: 'a' } })
    expect(logfmt.analyze('timeout').logql.branches[0]).toContain('| logfmt | __error__=""')
  })

  it('evaluates the field value', () => {
    const a = e.analyze('timeout')
    expect(e.evaluate(a.tree, { content: 'a timeout' })).toBe(true)
    expect(e.evaluate(a.tree, { content: 'all good' })).toBe(false)
  })

  it('needs a parser', () => {
    expect(() => createEngine({ schema: { fields: { a: { label: 'A', indexed: true }, b: { label: 'B', kind: 'line', parsed: true } } } })).toThrow('needs a schema parser')
  })

  it('only applies to the line field', () => {
    expect(() => createEngine({ schema: { parser: 'json', fields: { a: { label: 'A', parsed: true }, b: { label: 'B', kind: 'line' } } }, baseSelector: { index: 'a' } })).toThrow('only applies to the line field')
  })
})

describe('value groups', () => {
  const schema: Schema = {
    parser: 'json',
    fields: {
      logLevel: {
        label: 'Log Level',
        aliases: ['level'],
        values: ['ERROR', 'WARN', 'WARNING', 'INFO'],
        groups: { WARN: ['WARN', 'WARNING'], problem: ['ERROR', 'FATAL'] }
      },
      content: { label: 'Content', kind: 'line' }
    }
  }
  const e = createEngine({ schema, baseSelector: { index: 'a' } })

  it('expands a value into its whole group', () => {
    expect(e.analyze('level:warn').logql.branches[0]).toContain('| logLevel=~"WARN|WARNING"')
  })

  it('works from any member', () => {
    expect(e.analyze('level:warning').logql.branches[0]).toContain('| logLevel=~"WARN|WARNING"')
  })

  it('accepts a group name that is not a stored value', () => {
    expect(e.analyze('level:problem').logql.branches[0]).toContain('| logLevel=~"ERROR|FATAL"')
  })

  it('expands excluded values', () => {
    expect(e.analyze('-level:warn').logql.branches[0]).toContain('| logLevel!~"WARN|WARNING"')
  })

  it('expands inside lists without repeating values', () => {
    expect(e.analyze('level:warn,warning,info').logql.branches[0]).toContain('| logLevel=~"WARN|WARNING|INFO"')
  })

  it('leaves wildcards alone', () => {
    expect(e.analyze('level:w*').logql.branches[0]).toContain('logLevel=~"^(?:w.*)$"')
  })

  it('keeps the text the person typed in chips and facets', () => {
    const a = e.analyze('level:warn')
    expect(e.chipText(a.parsed.children[0])).toBe('Log Level is WARN')
    expect([...e.activeValues('level:warn', 'logLevel')]).toEqual(['WARN'])
  })

  it('expands for evaluate and the API filter', () => {
    const a = e.analyze('level:warn')
    expect(e.evaluate(a.tree, { logLevel: 'WARNING' })).toBe(true)
    expect(e.evaluate(a.tree, { logLevel: 'INFO' })).toBe(false)
    expect(a.filter).toEqual({ logic: 'AND', filters: [{ field: 'logLevel', operator: 'in', value: ['WARN', 'WARNING'] }] })
  })

  it('does not change a parsed tree', () => {
    const parsed = e.parse('level:warn')
    e.activeTree(parsed.root as Group)
    expect((parsed.children[0] as Cond).value).toBe('WARN')
  })

  it('rejects a value in two groups', () => {
    expect(() => createEngine({ schema: { ...schema, fields: { ...schema.fields, logLevel: { label: 'L', groups: { a: ['x', 'y'], b: ['Y'] } } } }, baseSelector: { index: 'a' } })).toThrow('in two groups')
  })

  it('rejects an empty group', () => {
    expect(() => createEngine({ schema: { ...schema, fields: { ...schema.fields, logLevel: { label: 'L', groups: { a: [] } } } }, baseSelector: { index: 'a' } })).toThrow('has no values')
  })
})

describe('field on a value suggestion list', () => {
  it('names the field only while a value is being picked', () => {
    const e = makeEngine()
    expect(e.suggest('app:', 4).field).toBe('service_name')
    expect(e.suggest('', 0).field).toBeUndefined()
    expect(e.suggest('ap', 2).field).toBeUndefined()
  })
})

describe('maxBranches option', () => {
  it('can be lowered', () => {
    const e = makeEngine({ maxBranches: 1 })
    expect(e.analyze('a OR b').logql.tooMany).toBe(true)
    expect(e.analyze('a').logql.tooMany).toBe(false)
  })
})

describe('determinism', () => {
  it('gives identical trees on repeated parses', () => {
    expect(engine.parse('a (b OR c)')).toEqual(engine.parse('a (b OR c)'))
  })
})
