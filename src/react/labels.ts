export interface Labels {
  placeholder: string
  ariaLabel: string
  description: string
  help: string
  helpTitle: string
  helpClose: string
  helpSyntax: string
  helpCombine: string
  helpKeyboard: string
  clear: string
  clearAria: string
  save: string
  savedAs: (name: string) => string
  execute: string
  showLogql: string
  hideLogql: string
  logQuery: string
  branch: (index: number, total: number) => string
  copy: string
  copied: string
  copyFailed: string
  mergeNote: string
  tryLabel: string
  fixFilter: string
  filterChanged: string
  removeFilter: (text: string) => string
  moreFilters: (count: number) => string
  suggestionCount: (count: number) => string
  savedAndRecent: string
}

export const defaultLabels: Labels = {
  placeholder: 'Filter your logs, for example: timeout level:error -debug',
  ariaLabel: 'Filter your logs',
  description: 'Build log queries using filters, operators, and real-time search conditions.',
  help: 'Search help',
  helpTitle: 'Search help',
  helpClose: 'Close help',
  helpSyntax: 'Search syntax (click an example to run it)',
  helpCombine: 'How filters combine',
  helpKeyboard: 'Keyboard',
  clear: 'Clear',
  clearAria: 'Clear the filter',
  save: 'Save this filter',
  savedAs: (name) => `Already saved as “${name}”. Click to edit it`,
  execute: 'Execute',
  showLogql: 'Show LogQL',
  hideLogql: 'Hide LogQL',
  logQuery: 'Log query',
  branch: (index, total) => `Branch ${index} of ${total}`,
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  mergeNote: 'Each branch is a separate Loki query. Merge the results and remove duplicates.',
  tryLabel: 'Try',
  fixFilter: 'Fix the filter before running it.',
  filterChanged: 'Filter changed. Press Execute.',
  removeFilter: (text) => `Remove filter ${text}`,
  moreFilters: (count) => `+${count} more`,
  suggestionCount: (count) => `${count} ${count === 1 ? 'suggestion' : 'suggestions'} available`,
  savedAndRecent: 'Saved and recent'
}

export const defaultExamples = ['level:error,warn', 'level:error (timeout OR refused)', 'apptype:java /\\w+Exception/', '-level:debug']

export const defaultSyntax: [string, string][] = [
  ['timeout', 'Lines that contain the word (not case sensitive)'],
  ['"connection refused"', 'An exact phrase'],
  ['-debug', 'Lines that do not contain it'],
  ['/\\w+Exception/', 'A regular expression'],
  ['level:error,warn', 'Log level is error or warn'],
  ['level:error level:warn', 'Same field twice means OR'],
  ['-level:debug', 'Exclude a log level'],
  ['app:checkout-*', 'App name with a wildcard'],
  ['apptype:java', 'App type'],
  ['level:error (timeout OR refused)', 'Group with OR and parentheses'],
  ['-(timeout OR refused)', 'Exclude a whole group']
]

export const defaultNotes: string[] = [
  'Different fields are combined with AND. `level:error app:checkout-api` returns error lines from that app only.',
  'The same field repeated is combined with OR. `level:error level:warn` is the same as `level:error,warn`.',
  'Words in the content are combined with AND. `timeout refused` needs both words. Use `timeout OR refused` for either one.',
  'A leading `-` means NOT. `-level:debug` hides debug lines, `-timeout` hides lines containing timeout, and `-app:a,b` hides both apps.',
  'Use parentheses to group: `level:error (timeout OR refused)`.'
]
