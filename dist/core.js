// src/core/regex.ts
var UNSUPPORTED_REGEX = "Loki uses RE2, which does not support lookaround or backreferences.";
var INVALID_REGEX = "This is not a valid regular expression.";
var POSIX = {
  alnum: [[48, 57], [65, 90], [97, 122]],
  alpha: [[65, 90], [97, 122]],
  ascii: [[0, 127]],
  blank: [[9, 9], [32, 32]],
  cntrl: [[0, 31], [127, 127]],
  digit: [[48, 57]],
  graph: [[33, 126]],
  lower: [[97, 122]],
  print: [[32, 126]],
  punct: [[33, 47], [58, 64], [91, 96], [123, 126]],
  space: [[9, 13], [32, 32]],
  upper: [[65, 90]],
  word: [[48, 57], [65, 90], [95, 95], [97, 122]],
  xdigit: [[48, 57], [65, 70], [97, 102]]
};
var SIMPLE_ESCAPE = { a: 7, f: 12, n: 10, r: 13, t: 9, v: 11 };
var CACHE_LIMIT = 500;
var LOOP_LIMIT = 4;
var LONG_REPEAT = 10;
var WIDE_REPEAT_LIMIT = 4;
var OVERLAP_SAMPLE = [...Array.from({ length: 118 }, (_, i) => String.fromCharCode(i + 9)), "\xE9", "\u4E2D", "\u{1F600}"];
var RISK_ATOM = /\\u\{[0-9a-f]+\}|\\[pP]\{[^}]*\}|\\.|\[(?:\\.|[^\]\\])*\]|[\s\S]/uy;
var RISK_REPEAT = /(?:\*|\+|\?|\{(\d+)(?:(,)(\d*))?\})\??/y;
var LITERAL_ATOM = /^(?:\\u\{[0-9a-f]+\}|[^\\.[\]])$/u;
var WIDE_ATOM = /^(?:\.|\[\^|\\[DSWP])/;
var ZERO_WIDTH_ATOM = /^(?:\^|\$|\\[bB])$/;
var point = (cp) => `\\u{${cp.toString(16)}}`;
function readEscape(p, i) {
  const d = p[i + 1];
  if (d === void 0) return { problem: INVALID_REGEX };
  if (d === "k") return { problem: UNSUPPORTED_REGEX };
  if (d >= "1" && d <= "9") {
    const octalFollows = d <= "7" && p[i + 2] >= "0" && p[i + 2] <= "7";
    if (!octalFollows) return { problem: UNSUPPORTED_REGEX };
  }
  if (d >= "0" && d <= "7") {
    let cp = 0;
    let j = i + 1;
    while (j < i + 4 && p[j] >= "0" && p[j] <= "7") cp = cp * 8 + Number(p[j++]);
    return { cp, next: j };
  }
  if (d === "x") {
    if (p[i + 2] === "{") {
      const end = p.indexOf("}", i + 3);
      const hex2 = end < 0 ? "" : p.slice(i + 3, end);
      if (!/^[0-9a-fA-F]+$/.test(hex2) || parseInt(hex2, 16) > 1114111) return { problem: INVALID_REGEX };
      return { cp: parseInt(hex2, 16), next: end + 1 };
    }
    const hex = p.slice(i + 2, i + 4);
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) return { problem: INVALID_REGEX };
    return { cp: parseInt(hex, 16), next: i + 4 };
  }
  if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPE, d)) return { cp: SIMPLE_ESCAPE[d], next: i + 2 };
  if (/[\x00-\x7f]/.test(d) && !/[0-9A-Za-z]/.test(d)) return { cp: d.charCodeAt(0), next: i + 2 };
  return { problem: INVALID_REGEX };
}
function readUnicodeClass(p, i) {
  let negative = p[i + 1] === "P";
  let name;
  let next;
  if (p[i + 2] === "{") {
    const end = p.indexOf("}", i + 3);
    if (end < 0) return null;
    name = p.slice(i + 3, end);
    next = end + 1;
    if (name[0] === "^") {
      negative = !negative;
      name = name.slice(1);
    }
  } else {
    if (p[i + 2] === void 0) return null;
    name = p[i + 2];
    next = i + 3;
  }
  const letter = negative ? "P" : "p";
  for (const body of [name, `Script=${name}`]) {
    const js = `\\${letter}{${body}}`;
    try {
      new RegExp(js, "u");
      return { js, next };
    } catch {
      continue;
    }
  }
  return null;
}
function readClass(p, start) {
  let i = start + 1;
  let out = "[";
  if (p[i] === "^") {
    out += "^";
    i++;
  }
  let first = true;
  const single = () => {
    if (p[i] === "\\") {
      const e = readEscape(p, i);
      if ("problem" in e) return e;
      i = e.next;
      return { cp: e.cp };
    }
    const cp = p.codePointAt(i);
    i += cp > 65535 ? 2 : 1;
    return { cp };
  };
  while (i < p.length && (p[i] !== "]" || first)) {
    first = false;
    if (p.startsWith("[:", i)) {
      const end = p.indexOf(":]", i + 2);
      if (end >= 0) {
        const raw = p.slice(i + 2, end);
        const name = raw.replace(/^\^/, "");
        if (!Object.prototype.hasOwnProperty.call(POSIX, name)) return { problem: INVALID_REGEX };
        const ranges = POSIX[name];
        if (raw[0] === "^") {
          let from = 0;
          for (const [lo2, hi] of ranges) {
            if (lo2 > from) out += `${point(from)}-${point(lo2 - 1)}`;
            from = hi + 1;
          }
          out += `${point(from)}-${point(1114111)}`;
        } else {
          for (const [lo2, hi] of ranges) out += `${point(lo2)}-${point(hi)}`;
        }
        i = end + 2;
        continue;
      }
    }
    if (p[i] === "\\" && /[dDsSwW]/.test(p[i + 1] ?? "")) {
      out += p[i + 1] === "s" ? "\\t\\n\\f\\r " : `\\${p[i + 1]}`;
      i += 2;
      continue;
    }
    if (p[i] === "\\" && (p[i + 1] === "p" || p[i + 1] === "P")) {
      const u = readUnicodeClass(p, i);
      if (!u) return { problem: INVALID_REGEX };
      out += u.js;
      i = u.next;
      continue;
    }
    const lo = single();
    if ("problem" in lo) return lo;
    if (p[i] === "-" && i + 1 < p.length && p[i + 1] !== "]") {
      i++;
      const hi = single();
      if ("problem" in hi) return hi;
      if (hi.cp < lo.cp) return { problem: INVALID_REGEX };
      out += `${point(lo.cp)}-${point(hi.cp)}`;
    } else {
      out += point(lo.cp);
    }
  }
  if (i >= p.length) return { problem: INVALID_REGEX };
  return { js: `${out}]`, next: i + 1 };
}
function sharesCharacters(a, b) {
  if (!a || !b || a === b) return true;
  try {
    const left = new RegExp(`^(?:${a})$`, "iu");
    const right = new RegExp(`^(?:${b})$`, "iu");
    return OVERLAP_SAMPLE.some((ch) => left.test(ch) && right.test(ch));
  } catch {
    return true;
  }
}
function isRisky(source) {
  let pending = [];
  const frame = () => ({ varying: false, firsts: [], first: null, required: false, nullable: false, entry: pending, exits: [] });
  const stack = [frame()];
  let wide = 0;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "(") {
      i += source[i + 1] === "?" ? 3 : 1;
      stack.push(frame());
      continue;
    }
    if (c === "|") {
      const top = stack[stack.length - 1];
      top.firsts.push(top.first ?? "");
      top.first = null;
      if (!top.required) top.nullable = true;
      top.required = false;
      top.exits.push(...pending);
      pending = top.entry;
      wide = 0;
      i++;
      continue;
    }
    let atom = "";
    let group;
    if (c === ")") {
      group = stack.pop();
      i++;
    } else {
      RISK_ATOM.lastIndex = i;
      atom = RISK_ATOM.exec(source)[0];
      i += atom.length;
    }
    RISK_REPEAT.lastIndex = i;
    const q = RISK_REPEAT.exec(source);
    let min = 1;
    let max = 1;
    if (q) {
      i += q[0].length;
      const head = q[0][0];
      min = head === "+" || head === "{" ? Number(q[1] ?? 1) : 0;
      max = head === "?" ? 1 : head !== "{" ? Infinity : q[2] ? q[3] ? Number(q[3]) : Infinity : min;
    }
    const parent = stack[stack.length - 1];
    let repeated = atom;
    if (group) {
      const branches = [...group.firsts, group.first ?? ""];
      repeated = branches.length === 1 ? branches[0] : "";
      const exits = [...group.exits, ...pending];
      pending = max >= LONG_REPEAT ? group.entry : min === 0 ? [...group.entry, ...exits] : exits;
      const overlap = branches.length > 1 && (branches.includes("") || new Set(branches).size < branches.length);
      const nullable = group.nullable || !group.required;
      if (max >= LOOP_LIMIT && (group.varying || overlap)) return true;
      if (max > 1 && group.varying && nullable) return true;
      if (group.varying) parent.varying = true;
      if (min > 0 && !nullable) parent.required = true;
    } else if (min > 0) {
      parent.required = true;
    }
    if (min !== max) parent.varying = true;
    if (parent.first === null) parent.first = !group && min > 0 && LITERAL_ATOM.test(atom) ? atom.toLowerCase() : "";
    if (max >= LONG_REPEAT) {
      if (pending.some((earlier) => sharesCharacters(earlier, repeated))) return true;
      if (WIDE_ATOM.test(atom) && ++wide >= WIDE_REPEAT_LIMIT) return true;
      pending = min > 0 ? [repeated] : [...pending, repeated];
    } else if (!group && min > 0 && !ZERO_WIDTH_ATOM.test(atom)) {
      pending = pending.filter((earlier) => !WIDE_ATOM.test(earlier) && sharesCharacters(earlier, atom));
    }
  }
  return false;
}
function translate(p) {
  let out = "";
  let flags = "u";
  let i = 0;
  let caseSensitive = false;
  const stop = (problem) => ({ source: "", flags: "", problem, caseSensitive, risky: false });
  while (i < p.length) {
    const c = p[i];
    if (c === "\\") {
      const d = p[i + 1];
      if (d === "Q") {
        const end = p.indexOf("\\E", i + 2);
        const literal = p.slice(i + 2, end < 0 ? p.length : end);
        for (const ch of literal) out += point(ch.codePointAt(0));
        i = end < 0 ? p.length : end + 2;
        continue;
      }
      if (d === "A") {
        out += "(?:^)";
        i += 2;
        continue;
      }
      if (d === "z") {
        out += "(?:(?![\\s\\S]))";
        i += 2;
        continue;
      }
      if (d === "b" || d === "B") {
        out += `(?:\\${d})`;
        i += 2;
        continue;
      }
      if (d === "d" || d === "D" || d === "w" || d === "W") {
        out += `\\${d}`;
        i += 2;
        continue;
      }
      if (d === "s" || d === "S") {
        out += d === "s" ? "[\\t\\n\\f\\r ]" : "[^\\t\\n\\f\\r ]";
        i += 2;
        continue;
      }
      if (d === "p" || d === "P") {
        const u = readUnicodeClass(p, i);
        if (!u) return stop(INVALID_REGEX);
        out += u.js;
        i = u.next;
        continue;
      }
      const e = readEscape(p, i);
      if ("problem" in e) return stop(e.problem);
      out += point(e.cp);
      i = e.next;
      continue;
    }
    if (c === "[") {
      const k = readClass(p, i);
      if ("problem" in k) return stop(k.problem);
      out += k.js;
      i = k.next;
      continue;
    }
    if (c === "(" && p[i + 1] === "?") {
      const rest = p.slice(i);
      if (/^\(\?(?:=|!|<=|<!)/.test(rest)) return stop(UNSUPPORTED_REGEX);
      const named = /^\(\?P?<([A-Za-z0-9_]+)>/.exec(rest);
      if (named) {
        out += "(";
        i += named[0].length;
        continue;
      }
      const inline = /^\(\?([imsU]*)(-[imsU]+)?([:)])/.exec(rest);
      if (!inline) return stop(INVALID_REGEX);
      i += inline[0].length;
      if (inline[3] === ":") {
        out += "(?:";
      } else if (out === "") {
        for (const f of inline[1]) if ("ims".includes(f) && !flags.includes(f)) flags += f;
        if (inline[2]?.includes("i")) {
          caseSensitive = true;
          flags = flags.replace("i", "");
        }
      } else if (/[*+?}]$/.test(out)) {
        out += "(?:)";
      }
      continue;
    }
    if (c === "^" || c === "$") {
      out += `(?:${c})`;
      i++;
      continue;
    }
    if (c === "{") {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(p.slice(i));
      if (!m) {
        out += "\\{";
        i++;
        continue;
      }
      const min = Number(m[1]);
      const max = m[2] ? m[3] === "" ? -1 : Number(m[3]) : min;
      if (min > 1e3 || max > 1e3 || max >= 0 && min > max) return stop(INVALID_REGEX);
      out += m[0];
      i += m[0].length;
      continue;
    }
    if (c === "}" || c === "]") {
      out += `\\${c}`;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  try {
    new RegExp(out, flags);
  } catch {
    return stop(INVALID_REGEX);
  }
  return { source: out, flags, problem: null, caseSensitive, risky: isRisky(out) };
}
var cache = /* @__PURE__ */ new Map();
function translated(p) {
  let t = cache.get(p);
  if (!t) {
    if (cache.size >= CACHE_LIMIT) cache.clear();
    t = translate(p);
    cache.set(p, t);
  }
  return t;
}
function regexProblem(p) {
  return translated(p).problem;
}
function isRiskyRegex(p) {
  return translated(p).risky;
}
function toJsRegex(p, ci, anchored) {
  const t = translated(p);
  if (t.problem) throw new Error(t.problem);
  const flags = ci && !t.caseSensitive && !t.flags.includes("i") ? `${t.flags}i` : t.flags;
  return new RegExp(anchored ? `^(?:${t.source})$` : t.source, flags);
}
function matchesEmpty(p) {
  try {
    return toJsRegex(p, false, true).test("");
  } catch {
    return true;
  }
}
function reEsc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/core/tree.ts
var FLIP = {
  contains: "not_contains",
  not_contains: "contains",
  eq: "neq",
  neq: "eq",
  regex: "not_regex",
  not_regex: "regex",
  in: "not_in",
  not_in: "in"
};
function splitList(s) {
  return String(s).split(",").map((x) => x.trim()).filter(Boolean);
}
function listOf(c) {
  return Array.isArray(c.value) ? c.value : splitList(c.value);
}
function valOf(c) {
  if (Array.isArray(c.value)) return c.value[0] == null ? "" : String(c.value[0]);
  return String(c.value == null ? "" : c.value);
}
function isEmpty(c) {
  if (c.op === "in" || c.op === "not_in") return listOf(c).length === 0;
  return valOf(c).trim() === "";
}
function condProblem(c) {
  if (c.op !== "regex" && c.op !== "not_regex") return null;
  const p = valOf(c);
  return p ? regexProblem(p) : null;
}
function activeTree(n) {
  if (n.type === "cond") return !isEmpty(n) && !condProblem(n) ? n : null;
  const kids = n.children.map(activeTree).filter(Boolean);
  return kids.length ? { id: n.id, type: "group", op: n.op, children: kids } : null;
}
function problems(n) {
  if (n.type === "cond") {
    const p = condProblem(n);
    return p ? [p] : [];
  }
  return n.children.flatMap(problems);
}
function hasRiskyRegex(n) {
  if (n.type === "group") return n.children.some(hasRiskyRegex);
  return (n.op === "regex" || n.op === "not_regex") && isRiskyRegex(valOf(n));
}
function negate(n) {
  if (n.type === "cond") {
    n.op = FLIP[n.op] ?? n.op;
    return n;
  }
  n.op = n.op === "AND" ? "OR" : "AND";
  n.children.forEach(negate);
  return n;
}
function isNegative(n) {
  return n.type === "cond" && (n.op === "neq" || n.op === "not_in" || n.op === "not_contains" || n.op === "not_regex");
}
function expandGroups(n, schema) {
  if (n.type === "group") return { ...n, children: n.children.map((ch) => expandGroups(ch, schema)) };
  const groups = schema.fields.get(n.field)?.groups;
  if (!groups?.size || !(n.op === "eq" || n.op === "neq" || n.op === "in" || n.op === "not_in")) return n;
  const values = Array.isArray(n.value) ? n.value : [valOf(n)];
  const expanded = [...new Set(values.flatMap((v) => groups.get(v.toLowerCase()) ?? [v]))];
  if (expanded.length === values.length && expanded.every((v, i) => v === values[i])) return n;
  return { ...n, op: isNegative(n) ? "not_in" : "in", value: expanded };
}
function testCond(c, r, schema, matchCase) {
  const raw = r[c.field];
  const hay = String(raw == null ? "" : raw);
  const isLine = c.field === schema.lineField;
  const ci = isLine && !matchCase;
  const H = ci ? hay.toLowerCase() : hay;
  const N = (s) => ci ? String(s).toLowerCase() : String(s);
  const v = valOf(c);
  switch (c.op) {
    case "contains":
      return H.indexOf(N(v)) >= 0;
    case "not_contains":
      return H.indexOf(N(v)) < 0;
    case "eq":
      return H === N(v);
    case "neq":
      return H !== N(v);
    case "starts":
      return H.indexOf(N(v)) === 0;
    case "ends":
      return H.length >= N(v).length && H.slice(H.length - N(v).length) === N(v);
    case "regex":
      return isRiskyRegex(v) || toJsRegex(v, ci, !isLine).test(hay);
    case "not_regex":
      return isRiskyRegex(v) || !toJsRegex(v, ci, !isLine).test(hay);
    case "in":
      return isLine ? listOf(c).some((x) => H.indexOf(N(x)) >= 0) : listOf(c).indexOf(hay) >= 0;
    case "not_in":
      return isLine ? !listOf(c).some((x) => H.indexOf(N(x)) >= 0) : listOf(c).indexOf(hay) < 0;
  }
}
function evaluate(n, r, schema, matchCase) {
  if (n.type === "cond") return testCond(n, r, schema, matchCase);
  if (n.op === "OR") return n.children.some((ch) => evaluate(ch, r, schema, matchCase));
  return n.children.every((ch) => evaluate(ch, r, schema, matchCase));
}
function toFilter(n) {
  if (n.type === "cond") return { field: n.field, operator: n.op, value: n.op === "in" || n.op === "not_in" ? listOf(n) : valOf(n) };
  return { logic: n.op, filters: n.children.map(toFilter) };
}

// src/core/chips.ts
function chipText(n, schema) {
  if (n.type === "group") return `(${n.children.map((c) => chipText(c, schema)).join(n.op === "OR" ? " OR " : " ")})`;
  const v = valOf(n);
  const L = listOf(n);
  if (n.field === schema.lineField) {
    if (n.op === "contains") return `\u201C${v}\u201D`;
    if (n.op === "not_contains") return `not \u201C${v}\u201D`;
    if (n.op === "regex") return `/${v}/`;
    return `not /${v}/`;
  }
  const l = schema.fields.get(n.field)?.label ?? n.field;
  switch (n.op) {
    case "eq":
      return `${l} is ${v}`;
    case "neq":
      return `${l} is not ${v}`;
    case "in":
      return `${l} is ${L.join(" or ")}`;
    case "not_in":
      return `${l} is not ${L.join(" or ")}`;
    case "regex":
      return `${l} matches /${v}/`;
    default:
      return `${l} does not match /${v}/`;
  }
}
function chipLabel(text) {
  return text.length > 70 ? `${text.slice(0, 68)}\u2026` : text;
}

// src/core/compile.ts
var MAX_BRANCHES = 12;
var INLINE_I = /^\(\?[imsU]*i[imsU]*(?:-[imsU]+)?\)/;
var RAW_SAFE = /^[\w .:,;=-]+$/;
function countBranches(n) {
  if (n.type === "cond") return 1;
  const parts = n.children.map(countBranches);
  return n.op === "OR" ? parts.reduce((a, b) => a + b, 0) : parts.reduce((a, b) => a * b, 1);
}
function dnf(n) {
  if (n.type === "cond") return [[n]];
  const parts = n.children.map(dnf);
  if (n.op === "OR") return parts.flat();
  const total = parts.reduce((product, p) => product * p.length, 1);
  const out = [];
  for (let k = 0; k < total; k++) {
    const branch = [];
    let stride = total;
    for (const p of parts) {
      stride /= p.length;
      for (const c of p[Math.floor(k / stride) % p.length]) branch.push(c);
    }
    out.push(branch);
  }
  return out;
}
function logqlString(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
}
function pipelineMatcher(c) {
  const n = c.field;
  const v = valOf(c);
  switch (c.op) {
    case "regex":
      return `${n}=~${logqlString(`^(?:${v})$`)}`;
    case "not_regex":
      return `${n}!~${logqlString(`^(?:${v})$`)}`;
    case "starts":
      return `${n}=~${logqlString(`^(?:${reEsc(v)}.*)$`)}`;
    case "ends":
      return `${n}=~${logqlString(`^(?:.*${reEsc(v)})$`)}`;
    default:
      return labelMatcher(c);
  }
}
function labelMatcher(c) {
  const n = c.field;
  const v = valOf(c);
  const L = listOf(c);
  switch (c.op) {
    case "eq":
      return `${n}=${logqlString(v)}`;
    case "neq":
      return `${n}!=${logqlString(v)}`;
    case "in":
      return `${n}=~${logqlString(L.map(reEsc).join("|"))}`;
    case "not_in":
      return `${n}!~${logqlString(L.map(reEsc).join("|"))}`;
    case "regex":
      return `${n}=~${logqlString(v)}`;
    case "not_regex":
      return `${n}!~${logqlString(v)}`;
    case "contains":
      return `${n}=~${logqlString(`.*${reEsc(v)}.*`)}`;
    case "not_contains":
      return `${n}!~${logqlString(`.*${reEsc(v)}.*`)}`;
    case "starts":
      return `${n}=~${logqlString(`${reEsc(v)}.*`)}`;
    case "ends":
      return `${n}=~${logqlString(`.*${reEsc(v)}`)}`;
  }
}
function lineFilter(c, matchCase) {
  const v = valOf(c);
  const pre = matchCase ? "" : "(?i)";
  const L = listOf(c);
  const userRegex = matchCase || INLINE_I.test(v) ? v : `(?i)${v}`;
  switch (c.op) {
    case "contains":
      return matchCase ? `|= ${logqlString(v)}` : `|~ ${logqlString(pre + reEsc(v))}`;
    case "not_contains":
      return matchCase ? `!= ${logqlString(v)}` : `!~ ${logqlString(pre + reEsc(v))}`;
    case "eq":
      return `|~ ${logqlString(`${pre}^${reEsc(v)}$`)}`;
    case "neq":
      return `!~ ${logqlString(`${pre}^${reEsc(v)}$`)}`;
    case "starts":
      return `|~ ${logqlString(`${pre}^${reEsc(v)}`)}`;
    case "ends":
      return `|~ ${logqlString(`${pre}${reEsc(v)}$`)}`;
    case "regex":
      return `|~ ${logqlString(userRegex)}`;
    case "not_regex":
      return `!~ ${logqlString(userRegex)}`;
    case "in":
      return `|~ ${logqlString(pre + L.map(reEsc).join("|"))}`;
    case "not_in":
      return `!~ ${logqlString(pre + L.map(reEsc).join("|"))}`;
  }
}
function canAnchorStream(c) {
  switch (c.op) {
    case "eq":
    case "contains":
    case "starts":
    case "ends":
      return valOf(c) !== "";
    case "in":
      return listOf(c).every((v) => v !== "");
    case "regex":
      return !matchesEmpty(valOf(c));
    default:
      return false;
  }
}
function baseMatchers(schema) {
  return schema.baseSelector.filter(([, value]) => value !== "").map(([name, value]) => `${name}=${logqlString(value)}`);
}
function unwrap(n) {
  return n.type === "group" && n.children.length === 1 ? unwrap(n.children[0]) : n;
}
function conjuncts(n) {
  const u = unwrap(n);
  return u.type === "group" && u.op === "AND" ? u.children.flatMap(conjuncts) : [u];
}
function leaves(n) {
  return n.type === "cond" ? [n] : n.children.flatMap(leaves);
}
function lineRegex(c) {
  const v = valOf(c);
  switch (c.op) {
    case "eq":
    case "neq":
      return `^${reEsc(v)}$`;
    case "starts":
      return `^${reEsc(v)}`;
    case "ends":
      return `${reEsc(v)}$`;
    case "regex":
    case "not_regex":
      return v;
    case "in":
    case "not_in":
      return listOf(c).map(reEsc).join("|");
    default:
      return reEsc(v);
  }
}
function parsedLineMatcher(c, matchCase) {
  const body = lineRegex(c);
  const plain = c.op === "contains" || c.op === "not_contains";
  const pattern = plain ? `(?${matchCase ? "" : "i"}s).*${body}.*` : `${matchCase ? "" : "(?i)"}^(?s:.*)(?:${body})(?s:.*)$`;
  return `${c.field}${isNegative(c) ? "!~" : "=~"}${logqlString(pattern)}`;
}
function labelExpr(n, schema, matchCase, nested = false) {
  const u = unwrap(n);
  if (u.type === "cond") return u.field === schema.lineField ? parsedLineMatcher(u, matchCase) : pipelineMatcher(u);
  const body = u.children.map((ch) => labelExpr(ch, schema, matchCase, true)).join(u.op === "OR" ? " or " : " and ");
  return nested ? `(${body})` : body;
}
function lineAlternatives(n) {
  const u = unwrap(n);
  if (u.type === "cond") {
    if (isNegative(u)) return null;
    return [u.op === "regex" ? `(?:${lineRegex(u)})` : lineRegex(u)];
  }
  if (u.op !== "OR") return null;
  const parts = u.children.map(lineAlternatives);
  return parts.every(Boolean) ? parts.flat() : null;
}
function rawHint(n, schema) {
  const u = unwrap(n);
  if (u.type === "group") {
    const hints = u.children.map((ch) => rawHint(ch, schema));
    if (u.op === "OR") return hints.every(Boolean) ? hints.join("|") : null;
    return hints.find(Boolean) ?? null;
  }
  if (u.field !== schema.lineField || isNegative(u) || u.op === "regex") return null;
  const terms = u.op === "in" ? listOf(u) : [valOf(u)];
  return terms.every((v) => RAW_SAFE.test(v)) ? terms.map(reEsc).join("|") : null;
}
function fitsOneQuery(n, schema) {
  if (n.type === "cond" || schema.parsedLine) return true;
  const conds = leaves(n);
  if (conds.every((c) => c.field !== schema.lineField)) return true;
  return conds.every((c) => c.field === schema.lineField) && lineAlternatives(n) !== null;
}
function parserStage(schema, fields) {
  return schema.parser === "json" ? `| json ${[...fields].join(", ")} | __error__=""` : `| ${schema.parser} | __error__=""`;
}
function compileBranch(parts, schema, matchCase) {
  const sel = baseMatchers(schema);
  const lines = [];
  const labs = [];
  const parsed = /* @__PURE__ */ new Set();
  let strong = sel.length > 0;
  const pre = matchCase ? "" : "(?i)";
  const parse2 = (c) => {
    if (!schema.fields.get(c.field)?.indexed) parsed.add(c.field);
  };
  for (const part of parts) {
    const hint = schema.parsedLine ? rawHint(part, schema) : null;
    if (hint) lines.push(`|~ ${logqlString(pre + hint)}`);
    if (part.type === "group") {
      if (!schema.parsedLine && leaves(part).every((c) => c.field === schema.lineField)) {
        lines.push(`|~ ${logqlString(pre + lineAlternatives(part).join("|"))}`);
      } else {
        labs.push(`| ${labelExpr(part, schema, matchCase)}`);
        leaves(part).forEach(parse2);
      }
    } else if (part.field === schema.lineField && !schema.parsedLine) lines.push(lineFilter(part, matchCase));
    else if (schema.fields.get(part.field)?.indexed) {
      sel.push(labelMatcher(part));
      if (canAnchorStream(part)) strong = true;
    } else {
      labs.push(`| ${labelExpr(part, schema, matchCase)}`);
      parse2(part);
    }
  }
  if (!strong) sel.push(`${schema.selectorField}=~".+"`);
  const parser = parsed.size && schema.parser ? [parserStage(schema, parsed)] : [];
  return `{${sel.join(", ")}}${[...lines, ...parser, ...labs].map((s) => `
  ${s}`).join("")}`;
}
function compile(tree, schema, matchCase, maxBranches) {
  if (!tree) return { branches: [compileBranch([], schema, matchCase)], tooMany: false, count: 1 };
  if (schema.parser) {
    const parts = conjuncts(tree);
    if (parts.every((p) => fitsOneQuery(p, schema))) return { branches: [compileBranch(parts, schema, matchCase)], tooMany: false, count: 1 };
  }
  const count = countBranches(tree);
  if (count > maxBranches) return { tooMany: true, count: Math.min(count, Number.MAX_SAFE_INTEGER), branches: [] };
  const branches = [...new Set(dnf(tree).map((b) => compileBranch(b, schema, matchCase)))];
  return { branches, tooMany: false, count: branches.length };
}

// src/core/tokenize.ts
var FIELD = /([A-Za-z_][A-Za-z0-9_]*):/y;
var WORD = /[^\s()]*/y;
var LIST_ITEM = /[^\s(),]*/y;
var SPACE = /\s/;
function closingSlash(src, i, classAware) {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (classAware && c === "[") {
      j++;
      if (src[j] === "^") j++;
      if (src[j] === "]") j++;
      while (j < src.length && src[j] !== "]") j += src[j] === "\\" ? 2 : 1;
      j++;
      continue;
    }
    if (c === "/") return j + 1 >= src.length || /[\s()]/.test(src[j + 1]) ? j : -1;
    j++;
  }
  return -1;
}
function regexEndAt(src, i) {
  const end = closingSlash(src, i, true);
  return end > 0 ? end : closingSlash(src, i, false);
}
function readPhrase(src, i) {
  const n = src.length;
  let j = i + 1;
  let v = "";
  while (j < n && src[j] !== '"') {
    if (src[j] === "\\" && j + 1 < n) {
      v += src[j + 1];
      j += 2;
    } else {
      v += src[j++];
    }
  }
  return j >= n ? null : { value: v, end: j + 1 };
}
function sticky(re, src, i) {
  re.lastIndex = i;
  const m = re.exec(src);
  return m ? m[0] : "";
}
function tokenize(src, schema) {
  const toks = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const ch = src[i];
    if (SPACE.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      toks.push({ t: ch, s: i, e: i + 1 });
      i++;
      continue;
    }
    const s = i;
    let neg = false;
    let field = null;
    if (ch === "-" && i + 1 < n && !SPACE.test(src[i + 1])) {
      neg = true;
      i++;
    }
    if (neg && src[i] === "(") {
      toks.push({ t: "(", s, e: i + 1, neg: true });
      i++;
      continue;
    }
    FIELD.lastIndex = i;
    const m = FIELD.exec(src);
    const known = m ? schema.alias.get(m[1].toLowerCase()) : void 0;
    if (m && known) {
      field = known;
      i += m[0].length;
    }
    if (field && field !== schema.lineField && !(src[i] === "/" && regexEndAt(src, i) > 0)) {
      const parts = [];
      const quotes2 = [];
      while (i < n) {
        if (src[i] === '"') {
          const p = readPhrase(src, i);
          if (!p) return { toks, open: s, error: `The quote that starts at character ${i + 1} is never closed.` };
          parts.push({ v: p.value, wild: false });
          quotes2.push([i, p.end]);
          i = p.end;
        } else {
          const bare = sticky(LIST_ITEM, src, i);
          if (bare) parts.push({ v: bare, wild: bare.includes("*") });
          i += bare.length;
        }
        if (src[i] !== ",") break;
        i++;
      }
      toks.push(parts.length ? { t: "term", neg, field, kind: "word", parts, quotes: quotes2, s, e: i } : { t: "skip", s, e: i });
      continue;
    }
    let kind = "word";
    let value = "";
    let quotes = [];
    if (src[i] === '"') {
      const p = readPhrase(src, i);
      if (!p) return { toks, open: s, error: `The quote that starts at character ${i + 1} is never closed.` };
      quotes = [[i, p.end]];
      value = p.value;
      i = p.end;
      kind = "phrase";
    } else if (src[i] === "/" && regexEndAt(src, i) > 0) {
      const end = regexEndAt(src, i);
      for (let j = i + 1; j < end; j++) {
        if (src[j] === "\\" && src[j + 1] === "/") {
          value += "/";
          j++;
        } else {
          value += src[j];
        }
      }
      quotes = [[i, end + 1]];
      i = end + 1;
      kind = "regex";
    } else {
      value = sticky(WORD, src, i);
      i += value.length;
    }
    if (!field && !neg && kind === "word") {
      if (value === "OR") {
        toks.push({ t: "or", s, e: i });
        continue;
      }
      if (value === "AND") {
        toks.push({ t: "and", s, e: i });
        continue;
      }
    }
    if (value === "" && kind === "word") {
      toks.push({ t: "skip", s, e: i });
      continue;
    }
    toks.push({ t: "term", neg, field, kind, value, quotes, s, e: i });
  }
  return { toks };
}

// src/core/parse.ts
var MAX_DEPTH = 100;
function canon(schema, known, field, v) {
  const f = schema.fields.get(field);
  const low = v.toLowerCase();
  const synonym = f?.synonyms.get(low);
  if (synonym) return synonym;
  for (const k of f?.values ?? []) if (k.toLowerCase() === low) return k;
  for (const k of known.get(field)?.keys() ?? []) if (k.toLowerCase() === low) return k;
  return f?.lowercase ? low : v;
}
function shape(c, neg) {
  const parts = c.parts.filter((p) => p.v !== "");
  if (parts.some((p) => p.wild)) {
    c.op = neg ? "not_regex" : "regex";
    c.value = parts.map((p) => p.wild ? reEsc(p.v).replace(/\\\*/g, ".*") : reEsc(p.v)).join("|");
  } else if (parts.length > 1) {
    c.op = neg ? "not_in" : "in";
    c.value = parts.map((p) => p.v);
  } else {
    c.op = neg ? "neq" : "eq";
    c.value = parts.length ? parts[0].v : "";
  }
}
function partKey(p) {
  return `${p.wild ? "*" : "="}${p.v}`;
}
function mergeSame(kids) {
  const out = [];
  const bags = /* @__PURE__ */ new Map();
  for (const n of kids) {
    if (n.type !== "cond" || !n.parts) {
      out.push(n);
      continue;
    }
    const neg = isNegative(n);
    const key = `${neg ? "-" : "+"}${n.field}`;
    const bag = bags.get(key);
    if (!bag) {
      bags.set(key, { node: n, seen: new Set(n.parts.map(partKey)), neg, merged: false });
      out.push(n);
      continue;
    }
    bag.merged = true;
    for (const p of n.parts) {
      if (bag.seen.has(partKey(p))) continue;
      bag.seen.add(partKey(p));
      bag.node.parts.push(p);
    }
    for (const span of n.spans) bag.node.spans.push(span);
  }
  for (const bag of bags.values()) if (bag.merged) shape(bag.node, bag.neg);
  return out;
}
function spanOf(nodes) {
  let start = Infinity;
  let end = -Infinity;
  for (const n of nodes) {
    for (const [s, e] of n.spans) {
      start = Math.min(start, s);
      end = Math.max(end, e);
    }
  }
  return [start, end];
}
function parse(src, schema, known) {
  const tk = tokenize(src, schema);
  if (tk.error) return { error: tk.error, children: [] };
  const toks = tk.toks.filter((t) => t.t !== "skip");
  let p = 0;
  let uid = 0;
  let depth = 0;
  const G = (op, children) => ({ id: ++uid, type: "group", op, children });
  const C = (field, op, value) => ({ id: ++uid, type: "cond", field, op, value });
  const termToNode = (t) => {
    const f = t.field;
    const neg = !!t.neg;
    if (f == null || f === schema.lineField) {
      if (t.kind === "regex") return C(schema.lineField, neg ? "not_regex" : "regex", t.value);
      return C(schema.lineField, neg ? "not_contains" : "contains", t.value);
    }
    if (t.kind === "regex") return C(f, neg ? "not_regex" : "regex", t.value);
    const parts = [];
    const seen = /* @__PURE__ */ new Set();
    for (const part of t.parts) {
      const next = { v: canon(schema, known, f, part.v), wild: part.wild };
      if (seen.has(partKey(next))) continue;
      seen.add(partKey(next));
      parts.push(next);
    }
    const c = C(f, "eq", "");
    c.parts = parts;
    shape(c, neg);
    return c;
  };
  const parseOr = () => {
    const parts = [parseAnd()];
    while (toks[p]?.t === "or") {
      p++;
      parts.push(parseAnd());
    }
    const kept = parts.filter(Boolean);
    if (!kept.length) return null;
    if (kept.length === 1) return kept[0];
    const g = G("OR", kept);
    g.spans = [spanOf(kept)];
    return g;
  };
  const parseAnd = () => {
    const items = [];
    while (toks[p] && toks[p].t !== "or" && toks[p].t !== ")") {
      if (toks[p].t === "and") {
        p++;
        continue;
      }
      const u = parseUnary();
      if (u) items.push(u);
    }
    if (!items.length) return null;
    const merged = mergeSame(items);
    if (merged.length === 1) return merged[0];
    const g = G("AND", merged);
    g.spans = [spanOf(merged)];
    return g;
  };
  const parseUnary = () => {
    const t = toks[p];
    if (t.t === "(") {
      if (++depth > MAX_DEPTH) throw new Error(`This filter nests brackets too deeply. The limit is ${MAX_DEPTH}.`);
      p++;
      const e = parseOr();
      const c = toks[p];
      if (!c || c.t !== ")") throw new Error("A ( is missing its closing ).");
      p++;
      depth--;
      if (e) {
        e.spans = [[t.s, c.e]];
        if (t.neg) negate(e);
      }
      return e;
    }
    const node = termToNode(t);
    node.spans = [[t.s, t.e]];
    p++;
    return node;
  };
  try {
    const top = parseOr();
    if (p < toks.length) throw new Error("There is a ) without a matching (.");
    const kids = !top ? [] : top.type === "group" && top.op === "AND" ? top.children : [top];
    return { root: G("AND", kids), children: kids };
  } catch (e) {
    return { error: e.message, children: [] };
  }
}

// src/core/edit.ts
function quoteValue(v) {
  if (v !== "" && !/[\s(),"\\*]/.test(v) && v[0] !== "/") return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function termText(schema, field, parts, neg) {
  const primary = schema.fields.get(field)?.primary ?? field;
  return `${neg ? "-" : ""}${primary}:${parts.map((p) => p.wild ? p.v : quoteValue(p.v)).join(",")}`;
}
function tidy(q, schema) {
  const tk = tokenize(q, schema);
  if (tk.error) return q.trim();
  let toks = tk.toks;
  for (let pass = 0, changed = true; changed && pass <= MAX_DEPTH; pass++) {
    changed = false;
    const real = toks.filter((t) => t.t !== "skip");
    const drop = /* @__PURE__ */ new Set();
    real.forEach((t, i) => {
      const prev = real[i - 1];
      const next = real[i + 1];
      const isOp = (x) => x?.t === "and" || x?.t === "or";
      if (t.t === "(" && next?.t === ")") {
        drop.add(t);
        drop.add(next);
      } else if (isOp(t) && (!prev || prev.t === "(" || isOp(prev) || !next || next.t === ")")) {
        drop.add(t);
      }
    });
    if (drop.size) {
      toks = toks.filter((t) => !drop.has(t));
      changed = true;
    }
  }
  let out = "";
  toks.forEach((t, i) => {
    const prev = toks[i - 1];
    if (prev && prev.e !== t.s && prev.t !== "(" && t.t !== ")") out += " ";
    out += q.slice(t.s, t.e);
  });
  return out;
}
function editSpans(q, spans, text, schema) {
  const pieces = [];
  let at = 0;
  spans.slice().sort((a, b) => a[0] - b[0]).forEach(([start, end], i) => {
    pieces.push(q.slice(at, start), i === 0 ? text : " ");
    at = end;
  });
  pieces.push(q.slice(at));
  return tidy(pieces.join(""), schema);
}
function appendTerm(q, text, schema) {
  const base = tidy(q, schema);
  if (!base) return text;
  const tk = tokenize(base, schema);
  let depth = 0;
  let topLevelOr = false;
  for (const t of tk.toks) {
    if (t.t === "(") depth++;
    else if (t.t === ")") depth--;
    else if (t.t === "or" && depth === 0) topLevelOr = true;
  }
  return topLevelOr ? `(${base}) ${text}` : `${base} ${text}`;
}
function isValueTerm(n, field, neg) {
  return n.type === "cond" && n.field === field && !!n.parts && isNegative(n) === neg;
}
function activeValues(parsed, field, neg) {
  const set = /* @__PURE__ */ new Set();
  for (const n of parsed.children) if (isValueTerm(n, field, neg)) n.parts.forEach((p) => set.add(p.v));
  return set;
}
function facetEdit(q, parsed, schema, field, value, neg) {
  const single = { v: value, wild: false };
  if (parsed.error) return appendTerm(q, termText(schema, field, [single], neg), schema);
  const found = parsed.children.find((n) => isValueTerm(n, field, neg));
  if (!found) return appendTerm(q, termText(schema, field, [single], neg), schema);
  const parts = found.parts.slice();
  const at = parts.findIndex((p) => p.v === value);
  if (at >= 0) parts.splice(at, 1);
  else parts.push(single);
  return editSpans(q, found.spans, parts.length ? termText(schema, field, parts, neg) : "", schema);
}
function clearField(q, parsed, schema, field) {
  if (parsed.error) return q;
  const spans = parsed.children.flatMap((n) => n.type === "cond" && n.field === field ? n.spans : []);
  return spans.length ? editSpans(q, spans, "", schema) : q;
}

// src/core/schema.ts
var LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
var defaultSchema = {
  fields: {
    detected_level: {
      label: "Log Level",
      indexed: false,
      aliases: ["level", "severity", "lvl", "type"],
      values: ["error", "info", "warn", "debug", "unknown"],
      synonyms: {
        warning: "warn",
        warnings: "warn",
        err: "error",
        fatal: "error",
        critical: "error",
        information: "info",
        trace: "debug",
        none: "unknown"
      },
      lowercase: true,
      color: "level",
      hint: "Filter by log level",
      excludeHint: "Hide log levels, for example -level:debug",
      example: "error, warn, info\u2026"
    },
    service_name: {
      label: "App Name",
      indexed: true,
      aliases: ["app", "service", "name"],
      color: "hash",
      hint: "Filter by app name",
      excludeHint: "Hide apps",
      example: (values) => values.slice(0, 2).join(", ") + "\u2026"
    },
    service_category: {
      label: "App Type",
      indexed: true,
      aliases: ["apptype", "runtime", "lang", "kind"],
      color: "accent",
      hint: "Filter by app type",
      excludeHint: "Hide app types",
      example: (values) => values.join(", ").toLowerCase()
    },
    line: {
      label: "Content",
      kind: "line",
      aliases: ["msg", "message", "content", "text"]
    }
  },
  selectorField: "service_name",
  excludeExample: "level:debug"
};
function resolveGroups(field, groups = {}) {
  const out = /* @__PURE__ */ new Map();
  for (const [key, list] of Object.entries(groups)) {
    const members = [...new Set(list.filter(Boolean))];
    if (!members.length) throw new Error(`logql-query-box: group "${key}" on "${field}" has no values.`);
    for (const value of new Set([key, ...members].map((v) => v.toLowerCase()))) {
      if (out.has(value)) throw new Error(`logql-query-box: "${value}" is in two groups on "${field}".`);
      out.set(value, members);
    }
  }
  return out;
}
function resolveSchema(schema, baseSelector = {}) {
  const fields = /* @__PURE__ */ new Map();
  const alias = /* @__PURE__ */ new Map();
  let lineField = "";
  let parsedLine = false;
  let firstIndexed = "";
  for (const [name, def] of Object.entries(schema.fields)) {
    if (!LABEL_NAME.test(name)) throw new Error(`logql-query-box: "${name}" is not a valid Loki label name.`);
    const kind = def.kind ?? "label";
    if (def.parsed && kind !== "line") throw new Error(`logql-query-box: "parsed" only applies to the line field, not "${name}".`);
    if (def.parsed && !schema.parser) throw new Error("logql-query-box: a parsed line field needs a schema parser.");
    if (kind === "line") {
      if (lineField) throw new Error("logql-query-box: a schema can only have one line field.");
      lineField = name;
      parsedLine = !!def.parsed;
    } else if (def.indexed && !firstIndexed) {
      firstIndexed = name;
    }
    const names = [...def.aliases ?? [], name];
    for (const a of names) {
      if (!LABEL_NAME.test(a)) throw new Error(`logql-query-box: "${a}" is not a valid field alias.`);
      const key = a.toLowerCase();
      const taken = alias.get(key);
      if (taken && taken !== name) throw new Error(`logql-query-box: alias "${a}" is used by both "${taken}" and "${name}".`);
      alias.set(key, name);
    }
    fields.set(name, {
      ...def,
      name,
      kind,
      primary: names[0],
      synonyms: new Map(Object.entries(def.synonyms ?? {})),
      groups: resolveGroups(name, def.groups)
    });
  }
  if (!lineField) throw new Error('logql-query-box: a schema needs one field with kind "line".');
  const base = Object.entries(baseSelector);
  for (const [name] of base) {
    if (!LABEL_NAME.test(name)) throw new Error(`logql-query-box: "${name}" is not a valid Loki label name.`);
  }
  const selectorField = schema.selectorField ?? base[0]?.[0] ?? firstIndexed;
  if (!fields.get(selectorField)?.indexed && !base.some(([name]) => name === selectorField)) {
    throw new Error("logql-query-box: a schema needs an indexed label or a baseSelector to use as the stream selector.");
  }
  const firstLabel = [...fields.values()].find((f) => f.kind === "label");
  return {
    fields,
    alias,
    lineField,
    parsedLine,
    selectorField,
    excludeExample: schema.excludeExample ?? `${firstLabel ? firstLabel.primary : "field"}:value`,
    parser: schema.parser,
    baseSelector: base
  };
}

// src/core/suggest.ts
var FIELD_TERM = /^([A-Za-z_][A-Za-z0-9_]*):([\s\S]*)$/;
var NOTHING = { head: "", items: [], extra: [] };
function hue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function colorOf(f, v) {
  if (typeof f.color === "function") return f.color(v);
  if (f.color === "level") return `var(--lqb-lv-${v}, var(--lqb-faint))`;
  if (f.color === "hash") return `hsl(${hue(v)} 55% 55%)`;
  return "var(--lqb-accent)";
}
function tokenAtCaret(src, caret, schema) {
  const { toks, open } = tokenize(src, schema);
  if (open !== void 0 && caret > open) return { s: caret, e: caret, text: "", inside: true };
  let found;
  for (const t of toks) {
    if (t.t === "(" || t.t === ")") continue;
    if (t.quotes?.some(([a, b]) => a < caret && caret < b)) return { s: caret, e: caret, text: "", inside: true };
    if (t.s <= caret && caret <= t.e) found = t;
  }
  if (!found) return { s: caret, e: caret, text: "", inside: false };
  return { s: found.s, e: found.e, text: src.slice(found.s, found.e), inside: false, token: found };
}
function valueNames(field, known) {
  return [.../* @__PURE__ */ new Set([...field.values ?? [], ...known.get(field.name)?.keys() ?? []])];
}
function valueOptions(field, known) {
  const counts = known.get(field.name);
  return valueNames(field, known).map((v) => ({ v, n: counts?.get(v) })).sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
}
function labelFields(schema) {
  return [...schema.fields.values()].filter((f) => f.kind === "label");
}
function exampleOf(f, known) {
  if (typeof f.example === "string") return f.example;
  const values = valueNames(f, known);
  if (!values.length) return f.hint ?? "";
  return typeof f.example === "function" ? f.example(values) : values.slice(0, 2).join(", ") + "\u2026";
}
function sortedSaved(saved) {
  return saved.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.name.localeCompare(b.name));
}
function suggest(src, caret, schema, known, extras = {}) {
  const tk = tokenAtCaret(src, caret, schema);
  if (tk.inside) return NOTHING;
  const items = [];
  const text = tk.text;
  const neg = text[0] === "-" ? "-" : "";
  const body = neg ? text.slice(1) : text;
  const replace = [tk.s, tk.e];
  if (text === "-") {
    for (const f of labelFields(schema)) {
      const label = `-${f.primary}:`;
      items.push({ kind: "field", label, hint: f.excludeHint ?? `Hide ${f.label}`, replace, text: label, keep: true });
    }
    return { head: "Exclude (NOT). You can also type -word to hide lines containing it", items, extra: [] };
  }
  const m = FIELD_TERM.exec(body);
  const name = m ? schema.alias.get(m[1].toLowerCase()) : void 0;
  if (m && name && name !== schema.lineField) {
    const field = schema.fields.get(name);
    const rest = m[2];
    const lc = rest.lastIndexOf(",");
    const prior = lc >= 0 ? rest.slice(0, lc + 1) : "";
    const part = (lc >= 0 ? rest.slice(lc + 1) : rest).toLowerCase();
    const parts = tk.token?.parts ?? [];
    const chosen = new Set((rest.endsWith(",") ? parts : parts.slice(0, -1)).map((p) => p.v.toLowerCase()));
    const all = valueOptions(field, known).filter((o) => !chosen.has(o.v.toLowerCase()));
    const pre = all.filter((o) => !part || o.v.toLowerCase().indexOf(part) === 0);
    const hits = pre.length ? pre : all.filter((o) => o.v.toLowerCase().indexOf(part) >= 0);
    const counted = all.some((o) => o.n !== void 0);
    for (const o of hits) {
      items.push({
        kind: "value",
        label: o.v,
        hint: counted ? `${(o.n ?? 0).toLocaleString("en-US")} lines` : "",
        color: colorOf(field, o.v),
        replace,
        text: `${neg}${m[1]}:${prior}${quoteValue(o.v)} `
      });
    }
    return { head: `Values for ${field.label}`, field: name, items, extra: [] };
  }
  if (body) {
    const low = body.toLowerCase();
    for (const f of labelFields(schema)) {
      const label = `${f.primary}:`;
      if (label.toLowerCase().indexOf(low) === 0 && label.toLowerCase() !== low) {
        items.push({ kind: "field", label: neg + label, hint: f.hint ?? `Filter by ${f.label}`, replace, text: neg + label, keep: true });
      }
    }
    return { head: items.length ? "Fields" : "", items, extra: [] };
  }
  for (const f of labelFields(schema)) {
    const label = `${f.primary}:`;
    items.push({ kind: "field", label, hint: exampleOf(f, known), replace, text: label, keep: true });
  }
  items.push({ kind: "field", label: "-", hint: `Exclude, for example -${schema.excludeExample}`, replace, text: "-", keep: true });
  const extra = [];
  for (const s of sortedSaved(extras.saved ?? []).slice(0, 5)) {
    extra.push({ kind: "saved", label: s.name, sub: s.query, hint: s.pinned ? "Pinned" : "Saved", whole: s.query });
  }
  for (const q of (extras.recent ?? []).slice(0, 5)) extra.push({ kind: "recent", label: q, hint: "Recent", whole: q });
  return { head: "Filter by", items, extra };
}

// src/core/engine.ts
var NO_LOGQL = { branches: [], tooMany: false, count: 0 };
function indexValues(values = {}) {
  const known = /* @__PURE__ */ new Map();
  for (const [field, list] of Object.entries(values)) {
    const entries = /* @__PURE__ */ new Map();
    for (const item of list) {
      if (typeof item === "string") entries.set(item, void 0);
      else entries.set(item.value, item.count);
    }
    known.set(field, entries);
  }
  return known;
}
function createEngine(options = {}) {
  const schema = resolveSchema(options.schema ?? defaultSchema, options.baseSelector);
  const known = indexValues(options.values);
  const matchCase = !!options.matchCase;
  const maxBranches = options.maxBranches ?? MAX_BRANCHES;
  const parseQuery = (q) => parse(q, schema, known);
  const compileTree = (tree) => compile(tree, schema, matchCase, maxBranches);
  const activeExpanded = (node) => {
    const tree = activeTree(node);
    return tree && expandGroups(tree, schema);
  };
  const toggleValue = (query, field, value, negative = false) => {
    let q = query;
    if (activeValues(parseQuery(q), field, !negative).has(value)) q = facetEdit(q, parseQuery(q), schema, field, value, !negative);
    return facetEdit(q, parseQuery(q), schema, field, value, negative);
  };
  return {
    schema,
    parse: parseQuery,
    compile: compileTree,
    activeTree: activeExpanded,
    chipText: (node) => chipText(node, schema),
    isNegative,
    analyze(query) {
      const parsed = parseQuery(query);
      if (parsed.error) return { query, parsed, error: parsed.error, tree: null, logql: NO_LOGQL, filter: null, riskyRegex: false };
      const found = problems(parsed.root);
      if (found.length) {
        const error2 = found.some((p) => p.startsWith("Loki")) ? "One of the /regular expressions/ is not valid for Loki. Loki uses RE2, so lookaround and backreferences do not work." : "One of the /regular expressions/ is not valid.";
        return { query, parsed, error: error2, tree: null, logql: NO_LOGQL, filter: null, riskyRegex: false };
      }
      const tree = activeExpanded(parsed.root);
      const logql = compileTree(tree);
      const error = logql.tooMany ? `This filter expands into ${logql.count} OR branches. Use comma lists such as level:error,warn to stay under ${maxBranches}.` : null;
      return { query, parsed, error, tree, logql, filter: tree ? toFilter(tree) : null, riskyRegex: !!tree && hasRiskyRegex(tree) };
    },
    validate(query) {
      const parsed = parseQuery(query);
      if (parsed.error) return `This filter is not valid: ${parsed.error}`;
      return problems(parsed.root).length ? "A regular expression in this filter is not valid for Loki." : "";
    },
    evaluate: (tree, record) => tree ? evaluate(tree, record, schema, matchCase) : true,
    highlightPattern(tree) {
      const sources = [];
      const walk = (n) => {
        if (n.type === "group") return n.children.forEach(walk);
        if (n.field !== schema.lineField) return;
        if (n.op === "contains") sources.push(reEsc(valOf(n)));
        else if (n.op === "regex" && !isRiskyRegex(valOf(n))) sources.push(toJsRegex(valOf(n), false, false).source);
      };
      if (tree) walk(tree);
      if (!sources.length) return null;
      try {
        return new RegExp(sources.join("|"), "giu");
      } catch {
        return null;
      }
    },
    suggest: (query, caret, extras) => suggest(query, caret, schema, known, extras),
    tokenAt: (query, caret) => tokenAtCaret(query, caret, schema).text,
    removeNode: (query, node) => editSpans(query, node.spans, "", schema),
    appendTerm: (query, field, values, negative = false) => appendTerm(query, termText(schema, field, values.map((v) => ({ v, wild: false })), negative), schema),
    toggleValue,
    clearField: (query, field) => clearField(query, parseQuery(query), schema, field),
    activeValues: (query, field, negative = false) => activeValues(parseQuery(query), field, negative)
  };
}
export {
  INVALID_REGEX,
  MAX_BRANCHES,
  MAX_DEPTH,
  UNSUPPORTED_REGEX,
  chipLabel,
  chipText,
  createEngine,
  defaultSchema,
  isRiskyRegex,
  listOf,
  logqlString,
  quoteValue,
  reEsc,
  regexProblem,
  resolveSchema,
  toJsRegex,
  tokenize,
  valOf
};
//# sourceMappingURL=core.js.map