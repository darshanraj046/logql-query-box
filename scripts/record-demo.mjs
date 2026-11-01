import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const url = process.env.DEMO_URL ?? 'http://localhost:5199/record.html'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'lqb-demo-'))
const WIDTH = 860
const HEIGHT = 500
const OUTPUT_WIDTH = 1000

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 })
const page = await context.newPage()
await page.goto(url)
await page.waitForFunction(() => 'stage' in window)
await page.evaluate(() => document.fonts.ready)

const frames = []
let pointer = [420, 520]

const stage = (patch) => page.evaluate((p) => window.stage(p), patch)
const settle = () => page.waitForTimeout(40)

async function shot(ms) {
  await settle()
  const path = join(dir, `${String(frames.length).padStart(4, '0')}.png`)
  await page.screenshot({ path })
  frames.push({ path, ms })
}

async function say(title, sub, step) {
  await stage({ title, sub, step })
}

async function type(text, ms = 65) {
  for (const ch of text) {
    await page.keyboard.type(ch)
    await shot(ms)
  }
}

async function press(key, label = key) {
  await stage({ key: label })
  await shot(350)
  await page.keyboard.press(key)
  await shot(450)
  await stage({ key: '' })
}

async function moveTo(x, y) {
  const [fromX, fromY] = pointer
  const steps = 9
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const eased = 1 - (1 - t) ** 3
    await stage({ pointer: [fromX + (x - fromX) * eased, fromY + (y - fromY) * eased] })
    await shot(30)
  }
  pointer = [x, y]
}

async function clickOn(locator) {
  const box = await locator.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await moveTo(x, y)
  await shot(220)
  await page.mouse.click(x, y)
  await shot(350)
}

await say('Writing LogQL by hand is slow and easy to get wrong', 'And this is only one simple filter', 0)
await stage({ scene: 'problem' })
await shot(2800)

await stage({ scene: 'box' })
await say('Now just search the way you think', 'Plain words and simple filters, no LogQL to learn', 1)
await page.waitForSelector('#card textarea')
await stage({ pointer })
await shot(1200)
await clickOn(page.locator('#card textarea'))
await stage({ pointer: null })
await say('Suggestions show what you can filter on', 'Fields and values are one keystroke away', 1)
await shot(1400)
await type('le')
await shot(350)
await press('Tab')
await say('Pick real values instead of guessing them', 'Line counts show where the logs are', 2)
await shot(1300)
await type('er')
await shot(450)
await press('Enter')
await page.keyboard.press('Backspace')
await type(',wa')
await shot(350)
await press('Enter')
await say('Add more filters in plain language', 'Wildcards, words, and a minus to exclude', 3)
await shot(600)
await type('app:checkout-* ', 60)
await shot(250)
await type('timeout ', 60)
await shot(250)
await type('-debug', 70)
await shot(300)
await press('Enter')
await say('Every filter becomes a chip', 'You can see exactly what is applied', 3)
await shot(1500)

await say('You get valid LogQL, written for you', 'The same query from the start, ready to send to Loki', 4)
await stage({ pointer })
await clickOn(page.getByRole('button', { name: 'Show LogQL' }))
await shot(2600)
await page.locator('#card').screenshot({ path: here('../docs/screenshot.png') })
await say('Change a filter and the LogQL follows', 'Remove a chip and the query updates instantly', 4)
await shot(600)
await clickOn(page.getByRole('button', { name: 'Remove filter not \u201cdebug\u201d' }))
await stage({ pointer: null })
await shot(2000)

await say('Mistakes are caught before Loki sees them', 'Loki uses RE2, so this regex would fail. The box explains why and blocks it', 5)
await page.getByRole('button', { name: 'Hide LogQL' }).click()
await page.getByRole('button', { name: 'Clear the filter' }).click()
await shot(400)
await type('/time(?=out)/', 50)
await shot(3000)

await stage({ scene: 'end', title: '', sub: '', step: 5, pointer: null })
await shot(3000)

await browser.close()

const list = frames.flatMap((f) => [`file '${f.path}'`, `duration ${(f.ms / 1000).toFixed(3)}`])
list.push(`file '${frames[frames.length - 1].path}'`)
const listFile = join(dir, 'frames.txt')
writeFileSync(listFile, `${list.join('\n')}\n`)

const filter = `scale=${OUTPUT_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`
const encode = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', filter, '-fps_mode', 'vfr', '-loop', '0', here('../docs/demo.gif')], { encoding: 'utf8' })
if (encode.status !== 0) {
  console.error(encode.stderr)
  process.exit(1)
}

if (process.env.KEEP_FRAMES) spawnSync('cp', ['-R', dir, process.env.KEEP_FRAMES])
rmSync(dir, { recursive: true, force: true })
const seconds = Math.round(frames.reduce((sum, f) => sum + f.ms, 0) / 1000)
console.log(`recorded ${frames.length} frames, ${seconds}s`)
