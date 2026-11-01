export interface FieldDef {
  label: string
  kind?: 'label' | 'line'
  indexed?: boolean
  aliases?: string[]
  values?: string[]
  synonyms?: Record<string, string>
  lowercase?: boolean
  color?: 'level' | 'hash' | 'accent' | ((value: string) => string)
  hint?: string
  excludeHint?: string
  example?: string | ((values: string[]) => string)
}

export interface Schema {
  fields: Record<string, FieldDef>
  selectorField?: string
  excludeExample?: string
}

export interface ResolvedField extends Omit<FieldDef, 'synonyms'> {
  name: string
  kind: 'label' | 'line'
  primary: string
  synonyms: Map<string, string>
}

export interface ResolvedSchema {
  fields: Map<string, ResolvedField>
  alias: Map<string, string>
  lineField: string
  selectorField: string
  excludeExample: string
}

const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

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

export function resolveSchema(schema: Schema): ResolvedSchema {
  const fields = new Map<string, ResolvedField>()
  const alias = new Map<string, string>()
  let lineField = ''
  let firstIndexed = ''

  for (const [name, def] of Object.entries(schema.fields)) {
    if (!LABEL_NAME.test(name)) throw new Error(`logql-query-box: "${name}" is not a valid Loki label name.`)
    const kind = def.kind ?? 'label'
    if (kind === 'line') {
      if (lineField) throw new Error('logql-query-box: a schema can only have one line field.')
      lineField = name
    } else if (def.indexed && !firstIndexed) {
      firstIndexed = name
    }
    const names = [...(def.aliases ?? []), name]
    for (const a of names) {
      if (!LABEL_NAME.test(a)) throw new Error(`logql-query-box: "${a}" is not a valid field alias.`)
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
      synonyms: new Map(Object.entries(def.synonyms ?? {}))
    })
  }

  if (!lineField) throw new Error('logql-query-box: a schema needs one field with kind "line".')
  const selectorField = schema.selectorField ?? firstIndexed
  if (!selectorField || !fields.get(selectorField)?.indexed) {
    throw new Error('logql-query-box: a schema needs an indexed label to use as the fallback stream selector.')
  }
  const firstLabel = [...fields.values()].find((f) => f.kind === 'label')
  return {
    fields,
    alias,
    lineField,
    selectorField,
    excludeExample: schema.excludeExample ?? `${firstLabel ? firstLabel.primary : 'field'}:value`
  }
}
