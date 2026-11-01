import { beforeAll, describe, expect, it } from 'vitest'
import { genBaselineQuery, genExtendedQuery, makeEngine, makeRecords, rng, type LogRow } from './helpers'

const base = process.env.LOKI_URL ?? 'http://127.0.0.1:3199'
const QUERIES = Number(process.env.LOKI_QUERIES ?? 3000)
const records: LogRow[] = makeRecords(400, 19).map((row) => (row.id % 5 === 0 ? { ...row, detected_level: '' } : row))
const start = Date.now() - 60000
const stamp = (id: number) => (BigInt(start) * 1000000n + BigInt(id) * 1000000n).toString()
const byStamp = new Map(records.map((row) => [stamp(row.id), row.id]))

async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/ready`)
      if (r.ok && (await r.text()).trim() === 'ready') return
    } catch {
      await new Promise((done) => setTimeout(done, 500))
      continue
    }
    await new Promise((done) => setTimeout(done, 500))
  }
  throw new Error(`Loki is not ready at ${base}`)
}

async function push() {
  const streams = new Map<string, LogRow[]>()
  for (const row of records) {
    const key = `${row.service_name}|${row.service_category}`
    streams.set(key, [...(streams.get(key) ?? []), row])
  }
  const body = {
    streams: [...streams.values()].map((rows) => ({
      stream: { service_name: rows[0].service_name, service_category: rows[0].service_category },
      values: rows.map((row) => [stamp(row.id), row.line, row.detected_level ? { detected_level: row.detected_level } : {}])
    }))
  }
  const r = await fetch(`${base}/loki/api/v1/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`push failed: ${r.status} ${await r.text()}`)
}

async function run(query: string): Promise<number[]> {
  const u = new URL(`${base}/loki/api/v1/query_range`)
  u.searchParams.set('query', query)
  u.searchParams.set('start', stamp(0))
  u.searchParams.set('end', stamp(records.length + 1))
  u.searchParams.set('limit', '5000')
  u.searchParams.set('direction', 'forward')
  const r = await fetch(u)
  const text = await r.text()
  if (!r.ok) throw new Error(`Loki ${r.status} for ${JSON.stringify(query)}: ${text.slice(0, 200)}`)
  const out: number[] = []
  for (const s of JSON.parse(text).data.result) for (const [ts] of s.values) out.push(byStamp.get(ts) as number)
  return out
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) await work(items[next++])
  }))
}

describe('compiled LogQL against a real Loki', () => {
  beforeAll(async () => {
    await ready()
    await push()
    for (let i = 0; i < 40; i++) {
      if ((await run('{service_name=~".+"}')).length === records.length) return
      await new Promise((done) => setTimeout(done, 250))
    }
    throw new Error('records did not arrive')
  })

  it.each([
    ['extended grammar, case insensitive', genExtendedQuery, false, 31],
    ['extended grammar, match case', genExtendedQuery, true, 32],
    ['baseline grammar', genBaselineQuery, false, 33]
  ] as const)('%s returns exactly the rows evaluate() picks', async (_name, gen, matchCase, seed) => {
    const engine = makeEngine({ matchCase })
    const r = rng(seed)
    const queries: string[] = []
    while (queries.length < QUERIES) queries.push(gen(r))
    const failures: string[] = []
    let executed = 0
    await pool(queries, 12, async (q) => {
      const a = engine.analyze(q)
      if (a.error) return
      executed++
      const expected = records.filter((row) => engine.evaluate(a.tree, row)).map((row) => row.id).sort((x, y) => x - y)
      try {
        const got = new Set<number>()
        for (const branch of a.logql.branches) for (const id of await run(branch)) got.add(id)
        const actual = [...got].sort((x, y) => x - y)
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          const extra = actual.filter((id) => !expected.includes(id)).slice(0, 3)
          const missing = expected.filter((id) => !actual.includes(id)).slice(0, 3)
          failures.push(`${JSON.stringify(q)} loki=${actual.length} local=${expected.length} extra=${extra.map((i) => JSON.stringify(records[i])).join()} missing=${missing.map((i) => JSON.stringify(records[i])).join()} logql=${JSON.stringify(a.logql.branches)}`)
        }
      } catch (e) {
        failures.push(`${JSON.stringify(q)} ${(e as Error).message}`)
      }
    })
    console.log(`${_name}: ${executed} of ${queries.length} queries executed, ${failures.length} failures`)
    expect(failures.slice(0, 12).join('\n')).toBe('')
    expect(executed).toBeGreaterThan(QUERIES / 3)
  })
})
