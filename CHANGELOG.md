# Changelog

## 0.6.0

Upgrading from 0.5.x:

- The bar variant now lays `=` mode queries out one filter per line (`stacked`, on by default). The text that `onChange`, `onExecute` and saved queries receive contains line breaks and aligned spaces, and the compiled LogQL is the same. Pass `stacked={false}` to keep one line.
- Picking a value from the list no longer ends the term, and Enter takes the highlighted row, so press Escape and then Enter (or Cmd/Ctrl+Enter) to run while the list is open.
- `engine.combine()` writes `a, b` with a space after the comma.
- New schema options: `icon`, `valueIcons` and `freeText`. `freeText: false` is off by default, so plain words still search.

Changed:

- In `=` mode, picking a value no longer ends the term. The caret stays right after it and the list switches to "Add another app" with the values not yet chosen, so a second value is one click away, including after backspacing onto a finished value. Type a space to move on to the next field. Enter and Tab only take one of these rows after an arrow key.
- Comma lists in `=` mode are written with a space after each comma, `app = loans-service, accounts-service`, by the list, by `engine.combine()` and by facet edits. `combine()` also rewrites hand typed lists and drops a dangling comma, and the box runs it when it loses focus as well as on every run. The LogQL does not change, and `:` mode keeps `a,b`.
- In the bar, a value that matches nothing opens a card instead of a yellow strip: a warning tile, the title with the value in a chip ("No app matches `^accounts$`"), a short explanation, a dismiss button, then a "Did you mean" list whose rows show what the fix does and the resulting term (`app = accounts-service`). Enter applies the highlighted fix, the arrows move, Escape dismisses. The card replaces the suggestion list while it is showing. The starts-with fix keeps the regex and drops the closing anchor (`app =~ ^accounts`) instead of rewriting it as a wildcard. The classic variant keeps the inline notice.
- Everything in the bar's card (headers, notes, hints, keycaps, notice) uses the bar's own font and size, with tighter row spacing. The first row of "Add another app" is highlighted like every other list, with the `Enter` chip, and Enter adds it. Escape closes the list, so Escape then Enter runs the query. Tab no longer adds a value from that list.
- New `stacked` prop for the bar with `operator: '='`, on by default (`stacked={false}` keeps the text on one line, as before): the text is laid out one filter per line with the operators lined up and a comma after each value list (`app     = accounts-service, loans-service,` then `level   = WARN`). It is applied when the query runs, when the box loses focus, and as you pick fields, operators and values from the list, so the text looks the same before and after a run. A query with free text, parentheses, OR/AND or a minus sign is left as typed. `engine.stack(query)` does the layout. A comma is only written after a value list, because a comma after a text or regex filter would become part of it.
- The closed summary joins filters with a space instead of ", " (with `stacked`, ", " as in the text), so it matches the text you edit. A trailing comma is no longer shown twice.
- Values already used in the query for a field are left out of that field's list, so `accounts-service` is not offered again when `app = accounts-service` is already there.
- The "no match" card is shorter: no `^`/`$` explanation, and the fix rows show only the title.
- The suggestion list now follows the bar when the bar changes height (undo, delete, a longer query), through a `ResizeObserver`, so it no longer overlaps the bar or floats far below it. The "no match" card also sits 2px under the bar.
- The closed summary counts one filter per line in the stacked layout, so a value with spaces, such as `content =~ check: active=2 idle=8 w`, no longer shows as "+4 filters".
- The "no match" card's warning icon is smaller (14px in a 24px tile) and lines up with the row icons.
- After `=~` or `!~` every field, including the log line (`content`), offers the same Pattern rows (`^ …`, `… $`, `^ … $`). For the log line the hints read "Line starts with ..." and the note suggests a pattern such as `timeout|refused`. Before, only fields with a value list got them.
- `engine.highlightPattern()` follows `matchCase`: it is case-insensitive by default, like the search, and exact-case when the engine is created with `matchCase: true`, except for a pattern that asks for it with `(?i)`, which is highlighted case-insensitively even then. Before it ignored both. A query that mixes the two modes uses a `(?i:...)` group, or falls back to case-insensitive in a browser without them.
- After `=~` or `!~` the pattern list has a second group, Combining text, under the Position rows: `… | …` (either), `… .* …` (both, in order), `\b … \b` (whole word), `(?i) …` (ignore case) and `\Q … \E` (plain text). The first group is now headed Position. Each row puts the caret where the text goes, and the same rows appear for every field.
- The bar's Queries panel and "Save query as" popover use the compact reference sizes: a 380px panel with a 12px search row, 10px upper case group headings, rows of a 12px bold name (pin icon 11px) over an 11px mono query with 24px hover actions beside them, and a 280px save popover with 12px labels, a 13px name field and 24px Cancel and Save buttons. The rows are a flex line now, so the actions no longer sit on top of the text.
- In `=` mode a name that is not a field, used with an operator (`nnjnd = ncjsndjc`), is now an error that lists the fields and says to quote the text to search for it. Before it was read as three words to search for, so the query ran and found nothing. `key=value` written without spaces is still plain text, since that is common in logs.
- Saved queries in the bar's Queries panel and the "Save query as" preview are shown in a box, with field names coloured, on one line with a trailing ellipsis. A name that is too long is cut to one line instead of wrapping. The pin sits on the right and gives way to the action buttons on hover, which are tinted: blue pin, amber alert, green edit, red delete.
- New schema option `freeText: false` (bar variant, `=` mode): a bare word or phrase is not run as a text search. The box holds the query and shows the "This is not a field" card with a one-click "Search the log text for ..." fix that rewrites it as `content = ...`, and Enter applies it. Run shows the card again if it was dismissed. `analysis.freeText` reports it. Off by default, so plain words still search the log text.
- The invalid-query message in the bar is a white card with a red icon instead of a red border around the bar and a red box. The bar keeps its normal border. A saved query's name, query and the four action buttons: the buttons take space only on hover, so the name and query use the full row until then. They are plain icons without colour or background, with a dark tooltip (Pin, Create alert, Edit, Delete) instead of the browser one. When a row is cut off, hovering it shows the full name and query. The boxed query has a filter icon, also in the Save popover.
- The clear and copy buttons in the bar use the same dark tooltip as the Queries panel, now a little smaller (11px, 10px for the query), and the copy tooltip changes to Copied.
- The highlight follows the mouse: hovering a row in the bar's list or in the "Did you mean" card makes it the highlighted row, with the `Enter` chip, so Enter takes the row under the pointer.
- The bar's suggestion list is a card: upper case section headers with an "N available" count, an icon on every row, the highlighted row in the accent colour with an `Enter` chip, and a footer such as "Press Esc to go back to fields" with the keys drawn as keycaps. Enter now picks the highlighted field or operator in `=` mode, and Esc on a value list that has nothing typed removes the dangling `level = ` and returns to the field list. The list sits 2px under the bar instead of 6px.
- New schema options `icon` and `valueIcons` choose the row icons from a built-in set (`tag`, `lines`, `bars`, `cube`, `code`, `trace`, `span`, `error`, `warn`, `info`, `terminal`, `pulse`). Fields without a known value list show "Type the traceId you want. Use * as a wildcard." In `=` mode the field list follows the schema order, so the line field no longer always comes last.
- In the bar variant the "No app matches ..." notice and the invalid query message float directly under the bar, inside the same layer, instead of sitting in the page flow below it. In a fixed height toolbar the in-flow notice made the row taller than its container, so the bar jumped up and the notice drew over the stat tiles. The notice no longer changes any layout, follows the bar when it grows, is as wide as the bar or wider (up to 560px, growing leftwards), and has a Dismiss button. It comes back for the next run.
- `color: 'level'` now looks the colour up in lower case, so upper case values such as `ERROR` get `--lqb-lv-error`.
- The bar's suggestion headers are sentence case, `Values for app`, instead of upper case letter-spaced text that shouted the field name.

## 0.5.5

Added:

- `--lqb-bar-font-size` and `--lqb-bar-font-weight` on `.lqb-v-bar` set both the query text in the bar and the suggestion values under it, so they always match. Defaults 14px and 400, as before.

Fixed:

- The bar's clear and copy buttons size and centre themselves from `--lqb-bar-height` (`--lqb-bar-btn`, at most 30px). They sat a pixel low at the default height, and in a bar shorter than 38px they made the bar grow taller and pushed the Queries button off centre.

## 0.5.4

Changed:

- Versions are staged by the `Publish` GitHub Actions workflow with npm provenance, through trusted publishing limited to `npm stage publish`, and go live after a maintainer approves them with 2FA. `npm audit signatures` verifies them, and the npm page links each version to its commit and workflow run. A local `npm publish` now stops with a message.

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
