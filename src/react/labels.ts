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
  loadingValues: string
  moreValues: (count: number) => string
  savedAndRecent: string
  filterPlaceholder: string
  queries: string
  searchSaved: string
  pinnedHead: string
  allSavedHead: string
  pinnedBadge: string
  noSaved: string
  noSavedMatch: string
  loadingSaved: string
  saveShort: string
  createAlert: string
  copyQuery: string
  runQuery: string
  pinShort: string
  unpinShort: string
  editShort: string
  removeShort: string
  pin: (name: string) => string
  unpin: (name: string) => string
  edit: (name: string) => string
  remove: (name: string) => string
  alertFor: (name: string) => string
  unknownValue: (label: string, value: string, negative: boolean, hasMatches: boolean) => string
  containing: (label: string, value: string, negative: boolean) => string
  hiddenFilters: (count: number) => string
  confirmRemove: (name: string) => string
  removing: string
  unknownPattern: (label: string, pattern: string, negative: boolean, hasMatches: boolean) => string
  startingWith: (label: string, value: string, negative: boolean) => string
  saveAs: string
  pinToTop: string
  cancel: string
  update: string
  saving: string
  nameLabel: string
  queryLabel: string
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
  loadingValues: 'Loading values…',
  moreValues: (count) => `${count.toLocaleString('en-US')} more. Keep typing to narrow the list.`,
  savedAndRecent: 'Saved and recent',
  filterPlaceholder: 'Type to filter',
  queries: 'Queries',
  searchSaved: 'Search saved queries',
  pinnedHead: 'Pinned',
  allSavedHead: 'All saved',
  pinnedBadge: 'Pinned',
  noSaved: 'No saved queries yet. Type a filter and press Save.',
  noSavedMatch: 'No saved queries match.',
  loadingSaved: 'Loading saved queries…',
  saveShort: 'Save',
  createAlert: 'Create alert',
  copyQuery: 'Copy query',
  runQuery: 'Run query',
  pinShort: 'Pin',
  unpinShort: 'Unpin',
  editShort: 'Edit',
  removeShort: 'Delete',
  pin: (name) => `Pin ${name}`,
  unpin: (name) => `Unpin ${name}`,
  edit: (name) => `Edit ${name}`,
  remove: (name) => `Delete ${name}`,
  alertFor: (name) => `Create an alert from ${name}`,
  unknownValue: (label, value, negative, hasMatches) => `No ${label} is exactly “${value}”, so ${negative ? 'nothing was excluded' : 'nothing matches it'}.${hasMatches ? ' Did you mean:' : ' Check the spelling.'}`,
  containing: (label, value, negative) => `${negative ? 'Every' : 'Any'} ${label} containing “${value}”`,
  unknownPattern: (label, pattern, negative, hasMatches) => `No ${label} matches “${pattern}”, so ${negative ? 'nothing was excluded' : 'nothing matches it'}. ^ means starts with and $ means ends with.${hasMatches ? ' Did you mean:' : ''}`,
  startingWith: (label, value, negative) => `${negative ? 'Every' : 'Any'} ${label} starting with “${value}”`,
  confirmRemove: (name) => `Delete “${name}”?`,
  removing: 'Deleting…',
  hiddenFilters: (count) => `+${count} ${count === 1 ? 'filter' : 'filters'}`,
  saveAs: 'Save query as',
  pinToTop: 'Pin to the top of Queries',
  cancel: 'Cancel',
  update: 'Update',
  saving: 'Saving…',
  nameLabel: 'Name',
  queryLabel: 'Query'
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
