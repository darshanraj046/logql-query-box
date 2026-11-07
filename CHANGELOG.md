# Changelog

## 0.5.3

Changed:

- Running a query in `=` mode also puts one space on each side of the operator, so `content =security` becomes `content = security` and `level=ERROR` becomes `level = ERROR`. Quoted text, `/regex/` terms and `:` filters are left as typed, and the compiled LogQL is unchanged. Through `engine.combine()`.

## 0.5.2

Fixed:

- `SavedQuery.id` is a `string` again. 0.5.0 widened it to `string | number`, which broke type checks in apps that pass `saved.id` to functions taking a `string`. Map numeric ids with `String(id)`.

## 0.5.1

Added:

- Regex errors give the reason and the character, for example `In /time(out/, this ( is never closed (character 5).` Covered: unclosed `(` and `[`, unmatched `)`, repeats with nothing to repeat or after another repeat, lookaround and back-references, reversed ranges, counts above 1000, bad flags, escapes, character and Unicode classes. Which patterns are valid is unchanged, which the RE2 golden verdicts check.
- In `=` mode, a field name followed by one of its values without an operator, such as `level ERROR` or `level, ERROR`, is an error with a one-click fix to `level = ERROR`.
- `analysis.errorAt` (the range in the query) and `analysis.fix` (a corrected query). Unclosed quotes and unmatched brackets also set `errorAt`. `ParseResult.errorAt` and `regexError(pattern)` from the core entry.
- The bar underlines the bad range, shows the message in the open editor's list, and shows the fix as a button under the bar. Label: `useFix`. Class: `.lqb-hl-bad`, `.lqb-sg-err`.

Changed:

- Pattern error messages are specific instead of "One of the /regular expressions/ is not valid." `engine.validate()` is unchanged.

## 0.5.0

Added:

- `maxSuggestions` (default `100`): value lists show at most that many rows, with a "N more. Keep typing to narrow the list." line. Label: `moreValues`. Headless: `limit` in `suggest()` extras, and `more` on the result.
- `searchValues`: calls `loadValues` again while someone types a value, debounced, with the typed text in the new `search` context field. Answers are cached per field and text, and stale answers are dropped. `SuggestionList.search` holds the typed text for headless use.
- `Ctrl+Enter` or `Cmd+Enter` runs exactly what was typed, even while a value is highlighted. Listed in the help dialog.

Changed:

- `SavedQuery.id` is `string | number`.
- Sourcemaps no longer embed the source, which roughly halves the package size.

Docs:

- Quoted values are literal, how case works for free text and field values, `level:none` and Loki's `discover_log_levels`, and an "Upgrading from 0.4" section.

## 0.4.0

Added:

- `variant="bar"`: a one line filter bar that grows into an editor over the page once it holds a query, with clear and copy buttons, field name highlighting, and Run query beside it.
- An embedded Queries panel in the bar: count badge, search, pinned and all saved groups, and hover actions through `onSelectSaved`, `onPinSaved`, `onEditSaved`, `onDeleteSaved` and `onCreateAlert`. Also `savedCount`, `savedLoading`, `onSavedSearch`, `showQueries`, `showRun`, and `openQueries()` and `closeQueries()` on the handle.
- `operator: '='` on the schema for `level = ERROR,WARN`, `level != DEBUG` and `content = *text*`. Aliases may contain dots, such as `app.type`.
- `=~` and `!~` with `operator: '='` for regular expressions, such as `app =~ security` and `content !~ debug`. In `=` mode a field regex matches anywhere in the value, like grep, and `^` or `$` anchor it. In `:` mode field regexes still match the whole value. A comma list may also have spaces before the comma.
- A guided flow in `=` mode: field, then an operator in plain words, then values. Values that contain the typed text follow the ones that start with it, a `*text*` row offers "every app containing text", content and regex operators show a note on what to type, and picking a value goes back to the field list. New `SuggestionList` fields: `extraHead`, `note`, and the `operator` suggestion kind.
- Running a query in `=` mode merges repeated filters on the same field, through the new `engine.combine(query)`.
- `analysis.unknownValues`: values that match no known value, with close matches. The box shows them after a run with one-click fixes, through the new `engine.replaceValue()`. Labels: `unknownValue`, `containing`.
- `onSaveQuery`: a built in "Save query as" popover with a generated name, a pin checkbox and a preview. `onUpdateSaved`: inline edit of a saved query inside the Queries panel. Both show "Saving…" while a returned promise runs and keep the form open with the error if it rejects.
- Field patterns: after `=~` or `!~`, anchor rows for starts with, ends with and is exactly, with the caret placed inside; a live note shows which known values the pattern matches; a pattern that matches nothing gets fixes after a run (`UnknownValue.regex`, `Suggestion.caret`).
- Deleting a saved query asks inside the row first, and a rejected `onDeleteSaved` promise shows its message there.
- `showValueCounts` to hide line counts in value suggestions.
- `classNames` for slot classes, and bar CSS variables.

