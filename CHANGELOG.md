# Changelog

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
