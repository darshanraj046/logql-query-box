"use client";

// src/react/LogQLQueryBox.tsx
import { forwardRef, useEffect as useEffect2, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef as useRef2, useState } from "react";
import { chipLabel, createEngine, reEsc } from "./core.js";

// src/react/HelpDialog.tsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { jsx, jsxs } from "react/jsx-runtime";
function withCode(text) {
  return text.split(/`([^`]+)`/).map((piece, i) => i % 2 ? /* @__PURE__ */ jsx("code", { children: piece }, i) : piece);
}
function HelpDialog({ labels, rootClass, rootStyle, theme, syntax, notes, shortcuts, onPick, onClose }) {
  const closeRef = useRef(null);
  const sheetRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !sheetRef.current) return;
    const focusable = sheetRef.current.querySelectorAll("button");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return createPortal(
    /* @__PURE__ */ jsx(
      "div",
      {
        className: `${rootClass} lqb-modal`,
        style: rootStyle,
        "data-lqb-theme": theme,
        onKeyDown,
        onMouseDown: (e) => {
          if (e.target === e.currentTarget) onClose();
        },
        children: /* @__PURE__ */ jsxs("div", { className: "lqb-sheet", ref: sheetRef, role: "dialog", "aria-modal": "true", "aria-label": labels.helpTitle, children: [
          /* @__PURE__ */ jsxs("h2", { children: [
            labels.helpTitle,
            /* @__PURE__ */ jsx("button", { type: "button", className: "lqb-x", ref: closeRef, "aria-label": labels.helpClose, onClick: onClose, children: "\xD7" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: labels.helpSyntax }),
            /* @__PURE__ */ jsx("div", { className: "lqb-cheat", children: syntax.map(([q, text]) => /* @__PURE__ */ jsxs("div", { className: "lqb-cheat-row", children: [
              /* @__PURE__ */ jsx("button", { type: "button", onClick: () => onPick(q), children: q }),
              /* @__PURE__ */ jsx("span", { children: text })
            ] }, q)) })
          ] }),
          notes.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: labels.helpCombine }),
            /* @__PURE__ */ jsx("ul", { className: "lqb-notes", children: notes.map((n) => /* @__PURE__ */ jsx("li", { children: withCode(n) }, n)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h3", { children: labels.helpKeyboard }),
            /* @__PURE__ */ jsxs("div", { className: "lqb-keys", children: [
              shortcuts && /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "Focus the filter box" }),
                /* @__PURE__ */ jsx("kbd", { children: "/" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "Run the search" }),
                /* @__PURE__ */ jsx("kbd", { children: "Enter" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "Run exactly what you typed" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  /* @__PURE__ */ jsx("kbd", { children: "Ctrl" }),
                  " ",
                  /* @__PURE__ */ jsx("kbd", { children: "Enter" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "New line" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  /* @__PURE__ */ jsx("kbd", { children: "Shift" }),
                  " ",
                  /* @__PURE__ */ jsx("kbd", { children: "Enter" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "Accept a suggestion" }),
                /* @__PURE__ */ jsx("kbd", { children: "Tab" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "Move through suggestions" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  /* @__PURE__ */ jsx("kbd", { children: "\u2191" }),
                  " ",
                  /* @__PURE__ */ jsx("kbd", { children: "\u2193" })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("span", { children: "Close suggestions or this help" }),
                /* @__PURE__ */ jsx("kbd", { children: "Esc" })
              ] })
            ] })
          ] })
        ] })
      }
    ),
    document.body
  );
}

// src/react/icons.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var FIELD_ICONS = {
  tag: /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2("path", { d: "M3 12V4h8l10 10-8 8z" }),
    /* @__PURE__ */ jsx2("circle", { cx: "7.5", cy: "8.5", r: "1" })
  ] }),
  error: /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ jsx2("path", { d: "M9 9l6 6M15 9l-6 6" })
  ] }),
  warn: /* @__PURE__ */ jsx2("path", { d: "M12 4l9 16H3zM12 10v4M12 17.2v.1" }),
  info: /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ jsx2("path", { d: "M12 11v5M12 7.8v.1" })
  ] }),
  terminal: /* @__PURE__ */ jsx2("path", { d: "M5 8l4 4-4 4M12 17h7" }),
  pulse: /* @__PURE__ */ jsx2("path", { d: "M3 12h4l3-7 4 14 3-7h4" }),
  asterisk: /* @__PURE__ */ jsx2("path", { d: "M12 4v16M5 8l14 8M19 8L5 16" }),
  bars: /* @__PURE__ */ jsx2("path", { d: "M5 20v-6M12 20V6M19 20v-10" }),
  cube: /* @__PURE__ */ jsx2("path", { d: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" }),
  code: /* @__PURE__ */ jsx2("path", { d: "M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" }),
  lines: /* @__PURE__ */ jsx2("path", { d: "M4 7h16M4 12h16M4 17h10" }),
  trace: /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2("circle", { cx: "6", cy: "5", r: "2" }),
    /* @__PURE__ */ jsx2("circle", { cx: "18", cy: "19", r: "2" }),
    /* @__PURE__ */ jsx2("path", { d: "M8 5h5a3 3 0 010 6h-2a3 3 0 000 6h5" })
  ] }),
  span: /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx2("rect", { x: "3", y: "4", width: "10", height: "4", rx: "1" }),
    /* @__PURE__ */ jsx2("rect", { x: "8", y: "10", width: "13", height: "4", rx: "1" }),
    /* @__PURE__ */ jsx2("rect", { x: "5", y: "16", width: "9", height: "4", rx: "1" })
  ] })
};

// src/react/labels.ts
var defaultLabels = {
  placeholder: "Filter your logs, for example: timeout level:error -debug",
  ariaLabel: "Filter your logs",
  description: "Build log queries using filters, operators, and real-time search conditions.",
  help: "Search help",
  helpTitle: "Search help",
  helpClose: "Close help",
  helpSyntax: "Search syntax (click an example to run it)",
  helpCombine: "How filters combine",
  helpKeyboard: "Keyboard",
  clear: "Clear",
  clearAria: "Clear the filter",
  save: "Save this filter",
  savedAs: (name) => `Already saved as \u201C${name}\u201D. Click to edit it`,
  execute: "Execute",
  showLogql: "Show LogQL",
  hideLogql: "Hide LogQL",
  logQuery: "Log query",
  branch: (index, total) => `Branch ${index} of ${total}`,
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  mergeNote: "Each branch is a separate Loki query. Merge the results and remove duplicates.",
  tryLabel: "Try",
  fixFilter: "Fix the filter before running it.",
  filterChanged: "Filter changed. Press Execute.",
  removeFilter: (text) => `Remove filter ${text}`,
  moreFilters: (count) => `+${count} more`,
  suggestionCount: (count) => `${count} ${count === 1 ? "suggestion" : "suggestions"} available`,
  loadingValues: "Loading values\u2026",
  useFix: (query) => `Change the filter to ${query} and run it`,
  moreValues: (count) => `${count.toLocaleString("en-US")} more. Keep typing to narrow the list.`,
  available: (count) => `${count.toLocaleString("en-US")} available`,
  dismiss: "Dismiss",
  notFoundTitle: (label, regex) => regex ? `No ${label} matches` : `No ${label} is exactly`,
  notFoundBody: (_label, value, regex, negative, hasMatches) => {
    if (regex) return negative && !/^\^[\w.-]+\$$/.test(value) ? "Nothing was excluded." : "";
    return `${negative ? "Nothing was excluded." : ""}${hasMatches ? "" : `${negative ? " " : ""}Check the spelling.`}`;
  },
  didYouMean: "Did you mean",
  notFieldTitle: "This is not a field",
  notFieldBody: "",
  fixSearchText: (value) => `Search the log text for ${value}`,
  fixUse: (value) => `Use \u201C${value}\u201D`,
  fixStarting: (label, value, negative) => `${negative ? "Exclude" : "Match"} every ${label} starting with \u201C${value}\u201D`,
  fixContaining: (label, value, negative) => `${negative ? "Exclude" : "Match"} every ${label} containing \u201C${value}\u201D`,
  savedAndRecent: "Saved and recent",
  filterPlaceholder: "Type to filter",
  queries: "Queries",
  searchSaved: "Search saved queries",
  pinnedHead: "Pinned",
  allSavedHead: "All saved",
  pinnedBadge: "Pinned",
  noSaved: "No saved queries yet. Type a filter and press Save.",
  noSavedMatch: "No saved queries match.",
  loadingSaved: "Loading saved queries\u2026",
  saveShort: "Save",
  createAlert: "Create alert",
  copyQuery: "Copy query",
  runQuery: "Run query",
  pinShort: "Pin",
  unpinShort: "Unpin",
  editShort: "Edit",
  removeShort: "Delete",
  pin: (name) => `Pin ${name}`,
  unpin: (name) => `Unpin ${name}`,
  edit: (name) => `Edit ${name}`,
  remove: (name) => `Delete ${name}`,
  alertFor: (name) => `Create an alert from ${name}`,
  unknownValue: (label, value, negative, hasMatches) => `No ${label} is exactly \u201C${value}\u201D${negative ? ", so nothing was excluded" : ""}.${hasMatches ? " Did you mean:" : " Check the spelling."}`,
  containing: (label, value, negative) => `${negative ? "Every" : "Any"} ${label} containing \u201C${value}\u201D`,
  unknownPattern: (label, pattern, negative, hasMatches) => `No ${label} matches \u201C${pattern}\u201D${negative ? ", so nothing was excluded" : ""}. ^ means starts with and $ means ends with.${hasMatches ? " Did you mean:" : ""}`,
  startingWith: (label, value, negative) => `${negative ? "Every" : "Any"} ${label} starting with \u201C${value}\u201D`,
  confirmRemove: (name) => `Delete \u201C${name}\u201D?`,
  removing: "Deleting\u2026",
  hiddenFilters: (count) => `+${count} ${count === 1 ? "filter" : "filters"}`,
  saveAs: "Save query as",
  pinToTop: "Pin to the top of Queries",
  cancel: "Cancel",
  update: "Update",
  saving: "Saving\u2026",
  nameLabel: "Name",
  queryLabel: "Query"
};
var defaultExamples = ["level:error,warn", "level:error (timeout OR refused)", "apptype:java /\\w+Exception/", "-level:debug"];
var defaultSyntax = [
  ["timeout", "Lines that contain the word (not case sensitive)"],
  ['"connection refused"', "An exact phrase"],
  ["-debug", "Lines that do not contain it"],
  ["/\\w+Exception/", "A regular expression"],
  ["level:error,warn", "Log level is error or warn"],
  ["level:error level:warn", "Same field twice means OR"],
  ["-level:debug", "Exclude a log level"],
  ["app:checkout-*", "App name with a wildcard"],
  ["apptype:java", "App type"],
  ["level:error (timeout OR refused)", "Group with OR and parentheses"],
  ["-(timeout OR refused)", "Exclude a whole group"]
];
var defaultNotes = [
  "Different fields are combined with AND. `level:error app:checkout-api` returns error lines from that app only.",
  "The same field repeated is combined with OR. `level:error level:warn` is the same as `level:error,warn`.",
  "Words in the content are combined with AND. `timeout refused` needs both words. Use `timeout OR refused` for either one.",
  "A leading `-` means NOT. `-level:debug` hides debug lines, `-timeout` hides lines containing timeout, and `-app:a,b` hides both apps.",
  "Use parentheses to group: `level:error (timeout OR refused)`."
];

// src/react/LogQLQueryBox.tsx
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var useIsoLayoutEffect = typeof window === "undefined" ? useEffect2 : useLayoutEffect;
var RECENT_LIMIT = 8;
var CHIP_LIMIT = 50;
var MENU_GAP = 6;
var LIST_GAP = 2;
var MENU_MAX = 360;
var MENU_MIN = 120;
var SEARCH_DELAY = 250;
var ICON = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
function readRecent(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeRecent(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    return;
  }
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
var LogQLQueryBox = forwardRef(function LogQLQueryBox2(props, ref) {
  const {
    value,
    defaultValue = "",
    onChange,
    onExecute,
    onSave,
    schema,
    values,
    loadValues,
    searchValues = false,
    maxSuggestions = 100,
    matchCase,
    maxBranches,
    baseSelector,
    saved,
    recent,
    recentStorageKey = "logql-query-box.recent",
    examples,
    syntax,
    notes,
    description,
    actions,
    statusText,
    dirty = false,
    running = false,
    disabled = false,
    readOnly = false,
    autoFocus = false,
    variant = "classic",
    classNames = {},
    showQueries = true,
    showRun = true,
    showValueCounts = true,
    stacked = true,
    savedCount,
    savedLoading = false,
    onSelectSaved,
    onPinSaved,
    onEditSaved,
    onUpdateSaved,
    onSaveQuery,
    onDeleteSaved,
    onCreateAlert,
    onSavedSearch,
    showHelp = false,
    showLogql = false,
    defaultLogqlOpen = false,
    executeOnMount = false,
    globalShortcuts = false,
    theme = "auto",
    className,
    style
  } = props;
  const bar = variant === "bar";
  const stack = bar && stacked;
  const rows = props.rows ?? (bar ? 1 : 2);
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const baseKey = JSON.stringify(baseSelector);
  const [loaded, setLoaded] = useState({});
  const [loading, setLoading] = useState([]);
  const allValues = useMemo(() => ({ ...values, ...loaded }), [values, loaded]);
  const engine = useMemo(() => props.engine ?? createEngine({ schema, values: allValues, matchCase, maxBranches, baseSelector }), [props.engine, schema, allValues, matchCase, maxBranches, baseKey]);
  const controlled = value !== void 0;
  const [inner, setInner] = useState(defaultValue);
  const query = controlled ? value : inner;
  const [ran, setRan] = useState(query);
  const [checked, setChecked] = useState(null);
  const [menu, setMenu] = useState(null);
  const [logqlOpen, setLogqlOpen] = useState(defaultLogqlOpen);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const [storedRecent, setStoredRecent] = useState([]);
  const [focused, setFocused] = useState(false);
  const [qOpen, setQOpen] = useState(false);
  const [qText, setQText] = useState("");
  const [muted, setMuted] = useState(null);
  const [tip, setTip] = useState(null);
  const tipRef = useRef2(null);
  const [fixAt, setFixAt] = useState(0);
  const qBtnRef = useRef2(null);
  const qPanelRef = useRef2(null);
  const hlRef = useRef2(null);
  const inputRef = useRef2(null);
  const helpButtonRef = useRef2(null);
  const wrapRef = useRef2(null);
  const listRef = useRef2(null);
  const pendingCaret = useRef2(null);
  const copyTimer = useRef2(void 0);
  const mountRan = useRef2(false);
  const loader = useRef2(loadValues);
  const requested = useRef2(/* @__PURE__ */ new Set());
  const cache = useRef2(/* @__PURE__ */ new Map());
  const latest = useRef2(/* @__PURE__ */ new Map());
  const loadAbort = useRef2(null);
  loader.current = loadValues;
  const baseId = useId();
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const optionId = (i) => `${baseId}-opt-${i}`;
  const analysis = useMemo(() => engine.analyze(query), [engine, query]);
  const recentList = recent ?? storedRecent;
  const interactive = !disabled && !readOnly;
  const sugg = useMemo(
    () => menu && interactive ? engine.suggest(query, menu.caret, bar ? { limit: maxSuggestions } : { saved, recent: recentList, limit: maxSuggestions }) : null,
    [menu, interactive, engine, query, saved, recentList, bar, maxSuggestions]
  );
  const items = useMemo(() => sugg ? [...sugg.items, ...sugg.extra] : [], [sugg]);
  const open = items.length > 0;
  const at = menu ? Math.min(menu.at, items.length - 1) : -1;
  const valueField = sugg?.field;
  const search = searchValues && valueField ? sugg?.search ?? "" : "";
  const waiting = !!valueField && loading.includes(valueField);
  const note = sugg?.note ?? (bar && analysis.error ? analysis.error : void 0);
  const unknown = query === checked && muted !== query && interactive ? analysis.unknownValues[0] : void 0;
  const unknownField = unknown ? engine.schema.fields.get(unknown.field) : void 0;
  const unknownLabel = unknown ? unknownField?.label ?? unknown.field : "";
  const unknownLit = unknown ? unknown.value.replace(/^\^/, "").replace(/\$$/, "") : "";
  const unknownAt = unknown ? query.lastIndexOf(unknown.value) : -1;
  const fieldRe = useMemo(
    () => new RegExp(
      `(?<![\\w.-])(${[...engine.schema.fields.values()].map((f) => f.label).sort((a, b) => b.length - a.length).map(reEsc).join("|")})(?![\\w.-])`
    ),
    [engine]
  );
  const tint = (text) => {
    const m = fieldRe.exec(text);
    return m ? /* @__PURE__ */ jsxs3(Fragment2, { children: [
      text.slice(0, m.index),
      /* @__PURE__ */ jsx3("span", { className: "lqb-nf-f", children: m[0] }),
      text.slice(m.index + m[0].length)
    ] }) : text;
  };
  const notFoundBody = unknown ? labels.notFoundBody(unknownLabel, unknown.value, !!unknown.regex, unknown.negative, unknown.matches.length > 0) : "";
  const loose = query === checked && muted !== query && interactive && bar ? analysis.freeText : void 0;
  const fixes = loose ? [{ title: labels.fixSearchText(loose.value), icon: "lines", next: loose.fix }] : unknown ? [
    ...unknown.matches.map((v) => ({ title: labels.fixUse(v), icon: unknownField?.icon ?? "tag", next: engine.replaceValue(query, unknown.field, unknown.value, v, unknown.negative) })),
    ...unknown.regex && unknownAt >= 0 && /^\^[\w.-]+\$?$/.test(unknown.value) && unknown.matches.length > 0 ? [{ title: labels.fixStarting(unknownLabel, unknownLit, unknown.negative), icon: "asterisk", next: query.slice(0, unknownAt) + `^${unknownLit}` + query.slice(unknownAt + unknown.value.length) }] : [],
    ...unknown.matches.length > 1 ? [{ title: labels.fixContaining(unknownLabel, unknownLit, unknown.negative), icon: "asterisk", next: engine.replaceValue(query, unknown.field, unknown.value, `*${unknownLit}*`, unknown.negative) }] : []
  ] : [];
  const noticeOpen = bar && (!!unknown || !!loose);
  const shown = !noticeOpen && (open || waiting || !!note);
  const pickedFix = Math.min(fixAt, fixes.length - 1);
  const usable = (text) => [...text.matchAll(/(?:^|[\s(`-])([A-Za-z_][A-Za-z0-9_]*):/g)].every((m) => engine.schema.alias.has(m[1].toLowerCase()));
  const shownExamples = examples ?? defaultExamples.filter(usable);
  const shownSyntax = syntax ?? defaultSyntax.filter((s) => usable(s[0]));
  const shownNotes = notes ?? defaultNotes.filter(usable);
  useEffect2(() => {
    if (recent === void 0 && recentStorageKey) setStoredRecent(readRecent(recentStorageKey));
  }, [recent, recentStorageKey]);
  useEffect2(() => {
    const controller = new AbortController();
    loadAbort.current = controller;
    requested.current.clear();
    cache.current.clear();
    latest.current.clear();
    setLoaded((x) => Object.keys(x).length ? {} : x);
    setLoading((x) => x.length ? [] : x);
    return () => controller.abort();
  }, [baseKey]);
  useEffect2(() => {
    const load = loader.current;
    const controller = loadAbort.current;
    if (!valueField || !load || !controller || props.engine) return;
    const field = valueField;
    const key = searchValues ? `${field}\0${search}` : field;
    latest.current.set(field, key);
    const hit = cache.current.get(key);
    if (hit) {
      setLoaded((x) => x[field] === hit ? x : { ...x, [field]: hit });
      setLoading((x) => x.includes(field) ? x.filter((f) => f !== field) : x);
      return;
    }
    if (requested.current.has(key)) return;
    const finish = (list) => {
      if (controller.signal.aborted) return;
      if (Array.isArray(list)) cache.current.set(key, list);
      else requested.current.delete(key);
      if (latest.current.get(field) !== key) return;
      if (Array.isArray(list)) setLoaded((x) => ({ ...x, [field]: list }));
      setLoading((x) => x.filter((f) => f !== field));
    };
    const run = () => {
      requested.current.add(key);
      setLoading((x) => x.includes(field) ? x : [...x, field]);
      Promise.resolve().then(() => load(field, { signal: controller.signal, search })).then(finish, () => finish());
    };
    if (!searchValues) return run();
    const timer = setTimeout(run, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [valueField, baseKey, props.engine, searchValues, search]);
  useIsoLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    const el = inputRef.current;
    const pos = pendingCaret.current;
    pendingCaret.current = null;
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
  });
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    if (!shown || !list || !("showPopover" in list)) return;
    list.setAttribute("popover", "manual");
    list.showPopover();
  }, [shown]);
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    const anchor = wrapRef.current;
    if (!shown || !list || !anchor) return;
    const place = () => {
      const box = anchor.getBoundingClientRect();
      const below = window.innerHeight - box.bottom - MENU_GAP * 2;
      const above = box.top - MENU_GAP * 2;
      const upward = below < Math.min(list.scrollHeight, MENU_MAX) && above > below;
      list.style.left = `${box.left}px`;
      list.style.width = `${box.width}px`;
      list.style.top = upward ? "auto" : `${box.bottom + LIST_GAP}px`;
      list.style.bottom = upward ? `${window.innerHeight - box.top + LIST_GAP}px` : "auto";
      list.style.maxHeight = `${Math.max(MENU_MIN, Math.min(MENU_MAX, upward ? above : below))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const watch = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(place);
    watch?.observe(anchor);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      watch?.disconnect();
    };
  }, [shown, items, waiting]);
  const [draft, setDraft] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [editing, setEditing] = useState(null);
  const saveBtnRef = useRef2(null);
  const savePopRef = useRef2(null);
  const expanded = bar && (focused || !!draft) && !qOpen && !!query;
  const showTip = (el, title, body) => {
    const r = el.getBoundingClientRect();
    setTip({ title, body, x: r.left + r.width / 2, y: r.bottom + 6, el });
  };
  useIsoLayoutEffect(() => {
    const el = tipRef.current;
    if (!tip || !el) return;
    if ("showPopover" in el && !el.matches(":popover-open")) {
      el.setAttribute("popover", "manual");
      el.showPopover();
    }
    const w = el.offsetWidth;
    el.style.left = `${Math.max(8, Math.min(tip.x - w / 2, window.innerWidth - w - 8))}px`;
    el.style.top = `${tip.y}px`;
  }, [tip]);
  useEffect2(() => {
    if (!qOpen) setTip(null);
  }, [qOpen]);
  useEffect2(() => {
    if (tip && !tip.el.isConnected) setTip(null);
  });
  useEffect2(() => {
    if (qOpen) return;
    setEditing(null);
    setRemoving(null);
  }, [qOpen]);
  useIsoLayoutEffect(() => {
    const pop = savePopRef.current;
    const btn = saveBtnRef.current;
    if (!draft || !pop || !btn) return;
    if ("showPopover" in pop && !pop.matches(":popover-open")) {
      pop.setAttribute("popover", "manual");
      pop.showPopover();
    }
    const place = () => {
      const box = btn.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 16);
      pop.style.width = `${width}px`;
      pop.style.left = `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`;
      pop.style.top = `${box.bottom + MENU_GAP}px`;
    };
    place();
    const outside = (e) => {
      const t = e.target;
      if (!pop.contains(t) && !btn.contains(t)) setDraft(null);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", outside);
    };
  }, [!!draft]);
  const summarize = bar && !expanded && !!query;
  const sumRef = useRef2(null);
  const [fit, setFit] = useState({ hidden: 0, over: false });
  useIsoLayoutEffect(() => {
    const el = sumRef.current;
    if (!summarize || !el) return;
    const measure = () => {
      const width = el.clientWidth;
      let hidden = 0;
      el.querySelectorAll(".lqb-piece").forEach((p) => {
        if (p.offsetLeft + p.offsetWidth > width + 1) hidden++;
      });
      const over = el.scrollWidth > width + 1;
      setFit((f) => f.hidden === hidden && f.over === over ? f : { hidden, over });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [summarize, query]);
  useIsoLayoutEffect(() => {
    const el = inputRef.current;
    if (!bar || !el) return;
    el.style.height = "";
    if (expanded) el.style.height = `${Math.min(260, Math.max(el.scrollHeight, el.offsetHeight))}px`;
  }, [bar, expanded, query]);
  useIsoLayoutEffect(() => {
    const panel = qPanelRef.current;
    const btn = qBtnRef.current;
    if (!qOpen || !panel || !btn) return;
    if ("showPopover" in panel) {
      panel.setAttribute("popover", "manual");
      panel.showPopover();
    }
    const place = () => {
      const box = btn.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 16);
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8))}px`;
      panel.style.top = `${box.bottom + MENU_GAP + 4}px`;
      panel.style.maxHeight = `${Math.max(200, Math.min(520, window.innerHeight - box.bottom - MENU_GAP * 3))}px`;
    };
    place();
    const outside = (e) => {
      const t = e.target;
      if (!panel.contains(t) && !btn.contains(t)) setQOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", outside);
    };
  }, [qOpen]);
  useEffect2(() => {
    if (!open || at < 0) return;
    document.getElementById(optionId(at))?.scrollIntoView?.({ block: "nearest" });
  }, [open, at]);
  useEffect2(() => () => clearTimeout(copyTimer.current), []);
  const change = (next) => {
    if (!controlled) setInner(next);
    onChange?.(next, engine.analyze(next));
  };
  const remember = (q) => {
    const text = q.trim();
    if (!text || recent !== void 0 || !recentStorageKey) return;
    const next = [text, ...readRecent(recentStorageKey).filter((x) => x !== text)].slice(0, RECENT_LIMIT);
    writeRecent(recentStorageKey, next);
    setStoredRecent(next);
  };
  const execute = (raw = query) => {
    const merged = engine.schema.operator === "=" ? engine.combine(raw) : raw;
    const q = stack ? engine.stack(merged) : merged;
    const result = engine.analyze(q);
    if (result.error) return false;
    if (bar && result.freeText) {
      if (q !== raw) change(q);
      setFixAt(0);
      setMuted(null);
      setChecked(q);
      return false;
    }
    if (q !== raw) change(q);
    setFixAt(0);
    setRan(q);
    setChecked(q);
    remember(q);
    onExecute?.(result);
    return true;
  };
  const commit = (q) => {
    change(q);
    execute(q);
  };
  const openMenu = () => {
    const el = inputRef.current;
    if (!el || !interactive) return;
    setMenu({ caret: el.selectionStart ?? el.value.length, at: 0 });
  };
  const accept = (i) => {
    const it = items[i];
    if (!it) return;
    if (it.whole != null) {
      setMenu(null);
      commit(it.whole);
      return;
    }
    const [s, e] = it.replace;
    const text = it.text;
    const next = query.slice(0, s) + text + query.slice(e);
    const laid = stack && it.caret == null && e >= query.length ? engine.stack(next) : next;
    const pos = laid !== next ? laid.length : s + (it.caret ?? text.length);
    pendingCaret.current = pos;
    change(laid);
    setMenu(it.keep ? { caret: pos, at: 0 } : null);
  };
  const currentToken = () => engine.tokenAt(query, inputRef.current?.selectionStart ?? query.length);
  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (noticeOpen && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "Escape" || fixes.length > 0 && ["ArrowDown", "ArrowUp", "Enter"].includes(e.key))) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "ArrowDown") setFixAt((pickedFix + 1) % fixes.length);
      else if (e.key === "ArrowUp") setFixAt((pickedFix - 1 + fixes.length) % fixes.length);
      else if (e.key === "Escape") setMuted(query);
      else commit(fixes[pickedFix].next);
      return;
    }
    if (e.key === "ArrowDown") {
      if (open) {
        e.preventDefault();
        setMenu((m) => m && { ...m, at: (at + 1) % items.length });
      } else if (!query.includes("\n")) {
        e.preventDefault();
        openMenu();
      }
    } else if (e.key === "ArrowUp") {
      if (open) {
        e.preventDefault();
        setMenu((m) => m && { ...m, at: (at - 1 + items.length) % items.length });
      }
    } else if (e.key === "Tab") {
      if (open && !e.shiftKey && !sugg?.finished && (currentToken() || items[at]?.kind === "operator")) {
        e.preventDefault();
        accept(at);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const it = open && !e.metaKey && !e.ctrlKey ? items[at] : void 0;
      const cur = currentToken();
      if (engine.schema.operator === "=" && (it?.kind === "operator" || it?.kind === "field" && (!!cur || !query.trim()))) accept(at);
      else if (it?.kind === "value" && (cur.indexOf(":") > 0 || engine.schema.operator === "=" && cur.indexOf("=") > 0) && it.text?.trim() !== cur) accept(at);
      else if (it?.whole != null && !cur && !query.trim()) accept(at);
      else {
        setMenu(null);
        if (!running) execute();
      }
    } else if (e.key === "Escape") {
      if (shown && sugg?.back) {
        e.stopPropagation();
        const [s, end] = sugg.back;
        pendingCaret.current = s;
        change(query.slice(0, s) + query.slice(end));
        setMenu({ caret: s, at: 0 });
      } else if (shown) {
        e.stopPropagation();
        setMenu(null);
      } else {
        inputRef.current?.blur();
      }
    }
  };
  useEffect2(() => {
    if (!globalShortcuts) return;
    const handler = (e) => {
      const target = e.target;
      const tag = (target.tagName || "").toLowerCase();
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "?" && showHelp) {
        setHelpOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [globalShortcuts, showHelp]);
  useEffect2(() => {
    if (!executeOnMount || mountRan.current) return;
    mountRan.current = true;
    execute(query);
  });
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    getQuery: () => query,
    setQuery: (q, options) => options?.run === false ? change(q) : commit(q),
    execute: () => execute(),
    toggleValue: (field, v, negative) => commit(engine.toggleValue(query, field, v, negative)),
    clearField: (field) => commit(engine.clearField(query, field)),
    appendTerm: (field, list, negative) => commit(engine.appendTerm(query, field, list, negative)),
    openQueries: () => setQOpen(true),
    closeQueries: () => setQOpen(false)
  }));
  const savedMatch = query.trim() ? saved?.find((s) => s.query.trim() === query.trim()) : void 0;
  const isDirty = query !== ran || dirty;
  const blocked = !!analysis.error;
  const status = blocked ? labels.fixFilter : statusText ?? (query !== ran ? labels.filterChanged : "");
  const closeHelp = () => {
    setHelpOpen(false);
    helpButtonRef.current?.focus();
  };
  const copyBranch = async (index, text) => {
    const ok = await copyText(text);
    clearTimeout(copyTimer.current);
    setCopied({ index, text: ok ? labels.copied : labels.copyFailed });
    copyTimer.current = setTimeout(() => setCopied(null), 1300);
    return ok;
  };
  const rootClass = ["lqb", className].filter(Boolean).join(" ");
  const themeAttr = theme === "auto" ? void 0 : theme;
  const blurb = description === void 0 ? labels.description : description;
  const row = (it, i) => {
    const selected = i === at;
    return /* @__PURE__ */ jsxs3(
      "div",
      {
        className: "lqb-sg",
        role: "option",
        id: optionId(i),
        "aria-selected": selected,
        onMouseMove: () => i !== at && setMenu((m) => m && { ...m, at: i }),
        onMouseDown: (e) => {
          e.preventDefault();
          accept(i);
        },
        children: [
          it.icon && FIELD_ICONS[it.icon] && /* @__PURE__ */ jsx3("span", { className: "lqb-sg-ic", "aria-hidden": "true", style: it.iconColor ? { color: it.iconColor } : void 0, children: /* @__PURE__ */ jsx3("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: FIELD_ICONS[it.icon] }) }),
          it.color && /* @__PURE__ */ jsx3("i", { style: { "--lqb-c": it.color } }),
          /* @__PURE__ */ jsx3("code", { children: it.label }),
          it.sub && /* @__PURE__ */ jsx3("span", { className: "lqb-hint lqb-sub", children: it.sub }),
          /* @__PURE__ */ jsx3("span", { className: "lqb-hint", children: it.kind === "value" && !showValueCounts ? "" : it.hint ?? "" }),
          bar && selected && it.kind === "value" && /* @__PURE__ */ jsx3("kbd", { className: "lqb-key", children: "Enter" })
        ]
      },
      `${it.kind}-${it.label}-${i}`
    );
  };
  const textarea = /* @__PURE__ */ jsx3(
    "textarea",
    {
      ref: inputRef,
      rows,
      className: classNames.input,
      role: "combobox",
      "aria-expanded": shown,
      "aria-controls": shown ? listId : void 0,
      "aria-activedescendant": open && at >= 0 ? optionId(at) : void 0,
      "aria-autocomplete": "list",
      "aria-label": labels.ariaLabel,
      "aria-invalid": blocked || void 0,
      "aria-describedby": blocked ? errorId : void 0,
      placeholder: bar && !props.labels?.placeholder ? labels.filterPlaceholder : labels.placeholder,
      spellCheck: false,
      autoComplete: "off",
      autoFocus,
      disabled,
      readOnly,
      value: query,
      onChange: (e) => {
        change(e.target.value);
        if (interactive) setMenu({ caret: e.target.selectionStart ?? e.target.value.length, at: 0 });
      },
      onFocus: () => {
        setFocused(true);
        openMenu();
      },
      onClick: openMenu,
      onBlur: () => {
        setFocused(false);
        setMenu(null);
        const merged = engine.schema.operator === "=" ? engine.combine(query) : query;
        const tidy = stack ? engine.stack(merged) : merged;
        if (tidy !== query) change(tidy);
      },
      onKeyDown,
      onKeyUp: (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") openMenu();
      },
      onScroll: (e) => {
        if (hlRef.current) hlRef.current.scrollTop = e.currentTarget.scrollTop;
      }
    }
  );
  const suggestions = shown && sugg && /* @__PURE__ */ jsxs3("div", { className: ["lqb-sugg", classNames.suggestions].filter(Boolean).join(" "), ref: listRef, id: listId, role: "listbox", "aria-label": labels.ariaLabel, onMouseDown: (e) => e.preventDefault(), children: [
    sugg.items.length > 0 && /* @__PURE__ */ jsxs3("div", { role: "group", "aria-label": sugg.head || labels.ariaLabel, children: [
      sugg.head && /* @__PURE__ */ jsxs3("div", { className: "lqb-sg-h", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsx3("span", { children: tint(sugg.head) }),
        sugg.count != null && /* @__PURE__ */ jsx3("span", { className: "lqb-sg-count", children: labels.available(sugg.count) })
      ] }),
      sugg.items.map((it, i) => row(it, i))
    ] }),
    !!sugg.more && /* @__PURE__ */ jsx3("div", { className: "lqb-sg-note lqb-sg-more", children: labels.moreValues(sugg.more) }),
    sugg.extra.length > 0 && /* @__PURE__ */ jsxs3("div", { role: "group", "aria-label": sugg.extraHead ?? labels.savedAndRecent, children: [
      /* @__PURE__ */ jsx3("div", { className: "lqb-sg-h", "aria-hidden": "true", children: sugg.extraHead ?? labels.savedAndRecent }),
      sugg.extra.map((it, i) => row(it, i + sugg.items.length))
    ] }),
    note && /* @__PURE__ */ jsx3("div", { className: sugg.note ? sugg.note.startsWith("Press ") ? "lqb-sg-note lqb-sg-keys" : "lqb-sg-note" : "lqb-sg-note lqb-sg-err", children: sugg.note?.startsWith("Press ") ? sugg.note.split(/\[([^\]]*)\]/).map((p, k) => k % 2 ? /* @__PURE__ */ jsx3("kbd", { children: p }, k) : p) : note }),
    waiting && /* @__PURE__ */ jsx3("div", { className: "lqb-sg-h", "aria-hidden": "true", children: labels.loadingValues })
  ] });
  const liveRegion = /* @__PURE__ */ jsx3("span", { className: "lqb-sr", "aria-live": "polite", children: waiting ? labels.loadingValues : open ? labels.suggestionCount(items.length) : note ?? "" });
  const dismiss = /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-unknown-x", "aria-label": labels.dismiss, title: labels.dismiss, onMouseDown: (e) => e.preventDefault(), onClick: () => setMuted(query), children: /* @__PURE__ */ jsx3("svg", { ...ICON, width: 14, height: 14, children: /* @__PURE__ */ jsx3("path", { d: "M6 6l12 12M18 6L6 18" }) }) });
  const unknownBox = (unknown || loose) && (bar ? /* @__PURE__ */ jsxs3("div", { className: "lqb-nf", role: "status", onMouseDown: (e) => e.preventDefault(), children: [
    /* @__PURE__ */ jsxs3("div", { className: "lqb-nf-head", children: [
      /* @__PURE__ */ jsx3("span", { className: "lqb-nf-ic", "aria-hidden": "true", children: /* @__PURE__ */ jsx3("svg", { ...ICON, width: 14, height: 14, children: FIELD_ICONS.warn }) }),
      /* @__PURE__ */ jsxs3("div", { className: "lqb-nf-text", children: [
        /* @__PURE__ */ jsxs3("div", { className: "lqb-nf-title", children: [
          unknown ? tint(labels.notFoundTitle(unknownLabel, !!unknown.regex)) : labels.notFieldTitle,
          " ",
          /* @__PURE__ */ jsx3("code", { children: unknown ? unknown.value : loose?.value })
        ] }),
        (unknown ? notFoundBody : labels.notFieldBody) && /* @__PURE__ */ jsx3("div", { className: "lqb-nf-desc", children: (unknown ? notFoundBody : labels.notFieldBody).split(/`([^`]*)`/).map((p, k) => k % 2 ? /* @__PURE__ */ jsx3("code", { children: p }, k) : p) })
      ] }),
      dismiss
    ] }),
    fixes.length > 0 && /* @__PURE__ */ jsxs3("div", { role: "group", "aria-label": labels.didYouMean, children: [
      /* @__PURE__ */ jsx3("div", { className: "lqb-sg-h", "aria-hidden": "true", children: labels.didYouMean }),
      fixes.map((f, i) => /* @__PURE__ */ jsxs3(
        "div",
        {
          className: "lqb-sg lqb-nf-fix",
          role: "button",
          "aria-pressed": i === pickedFix,
          "data-selected": i === pickedFix || void 0,
          onMouseMove: () => i !== pickedFix && setFixAt(i),
          onMouseDown: (e) => {
            e.preventDefault();
            commit(f.next);
          },
          children: [
            /* @__PURE__ */ jsx3("span", { className: "lqb-sg-ic", "aria-hidden": "true", children: /* @__PURE__ */ jsx3("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: FIELD_ICONS[f.icon] }) }),
            /* @__PURE__ */ jsx3("span", { className: "lqb-nf-fix-text", children: /* @__PURE__ */ jsx3("span", { className: "lqb-nf-fix-title", children: tint(f.title) }) }),
            i === pickedFix && /* @__PURE__ */ jsx3("kbd", { className: "lqb-key", children: "Enter" })
          ]
        },
        f.title
      ))
    ] })
  ] }) : unknown && !(shown && sugg) && /* @__PURE__ */ jsxs3("div", { className: "lqb-unknown", role: "status", children: [
    /* @__PURE__ */ jsx3("span", { children: tint(unknown.regex ? labels.unknownPattern(unknownLabel, unknown.value, unknown.negative, unknown.matches.length > 0) : labels.unknownValue(unknownLabel, unknown.value, unknown.negative, unknown.matches.length > 0)) }),
    unknown.matches.map((v) => /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-fix", onClick: () => commit(engine.replaceValue(query, unknown.field, unknown.value, v, unknown.negative)), children: v }, v)),
    unknown.regex && /^\^[\w.-]+\$?$/.test(unknown.value) && unknown.matches.length > 0 && /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-fix", onClick: () => commit(engine.replaceValue(query, unknown.field, unknown.value, `${unknownLit}*`, unknown.negative)), children: tint(labels.startingWith(unknownLabel, unknownLit, unknown.negative)) }),
    unknown.matches.length > 1 && /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-fix", onClick: () => commit(engine.replaceValue(query, unknown.field, unknown.value, `*${unknownLit}*`, unknown.negative)), children: tint(labels.containing(unknownLabel, unknownLit, unknown.negative)) }),
    dismiss
  ] }));
  const errorBox = analysis.error && /* @__PURE__ */ jsxs3("div", { className: "lqb-error", id: errorId, role: "alert", children: [
    bar && /* @__PURE__ */ jsx3("span", { className: "lqb-nf-ic lqb-err-ic", "aria-hidden": "true", children: /* @__PURE__ */ jsx3("svg", { ...ICON, width: 14, height: 14, children: FIELD_ICONS.error }) }),
    /* @__PURE__ */ jsx3("span", { className: "lqb-err-text", children: analysis.error }),
    analysis.fix != null && interactive && /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-fix", "aria-label": labels.useFix(analysis.fix), onClick: () => commit(analysis.fix), children: analysis.fix })
  ] });
  const logqlPanel = showLogql && logqlOpen && !analysis.error && /* @__PURE__ */ jsxs3("div", { className: "lqb-logql", children: [
    analysis.logql.branches.map((branch, i) => /* @__PURE__ */ jsxs3("div", { children: [
      /* @__PURE__ */ jsxs3("div", { className: "lqb-pre-h", children: [
        /* @__PURE__ */ jsx3("span", { children: analysis.logql.branches.length > 1 ? labels.branch(i + 1, analysis.logql.branches.length) : labels.logQuery }),
        /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-mini", onClick: () => copyBranch(i, branch), children: copied?.index === i ? copied.text : labels.copy })
      ] }),
      /* @__PURE__ */ jsx3("pre", { children: branch })
    ] }, i)),
    analysis.logql.branches.length > 1 && /* @__PURE__ */ jsx3("p", { className: "lqb-note", children: labels.mergeNote })
  ] });
  const logqlToggle = showLogql && /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-link", "aria-expanded": logqlOpen, onClick: () => setLogqlOpen((x) => !x), children: logqlOpen ? labels.hideLogql : labels.showLogql });
  const helpButton = showHelp && /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-link", ref: helpButtonRef, onClick: () => setHelpOpen(true), children: labels.help });
  const runButton = /* @__PURE__ */ jsxs3("button", { type: "button", className: [isDirty || blocked ? "lqb-run" : "lqb-run lqb-run-idle", classNames.run].filter(Boolean).join(" "), disabled: blocked || disabled || running, onClick: () => execute(), children: [
    /* @__PURE__ */ jsx3("svg", { ...ICON, width: 14, height: 14, children: /* @__PURE__ */ jsx3("path", { d: "M7 4l13 8-13 8z" }) }),
    bar ? labels.runQuery : labels.execute
  ] });
  const helpDialog = helpOpen && /* @__PURE__ */ jsx3(
    HelpDialog,
    {
      labels,
      rootClass,
      rootStyle: style,
      theme: themeAttr,
      syntax: shownSyntax,
      notes: shownNotes,
      shortcuts: globalShortcuts,
      onPick: (q) => {
        setHelpOpen(false);
        commit(q);
      },
      onClose: closeHelp
    }
  );
  if (bar) {
    const needle = qText.trim().toLowerCase();
    const matches = (saved ?? []).filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.query.toLowerCase().includes(needle));
    const pinnedList = matches.filter((s) => s.pinned);
    const restList = matches.filter((s) => !s.pinned);
    const count = savedCount ?? saved?.length ?? 0;
    const keep = (e) => e.preventDefault();
    const paint = (text, key) => {
      const out = [];
      let last = 0;
      for (const m of text.matchAll(/(^|[\s(,])(-?)([A-Za-z_][A-Za-z0-9_.]*)(\s*(?:!=|!~|=~|=|:))/g)) {
        if (!engine.schema.alias.has(m[3].toLowerCase())) continue;
        const s = m.index + m[1].length + m[2].length;
        out.push(
          text.slice(last, s),
          /* @__PURE__ */ jsx3("span", { className: "lqb-hl-f", children: m[3] }, `${key}${s}`),
          /* @__PURE__ */ jsx3("span", { className: "lqb-hl-op", children: m[4] }, `${key}${s}o`)
        );
        last = s + m[3].length + m[4].length;
      }
      out.push(text.slice(last));
      return out;
    };
    const bad = analysis.errorAt;
    const hl = bad ? [
      ...paint(query.slice(0, bad[0]), "q"),
      /* @__PURE__ */ jsx3("span", { className: "lqb-hl-bad", children: paint(query.slice(bad[0], bad[1]), "b") }, "bad"),
      ...paint(query.slice(bad[1]), "r"),
      "\u200B"
    ] : [...paint(query, "q"), "\u200B"];
    const flat = (text) => text.replace(/\s+/g, " ").trim();
    const raw = stack && !bad && query.includes("\n") ? query.split("\n").map(flat).filter(Boolean) : !bad && analysis.parsed.children.length ? analysis.parsed.children.map((n) => flat(n.spans.map(([a, b]) => query.slice(a, b)).join(" "))) : [flat(query)];
    const pieces = raw.map((l) => l.replace(/,$/, ""));
    const autoName = analysis.parsed.children.map((n) => n.type === "cond" ? n.parts ? n.parts.map((p) => p.v).join(", ") : String(n.value) : engine.chipText(n)).filter(Boolean).join(" \xB7 ").slice(0, 80);
    const failed = (e) => e instanceof Error ? e.message : String(e);
    const submitDraft = () => {
      if (!draft || draft.busy || !onSaveQuery || !draft.name.trim() || blocked) return;
      const next = { name: draft.name.trim(), query, pinned: draft.pinned };
      setDraft({ ...draft, busy: true, error: "" });
      Promise.resolve().then(() => onSaveQuery(next, savedMatch)).then(
        () => setDraft(null),
        (e) => setDraft((d) => d && { ...d, busy: false, error: failed(e) })
      );
    };
    const submitEdit = (s) => {
      if (!editing || editing.busy || !onUpdateSaved || !editing.name.trim() || !editing.query.trim() || engine.analyze(editing.query).error) return;
      const changes = { name: editing.name.trim(), query: editing.query };
      setEditing({ ...editing, busy: true, error: "" });
      Promise.resolve().then(() => onUpdateSaved(s, changes)).then(
        () => setEditing(null),
        (e) => setEditing((d) => d && { ...d, busy: false, error: failed(e) })
      );
    };
    const confirmRemove = (s) => {
      if (!removing || removing.busy || !onDeleteSaved) return;
      setRemoving({ ...removing, busy: true, error: "" });
      Promise.resolve().then(() => onDeleteSaved(s)).then(
        () => setRemoving(null),
        (e) => setRemoving((d) => d && { ...d, busy: false, error: failed(e) })
      );
    };
    const item = (s) => removing?.key === (s.id ?? s.name) ? /* @__PURE__ */ jsxs3(
      "div",
      {
        className: "lqb-q-confirm",
        role: "group",
        "aria-label": labels.confirmRemove(s.name),
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setRemoving(null);
          }
        },
        children: [
          /* @__PURE__ */ jsx3("span", { children: removing.error || labels.confirmRemove(s.name) }),
          /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-btn lqb-btn-danger", disabled: removing.busy, onClick: () => confirmRemove(s), children: removing.busy ? labels.removing : labels.removeShort }),
          /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-btn lqb-btn-outline", autoFocus: true, onClick: () => setRemoving(null), children: labels.cancel })
        ]
      },
      s.id ?? s.name
    ) : editing?.key === (s.id ?? s.name) ? /* @__PURE__ */ jsxs3(
      "div",
      {
        className: "lqb-q-edit",
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(null);
          } else if (e.key === "Enter" && !e.shiftKey && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            submitEdit(s);
          }
        },
        children: [
          /* @__PURE__ */ jsx3("input", { className: "lqb-input", "aria-label": labels.nameLabel, autoFocus: true, value: editing.name, onFocus: (e) => e.currentTarget.select(), onChange: (e) => setEditing({ ...editing, name: e.target.value }) }),
          /* @__PURE__ */ jsx3("textarea", { className: "lqb-q-edit-query", "aria-label": labels.queryLabel, rows: 3, spellCheck: false, value: editing.query, onChange: (e) => setEditing({ ...editing, query: e.target.value }) }),
          (editing.error || engine.analyze(editing.query).error) && /* @__PURE__ */ jsx3("div", { className: "lqb-error", children: editing.error || engine.analyze(editing.query).error }),
          /* @__PURE__ */ jsxs3("div", { className: "lqb-pop-acts", children: [
            /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-btn", onClick: () => setEditing(null), children: labels.cancel }),
            /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-btn lqb-btn-primary", disabled: editing.busy || !editing.name.trim() || !editing.query.trim() || !!engine.analyze(editing.query).error, onClick: () => submitEdit(s), children: editing.busy ? labels.saving : labels.saveShort })
          ] })
        ]
      },
      s.id ?? s.name
    ) : /* @__PURE__ */ jsxs3("div", { className: "lqb-q-item", children: [
      /* @__PURE__ */ jsxs3(
        "button",
        {
          type: "button",
          className: "lqb-q-main",
          onMouseEnter: (e) => {
            const b = e.currentTarget;
            const cut = [...b.querySelectorAll(".lqb-q-name, .lqb-q-text")].some((n) => n.scrollWidth > n.clientWidth);
            if (cut) showTip(b, s.name, s.query.replace(/\s+/g, " ").trim());
          },
          onMouseLeave: () => setTip(null),
          onClick: () => {
            setQOpen(false);
            setQText("");
            commit(s.query);
            onSelectSaved?.(s);
          },
          children: [
            /* @__PURE__ */ jsx3("span", { className: "lqb-q-name", children: s.name }),
            /* @__PURE__ */ jsxs3("code", { className: "lqb-q-query", children: [
              /* @__PURE__ */ jsx3("svg", { ...ICON, className: "lqb-q-ic", width: 12, height: 12, children: /* @__PURE__ */ jsx3("path", { d: "M3 5h18l-7 8v6l-4 2v-8z" }) }),
              /* @__PURE__ */ jsx3("span", { className: "lqb-q-text", children: paint(s.query.replace(/\s+/g, " ").trim(), `q${s.id ?? s.name}`) })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs3("span", { className: "lqb-q-end", children: [
        s.pinned && /* @__PURE__ */ jsx3("svg", { ...ICON, className: "lqb-q-pin", width: 14, height: 14, "aria-label": labels.pinnedBadge, role: "img", children: /* @__PURE__ */ jsx3("path", { d: "M9 3h6l-1 6 4 4H6l4-4zM12 13v8", fill: "currentColor" }) }),
        interactive && (onPinSaved || onCreateAlert || onEditSaved || onUpdateSaved || onDeleteSaved) && /* @__PURE__ */ jsxs3("span", { className: "lqb-q-acts", children: [
          onPinSaved && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              className: "lqb-icon-btn lqb-act-pin",
              "aria-label": s.pinned ? labels.unpin(s.name) : labels.pin(s.name),
              onMouseEnter: (e) => showTip(e.currentTarget, s.pinned ? labels.unpinShort : labels.pinShort),
              onFocus: (e) => showTip(e.currentTarget, s.pinned ? labels.unpinShort : labels.pinShort),
              onMouseLeave: () => setTip(null),
              onBlur: () => setTip(null),
              onClick: () => (setTip(null), onPinSaved(s, !s.pinned)),
              children: /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: s.pinned ? "M9 3h6l-1 6 4 4H6l4-4zM12 13v8M4 4l16 16" : "M9 3h6l-1 6 4 4H6l4-4zM12 13v8" }) })
            }
          ),
          onCreateAlert && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              className: "lqb-icon-btn lqb-act-alert",
              "aria-label": labels.alertFor(s.name),
              onMouseEnter: (e) => showTip(e.currentTarget, labels.createAlert),
              onFocus: (e) => showTip(e.currentTarget, labels.createAlert),
              onMouseLeave: () => setTip(null),
              onBlur: () => setTip(null),
              onClick: () => (setTip(null), onCreateAlert(s.query, s)),
              children: /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" }) })
            }
          ),
          (onEditSaved || onUpdateSaved) && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              className: "lqb-icon-btn lqb-act-edit",
              "aria-label": labels.edit(s.name),
              onMouseEnter: (e) => showTip(e.currentTarget, labels.editShort),
              onFocus: (e) => showTip(e.currentTarget, labels.editShort),
              onMouseLeave: () => setTip(null),
              onBlur: () => setTip(null),
              onClick: () => (setTip(null), onUpdateSaved ? setEditing({ key: s.id ?? s.name, name: s.name, query: s.query, error: "", busy: false }) : onEditSaved?.(s)),
              children: /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" }) })
            }
          ),
          onDeleteSaved && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              className: "lqb-icon-btn lqb-danger",
              "aria-label": labels.remove(s.name),
              onMouseEnter: (e) => showTip(e.currentTarget, labels.removeShort),
              onFocus: (e) => showTip(e.currentTarget, labels.removeShort),
              onMouseLeave: () => setTip(null),
              onBlur: () => setTip(null),
              onClick: () => (setTip(null), setRemoving({ key: s.id ?? s.name, error: "", busy: false })),
              children: /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" }) })
            }
          )
        ] })
      ] })
    ] }, s.id ?? s.name);
    return /* @__PURE__ */ jsxs3("div", { className: `${rootClass} lqb-v-bar`, style, "data-lqb-theme": themeAttr, "aria-busy": running || void 0, children: [
      blurb !== false && description !== void 0 && /* @__PURE__ */ jsx3("p", { className: "lqb-desc", children: blurb }),
      /* @__PURE__ */ jsxs3("div", { className: "lqb-bar-row", children: [
        /* @__PURE__ */ jsx3("div", { className: "lqb-bar-slot", children: /* @__PURE__ */ jsxs3("div", { className: "lqb-bar-layer", children: [
          /* @__PURE__ */ jsxs3("div", { ref: wrapRef, className: ["lqb-bar", classNames.bar].filter(Boolean).join(" "), "data-open": expanded || void 0, "data-focus": focused || void 0, "data-invalid": blocked || void 0, children: [
            /* @__PURE__ */ jsxs3("div", { className: ["lqb-field", classNames.field].filter(Boolean).join(" "), onMouseDown: (e) => e.target === e.currentTarget && (keep(e), inputRef.current?.focus()), children: [
              /* @__PURE__ */ jsx3("svg", { ...ICON, className: "lqb-funnel", children: /* @__PURE__ */ jsx3("path", { d: "M3 5h18l-7 8v6l-4 2v-8z" }) }),
              /* @__PURE__ */ jsxs3("div", { className: "lqb-edit", children: [
                summarize ? /* @__PURE__ */ jsx3("div", { className: "lqb-summary", ref: sumRef, "data-overflow": fit.over || void 0, "aria-hidden": "true", children: pieces.map((p, i) => /* @__PURE__ */ jsxs3("span", { className: "lqb-piece", children: [
                  i > 0 && /* @__PURE__ */ jsx3("span", { className: "lqb-sep", children: raw[i - 1].endsWith(",") ? ", " : " " }),
                  bad ? hl : paint(p, `p${i}`)
                ] }, i)) }) : /* @__PURE__ */ jsx3("div", { className: "lqb-hl", ref: hlRef, "aria-hidden": "true", children: hl }),
                textarea
              ] }),
              summarize && fit.hidden > 0 && !bad && /* @__PURE__ */ jsx3("span", { className: "lqb-more", children: labels.hiddenFilters(fit.hidden) }),
              query && interactive && /* @__PURE__ */ jsxs3("span", { className: "lqb-field-acts", children: [
                /* @__PURE__ */ jsx3(
                  "button",
                  {
                    type: "button",
                    className: "lqb-icon-btn",
                    "aria-label": labels.clearAria,
                    onMouseEnter: (e) => showTip(e.currentTarget, labels.clear),
                    onMouseLeave: () => setTip(null),
                    onMouseDown: keep,
                    onClick: () => {
                      setTip(null);
                      commit("");
                      inputRef.current?.focus();
                    },
                    children: /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M6 6l12 12M18 6L6 18" }) })
                  }
                ),
                expanded && /* @__PURE__ */ jsx3(
                  "button",
                  {
                    type: "button",
                    className: "lqb-icon-btn",
                    "aria-label": labels.copyQuery,
                    onMouseEnter: (e) => showTip(e.currentTarget, labels.copyQuery),
                    onMouseLeave: () => setTip(null),
                    onMouseDown: keep,
                    onClick: (e) => {
                      const el = e.currentTarget;
                      copyBranch(-1, query).then((ok) => {
                        showTip(el, ok ? labels.copied : labels.copyFailed);
                        setTimeout(() => setTip(null), 1300);
                      });
                    },
                    children: /* @__PURE__ */ jsxs3("svg", { ...ICON, children: [
                      /* @__PURE__ */ jsx3("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
                      /* @__PURE__ */ jsx3("path", { d: "M5 15V6a2 2 0 0 1 2-2h8" })
                    ] })
                  }
                )
              ] })
            ] }),
            showQueries && /* @__PURE__ */ jsxs3("div", { className: "lqb-qside", children: [
              /* @__PURE__ */ jsxs3("button", { type: "button", ref: qBtnRef, className: ["lqb-qbtn", classNames.queriesButton].filter(Boolean).join(" "), "aria-haspopup": "dialog", "aria-expanded": qOpen, onClick: () => setQOpen((x) => !x), children: [
                /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M6 3h12v18l-6-4-6 4z" }) }),
                /* @__PURE__ */ jsx3("span", { children: labels.queries }),
                /* @__PURE__ */ jsx3("span", { className: "lqb-count", children: count }),
                /* @__PURE__ */ jsx3("svg", { ...ICON, width: 15, height: 15, children: /* @__PURE__ */ jsx3("path", { d: "M6 9l6 6 6-6" }) })
              ] }),
              expanded && interactive && (onSave || onSaveQuery || onCreateAlert) && /* @__PURE__ */ jsxs3("div", { className: "lqb-qside-acts", children: [
                (onSave || onSaveQuery) && /* @__PURE__ */ jsxs3(
                  "button",
                  {
                    type: "button",
                    ref: saveBtnRef,
                    className: "lqb-side-btn",
                    "aria-expanded": onSaveQuery ? !!draft : void 0,
                    title: savedMatch ? labels.savedAs(savedMatch.name) : labels.save,
                    disabled: !query.trim(),
                    onMouseDown: keep,
                    onClick: () => onSaveQuery ? setDraft((d) => d ? null : { name: savedMatch?.name ?? autoName, pinned: savedMatch?.pinned ?? false, error: "", busy: false }) : onSave?.(query, savedMatch),
                    children: [
                      /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M6 3h12v18l-6-4-6 4z" }) }),
                      labels.saveShort
                    ]
                  }
                ),
                onCreateAlert && /* @__PURE__ */ jsxs3("button", { type: "button", className: "lqb-side-btn", disabled: blocked || !query.trim(), onMouseDown: keep, onClick: () => onCreateAlert(query, savedMatch), children: [
                  /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" }) }),
                  labels.createAlert
                ] })
              ] })
            ] }),
            suggestions,
            liveRegion
          ] }),
          errorBox,
          unknownBox
        ] }) }),
        showRun && runButton,
        actions
      ] }),
      (showHelp || showLogql) && /* @__PURE__ */ jsxs3("div", { className: "lqb-tools", children: [
        helpButton,
        logqlToggle
      ] }),
      logqlPanel,
      draft && /* @__PURE__ */ jsxs3(
        "div",
        {
          className: "lqb-savepop",
          ref: savePopRef,
          role: "dialog",
          "aria-label": labels.saveAs,
          onKeyDown: (e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setDraft(null);
              inputRef.current?.focus();
            } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              submitDraft();
            }
          },
          children: [
            /* @__PURE__ */ jsx3("div", { className: "lqb-pop-title", children: labels.saveAs }),
            /* @__PURE__ */ jsx3("input", { className: "lqb-input", "aria-label": labels.nameLabel, autoFocus: true, value: draft.name, onFocus: (e) => e.currentTarget.select(), onChange: (e) => setDraft({ ...draft, name: e.target.value }) }),
            /* @__PURE__ */ jsxs3("label", { className: "lqb-check", children: [
              /* @__PURE__ */ jsx3("input", { type: "checkbox", checked: draft.pinned, onChange: (e) => setDraft({ ...draft, pinned: e.target.checked }) }),
              labels.pinToTop
            ] }),
            /* @__PURE__ */ jsxs3("code", { className: "lqb-pop-preview", title: query, children: [
              /* @__PURE__ */ jsx3("svg", { ...ICON, className: "lqb-q-ic", width: 12, height: 12, children: /* @__PURE__ */ jsx3("path", { d: "M3 5h18l-7 8v6l-4 2v-8z" }) }),
              /* @__PURE__ */ jsx3("span", { className: "lqb-q-text", children: paint(flat(query), "sp") })
            ] }),
            draft.error && /* @__PURE__ */ jsx3("div", { className: "lqb-error", children: draft.error }),
            /* @__PURE__ */ jsxs3("div", { className: "lqb-pop-acts", children: [
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  className: "lqb-btn",
                  onClick: () => {
                    setDraft(null);
                    inputRef.current?.focus();
                  },
                  children: labels.cancel
                }
              ),
              /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-btn lqb-btn-primary", disabled: draft.busy || !draft.name.trim() || blocked, onClick: submitDraft, children: draft.busy ? labels.saving : savedMatch ? labels.update : labels.saveShort })
            ] })
          ]
        }
      ),
      qOpen && /* @__PURE__ */ jsxs3("div", { className: ["lqb-qpanel", classNames.queriesPanel].filter(Boolean).join(" "), ref: qPanelRef, role: "dialog", "aria-label": labels.queries, children: [
        /* @__PURE__ */ jsxs3("div", { className: "lqb-q-search", children: [
          /* @__PURE__ */ jsxs3("svg", { ...ICON, children: [
            /* @__PURE__ */ jsx3("circle", { cx: "11", cy: "11", r: "7" }),
            /* @__PURE__ */ jsx3("path", { d: "M20 20l-3.5-3.5" })
          ] }),
          /* @__PURE__ */ jsx3(
            "input",
            {
              autoFocus: true,
              value: qText,
              placeholder: labels.searchSaved,
              "aria-label": labels.searchSaved,
              onChange: (e) => {
                setQText(e.target.value);
                onSavedSearch?.(e.target.value);
              },
              onKeyDown: (e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setQOpen(false);
                  qBtnRef.current?.focus();
                } else if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  setQOpen(false);
                  setQText("");
                  commit(matches[0].query);
                  onSelectSaved?.(matches[0]);
                }
              }
            }
          )
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: "lqb-q-list", children: [
          savedLoading && /* @__PURE__ */ jsx3("div", { className: "lqb-q-empty", children: labels.loadingSaved }),
          !savedLoading && !matches.length && /* @__PURE__ */ jsx3("div", { className: "lqb-q-empty", children: needle ? labels.noSavedMatch : labels.noSaved }),
          pinnedList.length > 0 && /* @__PURE__ */ jsxs3("div", { role: "group", "aria-label": labels.pinnedHead, children: [
            /* @__PURE__ */ jsx3("div", { className: "lqb-sg-h", children: labels.pinnedHead }),
            pinnedList.map(item)
          ] }),
          restList.length > 0 && /* @__PURE__ */ jsxs3("div", { role: "group", "aria-label": labels.allSavedHead, className: pinnedList.length ? "lqb-q-sep" : void 0, children: [
            /* @__PURE__ */ jsx3("div", { className: "lqb-sg-h", children: labels.allSavedHead }),
            restList.map(item)
          ] })
        ] })
      ] }),
      helpDialog,
      tip && /* @__PURE__ */ jsxs3("div", { ref: tipRef, className: "lqb-tip", role: "tooltip", children: [
        /* @__PURE__ */ jsx3("div", { className: "lqb-tip-title", children: tip.title }),
        tip.body && /* @__PURE__ */ jsx3("div", { className: "lqb-tip-body", children: tip.body })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs3("div", { className: rootClass, style, "data-lqb-theme": themeAttr, "aria-busy": running || void 0, children: [
    (blurb !== false || showHelp) && /* @__PURE__ */ jsxs3("div", { className: "lqb-head", children: [
      blurb !== false ? /* @__PURE__ */ jsx3("p", { className: "lqb-desc", children: blurb }) : /* @__PURE__ */ jsx3("span", {}),
      helpButton
    ] }),
    /* @__PURE__ */ jsxs3("div", { className: "lqb-wrap", ref: wrapRef, children: [
      /* @__PURE__ */ jsxs3("div", { className: "lqb-box", children: [
        /* @__PURE__ */ jsxs3("div", { className: "lqb-row", children: [
          textarea,
          query && interactive && /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              className: "lqb-text-btn",
              "aria-label": labels.clearAria,
              onClick: () => {
                commit("");
                inputRef.current?.focus();
              },
              children: labels.clear
            }
          ),
          onSave && interactive && /* @__PURE__ */ jsx3("button", { type: "button", className: "lqb-icon-btn", "aria-label": labels.save, title: savedMatch ? labels.savedAs(savedMatch.name) : labels.save, onClick: () => onSave(query, savedMatch), children: /* @__PURE__ */ jsx3("svg", { ...ICON, children: /* @__PURE__ */ jsx3("path", { d: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" }) }) })
        ] }),
        analysis.parsed.children.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "lqb-chips", children: [
          analysis.parsed.children.slice(0, CHIP_LIMIT).map((node, i) => {
            const text = engine.chipText(node);
            return /* @__PURE__ */ jsxs3("span", { className: engine.isNegative(node) ? "lqb-chip lqb-chip-neg" : "lqb-chip", children: [
              /* @__PURE__ */ jsx3("span", { title: text, children: chipLabel(text) }),
              interactive && /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  "aria-label": labels.removeFilter(text),
                  onClick: () => {
                    commit(engine.removeNode(query, node));
                    if (analysis.parsed.children.length === 1) inputRef.current?.focus();
                  },
                  children: /* @__PURE__ */ jsx3("svg", { ...ICON, width: 10, height: 10, children: /* @__PURE__ */ jsx3("path", { d: "M5 5l14 14M19 5L5 19" }) })
                }
              )
            ] }, `${node.id}-${i}`);
          }),
          analysis.parsed.children.length > CHIP_LIMIT && /* @__PURE__ */ jsx3("span", { className: "lqb-chip lqb-chip-more", children: labels.moreFilters(analysis.parsed.children.length - CHIP_LIMIT) })
        ] })
      ] }),
      suggestions,
      liveRegion
    ] }),
    errorBox,
    unknownBox,
    !query.trim() && shownExamples.length > 0 && interactive && /* @__PURE__ */ jsxs3("div", { className: "lqb-try", children: [
      /* @__PURE__ */ jsx3("span", { children: labels.tryLabel }),
      shownExamples.map((q) => /* @__PURE__ */ jsx3("button", { type: "button", onClick: () => commit(q), children: q }, q))
    ] }),
    logqlPanel,
    /* @__PURE__ */ jsxs3("div", { className: "lqb-runbar", children: [
      /* @__PURE__ */ jsx3("span", { className: blocked ? "lqb-status lqb-status-warn" : "lqb-status", role: "status", children: status }),
      logqlToggle,
      actions,
      runButton
    ] }),
    helpDialog
  ] });
});

// src/index.ts
export * from "./core.js";
export {
  LogQLQueryBox,
  defaultExamples,
  defaultLabels,
  defaultNotes,
  defaultSyntax
};
//# sourceMappingURL=index.js.map