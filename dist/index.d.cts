import * as react from 'react';
import { ReactNode, CSSProperties } from 'react';

interface FieldDef {
    label: string;
    kind?: 'label' | 'line';
    indexed?: boolean;
    parsed?: boolean;
    aliases?: string[];
    values?: string[];
    synonyms?: Record<string, string>;
    groups?: Record<string, string[]>;
    lowercase?: boolean;
    color?: 'level' | 'hash' | 'accent' | ((value: string) => string);
    hint?: string;
    excludeHint?: string;
    example?: string | ((values: string[]) => string);
}
type LogParser = 'json' | 'logfmt';
interface Schema {
    fields: Record<string, FieldDef>;
    selectorField?: string;
    excludeExample?: string;
    parser?: LogParser;
    operator?: ':' | '=';
}
interface ResolvedField extends Omit<FieldDef, 'synonyms' | 'groups'> {
    name: string;
    kind: 'label' | 'line';
    primary: string;
    synonyms: Map<string, string>;
    groups: Map<string, string[]>;
}
interface ResolvedSchema {
    fields: Map<string, ResolvedField>;
    alias: Map<string, string>;
    lineField: string;
    parsedLine: boolean;
    selectorField: string;
    excludeExample: string;
    parser?: LogParser;
    operator: ':' | '=';
    baseSelector: [string, string][];
}
declare const defaultSchema: Schema;
declare function resolveSchema(schema: Schema, baseSelector?: Record<string, string>): ResolvedSchema;

type Op = 'contains' | 'not_contains' | 'eq' | 'neq' | 'starts' | 'ends' | 'regex' | 'not_regex' | 'in' | 'not_in';
type Span = [number, number];
interface ValuePart {
    v: string;
    wild: boolean;
}
interface Cond {
    id: number;
    type: 'cond';
    field: string;
    op: Op;
    value: string | string[];
    spans?: Span[];
    parts?: ValuePart[];
    anywhere?: boolean;
}
interface Group {
    id: number;
    type: 'group';
    op: 'AND' | 'OR';
    children: QueryNode[];
    spans?: Span[];
}
type QueryNode = Cond | Group;
interface ParseResult {
    root?: Group;
    children: QueryNode[];
    error?: string;
    errorAt?: Span;
}
interface Token {
    t: '(' | ')' | 'or' | 'and' | 'term' | 'skip';
    s: number;
    e: number;
    neg?: boolean;
    field?: string | null;
    kind?: 'word' | 'phrase' | 'regex';
    value?: string;
    parts?: ValuePart[];
    quotes?: Span[];
}
interface TokenizeResult {
    toks: Token[];
    error?: string;
    errorAt?: Span;
    open?: number;
}
interface CompileResult {
    branches: string[];
    tooMany: boolean;
    count: number;
}
type ApiFilter = {
    field: string;
    operator: Op;
    value: string | string[];
} | {
    logic: 'AND' | 'OR';
    filters: ApiFilter[];
};
interface Analysis {
    query: string;
    parsed: ParseResult;
    error: string | null;
    errorAt?: Span;
    fix?: string;
    tree: QueryNode | null;
    logql: CompileResult;
    filter: ApiFilter | null;
    riskyRegex: boolean;
    unknownValues: UnknownValue[];
}
interface UnknownValue {
    field: string;
    value: string;
    negative: boolean;
    matches: string[];
    regex?: boolean;
}
interface SavedQuery {
    id?: string | number;
    name: string;
    query: string;
    pinned?: boolean;
}
interface Suggestion {
    kind: 'field' | 'value' | 'saved' | 'recent' | 'operator';
    label: string;
    hint?: string;
    sub?: string;
    color?: string;
    replace?: [number, number];
    text?: string;
    keep?: boolean;
    caret?: number;
    whole?: string;
}
interface SuggestionList {
    head: string;
    field?: string;
    items: Suggestion[];
    extra: Suggestion[];
    extraHead?: string;
    note?: string;
    search?: string;
    more?: number;
}
interface SuggestExtras {
    saved?: SavedQuery[];
    recent?: string[];
    limit?: number;
}
type FieldValue = string | {
    value: string;
    count?: number;
};
type FieldValues = Record<string, FieldValue[]>;
type LogRecord = Record<string, unknown>;

