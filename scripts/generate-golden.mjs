import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { regexCorpus } from './regex-corpus.mjs'

const here = (p) => fileURLToPath(new URL(p, import.meta.url))

const patterns = regexCorpus()
const run = spawnSync('go', ['run', here('../test/oracle/re2check.go')], {
  input: patterns.map((p) => JSON.stringify(p)).join('\n') + '\n',
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024
})
if (run.status !== 0) {
  console.error(run.stderr)
  process.exit(1)
}
const verdicts = run.stdout.trim().split('\n')
if (verdicts.length !== patterns.length) throw new Error(`expected ${patterns.length} verdicts, got ${verdicts.length}`)

writeFileSync(here('../test/golden/re2-verdicts.json'), JSON.stringify(patterns.map((p, i) => [p, verdicts[i] === 'true'])))
console.log(`wrote ${patterns.length} RE2 verdicts, ${verdicts.filter((v) => v === 'true').length} valid`)
