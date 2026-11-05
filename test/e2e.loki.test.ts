import { beforeAll, describe, expect, it } from 'vitest'
import { createEngine, defaultSchema, type Schema } from '../src/core'
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

describe('JSON logs under one stream label against a real Loki', () => {
  const index = 'e2e-json-logs'
  const jsonStart = start - 3600000
  const jsonStamp = (id: number) => (BigInt(jsonStart) * 1000000n + BigInt(id) * 1000000n).toString()
  const stored = records.map((row) => {
    const content = row.id % 3 === 0 ? `first line of trace\n${row.line}\n  at com.acme.Order.total(Order.java:42)\nlast line` : row.line
    const fields = { ts: jsonStart + row.id, ...(row.detected_level ? { logLevel: row.detected_level } : {}), serviceName: row.service_name, serviceCategory: row.service_category, content }
    return { id: row.id, raw: JSON.stringify(fields), content, logLevel: row.detected_level, serviceName: row.service_name, serviceCategory: row.service_category }
  })
  const fromStamp = new Map(stored.map((row) => [jsonStamp(row.id), row.id]))
  const schema: Schema = {
    parser: 'json',
    fields: {
      logLevel: { ...defaultSchema.fields.detected_level, indexed: false },
      serviceName: { ...defaultSchema.fields.service_name, indexed: false },
      serviceCategory: { ...defaultSchema.fields.service_category, indexed: false },
      content: { ...defaultSchema.fields.line, aliases: ['msg', 'message', 'line', 'text'] }
    }
  }
  const parsedSchema: Schema = {
    ...schema,
    fields: {
      ...schema.fields,
      logLevel: { ...schema.fields.logLevel, groups: { warn: ['warn', 'unknown'] } },
      content: { ...schema.fields.content, parsed: true }
    }
  }
  const appValues = { serviceName: [...new Set(records.map((r) => r.service_name))] }
  const engineFor = (matchCase: boolean) => createEngine({ schema, baseSelector: { index }, matchCase, values: appValues })
  const parsedEngineFor = (matchCase: boolean) => createEngine({ schema: parsedSchema, baseSelector: { index }, matchCase, values: appValues })

  async function runJson(query: string): Promise<number[]> {
    const u = new URL(`${base}/loki/api/v1/query_range`)
    u.searchParams.set('query', query)
    u.searchParams.set('start', jsonStamp(0))
    u.searchParams.set('end', jsonStamp(records.length + 1))
    u.searchParams.set('limit', '5000')
    u.searchParams.set('direction', 'forward')
    const r = await fetch(u)
    const text = await r.text()
    if (!r.ok) throw new Error(`Loki ${r.status} for ${JSON.stringify(query)}: ${text.slice(0, 200)}`)
    const out: number[] = []
    for (const s of JSON.parse(text).data.result) for (const [ts] of s.values) out.push(fromStamp.get(ts) as number)
    return out
  }

  beforeAll(async () => {
    await ready()
    const body = { streams: [{ stream: { index }, values: stored.map((row) => [jsonStamp(row.id), row.raw]) }] }
    const r = await fetch(`${base}/loki/api/v1/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error(`push failed: ${r.status} ${await r.text()}`)
    for (let i = 0; i < 40; i++) {
      if ((await runJson(`{index="${index}"}`)).length === stored.length) return
      await new Promise((done) => setTimeout(done, 250))
    }
    throw new Error('records did not arrive')
  })

  it('needs the parser, without it a field filter finds nothing', async () => {
    expect(await runJson(`{index="${index}"} | serviceName="checkout-api"`)).toEqual([])
    const engine = engineFor(false)
    expect((await runJson(engine.analyze('app:checkout-api').logql.branches[0])).length).toBeGreaterThan(0)
  })

  it.each([
    ['case insensitive', false, 41],
    ['match case', true, 42]
  ] as const)('%s returns exactly the rows evaluate() picks on the stored lines', async (_name, matchCase, seed) => {
    const engine = engineFor(matchCase)
    const r = rng(seed)
    const queries: string[] = []
    while (queries.length < QUERIES) queries.push(genExtendedQuery(r))
    const failures: string[] = []
    let executed = 0
    await pool(queries, 12, async (q) => {
      const a = engine.analyze(q)
      if (a.error) return
      executed++
      const expected = stored.filter((row) => engine.evaluate(a.tree, { logLevel: row.logLevel, serviceName: row.serviceName, serviceCategory: row.serviceCategory, content: row.raw })).map((row) => row.id).sort((x, y) => x - y)
      try {
        const got = new Set<number>()
        for (const branch of a.logql.branches) {
          if (!branch.startsWith(`{index="${index}"`)) throw new Error(`not scoped: ${branch}`)
          for (const id of await runJson(branch)) got.add(id)
        }
        const actual = [...got].sort((x, y) => x - y)
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${JSON.stringify(q)} loki=${actual.length} local=${expected.length} logql=${JSON.stringify(a.logql.branches)}`)
      } catch (e) {
        failures.push(`${JSON.stringify(q)} ${(e as Error).message}`)
      }
    })
    expect(failures.slice(0, 12).join('\n')).toBe('')
    expect(executed).toBeGreaterThan(QUERIES / 3)
  })

  it.each([
    ['case insensitive', false, 51],
    ['match case', true, 52]
  ] as const)('parsed line, %s, one query returns exactly the rows evaluate() picks with no repeats', async (_name, matchCase, seed) => {
    const engine = parsedEngineFor(matchCase)
    const r = rng(seed)
    const queries: string[] = []
    while (queries.length < QUERIES) queries.push(genExtendedQuery(r))
    const failures: string[] = []
    let executed = 0
    await pool(queries, 12, async (q) => {
      const a = engine.analyze(q)
      if (a.error) return
      executed++
      const expected = stored.filter((row) => engine.evaluate(a.tree, { logLevel: row.logLevel, serviceName: row.serviceName, serviceCategory: row.serviceCategory, content: row.content })).map((row) => row.id).sort((x, y) => x - y)
      try {
        if (a.logql.branches.length !== 1) throw new Error(`expected one query, got ${a.logql.branches.length}`)
        const actual = (await runJson(a.logql.branches[0])).sort((x, y) => x - y)
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${JSON.stringify(q)} loki=${actual.length} local=${expected.length} logql=${JSON.stringify(a.logql.branches)}`)
      } catch (e) {
        failures.push(`${JSON.stringify(q)} ${(e as Error).message}`)
      }
    })
    console.log(`parsed line ${_name}: ${executed} of ${queries.length} queries executed, ${failures.length} failures`)
    expect(failures.slice(0, 12).join('\n')).toBe('')
    expect(executed).toBeGreaterThan(QUERIES / 3)
  })

  it('finds a word in the field, not in the JSON keys around it', async () => {
    const raw = await runJson(engineFor(false).analyze('service').logql.branches[0])
    const parsed = await runJson(parsedEngineFor(false).analyze('service').logql.branches[0])
    expect(raw).toHaveLength(stored.length)
    expect(parsed).toEqual(stored.filter((row) => row.content.toLowerCase().includes('service')).map((row) => row.id))
  })

  it('finds a word on any line of a multi-line message', async () => {
    const rows = await runJson(parsedEngineFor(false).analyze('"com.acme.order.total"').logql.branches[0])
    const multi = stored.filter((row) => row.content.toLowerCase().includes('com.acme.order.total')).map((row) => row.id)
    expect(multi.length).toBeGreaterThan(100)
    expect(rows.sort((x, y) => x - y)).toEqual(multi)
  })

  it.each([
    ['case insensitive', false, 61],
    ['match case', true, 62]
  ] as const)('operator "=", %s, returns exactly the rows evaluate() picks', async (_name, matchCase, seed) => {
    const eqSchema: Schema = {
      parser: 'json',
      operator: '=',
      fields: {
        logLevel: { label: 'level', aliases: ['level'], values: ['error', 'info', 'warn', 'debug', 'unknown'] },
        serviceName: { label: 'app', aliases: ['app'] },
        serviceCategory: { label: 'app.type', aliases: ['app.type'], values: ['JAVA', 'PYTHON', 'GO'] },
        content: { label: 'content', kind: 'line', parsed: true, aliases: ['content'] }
      }
    }
    const engine = createEngine({ schema: eqSchema, baseSelector: { index }, matchCase, values: appValues })
    const terms = [
      'app =~ service', 'app =~ ^auth', 'app =~ api$', 'app =~ ^checkout-api$', 'app !~ service', 'app =~ (checkout|billing)-', 'app =~ ledger\\.sync',
      'app = /work/', 'app = checkout-*', 'app = *-service', 'app = *e*', 'app != auth-service', 'app = checkout-api, auth-service',
      'app.type != JAVA', 'app.type != JAVA,GO', 'app.type =~ ^P', 'app.type !~ o',
      'level = error,warn', 'level != debug', 'level =~ ^(error|warn)$', 'level !~ n',
      'content = *timeout*', 'content = conn*refused', 'content != *retry*', 'content =~ time(out|d)', 'content !~ \\d', 'content = "hello world"', 'content =~ order\\.total'
    ]
    const r = rng(seed)
    const pick = () => terms[Math.floor(r() * terms.length)]
    const queries: string[] = [...terms]
    while (queries.length < 600) {
      const a = pick()
      const b = pick()
      const c = pick()
      const shape = Math.floor(r() * 4)
      queries.push(shape === 0 ? `${a} ${b}` : shape === 1 ? `(${a} OR ${b}) ${c}` : shape === 2 ? `-(${a}) ${b}` : `${a}\n${b} ${c}`)
    }
    const failures: string[] = []
    let executed = 0
    await pool(queries, 12, async (q) => {
      const a = engine.analyze(q)
      if (a.error) return
      executed++
      const expected = stored.filter((row) => engine.evaluate(a.tree, { logLevel: row.logLevel, serviceName: row.serviceName, serviceCategory: row.serviceCategory, content: row.content })).map((row) => row.id).sort((x, y) => x - y)
      try {
        const got = new Set<number>()
        for (const branch of a.logql.branches) for (const id of await runJson(branch)) got.add(id)
        const actual = [...got].sort((x, y) => x - y)
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${JSON.stringify(q)} loki=${actual.length} local=${expected.length} logql=${JSON.stringify(a.logql.branches)}`)
      } catch (e) {
        failures.push(`${JSON.stringify(q)} ${(e as Error).message}`)
      }
    })
    console.log(`operator = ${_name}: ${executed} of ${queries.length} queries executed, ${failures.length} failures`)
    expect(failures.slice(0, 12).join('\n')).toBe('')
    expect(executed).toBeGreaterThan(500)
    const single = (q: string) => stored.filter((row) => engine.evaluate(engine.analyze(q).tree, { serviceName: row.serviceName })).length
    expect(single('app =~ service')).toBeGreaterThan(0)
    expect(single('app =~ service')).toBeLessThan(stored.length)
  })

  it('a value group finds every stored spelling', async () => {
    const rows = await runJson(parsedEngineFor(false).analyze('level:warn').logql.branches[0])
    expect(rows.sort((x, y) => x - y)).toEqual(stored.filter((row) => row.logLevel === 'warn' || row.logLevel === 'unknown').map((row) => row.id))
  })
})
