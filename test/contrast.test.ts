import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/styles.css', 'utf8')
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--lqb-([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))
const darkAt = css.indexOf(".lqb[data-lqb-theme='dark']")
const mediaAt = css.indexOf('@media (prefers-color-scheme: dark)')
const light = tokens(css.slice(0, darkAt))
const dark = tokens(css.slice(darkAt, mediaAt))
const media = tokens(css.slice(mediaAt, css.indexOf('.lqb *,')))

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT_ON: [string, string][] = [
  ['fg', 'surface'],
  ['fg', 'surface-2'],
  ['fg', 'accent-soft'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['muted', 'accent-soft'],
  ['faint', 'surface'],
  ['faint', 'surface-2'],
  ['faint', 'accent-soft'],
  ['accent', 'surface'],
  ['accent', 'accent-soft'],
  ['accent-fg', 'accent'],
  ['lv-error', 'surface']
]

describe('text contrast meets WCAG AA', () => {
  it.each(TEXT_ON)('light %s on %s', (fg, bg) => {
    expect(ratio(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(TEXT_ON)('dark %s on %s', (fg, bg) => {
    expect(ratio(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the two dark theme blocks identical', () => {
    expect(Object.keys(dark).length).toBeGreaterThan(10)
    expect(media).toEqual(dark)
  })
})
