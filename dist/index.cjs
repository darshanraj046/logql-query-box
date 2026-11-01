"use client";
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  LogQLQueryBox: () => LogQLQueryBox,
  defaultExamples: () => defaultExamples,
  defaultLabels: () => defaultLabels,
  defaultNotes: () => defaultNotes,
  defaultSyntax: () => defaultSyntax
});
module.exports = __toCommonJS(src_exports);

// src/react/LogQLQueryBox.tsx
var import_react2 = require("react");
var import_core = require("./core.cjs");

// src/react/HelpDialog.tsx
var import_react = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime = require("react/jsx-runtime");
function withCode(text) {
  return text.split(/`([^`]+)`/).map((piece, i) => i % 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: piece }, i) : piece);
}
function HelpDialog({ labels, rootClass, rootStyle, theme, syntax, notes, shortcuts, onPick, onClose }) {
  const closeRef = (0, import_react.useRef)(null);
  const sheetRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
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
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        className: `${rootClass} lqb-modal`,
        style: rootStyle,
        "data-lqb-theme": theme,
        onKeyDown,
        onMouseDown: (e) => {
          if (e.target === e.currentTarget) onClose();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lqb-sheet", ref: sheetRef, role: "dialog", "aria-modal": "true", "aria-label": labels.helpTitle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", { children: [
            labels.helpTitle,
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "lqb-x", ref: closeRef, "aria-label": labels.helpClose, onClick: onClose, children: "\xD7" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: labels.helpSyntax }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "lqb-cheat", children: syntax.map(([q, text]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lqb-cheat-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => onPick(q), children: q }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: text })
            ] }, q)) })
          ] }),
          notes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: labels.helpCombine }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "lqb-notes", children: notes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: withCode(n) }, n)) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: labels.helpKeyboard }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "lqb-keys", children: [
              shortcuts && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Focus the filter box" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "/" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Run the search" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Enter" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "New line" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Shift" }),
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Enter" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Accept a suggestion" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Tab" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Move through suggestions" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "\u2191" }),
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "\u2193" })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Close suggestions or this help" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Esc" })
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
  savedAndRecent: "Saved and recent"
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
var import_jsx_runtime2 = require("react/jsx-runtime");
var useIsoLayoutEffect = typeof window === "undefined" ? import_react2.useEffect : import_react2.useLayoutEffect;
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
var LogQLQueryBox = (0, import_react2.forwardRef)(function LogQLQueryBox2(props, ref) {
  const {
    value,
    defaultValue = "",
    onChange,
    onExecute,
    onSave,
    schema,
    values,
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
    rows = 2,
    showHelp = true,
    showLogql = true,
    defaultLogqlOpen = false,
    executeOnMount = false,
    globalShortcuts = false,
    theme = "auto",
    className,
    style
  } = props;
  const labels = (0, import_react2.useMemo)(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const baseKey = JSON.stringify(baseSelector);
  const engine = (0, import_react2.useMemo)(() => props.engine ?? (0, import_core.createEngine)({ schema, values, matchCase, maxBranches, baseSelector }), [props.engine, schema, values, matchCase, maxBranches, baseKey]);
  const controlled = value !== void 0;
  const [inner, setInner] = (0, import_react2.useState)(defaultValue);
  const query = controlled ? value : inner;
  const [ran, setRan] = (0, import_react2.useState)(query);
  const [menu, setMenu] = (0, import_react2.useState)(null);
  const [logqlOpen, setLogqlOpen] = (0, import_react2.useState)(defaultLogqlOpen);
  const [helpOpen, setHelpOpen] = (0, import_react2.useState)(false);
  const [copied, setCopied] = (0, import_react2.useState)(null);
  const [storedRecent, setStoredRecent] = (0, import_react2.useState)([]);
  const inputRef = (0, import_react2.useRef)(null);
  const helpButtonRef = (0, import_react2.useRef)(null);
  const wrapRef = (0, import_react2.useRef)(null);
  const listRef = (0, import_react2.useRef)(null);
  const pendingCaret = (0, import_react2.useRef)(null);
  const copyTimer = (0, import_react2.useRef)(void 0);
  const mountRan = (0, import_react2.useRef)(false);
  const baseId = (0, import_react2.useId)();
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const optionId = (i) => `${baseId}-opt-${i}`;
  const analysis = (0, import_react2.useMemo)(() => engine.analyze(query), [engine, query]);
  const recentList = recent ?? storedRecent;
  const interactive = !disabled && !readOnly;
  const sugg = (0, import_react2.useMemo)(() => menu && interactive ? engine.suggest(query, menu.caret, { saved, recent: recentList }) : null, [menu, interactive, engine, query, saved, recentList]);
  const items = (0, import_react2.useMemo)(() => sugg ? [...sugg.items, ...sugg.extra] : [], [sugg]);
  const open = items.length > 0;
  const at = menu ? Math.min(menu.at, items.length - 1) : -1;
  const usable = (text) => [...text.matchAll(/(?:^|[\s(`-])([A-Za-z_][A-Za-z0-9_]*):/g)].every((m) => engine.schema.alias.has(m[1].toLowerCase()));
  const shownExamples = examples ?? defaultExamples.filter(usable);
  const shownSyntax = syntax ?? defaultSyntax.filter((s) => usable(s[0]));
  const shownNotes = notes ?? defaultNotes.filter(usable);
  (0, import_react2.useEffect)(() => {
    if (recent === void 0 && recentStorageKey) setStoredRecent(readRecent(recentStorageKey));
  }, [recent, recentStorageKey]);
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
    if (!open || !list || !("showPopover" in list)) return;
    list.setAttribute("popover", "manual");
    list.showPopover();
  }, [open]);
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    const anchor = wrapRef.current;
    if (!open || !list || !anchor) return;
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
  }, [open, items]);
  (0, import_react2.useEffect)(() => {
    if (!open || at < 0) return;
    document.getElementById(optionId(at))?.scrollIntoView?.({ block: "nearest" });
  }, [open, at]);
  (0, import_react2.useEffect)(() => () => clearTimeout(copyTimer.current), []);
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
  const execute = (q = query) => {
    const result = engine.analyze(q);
    if (result.error) return false;
    setRan(q);
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
    const pos = s + text.length;
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
      if (open && !e.shiftKey && currentToken()) {
        e.preventDefault();
        accept(at);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const it = open ? items[at] : void 0;
      const cur = currentToken();
      if (it?.kind === "value" && cur.indexOf(":") > 0 && it.text?.trim() !== cur) accept(at);
      else if (it?.whole != null && !cur && !query.trim()) accept(at);
      else {
        setMenu(null);
        if (!running) execute();
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setMenu(null);
      } else {
        inputRef.current?.blur();
      }
    }
  };
  (0, import_react2.useEffect)(() => {
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
  (0, import_react2.useEffect)(() => {
    if (!executeOnMount || mountRan.current) return;
    mountRan.current = true;
    execute(query);
  });
  (0, import_react2.useImperativeHandle)(ref, () => ({
    focus: () => inputRef.current?.focus(),
    getQuery: () => query,
    setQuery: (q, options) => options?.run === false ? change(q) : commit(q),
    execute: () => execute(),
    toggleValue: (field, v, negative) => commit(engine.toggleValue(query, field, v, negative)),
    clearField: (field) => commit(engine.clearField(query, field)),
    appendTerm: (field, list, negative) => commit(engine.appendTerm(query, field, list, negative))
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
  const row = (it, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
        it.color && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("i", { style: { "--lqb-c": it.color } }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: it.label }),
        it.sub && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "lqb-hint lqb-sub", children: it.sub }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "lqb-hint", children: it.hint ?? "" })
      ]
    },
    `${it.kind}-${it.label}-${i}`
  );
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: rootClass, style, "data-lqb-theme": themeAttr, "aria-busy": running || void 0, children: [
    (blurb !== false || showHelp) && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-head", children: [
      blurb !== false ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "lqb-desc", children: blurb }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", {}),
      showHelp && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "lqb-link", ref: helpButtonRef, onClick: () => setHelpOpen(true), children: labels.help })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-wrap", ref: wrapRef, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-box", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "textarea",
            {
              ref: inputRef,
              rows,
              role: "combobox",
              "aria-expanded": open,
              "aria-controls": open ? listId : void 0,
              "aria-activedescendant": open && at >= 0 ? optionId(at) : void 0,
              "aria-autocomplete": "list",
              "aria-label": labels.ariaLabel,
              "aria-invalid": blocked || void 0,
              "aria-describedby": blocked ? errorId : void 0,
              placeholder: labels.placeholder,
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
              onFocus: openMenu,
              onClick: openMenu,
              onBlur: () => setMenu(null),
              onKeyDown,
              onKeyUp: (e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") openMenu();
              }
            }
          ),
          query && interactive && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
          onSave && interactive && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "lqb-icon-btn", "aria-label": labels.save, title: savedMatch ? labels.savedAs(savedMatch.name) : labels.save, onClick: () => onSave(query, savedMatch), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { ...ICON, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" }) }) })
        ] }),
        analysis.parsed.children.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-chips", children: [
          analysis.parsed.children.slice(0, CHIP_LIMIT).map((node, i) => {
            const text = engine.chipText(node);
            return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: engine.isNegative(node) ? "lqb-chip lqb-chip-neg" : "lqb-chip", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { title: text, children: (0, import_core.chipLabel)(text) }),
              interactive && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                "button",
                {
                  type: "button",
                  "aria-label": labels.removeFilter(text),
                  onClick: () => {
                    commit(engine.removeNode(query, node));
                    if (analysis.parsed.children.length === 1) inputRef.current?.focus();
                  },
                  children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { ...ICON, width: 10, height: 10, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M5 5l14 14M19 5L5 19" }) })
                }
              )
            ] }, `${node.id}-${i}`);
          }),
          analysis.parsed.children.length > CHIP_LIMIT && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "lqb-chip lqb-chip-more", children: labels.moreFilters(analysis.parsed.children.length - CHIP_LIMIT) })
        ] })
      ] }),
      open && sugg && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-sugg", ref: listRef, id: listId, role: "listbox", "aria-label": labels.ariaLabel, onMouseDown: (e) => e.preventDefault(), children: [
        sugg.items.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "group", "aria-label": sugg.head || labels.ariaLabel, children: [
          sugg.head && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "lqb-sg-h", "aria-hidden": "true", children: sugg.head }),
          sugg.items.map((it, i) => row(it, i))
        ] }),
        sugg.extra.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { role: "group", "aria-label": labels.savedAndRecent, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "lqb-sg-h", "aria-hidden": "true", children: labels.savedAndRecent }),
          sugg.extra.map((it, i) => row(it, i + sugg.items.length))
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "lqb-sr", "aria-live": "polite", children: open ? labels.suggestionCount(items.length) : "" })
    ] }),
    analysis.error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "lqb-error", id: errorId, role: "alert", children: analysis.error }),
    !query.trim() && shownExamples.length > 0 && interactive && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-try", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: labels.tryLabel }),
      shownExamples.map((q) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => commit(q), children: q }, q))
    ] }),
    showLogql && logqlOpen && !analysis.error && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-logql", children: [
      analysis.logql.branches.map((branch, i) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-pre-h", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: analysis.logql.branches.length > 1 ? labels.branch(i + 1, analysis.logql.branches.length) : labels.logQuery }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "lqb-mini", onClick: () => copyBranch(i, branch), children: copied?.index === i ? copied.text : labels.copy })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { children: branch })
      ] }, i)),
      analysis.logql.branches.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "lqb-note", children: labels.mergeNote })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "lqb-runbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: blocked ? "lqb-status lqb-status-warn" : "lqb-status", role: "status", children: status }),
      showLogql && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "lqb-link", "aria-expanded": logqlOpen, onClick: () => setLogqlOpen((x) => !x), children: logqlOpen ? labels.hideLogql : labels.showLogql }),
      actions,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: isDirty || blocked ? "lqb-run" : "lqb-run lqb-run-idle", disabled: blocked || disabled || running, onClick: () => execute(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { ...ICON, width: 14, height: 14, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M7 4l13 8-13 8z" }) }),
        labels.execute
      ] })
    ] }),
    helpOpen && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    )
  ] });
});

// src/index.ts
__reExport(src_exports, require("./core.cjs"), module.exports);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LogQLQueryBox,
  defaultExamples,
  defaultLabels,
  defaultNotes,
  defaultSyntax,
  ...require("./core.cjs")
});
//# sourceMappingURL=index.cjs.map