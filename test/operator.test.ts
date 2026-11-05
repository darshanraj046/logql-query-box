import { describe, expect, it } from 'vitest'
import { createEngine, type Schema } from '../src/core'
import { strip } from './helpers'

const schema: Schema = {
  parser: 'json',
  operator: '=',
  fields: {
    logLevel: { label: 'level', aliases: ['level'], values: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'NONE'], example: 'Log level: ERROR, WARN, INFO, DEBUG, NONE' },
    serviceName: { label: 'app', aliases: ['app'], example: 'App that wrote the log line' },
    serviceType: { label: 'app.type', aliases: ['app.type'], values: ['JAVA', 'NODE', 'GO', 'PYTHON'], example: 'Runtime: JAVA, NODE, GO, PYTHON' },
    content: { label: 'content', kind: 'line', parsed: true, aliases: ['content'], example: 'Text in the log line, use * as wildcard' }
  }
}
const e = createEngine({ schema, baseSelector: { index: 'a' } })
const tree = (q: string) => {
  const p = e.parse(q)
  return p.error ? { error: p.error } : strip(p.root)
}
const cond = (field: string, op: string, value: unknown) => ({ field, op, value })
const and = (...children: unknown[]) => ({ op: 'AND', children })

describe('operator "="', () => {
  it.each([
    ['level = ERROR', and(cond('logLevel', 'eq', 'ERROR'))],
    ['level=error', and(cond('logLevel', 'eq', 'ERROR'))],
    ['level = ERROR,WARN', and(cond('logLevel', 'in', ['ERROR', 'WARN']))],
    ['level = ERROR, WARN', and(cond('logLevel', 'in', ['ERROR', 'WARN']))],
    ['level != DEBUG', and(cond('logLevel', 'neq', 'DEBUG'))],
    ['-level = DEBUG', and(cond('logLevel', 'neq', 'DEBUG'))],
    ['app.type = JAVA,NODE', and(cond('serviceType', 'in', ['JAVA', 'NODE']))],
    ['level:error', and(cond('logLevel', 'eq', 'ERROR'))],
    ['content = *SocketTimeoutException*', and(cond('content', 'contains', 'SocketTimeoutException'))],
    ['content = "nearing capacity"', and(cond('content', 'contains', 'nearing capacity'))],
    ['content = conn*refused', and(cond('content', 'regex', 'conn.*refused'))],
    ['content != *debug*', and(cond('content', 'not_contains', 'debug'))],
    ['level = INFO,ERROR,\n app = passive-scan-consumer,security-insights-worker', and(cond('logLevel', 'in', ['INFO', 'ERROR']), cond('serviceName', 'in', ['passive-scan-consumer', 'security-insights-worker']))],
    ['level = ERROR, app = billing', and(cond('logLevel', 'eq', 'ERROR'), cond('serviceName', 'eq', 'billing'))],
    ['level = ERROR content = *JsonParseException*', and(cond('logLevel', 'eq', 'ERROR'), cond('content', 'contains', 'JsonParseException'))],
    ['timeout', and(cond('content', 'contains', 'timeout'))],
    ['app =~ checkout-.*', and(cond('serviceName', 'regex', 'checkout-.*'))],
    ['app !~ ^pii', and(cond('serviceName', 'not_regex', '^pii'))],
    ['app = /check.*/', and(cond('serviceName', 'regex', 'check.*'))],
    ['app =~ "a b.*"', and(cond('serviceName', 'regex', 'a b.*'))],
    ['content =~ timeout|refused', and(cond('content', 'regex', 'timeout|refused'))],
    ['content !~ debug', and(cond('content', 'not_regex', 'debug'))],
    ['level = ERROR , WARN', and(cond('logLevel', 'in', ['ERROR', 'WARN']))],
    ['app.type != JAVA', and(cond('serviceType', 'neq', 'JAVA'))],
    ['app =~ (billing|checkout)-api', and(cond('serviceName', 'regex', '(billing|checkout)-api'))],
    ['(app =~ a.* OR level = ERROR)', and({ op: 'OR', children: [cond('serviceName', 'regex', 'a.*'), cond('logLevel', 'eq', 'ERROR')] })],
    ['app =~ x\\)y', and(cond('serviceName', 'regex', 'x\\)y'))],
    ['app.type != JAVA,GO', and(cond('serviceType', 'not_in', ['JAVA', 'GO']))]
  ])('%j', (q, expected) => {
    expect(tree(q)).toEqual(expected)
  })

  it('compiles to the same LogQL as the colon syntax', () => {
    const colon = createEngine({ schema: { ...schema, operator: ':' }, baseSelector: { index: 'a' } })
    expect(e.analyze('level = ERROR,WARN app.type != GO').logql.branches).toEqual(colon.analyze('level:ERROR,WARN -app.type:GO').logql.branches)
  })

  it('writes terms with the operator', () => {
    expect(e.toggleValue('', 'logLevel', 'ERROR')).toBe('level = ERROR')
    expect(e.toggleValue('level = ERROR', 'logLevel', 'WARN')).toBe('level = ERROR,WARN')
    expect(e.toggleValue('level = ERROR', 'logLevel', 'DEBUG', true)).toBe('level = ERROR level != DEBUG')
    expect(e.appendTerm('timeout', 'serviceType', ['JAVA'])).toBe('timeout app.type = JAVA')
    expect(e.clearField('level = ERROR app = x', 'logLevel')).toBe('app = x')
  })

  it('suggests field names first, with no exclude item', () => {
    const s = e.suggest('', 0)
    expect(s.head).toBe('Fields')
    expect(s.items.map((i) => [i.label, i.text, i.hint])).toEqual([
      ['level', 'level ', 'Log level: ERROR, WARN, INFO, DEBUG, NONE'],
      ['app', 'app ', 'App that wrote the log line'],
      ['app.type', 'app.type ', 'Runtime: JAVA, NODE, GO, PYTHON'],
      ['content', 'content ', 'Text in the log line, use * as wildcard']
    ])
    expect(s.extra).toEqual([])
    expect(e.suggest('app', 3).items.map((i) => i.text)).toEqual(['app ', 'app.type '])
    expect(e.suggest('app.', 4).items.map((i) => i.text)).toEqual(['app.type '])
  })

  it('asks for the operator after a field name, in plain words', () => {
    const s = e.suggest('app ', 4)
    expect(s.head).toBe('How should app match?')
    expect(s.items.map((i) => [i.label, i.text, i.replace])).toEqual([
      ['app =', 'app = ', [0, 4]],
      ['app !=', 'app != ', [0, 4]],
      ['app =~', 'app =~ ', [0, 4]],
      ['app !~', 'app !~ ', [0, 4]]
    ])
    expect(s.items.every((i) => i.kind === 'operator' && i.keep && i.hint)).toBe(true)
    expect(e.suggest('level = ERROR content  ', 23).items.map((i) => i.text)).toEqual(['content = ', 'content != ', 'content =~ ', 'content !~ '])
    expect(e.suggest('level = ERROR content ', 22).items[0].hint).toMatch(/Contains this text/)
    expect(e.suggest('-app ', 5).items[1].text).toBe('-app != ')
    expect(e.suggest('timeout ', 8).head).toBe('Fields')
    expect(e.suggest('app = app ', 10).head).toBe('Fields')
    expect(e.suggest('"app" ', 6).head).toBe('Fields')
  })

  it('suggests values after the operator, with no operator group', () => {
    const s = e.suggest('level = ', 8)
    expect(s.field).toBe('logLevel')
    expect(s.items.map((i) => i.text)).toEqual(['level = ERROR ', 'level = WARN ', 'level = INFO ', 'level = DEBUG ', 'level = NONE '])
    expect(s.items.every((i) => i.keep)).toBe(true)
    expect(s.extra).toEqual([])
    expect(e.suggest('level != ERROR,w', 16).items.map((i) => i.text)).toEqual(['level != ERROR,WARN '])
  })

  it('offers a contains row when the typed text is not an exact value', () => {
    const apps = createEngine({ schema, values: { serviceName: ['pii-detector', 'policy-evaluator', 'security-notifier', 'apiwiz-api-security'] }, baseSelector: { index: 'a' } })
    const s = apps.suggest('app != pii', 10)
    expect(s.items.map((i) => [i.label, i.text, i.sub])).toEqual([
      ['pii-detector', 'app != pii-detector ', undefined],
      ['*pii*', 'app != *pii* ', 'Every app containing “pii”']
    ])
    expect(apps.suggest('app = secur', 11).items.map((i) => i.label)).toEqual(['security-notifier', 'apiwiz-api-security', '*secur*'])
    expect(apps.suggest('app = security', 14).items.map((i) => i.label)).toEqual(['security-notifier', 'apiwiz-api-security', '*security*'])
    expect(apps.suggest('app = pii-detector', 18).items.map((i) => i.label)).toEqual(['pii-detector'])
    expect(apps.suggest('app = zzz', 9).items).toEqual([])
    expect(apps.suggest('app = pi*', 9).items.map((i) => i.label)).not.toContain('*pi**')
  })

  it('gives a note instead of values for text and regex', () => {
    const c = e.suggest('content = ', 10)
    expect(c.items).toEqual([])
    expect(c.extra).toEqual([])
    expect(c.note).toMatch(/wildcard/)
    expect(e.suggest('app =~ ', 7).note).toMatch(/contains it/)
    expect(e.suggest('content = foo', 13).note).toBeUndefined()
  })

  it('offers anchors for a field pattern and puts the caret where the text goes', () => {
    const s = e.suggest('app =~ ', 7)
    expect(s.head).toBe('Pattern')
    expect(s.items.map((i) => [i.label, i.text, i.caret, i.hint])).toEqual([
      ['^ …', 'app =~ ^', 8, 'Starts with the text you type next'],
      ['… $', 'app =~ $', 7, 'Ends with the text you type next'],
      ['^ … $', 'app =~ ^$', 8, 'Is exactly the text you type next']
    ])
    expect(e.suggest('-app !~ ', 8).items[0].text).toBe('-app !~ ^')
    expect(e.suggest('content =~ ', 11).items).toEqual([])
  })

  it('previews which known values a pattern matches while typing', () => {
    const apps = createEngine({ schema, values: { serviceName: ['passive-scan-consumer', 'pii-detector', 'policy-evaluator', 'security-notifier', 'apiwiz-api-security'] }, baseSelector: { index: 'a' } })
    expect(apps.suggest('app =~ ^p', 9).note).toBe('Matches 3 of 5: passive-scan-consumer, pii-detector, policy-evaluator')
    expect(apps.suggest('app =~ security', 15).note).toBe('Matches 2 of 5: security-notifier, apiwiz-api-security')
    expect(apps.suggest('app =~ ^passive$', 16).note).toMatch(/^Matches no app\. \^ means starts with/)
    expect(apps.suggest('app =~ ^$', 8).note).toBe('Now type the app text.')
    expect(apps.suggest('app =~ (', 8).note).toBe('This is not a complete pattern yet.')
    expect(apps.suggest('app =~ ^P', 9).note).toMatch(/^Matches no app/)
    expect(apps.suggest('app =~ x', 8).items).toEqual([])
    expect(e.suggest('app =~ x', 8).note).toBeUndefined()
  })

  it('reports patterns that match no known value', () => {
    const apps = createEngine({ schema, values: { serviceName: ['passive-scan-consumer', 'pii-detector'] }, baseSelector: { index: 'a' } })
    expect(apps.analyze('level = INFO app =~ ^passive$').unknownValues).toEqual([{ field: 'serviceName', value: '^passive$', negative: false, matches: ['passive-scan-consumer'], regex: true }])
    expect(apps.analyze('app !~ zz').unknownValues).toEqual([{ field: 'serviceName', value: 'zz', negative: true, matches: [], regex: true }])
    expect(apps.analyze('app =~ ^passive app =~ detector$ app =~ (a+)+').unknownValues).toEqual([])
    expect(apps.replaceValue('level = INFO app =~ ^passive$', 'serviceName', '^passive$', 'passive*')).toBe('level = INFO app = passive*')
    expect(apps.replaceValue('app !~ ^pii$', 'serviceName', '^pii$', 'pii-detector', true)).toBe('app != pii-detector')
  })

  it('reports values that match nothing known, with close matches', () => {
    const apps = createEngine({ schema, values: { serviceName: ['pii-detector', 'policy-evaluator'] }, baseSelector: { index: 'a' } })
    expect(apps.analyze('app != policy-evaluator app != pii').unknownValues).toEqual([{ field: 'serviceName', value: 'pii', negative: true, matches: ['pii-detector'] }])
    expect(apps.analyze('app = zzz').unknownValues).toEqual([{ field: 'serviceName', value: 'zzz', negative: false, matches: [] }])
    expect(apps.analyze('app = pii-detector app = *pii* level = error app =~ pii').unknownValues).toEqual([])
    expect(apps.analyze('app = x').unknownValues).toHaveLength(1)
    expect(e.analyze('app = anything').unknownValues).toEqual([])
    expect(apps.analyze('"oops').unknownValues).toEqual([])
  })

  it('combines repeated filters on the same field', () => {
    expect(e.combine('app != policy-evaluator app != pii')).toBe('app != policy-evaluator,pii')
    expect(e.combine('level = ERROR timeout level = WARN')).toBe('level = ERROR,WARN timeout')
    expect(e.combine('-app = a app != b')).toBe('app != a,b')
    expect(e.combine('app = a app != b')).toBe('app = a app != b')
    expect(e.combine('app = a level = ERROR app = b level = WARN')).toBe('app = a,b level = ERROR,WARN')
    expect(e.combine('app = a app = a')).toBe('app = a')
    expect(e.combine('app = checkout-* app = billing')).toBe('app = checkout-*,billing')
    expect(e.combine('(app = a OR level = ERROR) app = b')).toBe('(app = a OR level = ERROR) app = b')
    expect(e.combine('app = a "unclosed')).toBe('app = a "unclosed')
    const q = 'app != policy-evaluator app != pii level = ERROR'
    expect(e.analyze(e.combine(q)).logql).toEqual(e.analyze(q).logql)
  })

  it('replaces one value and keeps the rest', () => {
    expect(e.replaceValue('app != policy-evaluator,pii', 'serviceName', 'pii', 'pii-detector', true)).toBe('app != policy-evaluator,pii-detector')
    expect(e.replaceValue('app != pii level = ERROR', 'serviceName', 'pii', '*pii*', true)).toBe('app != *pii* level = ERROR')
    expect(e.analyze('app != *pii*').tree).toEqual(expect.objectContaining({ children: [expect.objectContaining({ op: 'not_regex' })] }))
    expect(e.replaceValue('app = pii', 'serviceName', 'pii', 'x', true)).toBe('app = pii')
  })

  it('matches a field regex anywhere in the value, with anchors when asked', () => {
    const rows = ['apiwiz-api-security', 'security-notifier', 'policy-evaluator'].map((serviceName) => ({ serviceName }))
    const hits = (q: string) => rows.filter((r) => e.evaluate(e.analyze(q).tree, r)).map((r) => r.serviceName)
    expect(hits('app =~ security')).toEqual(['apiwiz-api-security', 'security-notifier'])
    expect(hits('app =~ ^security')).toEqual(['security-notifier'])
    expect(hits('app =~ security$')).toEqual(['apiwiz-api-security'])
    expect(hits('app !~ security')).toEqual(['policy-evaluator'])
    expect(hits('app = /eval/')).toEqual(['policy-evaluator'])
    expect(hits('app = policy-*')).toEqual(['policy-evaluator'])
    expect(hits('app = *security')).toEqual(['apiwiz-api-security'])
    expect(e.analyze('app =~ security').logql.branches).toEqual(['{index="a"}\n  | json serviceName | __error__=""\n  | serviceName=~"^(?s:.*)(?:security)(?s:.*)$"'])
  })

  it('validates regex values for Loki', () => {
    expect(e.analyze('app =~ (?=x)').error).toMatch(/RE2/)
  })

  it('rejects dots in Loki label names but allows them in aliases', () => {
    expect(() => createEngine({ schema: { ...schema, fields: { ...schema.fields, 'a.b': { label: 'x' } } } })).toThrow(/not a valid Loki label name/)
  })
})
