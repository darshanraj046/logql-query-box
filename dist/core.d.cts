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

export { INVALID_REGEX, MAX_BRANCHES, MAX_DEPTH, UNSUPPORTED_REGEX, chipLabel, chipText, createEngine, defaultSchema, isRiskyRegex, listOf, logqlString, quoteValue, reEsc, regexError, regexProblem, resolveSchema, toJsRegex, tokenize, valOf };
export type { Analysis, ApiFilter, CompileResult, Cond, Engine, EngineOptions, FieldDef, FieldValue, FieldValues, Group, LogParser, LogRecord, Op, ParseResult, QueryNode, ResolvedField, ResolvedSchema, SavedQuery, Schema, Span, SuggestExtras, Suggestion, SuggestionList, Token, UnknownValue, ValuePart };