interface EngineOptions {
    schema?: Schema;
    values?: FieldValues;
    matchCase?: boolean;
    maxBranches?: number;
    baseSelector?: Record<string, string>;
}
interface Engine {
    schema: ResolvedSchema;
    parse(query: string): ParseResult;
    analyze(query: string): Analysis;
    validate(query: string): string;
    compile(tree: QueryNode | null): CompileResult;
    evaluate(tree: QueryNode | null, record: LogRecord): boolean;
    activeTree(node: QueryNode): QueryNode | null;
    chipText(node: QueryNode): string;
    isNegative(node: QueryNode): boolean;
    highlightPattern(tree: QueryNode | null): RegExp | null;
    suggest(query: string, caret: number, extras?: SuggestExtras): SuggestionList;
    tokenAt(query: string, caret: number): string;
    removeNode(query: string, node: QueryNode): string;
    appendTerm(query: string, field: string, values: string[], negative?: boolean): string;
    toggleValue(query: string, field: string, value: string, negative?: boolean): string;
    clearField(query: string, field: string): string;
    combine(query: string): string;
    replaceValue(query: string, field: string, from: string, to: string, negative?: boolean): string;
    activeValues(query: string, field: string, negative?: boolean): Set<string>;
}
declare function createEngine(options?: EngineOptions): Engine;

declare const MAX_BRANCHES = 12;
declare function logqlString(s: string): string;

declare const MAX_DEPTH = 100;

declare const UNSUPPORTED_REGEX = "Loki uses RE2, which does not support lookaround or backreferences.";
declare const INVALID_REGEX = "This is not a valid regular expression.";
declare function regexProblem(p: string): string | null;
declare function regexError(p: string): {
    reason: string;
    at: number;
    unsupported: boolean;
} | null;
declare function isRiskyRegex(p: string): boolean;
declare function toJsRegex(p: string, ci: boolean, anchored: boolean): RegExp;
declare function reEsc(s: string): string;

declare function chipText(n: QueryNode, schema: ResolvedSchema): string;
declare function chipLabel(text: string): string;

declare function quoteValue(v: string): string;

declare function tokenize(src: string, schema: ResolvedSchema): TokenizeResult;

declare function listOf(c: Cond): string[];
declare function valOf(c: Cond): string;

interface Labels {
    placeholder: string;
    ariaLabel: string;
    description: string;
    help: string;
    helpTitle: string;
    helpClose: string;
    helpSyntax: string;
    helpCombine: string;
    helpKeyboard: string;
    clear: string;
    clearAria: string;
    save: string;
    savedAs: (name: string) => string;
    execute: string;
    showLogql: string;
    hideLogql: string;
    logQuery: string;
    branch: (index: number, total: number) => string;
    copy: string;
    copied: string;
    copyFailed: string;
    mergeNote: string;
    tryLabel: string;
    fixFilter: string;
    filterChanged: string;
    removeFilter: (text: string) => string;
    moreFilters: (count: number) => string;
    suggestionCount: (count: number) => string;
    loadingValues: string;
    moreValues: (count: number) => string;
    useFix: (query: string) => string;
    savedAndRecent: string;
    filterPlaceholder: string;
    queries: string;
    searchSaved: string;
    pinnedHead: string;
    allSavedHead: string;
    pinnedBadge: string;
    noSaved: string;
    noSavedMatch: string;
    loadingSaved: string;
    saveShort: string;
    createAlert: string;
    copyQuery: string;
    runQuery: string;
    pinShort: string;
    unpinShort: string;
    editShort: string;
    removeShort: string;
    pin: (name: string) => string;
    unpin: (name: string) => string;
    edit: (name: string) => string;
    remove: (name: string) => string;
    alertFor: (name: string) => string;
    unknownValue: (label: string, value: string, negative: boolean, hasMatches: boolean) => string;
    containing: (label: string, value: string, negative: boolean) => string;
    hiddenFilters: (count: number) => string;
    confirmRemove: (name: string) => string;
    removing: string;
    unknownPattern: (label: string, pattern: string, negative: boolean, hasMatches: boolean) => string;
    startingWith: (label: string, value: string, negative: boolean) => string;
    saveAs: string;
    pinToTop: string;
    cancel: string;
    update: string;
    saving: string;
    nameLabel: string;
    queryLabel: string;
}
declare const defaultLabels: Labels;
declare const defaultExamples: string[];
declare const defaultSyntax: [string, string][];
declare const defaultNotes: string[];