Fixed:

- Clicking Queries no longer expands or highlights the bar. Only the text box counts as editing.
- In `=` mode, Enter while picking a value ran the half typed value instead of accepting the highlighted suggestion.

Changed:

- `showHelp` and `showLogql` now default to `false`. Pass them to get the Search help link and the LogQL toggle back.

Without `operator: '='`, parsing and compiled queries are identical to 0.3.0.

## 0.3.0

Added:

- With a `parser` on the schema, an OR stays in one query whenever LogQL can express it, so there is nothing to merge, no row repeats, and the branch limit does not apply. An OR that mixes raw line text with a field still splits into branches.
- `parsed: true` on the line field searches the parsed field, such as `content`, instead of the whole raw line. Searching `service` no longer matches every row with a `serviceName` key. Plain words get a fast raw filter first, so Loki skips most lines before parsing them.
- `groups` on a field: `groups: { WARN: ['WARN', 'WARNING'] }` makes `level:warn` cover both stored values.
- `loadValues` on `LogQLQueryBox`: fetches a field's values the first time someone picks one, and aborts when `baseSelector` changes.
- `field` on `SuggestionList`, set while a value is being picked.
- `loadingValues` label.

Changed:

- With `parser: 'json'`, queries now write `| json logLevel, serviceName` instead of `| json`. Rows are the same, and with the `categorize-labels` response flag the response is about 45% smaller. `logfmt` is unchanged.

Without a `parser`, compiled queries are identical to 0.2.0.

## 0.2.0

Added:

- `parser` on the schema: `'json'` or `'logfmt'`. It adds `| json | __error__=""` before field filters, only on queries that need it.
- `baseSelector` on `createEngine` and `LogQLQueryBox`: stream labels added to every query, such as `{ index: 'payments' }`. A schema no longer needs an indexed field when this is set.

Fixed:

- Removing a chip or clearing a field on a query with 120,000 terms took about 11 seconds. It now runs in linear time.

## 0.1.1

Fixed:

- A regex that is valid on Loki, such as `(a+)+b`, could freeze the page in `evaluate()` and `highlightPattern()`. Patterns like this are now detected and not run in the browser.
- The suggestion list is no longer clipped by a parent with `overflow: hidden`, and it opens upward near the bottom of the screen.
- Text contrast now meets WCAG AA in light and dark themes. This changes the default value of `--lqb-faint`.
- Screen readers now hear the filter error and the number of suggestions, and suggestions are grouped under named headings.
- Removing the last chip moves focus to the filter box instead of losing it.
- Very large queries are much faster: 100,000 words dropped from 8 seconds to about 130ms, and 300,000 words no longer fail with a stack error.
- Importing both `logql-query-box` and `logql-query-box/core` no longer bundles the engine twice.

Added:

- `analysis.riskyRegex` and `isRiskyRegex(pattern)`.
- Only the first 50 chips are shown, followed by a count of the rest, so a large paste stays responsive. New labels: `moreFilters` and `suggestionCount`.

## 0.1.0

First release.

- `LogQLQueryBox` React component: suggestions, chips, validation, LogQL preview, search help, recent and saved queries, dark mode.
- Headless engine in `logql-query-box/core`: parser, LogQL compiler, RE2 validation, client side evaluation and query text editing.
- Configurable field schema, with OpenTelemetry style defaults for Loki.
