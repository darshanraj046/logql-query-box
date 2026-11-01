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

![Animated walkthrough: typing a search with suggestions, seeing chips, getting valid LogQL, and catching a bad regex](docs/demo.gif)

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
npm install github:darshanraj046/logql-query-box#v0.2.0
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
| `riskyRegex` | `true` when a regex here is safe on Loki but too slow to run in a browser. See [Limits](#limits). |

### Why several branches?

The compiler turns a filter into an OR of AND-branches, with one LogQL query per branch, so `(a OR b) (c OR d)` becomes four queries. Run each one with `query_range`, then merge and de-duplicate by timestamp and line. Filters that would need more than 12 queries are blocked with a message suggesting comma lists. Change the limit with `maxBranches`.

With a `parser` on the schema, an OR stays in one query whenever LogQL can express it, so there is nothing to merge, no row comes back twice, and Loki returns the order. Only an OR that mixes raw line text with a field still splits into branches, and setting `parsed: true` on the line field removes that case too. See [Logs stored as JSON](#logs-stored-as-json).

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
| `loadValues` | `(field, { signal }) => Promise<FieldValue[]>` | | Fetches a field's values the first time someone picks one. See [Loading values on demand](#loading-values-on-demand). |
| `schema` | `Schema` | Loki defaults | Fields and aliases. See below. |
| `engine` | `Engine` | | A ready engine. Replaces `schema`, `values`, `loadValues`, `matchCase`, `maxBranches` and `baseSelector`. |
| `matchCase` | `boolean` | `false` | Case sensitive line matching. |
| `maxBranches` | `number` | `12` | Limit on OR expansion into separate queries. |
| `baseSelector` | `Record<string, string>` | | Stream labels added to every query, such as `{ index: 'payments' }`. Can change at any time. |
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
- `selectorField` picks the label used for the fallback `=~".+"` selector. It defaults to the first `baseSelector` label, then the first indexed field.
- An invalid schema throws a clear error on first render.

Other field options: `values` (a fixed list), `synonyms` (`{ prod: 'production' }`), `groups` (below), `lowercase`, `color` (`'level'`, `'hash'`, `'accent'` or a function), `hint`, `excludeHint`, `example`.

### Value groups

Different apps can store the same thing under different names. Java logs `WARN`, Python logs `WARNING`. A group makes them one value, so nobody has to know both.

```tsx
logLevel: {
  label: 'Log Level',
  aliases: ['level'],
  values: ['ERROR', 'WARN', 'WARNING', 'INFO'],
  groups: { WARN: ['WARN', 'WARNING'] }
}
```

`level:warn` and `level:warning` both compile to `| logLevel=~"WARN|WARNING"`, and `-level:warn` excludes both. Chips and facets keep what was typed. A group name does not have to be a stored value, so `groups: { problem: ['ERROR', 'FATAL'] }` adds `level:problem`.

`synonyms` map one word to one stored value. Use `groups` when one word should cover several stored values.

### Loading values on demand

Use `loadValues` when the list of values is too large or changes too often to fetch up front.

```tsx
<LogQLQueryBox
  baseSelector={{ index }}
  loadValues={async (field, { signal }) => {
    const res = await fetch(`/api/logs/values?index=${index}&field=${field}`, { signal })
    return res.json()
  }}
/>
```

- It runs the first time someone picks a value for a field, and once per field after that. Values already known through `values` stay visible until it answers.
- The result is the same shape as `values`: plain strings or `{ value, count }`. It replaces what `values` holds for that field.
- When `baseSelector` changes, the running request is aborted through `signal` and values load again for the new stream.
- If it fails, the box keeps working with what it has and tries again the next time the list opens.
- It does not run when you pass a ready `engine`. Headless code can do the same thing using `suggest().field`, which names the field while a value is being picked.

### Logs stored as JSON

When logs are stored as JSON lines, their fields are not Loki labels until a parser runs, so a filter like `| logLevel="ERROR"` on its own finds nothing. Set `parser` on the schema, and use `baseSelector` for the stream labels every query must include.

```tsx
const schema = {
  parser: 'json',
  fields: {
    logLevel: { label: 'Log Level', aliases: ['level'], values: ['ERROR', 'WARN', 'INFO', 'DEBUG'] },
    serviceName: { label: 'App Name', aliases: ['app'] },
    content: { label: 'Content', kind: 'line', parsed: true, aliases: ['msg'] }
  }
}

<LogQLQueryBox schema={schema} baseSelector={{ index: 'payments' }} />
```

Now `level:error app:checkout-* timeout` compiles to:

```logql
{index="payments"}
  |~ "(?i)timeout"
  | json logLevel, serviceName, content | __error__=""
  | logLevel="ERROR"
  | serviceName=~"^(?:checkout-.*)$"
  | content=~"(?is).*timeout.*"
```

And `level:error OR timeout` stays one query:

```logql
{index="payments"}
  | json logLevel, content | __error__=""
  | logLevel="ERROR" or content=~"(?is).*timeout.*"
```

`parsed: true` says the searchable text lives in a parsed field with the same name as the line field. Without it, words search the whole raw line, keys and all, so `service` matches every row that has a `serviceName` key. The `|~` line is only a fast first pass: it lets Loki skip lines before paying for the parser, and the `content` filter decides the result.

- The parser stage is added only when a query filters on a field, and it comes after the line filters so Loki parses fewer lines. `json` extracts only the fields the query uses, which roughly halves what Loki sends back. `parser: 'logfmt'` works the same way, but extracts every field.
- `baseSelector` labels are not fields, so they never appear in suggestions or chips. Values are escaped for you. While a value is empty, the query uses `label=~".+"`.
- `baseSelector` is for building queries, not for access control. Anyone can change what a browser sends, so enforce access on your server.
- The fast first pass is left out for excluded words, regexes, and text with characters a JSON encoder may rewrite, such as quotes, backslashes, slashes or non-ASCII letters. Those searches are still correct, but Loki parses every line in the range.
- A word that also appears in every line, such as a JSON key, gets no help from the first pass either. On 1.5M lines over 24 hours, searching `service` took about 8 seconds. Narrow the time range or add a field filter.

## Without React

The engine runs anywhere, including a Node backend.

```ts
import { createEngine } from 'logql-query-box/core'

const engine = createEngine({ values: { service_name: ['checkout-api'] }, baseSelector: { index: 'payments' } })
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
| `highlightPattern(tree)` | A `RegExp` for highlighting matched text in log lines, or `null`. Leaves out risky regexes. |
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
- **Row order depends on the response format.** Without `X-Loki-Response-Encoding-Flags: categorize-labels`, Loki groups rows by every parsed field, so a `| json` query can return one group per row and rows arrive out of time order. Send that header from your backend. Each stream is still its own group, so this gives one ordered list only when one stream holds the logs. Loki can split a busy stream on its own, which shows up as a `__stream_shard__` label.
- **Structured metadata does not sort anything.** Loki orders rows by timestamp only, and without that header each set of metadata values is also its own group.
- **RE2 is not JavaScript.** `(?P<x>a)` is valid RE2 and invalid JavaScript, while `\y` is the reverse. Validation follows RE2, and it is checked against the Go parser that Loki uses.

## Limits

- **Risky regexes do not run in the browser.** Loki uses RE2, which stays fast on any pattern. The JavaScript regex engine can stall on patterns such as `(a+)+b`, even on a short line, and it cannot be interrupted. These patterns are detected first: `evaluate()` does not apply that condition, `highlightPattern()` leaves it out, and `analysis.riskyRegex` is `true`. The query still compiles and runs on Loki as normal. The check is cautious, so a few harmless patterns are skipped too, such as `(a+b)+`. Use `isRiskyRegex(pattern)` to ask the same question in your own code.
- `evaluate()` runs on the JavaScript regex engine after translating RE2 syntax. Flags set in the middle of a pattern, such as `a(?i)b`, are validated but not applied there. Loki itself handles them correctly, so only client side filtering is affected.
- Only the first 50 chips are shown, followed by a count of the rest. The filter still uses every term.
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
| `test/regex-safety.test.ts` | Every regex judged safe finishes quickly on worst case input, checked in a sandbox that can stop it. |
| `test/contrast.test.ts` | Text colors meet WCAG AA in both themes. |
| `test/invariants.test.ts` | Properties that must hold for any input, including garbage. |
| `test/component.test.tsx` | The React component, with real keyboard and mouse events. |
| `test/ssr.test.tsx` | Rendering with no browser globals. |
| `test/e2e.loki.test.ts` | For random queries, real Loki returns exactly the rows `evaluate()` picks, for label based logs and for JSON lines. |

To run the Loki tests, start a local Loki and point the tests at it:

```bash
loki -config.file=test/loki/loki-test.yaml -config.expand-env=true
```

```bash
npm run test:loki
```

`npm run golden` refreshes the recorded RE2 verdicts, which needs Go installed.

`npm run record` rebuilds `docs/demo.gif` from the real component. Start `npm run dev` first. It needs Chrome and ffmpeg installed.

## License

MIT