interface LogQLQueryBoxHandle {
    focus(): void;
    getQuery(): string;
    setQuery(query: string, options?: {
        run?: boolean;
    }): void;
    execute(): boolean;
    toggleValue(field: string, value: string, negative?: boolean): void;
    clearField(field: string): void;
    appendTerm(field: string, values: string[], negative?: boolean): void;
    openQueries(): void;
    closeQueries(): void;
}
type LogQLQueryBoxSlot = 'bar' | 'field' | 'input' | 'queriesButton' | 'queriesPanel' | 'suggestions' | 'run';
interface LogQLQueryBoxProps {
    variant?: 'classic' | 'bar';
    classNames?: Partial<Record<LogQLQueryBoxSlot, string>>;
    showQueries?: boolean;
    showRun?: boolean;
    showValueCounts?: boolean;
    savedCount?: number;
    savedLoading?: boolean;
    onSelectSaved?: (saved: SavedQuery) => void;
    onPinSaved?: (saved: SavedQuery, pinned: boolean) => void;
    onEditSaved?: (saved: SavedQuery) => void;
    onUpdateSaved?: (saved: SavedQuery, changes: {
        name: string;
        query: string;
    }) => unknown;
    onSaveQuery?: (draft: {
        name: string;
        query: string;
        pinned: boolean;
    }, existing?: SavedQuery) => unknown;
    onDeleteSaved?: (saved: SavedQuery) => void;
    onCreateAlert?: (query: string, saved?: SavedQuery) => void;
    onSavedSearch?: (text: string) => void;
    value?: string;
    defaultValue?: string;
    onChange?: (query: string, analysis: Analysis) => void;
    onExecute?: (analysis: Analysis) => void;
    onSave?: (query: string, existing?: SavedQuery) => void;
    engine?: Engine;
    schema?: Schema;
    values?: FieldValues;
    loadValues?: (field: string, context: {
        signal: AbortSignal;
        search: string;
    }) => Promise<FieldValue[]>;
    searchValues?: boolean;
    maxSuggestions?: number;
    matchCase?: boolean;
    maxBranches?: number;
    baseSelector?: Record<string, string>;
    saved?: SavedQuery[];
    recent?: string[];
    recentStorageKey?: string | null;
    examples?: string[];
    syntax?: [string, string][];
    notes?: string[];
    labels?: Partial<Labels>;
    description?: ReactNode | false;
    actions?: ReactNode;
    statusText?: ReactNode;
    dirty?: boolean;
    running?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    rows?: number;
    showHelp?: boolean;
    showLogql?: boolean;
    defaultLogqlOpen?: boolean;
    executeOnMount?: boolean;
    globalShortcuts?: boolean;
    theme?: 'auto' | 'light' | 'dark';
    className?: string;
    style?: CSSProperties;
}
declare const LogQLQueryBox: react.ForwardRefExoticComponent<LogQLQueryBoxProps & react.RefAttributes<LogQLQueryBoxHandle>>;

export { INVALID_REGEX, LogQLQueryBox, MAX_BRANCHES, MAX_DEPTH, UNSUPPORTED_REGEX, chipLabel, chipText, createEngine, defaultExamples, defaultLabels, defaultNotes, defaultSchema, defaultSyntax, isRiskyRegex, listOf, logqlString, quoteValue, reEsc, regexError, regexProblem, resolveSchema, toJsRegex, tokenize, valOf };
export type { Analysis, ApiFilter, CompileResult, Cond, Engine, EngineOptions, FieldDef, FieldValue, FieldValues, Group, Labels, LogParser, LogQLQueryBoxHandle, LogQLQueryBoxProps, LogQLQueryBoxSlot, LogRecord, Op, ParseResult, QueryNode, ResolvedField, ResolvedSchema, SavedQuery, Schema, Span, SuggestExtras, Suggestion, SuggestionList, Token, UnknownValue, ValuePart };
