export interface FieldDef {
  label: string
  kind?: 'label' | 'line'
  indexed?: boolean
  parsed?: boolean
  aliases?: string[]
  values?: string[]
  synonyms?: Record<string, string>
  groups?: Record<string, string[]>
  lowercase?: boolean
  color?: 'level' | 'hash' | 'accent' | ((value: string) => string)
  hint?: string
  excludeHint?: string
  example?: string | ((values: string[]) => string)
}

export type LogParser = 'json' | 'logfmt'

export interface Schema {
  fields: Record<string, FieldDef>
  selectorField?: string
  excludeExample?: string
  parser?: LogParser
  operator?: ':' | '='
}

export interface ResolvedField extends Omit<FieldDef, 'synonyms' | 'groups'> {
  name: string
  kind: 'label' | 'line'
  primary: string
  synonyms: Map<string, string>
  groups: Map<string, string[]>
}

export interface ResolvedSchema {
  fields: Map<string, ResolvedField>
  alias: Map<string, string>
  lineField: string
  parsedLine: boolean
  selectorField: string
  excludeExample: string
  parser?: LogParser
  operator: ':' | '='
  baseSelector: [string, string][]
}

const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const ALIAS_NAME = /^[a-zA-Z_][a-zA-Z0-9_.]*$/

export const defaultSchema: Schema = {
  fields: {
    detected_level: {
      label: 'Log Level',
      indexed: false,
      aliases: ['level', 'severity', 'lvl', 'type'],
      values: ['error', 'info', 'warn', 'debug', 'unknown'],
      synonyms: {
        warning: 'warn',
        warnings: 'warn',
        err: 'error',
        fatal: 'error',
        critical: 'error',
        information: 'info',
        trace: 'debug',
        none: 'unknown'
      },
      lowercase: true,
      color: 'level',
      hint: 'Filter by log level',
      excludeHint: 'Hide log levels, for example -level:debug',
      example: 'error, warn, info…'
    },
    service_name: {
      label: 'App Name',
      indexed: true,
      aliases: ['app', 'service', 'name'],
      color: 'hash',
      hint: 'Filter by app name',
      excludeHint: 'Hide apps',
      example: (values) => values.slice(0, 2).join(', ') + '…'
    },
    service_category: {
      label: 'App Type',
      indexed: true,
      aliases: ['apptype', 'runtime', 'lang', 'kind'],
      color: 'accent',
      hint: 'Filter by app type',
      excludeHint: 'Hide app types',
      example: (values) => values.join(', ').toLowerCase()
    },
    line: {
      label: 'Content',
      kind: 'line',
      aliases: ['msg', 'message', 'content', 'text']
    }
  },
  selectorField: 'service_name',
  excludeExample: 'level:debug'
}

function resolveGroups(field: string, groups: Record<string, string[]> = {}): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [key, list] of Object.entries(groups)) {
    const members = [...new Set(list.filter(Boolean))]
    if (!members.length) throw new Error(`logql-query-box: group "${key}" on "${field}" has no values.`)
    for (const value of new Set([key, ...members].map((v) => v.toLowerCase()))) {
      if (out.has(value)) throw new Error(`logql-query-box: "${value}" is in two groups on "${field}".`)
      out.set(value, members)
    }
  }
  return out
}

export function resolveSchema(schema: Schema, baseSelector: Record<string, string> = {}): ResolvedSchema {
  const fields = new Map<string, ResolvedField>()
  const alias = new Map<string, string>()
  let lineField = ''
  let parsedLine = false
  let firstIndexed = ''

  for (const [name, def] of Object.entries(schema.fields)) {
    if (!LABEL_NAME.test(name)) throw new Error(`logql-query-box: "${name}" is not a valid Loki label name.`)
    const kind = def.kind ?? 'label'
    if (def.parsed && kind !== 'line') throw new Error(`logql-query-box: "parsed" only applies to the line field, not "${name}".`)
    if (def.parsed && !schema.parser) throw new Error('logql-query-box: a parsed line field needs a schema parser.')
    if (kind === 'line') {
      if (lineField) throw new Error('logql-query-box: a schema can only have one line field.')
      lineField = name
      parsedLine = !!def.parsed
    } else if (def.indexed && !firstIndexed) {
      firstIndexed = name
    }
    const names = [...(def.aliases ?? []), name]
    for (const a of names) {
      if (!ALIAS_NAME.test(a)) throw new Error(`logql-query-box: "${a}" is not a valid field alias.`)
      const key = a.toLowerCase()
      const taken = alias.get(key)
      if (taken && taken !== name) throw new Error(`logql-query-box: alias "${a}" is used by both "${taken}" and "${name}".`)
      alias.set(key, name)
    }
    fields.set(name, {
      ...def,
      name,
      kind,
      primary: names[0],
      synonyms: new Map(Object.entries(def.synonyms ?? {})),
      groups: resolveGroups(name, def.groups)
    })
  }

  if (!lineField) throw new Error('logql-query-box: a schema needs one field with kind "line".')
  const base = Object.entries(baseSelector)
  for (const [name] of base) {
    if (!LABEL_NAME.test(name)) throw new Error(`logql-query-box: "${name}" is not a valid Loki label name.`)
  }
  const selectorField = schema.selectorField ?? base[0]?.[0] ?? firstIndexed
  if (!fields.get(selectorField)?.indexed && !base.some(([name]) => name === selectorField)) {
    throw new Error('logql-query-box: a schema needs an indexed label or a baseSelector to use as the stream selector.')
  }
  const firstLabel = [...fields.values()].find((f) => f.kind === 'label')
  return {
    fields,
    alias,
    lineField,
    parsedLine,
    selectorField,
    excludeExample: schema.excludeExample ?? (schema.operator === '=' ? `${firstLabel ? firstLabel.primary : 'field'} != value` : `${firstLabel ? firstLabel.primary : 'field'}:value`),
    parser: schema.parser,
    operator: schema.operator ?? ':',
    baseSelector: base
  }
}
