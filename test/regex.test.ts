import { describe, expect, it } from 'vitest'
import { regexProblem, toJsRegex, UNSUPPORTED_REGEX } from '../src/core/regex'
import verdicts from './golden/re2-verdicts.json'

describe('regex validation agrees with the Go RE2 parser Loki runs', () => {
  it('matches every recorded verdict', () => {
    const wrong = (verdicts as [string, boolean][])
      .filter(([p, valid]) => (regexProblem(p) === null) !== valid)
      .map(([p, valid]) => `${JSON.stringify(p)} go=${valid}`)
    expect(wrong.slice(0, 60).join('\n')).toBe('')
    expect(verdicts.length).toBeGreaterThan(20000)
  })
})

describe('regex problem messages', () => {
  it.each(['(?=a)', '(?!a)', '(?<=a)', '(?<!a)', '\\1', '(a)\\1', '\\k<x>'])('explains RE2 limits for %s', (p) => {
    expect(regexProblem(p)).toBe(UNSUPPORTED_REGEX)
  })

  it.each(['\\\\1', '\\(?=', '[(?=]', '(?P<x>a)', '(?<x>a)', '\\z', '\\A', '\\pL', '[[:alpha:]]', '(?i)foo', 'a(?i)b', '^*'])('accepts %s', (p) => {
    expect(regexProblem(p)).toBeNull()
  })
})

describe('client side matching of translated RE2 syntax', () => {
  const m = (p: string, s: string, ci = false, anchored = false) => toJsRegex(p, ci, anchored).test(s)

  it('honours leading inline flags', () => {
    expect(m('(?i)FOO', 'foo')).toBe(true)
    expect(m('(?s)a.b', 'a\nb')).toBe(true)
    expect(m('a.b', 'a\nb')).toBe(false)
    expect(m('(?m)^b', 'a\nb')).toBe(true)
    expect(m('^b', 'a\nb')).toBe(false)
  })

  it('handles named groups, literal blocks and anchors', () => {
    expect(m('(?P<x>a)+', 'aa')).toBe(true)
    expect(m('\\Qa.b\\E', 'a.b')).toBe(true)
    expect(m('\\Qa.b\\E', 'axb')).toBe(false)
    expect(m('\\Aa\\z', 'a')).toBe(true)
    expect(m('\\Aa\\z', 'ab')).toBe(false)
  })

  it('handles POSIX classes including negation', () => {
    expect(m('^[[:alpha:]]+$', 'abc')).toBe(true)
    expect(m('^[[:alpha:]]+$', 'a1')).toBe(false)
    expect(m('^[[:^alpha:]]+$', '123')).toBe(true)
    expect(m('^[[:^alpha:]]+$', 'a')).toBe(false)
    expect(m('^[[:^digit:]x]+$', 'ax')).toBe(true)
  })

  it('handles literal braces and brackets that Unicode mode would reject', () => {
    expect(m('a{x', 'a{x')).toBe(true)
    expect(m('a{,2}', 'a{,2}')).toBe(true)
    expect(m('}', '}')).toBe(true)
    expect(m(']', ']')).toBe(true)
    expect(m('[]a]', ']')).toBe(true)
    expect(m('[^]a]', 'b')).toBe(true)
  })

  it('treats non BMP characters as one character', () => {
    expect(m('^.$', '😀')).toBe(true)
    expect(m('^[😀]$', '😀')).toBe(true)
  })

  it('anchors label regexes the way Loki does', () => {
    expect(m('ab|cd', 'ab', false, true)).toBe(true)
    expect(m('ab|cd', 'abcd', false, true)).toBe(false)
    expect(m('ab|cd', 'xcd', false, true)).toBe(false)
  })

  it('uses the ASCII meaning of \\s like Go does', () => {
    expect(m('\\s', ' ')).toBe(false)
    expect(m('\\s', ' ')).toBe(true)
  })
})
