# logql-query-box

A React query box for [Grafana Loki](https://grafana.com/oss/loki/). People type a friendly search language, and you get validated [LogQL](https://grafana.com/docs/loki/latest/query/) back.

```text
level:error,warn app:checkout-* timeout -debug
```

becomes

```logql
{service_name=~"checkout-.*"}
  |~ "(?i)timeout"
  !~ "(?i)debug"
  | detected_level=~"error|warn"
```

![logql-query-box showing a filter, chips and compiled LogQL](docs/screenshot.png)

- **Suggestions** for fields, values with line counts, saved and recent queries, all keyboard driven.
- **Chips** for every condition, removable with one click.
- **Live validation** that matches what Loki really accepts, including RE2 regex rules.
- **Show LogQL** with copy buttons, one per query branch.
- **Search help** dialog, dark mode, and themable CSS variables.
- **Headless engine** with no React dependency, usable on a server.
- No runtime dependencies besides React.

## Install

```bash
npm install logql-query-box
```

Works with `yarn add` and `pnpm add` too. React 18 or newer is required.

To install directly from GitHub instead, pin a tag. The built files are committed, so there is no build step.

```bash
npm install github:darshanraj046/logql-query-box#v0.1.0
```

## Quick start

```tsx
import { LogQLQueryBox } from 'logql-query-box'
import 'logql-query-box/styles.css'

export function LogSearch() {
  return (
    <LogQLQueryBox
      values={{
        service_name: [{ value: 'checkout-api', count: 8123 }, { value: 'auth-service', count: 2210 }],
        service_category: ['JAVA', 'PYTHON']
      }}
      onExecute={({ query, logql, filter }) => {
        console.log(query)
        console.log(logql.branches)
        console.log(filter)
      }}
    />
  )
}
```

`onExecute` only fires for a valid filter. It receives:

| Field | Meaning |
| --- | --- |
| `query` | The text the user typed. |
| `logql.branches` | One LogQL string per branch. Run them all and merge the results. |
| `logql.count` | The number of branches. |
| `filter` | The same filter as a JSON tree, for backends that build their own queries. `null` when empty. |
| `tree` | The parsed condition tree. |

### Why several branches?

LogQL cannot express an arbitrary AND/OR tree in one query, so the filter is expanded into an OR of AND-branches. `(a OR b) (c OR d)` becomes four queries. Run each one with `query_range`, then merge and de-duplicate by timestamp and line. Filters that would need more than 12 queries are blocked with a message suggesting comma lists. Change the limit with `maxBranches`.

## The search language

| You type | It means |
| --- | --- |
| `timeout` | Lines containing the word, not case sensitive |
| `"connection refused"` | An exact phrase |
| `-debug` | Lines that do not contain it |
| `/\w+Exception/` | A regular expression (RE2) |
| `level:error,warn` | Field is one of these values |
| `level:error level:warn` | Same field repeated means OR |
| `-level:debug` | Exclude a value |
| `-app:a,b` | Exclude several values |
| `app:checkout-*` | Wildcard, also inside lists: `app:a-*,b` |
| `app:"my service",other` | Quote values with spaces or commas |
| `a OR b`, `a AND b` | Boolean operators, uppercase. AND binds tighter |
| `level:error (timeout OR refused)` | Group with brackets |
| `-(timeout OR refused)` | Exclude a whole group |

Half typed input stays valid, so `a OR` or `level:` never shows an error while someone is still typing.

## Keyboard

| Key | Action |
| --- | --- |
| `Enter` | Run, or complete a highlighted value |
| `Shift+Enter` | New line |
| `Tab` | Accept the highlighted suggestion |
| `Up` / `Down` | Move through suggestions |
| `Esc` | Close suggestions, then leave the box |
| `/` and `?` | Focus the box and open help, when `globalShortcuts` is on |

## Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `value` | `string` | | Controlled query. Pair with `onChange`. |
| `defaultValue` | `string` | `''` | Initial query when uncontrolled. |
| `onChange` | `(query, analysis) => void` | | Fires on every edit. |
| `onExecute` | `(analysis) => void` | | Fires when a valid filter runs. |
| `onSave` | `(query, existing?) => void` | | Shows a save button. `existing` is set if this query is already saved. |
| `values` | `FieldValues` | | Known values per field, plain strings or `{ value, count }`. Can change at any time. |
| `schema` | `Schema` | Loki defaults | Fields and aliases. See below. |
| `engine` | `Engine` | | A ready engine. Replaces `schema`, `values`, `matchCase` and `maxBranches`. |
| `matchCase` | `boolean` | `false` | Case sensitive line matching. |
| `maxBranches` | `number` | `12` | Limit on OR expansion. |
| `saved` | `SavedQuery[]` | | Shown in suggestions. |
| `recent` | `string[]` | | Recent queries. When set, you own the list. |
| `recentStorageKey` | `string \| null` | `'logql-query-box.recent'` | `localStorage` key. `null` turns storage off. |
| `examples` | `string[]` | built in | The "Try" row. `[]` hides it. |
| `syntax`, `notes` | | built in | Search help content. |
| `labels` | `Partial<Labels>` | | Override any text, for translation. |
| `description` | `ReactNode \| false` | built in | Text above the box. |
| `actions` | `ReactNode` | | Extra controls in the run bar, such as a live tail button. |
| `statusText` | `ReactNode` | | Replaces the status message, for example when a time range changed. |
| `dirty` | `boolean` | `false` | Highlights Execute when something outside the filter changed. |
| `running` | `boolean` | `false` | Disables Execute while a search is in flight. |
| `disabled`, `readOnly`, `autoFocus` | `boolean` | `false` | The usual meaning. |
| `rows` | `number` | `2` | Height of the box. |
| `showHelp`, `showLogql` | `boolean` | `true` | Hide parts of the UI. |
| `defaultLogqlOpen` | `boolean` | `false` | Start with LogQL visible. |
| `executeOnMount` | `boolean` | `false` | Run once on load. |
| `globalShortcuts` | `boolean` | `false` | Listen for `/` and `?` on the page. Off by default so a library never takes over keys unasked. |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `auto` follows the system. |
| `className`, `style` | | | Applied to the root and the help dialog. |

## Facets and other outside controls

Use a ref to drive the box from a sidebar, a chart, or anything else. Each call edits the query text so people can see what happened, then runs it.

```tsx
const box = useRef<LogQLQueryBoxHandle>(null)

box.current?.toggleValue('detected_level', 'error')
box.current?.toggleValue('detected_level', 'debug', true)
box.current?.clearField('detected_level')
box.current?.appendTerm('service_name', ['checkout-api'])
box.current?.setQuery('level:error')
box.current?.setQuery('level:error', { run: false })
box.current?.execute()
box.current?.focus()
box.current?.getQuery()
```

To mark facet checkboxes, ask the engine what is selected:

```ts
const included = engine.activeValues(query, 'detected_level')
const excluded = engine.activeValues(query, 'detected_level', true)
```

## Custom fields

The defaults match OpenTelemetry logs in Loki. Describe your own labels with a schema.

```tsx
const schema = {
  fields: {
    namespace: { label: 'Namespace', indexed: true, aliases: ['ns'] },
    pod: { label: 'Pod', indexed: true, aliases: ['p'] },
    level: { label: 'Level', indexed: false, values: ['error', 'warn', 'info'], lowercase: true, color: 'level' },
    trace_id: { label: 'Trace', indexed: false },
    line: { label: 'Content', kind: 'line', aliases: ['msg'] }
  }
}

<LogQLQueryBox schema={schema} />
```

- `indexed: true` means a Loki stream label, which goes in the `{...}` selector.
- `indexed: false` means structured metadata or an extracted label, which becomes a `| label="x"` filter.
- Exactly one field needs `kind: 'line'`. Plain words search it.
- The first alias is what the UI writes when it adds a term.
- `selectorField` picks the label used for the fallback `=~".+"` selector. It defaults to the first indexed field.
- An invalid schema throws a clear error on first render.

Other field options: `values` (a fixed list), `synonyms` (`{ prod: 'production' }`), `lowercase`, `color` (`'level'`, `'hash'`, `'accent'` or a function), `hint`, `excludeHint`, `example`.

## Without React

The engine runs anywhere, including a Node backend.

```ts
import { createEngine } from 'logql-query-box/core'

const engine = createEngine({ values: { service_name: ['checkout-api'] } })
const result = engine.analyze('level:error timeout')

result.error
result.logql.branches
result.filter
```

| Method | Purpose |
| --- | --- |
| `analyze(query)` | Parse, validate and compile in one call. |
| `validate(query)` | Returns an error string, or `''`. Handy for saved query forms. |
| `parse(query)`, `compile(tree)` | The separate steps. |
| `evaluate(tree, record)` | Test a record in JavaScript, for client side filtering or demos. |
| `suggest(query, caret, extras?)` | The suggestion list, to build your own UI. |
| `chipText(node)`, `isNegative(node)` | Chip rendering. |
| `highlightPattern(tree)` | A `RegExp` for highlighting matched text in log lines, or `null`. |
| `removeNode`, `toggleValue`, `appendTerm`, `clearField`, `activeValues` | Query text editing. |

## Theming

Every color and font is a CSS variable on `.lqb`. Set them in your own stylesheet.

```css
.lqb {
  --lqb-accent: #7c3aed;
  --lqb-accent-soft: #f3e8ff;
  --lqb-font-ui: Inter, sans-serif;
  --lqb-font-mono: 'JetBrains Mono', monospace;
}
```

All class names start with `lqb-`, and the stylesheet does not touch anything outside the component.

## What Loki taught this library

Generated queries are tested against a real Loki server, which surfaced behavior that is easy to get wrong.

- **Selectors must be able to exclude the empty string.** Loki rejects `{app=~".*"}`, and also `{app=~"(foo)?"}` and `{app!="x"}`. The compiler tests each pattern against the empty string and adds a safe selector when needed, so `app:*` just works.
- **Label filters need explicit anchors.** A pipeline filter such as `| level=~"e.*"` can match `debug`, because Loki may optimize it into a substring check. The compiler always writes `^(?:e.*)$` for pipeline regexes.
- **RE2 is not JavaScript.** `(?P<x>a)` is valid RE2 and invalid JavaScript, while `\y` is the reverse. Validation follows RE2, and it is checked against the Go parser that Loki uses.

## Limits

- `evaluate()` runs on the JavaScript regex engine after translating RE2 syntax. Flags set in the middle of a pattern, such as `a(?i)b`, are validated but not applied there. Loki itself handles them correctly, so only client side filtering is affected.
- The component builds queries. Running them, time ranges and results are yours, which keeps it usable with any backend.

## Development

```bash
npm install
npm run dev
npm test
npm run check
```

`npm run dev` opens a demo. The test suite has several layers:

| Layer | What it proves |
| --- | --- |
| `test/prototype-parity.test.ts` | Thousands of random queries behave the same as the original implementation, kept in `test/oracle`. |
| `test/fixes.test.ts` | Every intentional difference from that implementation, showing both the old and the new result. |
| `test/regex.test.ts` | Regex validation agrees with Go `regexp/syntax` on over 20,000 patterns. |
| `test/invariants.test.ts` | Properties that must hold for any input, including garbage. |
| `test/component.test.tsx` | The React component, with real keyboard and mouse events. |
| `test/ssr.test.tsx` | Rendering with no browser globals. |
| `test/e2e.loki.test.ts` | For random queries, real Loki returns exactly the rows `evaluate()` picks. |

To run the Loki tests, start a local Loki and point the tests at it:

```bash
loki -config.file=test/loki/loki-test.yaml -config.expand-env=true
```

```bash
npm run test:loki
```

`npm run golden` refreshes the recorded RE2 verdicts, which needs Go installed.

## License

MIT
