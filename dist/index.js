"use client";

// src/react/LogQLQueryBox.tsx
import {
  forwardRef,
  useEffect as useEffect2,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef as useRef2,
  useState
} from "react";
import { chipLabel, createEngine } from "./core.js";

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
  unknownValue: (label, value, negative, hasMatches) => `No ${label} is exactly \u201C${value}\u201D, so ${negative ? "nothing was excluded" : "nothing matches it"}.${hasMatches ? " Did you mean:" : " Check the spelling."}`,
  containing: (label, value, negative) => `${negative ? "Every" : "Any"} ${label} containing \u201C${value}\u201D`,
  unknownPattern: (label, pattern, negative, hasMatches) => `No ${label} matches \u201C${pattern}\u201D, so ${negative ? "nothing was excluded" : "nothing matches it"}. ^ means starts with and $ means ends with.${hasMatches ? " Did you mean:" : ""}`,
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
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var useIsoLayoutEffect = typeof window === "undefined" ? useEffect2 : useLayoutEffect;
var RECENT_LIMIT = 8;
var CHIP_LIMIT = 50;
var MENU_GAP = 6;
var MENU_MAX = 300;
var MENU_MIN = 120;
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
  const loadAbort = useRef2(null);
  loader.current = loadValues;
  const baseId = useId();
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const optionId = (i) => `${baseId}-opt-${i}`;
  const analysis = useMemo(() => engine.analyze(query), [engine, query]);
  const recentList = recent ?? storedRecent;
  const interactive = !disabled && !readOnly;
  const sugg = useMemo(() => menu && interactive ? engine.suggest(query, menu.caret, bar ? {} : { saved, recent: recentList }) : null, [menu, interactive, engine, query, saved, recentList, bar]);
  const items = useMemo(() => sugg ? [...sugg.items, ...sugg.extra] : [], [sugg]);
  const open = items.length > 0;
  const at = menu ? Math.min(menu.at, items.length - 1) : -1;
  const valueField = sugg?.field;
  const waiting = !!valueField && loading.includes(valueField);
  const note = sugg?.note;
  const shown = open || waiting || !!note;
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
    setLoaded((x) => Object.keys(x).length ? {} : x);
    setLoading((x) => x.length ? [] : x);
    return () => controller.abort();
  }, [baseKey]);
  useEffect2(() => {
    const load = loader.current;
    const controller = loadAbort.current;
    if (!valueField || !load || !controller || props.engine || requested.current.has(valueField)) return;
    const field = valueField;
    requested.current.add(field);
    setLoading((x) => [...x, field]);
    const finish = (list) => {
      if (controller.signal.aborted) return;
      if (Array.isArray(list)) setLoaded((x) => ({ ...x, [field]: list }));
      else requested.current.delete(field);
      setLoading((x) => x.filter((f) => f !== field));
    };
    Promise.resolve().then(() => load(field, { signal: controller.signal })).then(finish, () => finish());
  }, [valueField, baseKey, props.engine]);
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
      list.style.top = upward ? "auto" : `${box.bottom + MENU_GAP}px`;
      list.style.bottom = upward ? `${window.innerHeight - box.top + MENU_GAP}px` : "auto";
      list.style.maxHeight = `${Math.max(MENU_MIN, Math.min(MENU_MAX, upward ? above : below))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [shown, items, waiting]);
  const [draft, setDraft] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [editing, setEditing] = useState(null);
  const saveBtnRef = useRef2(null);
  const savePopRef = useRef2(null);
  const expanded = bar && (focused || !!draft) && !qOpen && !!query;
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
      const width = Math.min(360, window.innerWidth - 16);
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
      const width = Math.min(400, window.innerWidth - 16);
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
    const q = engine.schema.operator === "=" ? engine.combine(raw) : raw;
    const result = engine.analyze(q);
    if (result.error) return false;
    if (q !== raw) change(q);
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
    const pos = s + (it.caret ?? text.length);
    pendingCaret.current = pos;
    change(query.slice(0, s) + text + query.slice(e));
    setMenu(it.keep ? { caret: pos, at: 0 } : null);
  };
  const currentToken = () => engine.tokenAt(query, inputRef.current?.selectionStart ?? query.length);
  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
      if (open && !e.shiftKey && (currentToken() || items[at]?.kind === "operator")) {
        e.preventDefault();
        accept(at);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const it = open ? items[at] : void 0;
      const cur = currentToken();
      if (it?.kind === "value" && (cur.indexOf(":") > 0 || engine.schema.operator === "=" && cur.indexOf("=") > 0) && it.text?.trim() !== cur) accept(at);
      else if (it?.whole != null && !cur && !query.trim()) accept(at);
      else {
        setMenu(null);
        if (!running) execute();
      }
    } else if (e.key === "Escape") {
      if (shown) {
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
  };
  const rootClass = ["lqb", className].filter(Boolean).join(" ");
  const themeAttr = theme === "auto" ? void 0 : theme;
  const blurb = description === void 0 ? labels.description : description;
  const row = (it, i) => /* @__PURE__ */ jsxs2(
    "div",
    {
      className: "lqb-sg",
      role: "option",
      id: optionId(i),
      "aria-selected": i === at,
      onMouseDown: (e) => {
        e.preventDefault();
        accept(i);
      },
      children: [
        it.color && /* @__PURE__ */ jsx2("i", { style: { "--lqb-c": it.color } }),
        /* @__PURE__ */ jsx2("code", { children: it.label }),
        it.sub && /* @__PURE__ */ jsx2("span", { className: "lqb-hint lqb-sub", children: it.sub }),
        /* @__PURE__ */ jsx2("span", { className: "lqb-hint", children: it.kind === "value" && !showValueCounts ? "" : it.hint ?? "" })
      ]
    },
    `${it.kind}-${it.label}-${i}`
  );
  const textarea = /* @__PURE__ */ jsx2(
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
  const suggestions = shown && sugg && /* @__PURE__ */ jsxs2("div", { className: ["lqb-sugg", classNames.suggestions].filter(Boolean).join(" "), ref: listRef, id: listId, role: "listbox", "aria-label": labels.ariaLabel, onMouseDown: (e) => e.preventDefault(), children: [
    sugg.items.length > 0 && /* @__PURE__ */ jsxs2("div", { role: "group", "aria-label": sugg.head || labels.ariaLabel, children: [
      sugg.head && /* @__PURE__ */ jsx2("div", { className: "lqb-sg-h", "aria-hidden": "true", children: sugg.head }),
      sugg.items.map((it, i) => row(it, i))
    ] }),
    note && /* @__PURE__ */ jsx2("div", { className: "lqb-sg-note", children: note }),
    sugg.extra.length > 0 && /* @__PURE__ */ jsxs2("div", { role: "group", "aria-label": sugg.extraHead ?? labels.savedAndRecent, children: [
      /* @__PURE__ */ jsx2("div", { className: "lqb-sg-h", "aria-hidden": "true", children: sugg.extraHead ?? labels.savedAndRecent }),
      sugg.extra.map((it, i) => row(it, i + sugg.items.length))
    ] }),
    waiting && /* @__PURE__ */ jsx2("div", { className: "lqb-sg-h", "aria-hidden": "true", children: labels.loadingValues })
  ] });
  const liveRegion = /* @__PURE__ */ jsx2("span", { className: "lqb-sr", "aria-live": "polite", children: waiting ? labels.loadingValues : open ? labels.suggestionCount(items.length) : note ?? "" });
  const unknown = query === checked && interactive ? analysis.unknownValues[0] : void 0;
  const unknownLabel = unknown ? engine.schema.fields.get(unknown.field)?.label ?? unknown.field : "";
  const unknownBox = unknown && /* @__PURE__ */ jsxs2("div", { className: "lqb-unknown", role: "status", children: [
    /* @__PURE__ */ jsx2("span", { children: unknown.regex ? labels.unknownPattern(unknownLabel, unknown.value, unknown.negative, unknown.matches.length > 0) : labels.unknownValue(unknownLabel, unknown.value, unknown.negative, unknown.matches.length > 0) }),
    unknown.matches.map((v) => /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-fix", onClick: () => commit(engine.replaceValue(query, unknown.field, unknown.value, v, unknown.negative)), children: v }, v)),
    unknown.regex && /^\^[\w.-]+\$?$/.test(unknown.value) && unknown.matches.length > 0 && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-fix", onClick: () => commit(engine.replaceValue(query, unknown.field, unknown.value, `${unknown.value.replace(/^\^/, "").replace(/\$$/, "")}*`, unknown.negative)), children: labels.startingWith(unknownLabel, unknown.value.replace(/^\^/, "").replace(/\$$/, ""), unknown.negative) }),
    unknown.matches.length > 1 && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-fix", onClick: () => commit(engine.replaceValue(query, unknown.field, unknown.value, `*${unknown.value.replace(/^\^/, "").replace(/\$$/, "")}*`, unknown.negative)), children: labels.containing(unknownLabel, unknown.value.replace(/^\^/, "").replace(/\$$/, ""), unknown.negative) })
  ] });
  const errorBox = analysis.error && /* @__PURE__ */ jsx2("div", { className: "lqb-error", id: errorId, role: "alert", children: analysis.error });
  const logqlPanel = showLogql && logqlOpen && !analysis.error && /* @__PURE__ */ jsxs2("div", { className: "lqb-logql", children: [
    analysis.logql.branches.map((branch, i) => /* @__PURE__ */ jsxs2("div", { children: [
      /* @__PURE__ */ jsxs2("div", { className: "lqb-pre-h", children: [
        /* @__PURE__ */ jsx2("span", { children: analysis.logql.branches.length > 1 ? labels.branch(i + 1, analysis.logql.branches.length) : labels.logQuery }),
        /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-mini", onClick: () => copyBranch(i, branch), children: copied?.index === i ? copied.text : labels.copy })
      ] }),
      /* @__PURE__ */ jsx2("pre", { children: branch })
    ] }, i)),
    analysis.logql.branches.length > 1 && /* @__PURE__ */ jsx2("p", { className: "lqb-note", children: labels.mergeNote })
  ] });
  const logqlToggle = showLogql && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-link", "aria-expanded": logqlOpen, onClick: () => setLogqlOpen((x) => !x), children: logqlOpen ? labels.hideLogql : labels.showLogql });
  const helpButton = showHelp && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-link", ref: helpButtonRef, onClick: () => setHelpOpen(true), children: labels.help });
  const runButton = /* @__PURE__ */ jsxs2("button", { type: "button", className: [isDirty || blocked ? "lqb-run" : "lqb-run lqb-run-idle", classNames.run].filter(Boolean).join(" "), disabled: blocked || disabled || running, onClick: () => execute(), children: [
    /* @__PURE__ */ jsx2("svg", { ...ICON, width: 14, height: 14, children: /* @__PURE__ */ jsx2("path", { d: "M7 4l13 8-13 8z" }) }),
    bar ? labels.runQuery : labels.execute
  ] });
  const helpDialog = helpOpen && /* @__PURE__ */ jsx2(
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
          /* @__PURE__ */ jsx2("span", { className: "lqb-hl-f", children: m[3] }, `${key}${s}`),
          /* @__PURE__ */ jsx2("span", { className: "lqb-hl-op", children: m[4] }, `${key}${s}o`)
        );
        last = s + m[3].length + m[4].length;
      }
      out.push(text.slice(last));
      return out;
    };
    const hl = [...paint(query, "q"), "\u200B"];
    const flat = (text) => text.replace(/\s+/g, " ").trim();
    const pieces = analysis.parsed.children.length ? analysis.parsed.children.map((n) => flat(n.spans.map(([a, b]) => query.slice(a, b)).join(" "))) : [flat(query)];
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
    const item = (s) => removing?.key === (s.id ?? s.name) ? /* @__PURE__ */ jsxs2(
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
          /* @__PURE__ */ jsx2("span", { children: removing.error || labels.confirmRemove(s.name) }),
          /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-btn lqb-btn-danger", disabled: removing.busy, onClick: () => confirmRemove(s), children: removing.busy ? labels.removing : labels.removeShort }),
          /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-btn lqb-btn-outline", autoFocus: true, onClick: () => setRemoving(null), children: labels.cancel })
        ]
      },
      s.id ?? s.name
    ) : editing?.key === (s.id ?? s.name) ? /* @__PURE__ */ jsxs2(
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
          /* @__PURE__ */ jsx2("input", { className: "lqb-input", "aria-label": labels.nameLabel, autoFocus: true, value: editing.name, onFocus: (e) => e.currentTarget.select(), onChange: (e) => setEditing({ ...editing, name: e.target.value }) }),
          /* @__PURE__ */ jsx2("textarea", { className: "lqb-q-edit-query", "aria-label": labels.queryLabel, rows: 3, spellCheck: false, value: editing.query, onChange: (e) => setEditing({ ...editing, query: e.target.value }) }),
          (editing.error || engine.analyze(editing.query).error) && /* @__PURE__ */ jsx2("div", { className: "lqb-error", children: editing.error || engine.analyze(editing.query).error }),
          /* @__PURE__ */ jsxs2("div", { className: "lqb-pop-acts", children: [
            /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-btn", onClick: () => setEditing(null), children: labels.cancel }),
            /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-btn lqb-btn-primary", disabled: editing.busy || !editing.name.trim() || !editing.query.trim() || !!engine.analyze(editing.query).error, onClick: () => submitEdit(s), children: editing.busy ? labels.saving : labels.saveShort })
          ] })
        ]
      },
      s.id ?? s.name
    ) : /* @__PURE__ */ jsxs2("div", { className: "lqb-q-item", children: [
      /* @__PURE__ */ jsxs2(
        "button",
        {
          type: "button",
          className: "lqb-q-main",
          title: s.query,
          onClick: () => {
            setQOpen(false);
            setQText("");
            commit(s.query);
            onSelectSaved?.(s);
          },
          children: [
            /* @__PURE__ */ jsxs2("span", { className: "lqb-q-name", children: [
              s.name,
              s.pinned && /* @__PURE__ */ jsx2("svg", { ...ICON, width: 14, height: 14, "aria-label": labels.pinnedBadge, role: "img", children: /* @__PURE__ */ jsx2("path", { d: "M9 3h6l-1 6 4 4H6l4-4zM12 13v8", fill: "currentColor" }) })
            ] }),
            /* @__PURE__ */ jsx2("code", { children: s.query })
          ]
        }
      ),
      interactive && (onPinSaved || onCreateAlert || onEditSaved || onUpdateSaved || onDeleteSaved) && /* @__PURE__ */ jsxs2("span", { className: "lqb-q-acts", children: [
        onPinSaved && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-icon-btn", "aria-label": s.pinned ? labels.unpin(s.name) : labels.pin(s.name), title: s.pinned ? labels.unpinShort : labels.pinShort, onClick: () => onPinSaved(s, !s.pinned), children: /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: s.pinned ? "M9 3h6l-1 6 4 4H6l4-4zM12 13v8M4 4l16 16" : "M9 3h6l-1 6 4 4H6l4-4zM12 13v8" }) }) }),
        onCreateAlert && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-icon-btn", "aria-label": labels.alertFor(s.name), title: labels.createAlert, onClick: () => onCreateAlert(s.query, s), children: /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" }) }) }),
        (onEditSaved || onUpdateSaved) && /* @__PURE__ */ jsx2(
          "button",
          {
            type: "button",
            className: "lqb-icon-btn",
            "aria-label": labels.edit(s.name),
            title: labels.editShort,
            onClick: () => onUpdateSaved ? setEditing({ key: s.id ?? s.name, name: s.name, query: s.query, error: "", busy: false }) : onEditSaved?.(s),
            children: /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" }) })
          }
        ),
        onDeleteSaved && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-icon-btn lqb-danger", "aria-label": labels.remove(s.name), title: labels.removeShort, onClick: () => setRemoving({ key: s.id ?? s.name, error: "", busy: false }), children: /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" }) }) })
      ] })
    ] }, s.id ?? s.name);
    return /* @__PURE__ */ jsxs2("div", { className: `${rootClass} lqb-v-bar`, style, "data-lqb-theme": themeAttr, "aria-busy": running || void 0, children: [
      blurb !== false && description !== void 0 && /* @__PURE__ */ jsx2("p", { className: "lqb-desc", children: blurb }),
      /* @__PURE__ */ jsxs2("div", { className: "lqb-bar-row", children: [
        /* @__PURE__ */ jsx2("div", { className: "lqb-bar-slot", children: /* @__PURE__ */ jsxs2("div", { ref: wrapRef, className: ["lqb-bar", classNames.bar].filter(Boolean).join(" "), "data-open": expanded || void 0, "data-focus": focused || void 0, "data-invalid": blocked || void 0, children: [
          /* @__PURE__ */ jsxs2("div", { className: ["lqb-field", classNames.field].filter(Boolean).join(" "), onMouseDown: (e) => e.target === e.currentTarget && (keep(e), inputRef.current?.focus()), children: [
            /* @__PURE__ */ jsx2("svg", { ...ICON, className: "lqb-funnel", children: /* @__PURE__ */ jsx2("path", { d: "M3 5h18l-7 8v6l-4 2v-8z" }) }),
            /* @__PURE__ */ jsxs2("div", { className: "lqb-edit", children: [
              summarize ? /* @__PURE__ */ jsx2("div", { className: "lqb-summary", ref: sumRef, "data-overflow": fit.over || void 0, "aria-hidden": "true", children: pieces.map((p, i) => /* @__PURE__ */ jsxs2("span", { className: "lqb-piece", children: [
                i > 0 && /* @__PURE__ */ jsx2("span", { className: "lqb-sep", children: ", " }),
                paint(p, `p${i}`)
              ] }, i)) }) : /* @__PURE__ */ jsx2("div", { className: "lqb-hl", ref: hlRef, "aria-hidden": "true", children: hl }),
              textarea
            ] }),
            summarize && fit.hidden > 0 && /* @__PURE__ */ jsx2("span", { className: "lqb-more", children: labels.hiddenFilters(fit.hidden) }),
            query && interactive && /* @__PURE__ */ jsxs2("span", { className: "lqb-field-acts", children: [
              /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  className: "lqb-icon-btn",
                  "aria-label": labels.clearAria,
                  title: labels.clear,
                  onMouseDown: keep,
                  onClick: () => {
                    commit("");
                    inputRef.current?.focus();
                  },
                  children: /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M6 6l12 12M18 6L6 18" }) })
                }
              ),
              expanded && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-icon-btn", "aria-label": labels.copyQuery, title: copied?.index === -1 ? copied.text : labels.copyQuery, onMouseDown: keep, onClick: () => copyBranch(-1, query), children: /* @__PURE__ */ jsxs2("svg", { ...ICON, children: [
                /* @__PURE__ */ jsx2("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
                /* @__PURE__ */ jsx2("path", { d: "M5 15V6a2 2 0 0 1 2-2h8" })
              ] }) })
            ] })
          ] }),
          showQueries && /* @__PURE__ */ jsxs2("div", { className: "lqb-qside", children: [
            /* @__PURE__ */ jsxs2("button", { type: "button", ref: qBtnRef, className: ["lqb-qbtn", classNames.queriesButton].filter(Boolean).join(" "), "aria-haspopup": "dialog", "aria-expanded": qOpen, onClick: () => setQOpen((x) => !x), children: [
              /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M6 3h12v18l-6-4-6 4z" }) }),
              /* @__PURE__ */ jsx2("span", { children: labels.queries }),
              /* @__PURE__ */ jsx2("span", { className: "lqb-count", children: count }),
              /* @__PURE__ */ jsx2("svg", { ...ICON, width: 15, height: 15, children: /* @__PURE__ */ jsx2("path", { d: "M6 9l6 6 6-6" }) })
            ] }),
            expanded && interactive && (onSave || onSaveQuery || onCreateAlert) && /* @__PURE__ */ jsxs2("div", { className: "lqb-qside-acts", children: [
              (onSave || onSaveQuery) && /* @__PURE__ */ jsxs2(
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
                    /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M6 3h12v18l-6-4-6 4z" }) }),
                    labels.saveShort
                  ]
                }
              ),
              onCreateAlert && /* @__PURE__ */ jsxs2("button", { type: "button", className: "lqb-side-btn", disabled: blocked || !query.trim(), onMouseDown: keep, onClick: () => onCreateAlert(query, savedMatch), children: [
                /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" }) }),
                labels.createAlert
              ] })
            ] })
          ] }),
          suggestions,
          liveRegion
        ] }) }),
        showRun && runButton,
        actions
      ] }),
      errorBox,
      unknownBox,
      (showHelp || showLogql) && /* @__PURE__ */ jsxs2("div", { className: "lqb-tools", children: [
        helpButton,
        logqlToggle
      ] }),
      logqlPanel,
      draft && /* @__PURE__ */ jsxs2(
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
            /* @__PURE__ */ jsx2("div", { className: "lqb-pop-title", children: labels.saveAs }),
            /* @__PURE__ */ jsx2("input", { className: "lqb-input", "aria-label": labels.nameLabel, autoFocus: true, value: draft.name, onFocus: (e) => e.currentTarget.select(), onChange: (e) => setDraft({ ...draft, name: e.target.value }) }),
            /* @__PURE__ */ jsxs2("label", { className: "lqb-check", children: [
              /* @__PURE__ */ jsx2("input", { type: "checkbox", checked: draft.pinned, onChange: (e) => setDraft({ ...draft, pinned: e.target.checked }) }),
              labels.pinToTop
            ] }),
            /* @__PURE__ */ jsx2("code", { className: "lqb-pop-preview", title: query, children: flat(query) }),
            draft.error && /* @__PURE__ */ jsx2("div", { className: "lqb-error", children: draft.error }),
            /* @__PURE__ */ jsxs2("div", { className: "lqb-pop-acts", children: [
              /* @__PURE__ */ jsx2(
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
              /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-btn lqb-btn-primary", disabled: draft.busy || !draft.name.trim() || blocked, onClick: submitDraft, children: draft.busy ? labels.saving : savedMatch ? labels.update : labels.saveShort })
            ] })
          ]
        }
      ),
      qOpen && /* @__PURE__ */ jsxs2("div", { className: ["lqb-qpanel", classNames.queriesPanel].filter(Boolean).join(" "), ref: qPanelRef, role: "dialog", "aria-label": labels.queries, children: [
        /* @__PURE__ */ jsxs2("div", { className: "lqb-q-search", children: [
          /* @__PURE__ */ jsxs2("svg", { ...ICON, children: [
            /* @__PURE__ */ jsx2("circle", { cx: "11", cy: "11", r: "7" }),
            /* @__PURE__ */ jsx2("path", { d: "M20 20l-3.5-3.5" })
          ] }),
          /* @__PURE__ */ jsx2(
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
        /* @__PURE__ */ jsxs2("div", { className: "lqb-q-list", children: [
          savedLoading && /* @__PURE__ */ jsx2("div", { className: "lqb-q-empty", children: labels.loadingSaved }),
          !savedLoading && !matches.length && /* @__PURE__ */ jsx2("div", { className: "lqb-q-empty", children: needle ? labels.noSavedMatch : labels.noSaved }),
          pinnedList.length > 0 && /* @__PURE__ */ jsxs2("div", { role: "group", "aria-label": labels.pinnedHead, children: [
            /* @__PURE__ */ jsx2("div", { className: "lqb-sg-h", children: labels.pinnedHead }),
            pinnedList.map(item)
          ] }),
          restList.length > 0 && /* @__PURE__ */ jsxs2("div", { role: "group", "aria-label": labels.allSavedHead, className: pinnedList.length ? "lqb-q-sep" : void 0, children: [
            /* @__PURE__ */ jsx2("div", { className: "lqb-sg-h", children: labels.allSavedHead }),
            restList.map(item)
          ] })
        ] })
      ] }),
      helpDialog
    ] });
  }
  return /* @__PURE__ */ jsxs2("div", { className: rootClass, style, "data-lqb-theme": themeAttr, "aria-busy": running || void 0, children: [
    (blurb !== false || showHelp) && /* @__PURE__ */ jsxs2("div", { className: "lqb-head", children: [
      blurb !== false ? /* @__PURE__ */ jsx2("p", { className: "lqb-desc", children: blurb }) : /* @__PURE__ */ jsx2("span", {}),
      helpButton
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "lqb-wrap", ref: wrapRef, children: [
      /* @__PURE__ */ jsxs2("div", { className: "lqb-box", children: [
        /* @__PURE__ */ jsxs2("div", { className: "lqb-row", children: [
          textarea,
          query && interactive && /* @__PURE__ */ jsx2(
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
          onSave && interactive && /* @__PURE__ */ jsx2("button", { type: "button", className: "lqb-icon-btn", "aria-label": labels.save, title: savedMatch ? labels.savedAs(savedMatch.name) : labels.save, onClick: () => onSave(query, savedMatch), children: /* @__PURE__ */ jsx2("svg", { ...ICON, children: /* @__PURE__ */ jsx2("path", { d: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" }) }) })
        ] }),
        analysis.parsed.children.length > 0 && /* @__PURE__ */ jsxs2("div", { className: "lqb-chips", children: [
          analysis.parsed.children.slice(0, CHIP_LIMIT).map((node, i) => {
            const text = engine.chipText(node);
            return /* @__PURE__ */ jsxs2("span", { className: engine.isNegative(node) ? "lqb-chip lqb-chip-neg" : "lqb-chip", children: [
              /* @__PURE__ */ jsx2("span", { title: text, children: chipLabel(text) }),
              interactive && /* @__PURE__ */ jsx2(
                "button",
                {
                  type: "button",
                  "aria-label": labels.removeFilter(text),
                  onClick: () => {
                    commit(engine.removeNode(query, node));
                    if (analysis.parsed.children.length === 1) inputRef.current?.focus();
                  },
                  children: /* @__PURE__ */ jsx2("svg", { ...ICON, width: 10, height: 10, children: /* @__PURE__ */ jsx2("path", { d: "M5 5l14 14M19 5L5 19" }) })
                }
              )
            ] }, `${node.id}-${i}`);
          }),
          analysis.parsed.children.length > CHIP_LIMIT && /* @__PURE__ */ jsx2("span", { className: "lqb-chip lqb-chip-more", children: labels.moreFilters(analysis.parsed.children.length - CHIP_LIMIT) })
        ] })
      ] }),
      suggestions,
      liveRegion
    ] }),
    errorBox,
    unknownBox,
    !query.trim() && shownExamples.length > 0 && interactive && /* @__PURE__ */ jsxs2("div", { className: "lqb-try", children: [
      /* @__PURE__ */ jsx2("span", { children: labels.tryLabel }),
      shownExamples.map((q) => /* @__PURE__ */ jsx2("button", { type: "button", onClick: () => commit(q), children: q }, q))
    ] }),
    logqlPanel,
    /* @__PURE__ */ jsxs2("div", { className: "lqb-runbar", children: [
      /* @__PURE__ */ jsx2("span", { className: blocked ? "lqb-status lqb-status-warn" : "lqb-status", role: "status", children: status }),
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