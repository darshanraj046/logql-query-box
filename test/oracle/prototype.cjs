module.exports = function createPrototype(env) {
  'use strict';
  /* indexed:true means the field is a Loki stream label and goes inside {...}. Set it to false if it is structured metadata. */
  var FIELDS = {
    service_name: { label: 'App Name', kind: 'label', indexed: true, values: true },
    service_category: { label: 'App Type', kind: 'label', indexed: true, values: true },
    detected_level: { label: 'Type', kind: 'label', indexed: false, values: true },
    line: { label: 'Content', kind: 'line', values: false }
  };
  var OPS = ['contains', 'not_contains', 'eq', 'neq', 'starts', 'ends', 'regex', 'not_regex', 'in', 'not_in'];
  var OP_LABEL = { contains: 'contains', not_contains: "doesn't contain", eq: 'equals', neq: "doesn't equal", starts: 'starts with', ends: 'ends with', regex: 'matches regex', not_regex: "doesn't match regex", in: 'is one of', not_in: 'is not one of' };
  var LEVELS = [
    { v: 'error', l: 'Error', chip: 'Error', pill: 'ERROR' },
    { v: 'info', l: 'Info', chip: 'Info', pill: 'INFO' },
    { v: 'warn', l: 'Warnings', chip: 'Warn', pill: 'WARN' },
    { v: 'debug', l: 'Debug', chip: 'Debug', pill: 'DEBUG' },
    { v: 'unknown', l: 'None', chip: 'None', pill: 'NONE' }
  ];
  var MAX_BRANCHES = 12;
  var uid = 0;
  function C(field, op, value) { return { id: ++uid, type: 'cond', field: field, op: op, value: value }; }
  function G(op, children) { return { id: ++uid, type: 'group', op: op, children: children }; }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function splitList(s) { return String(s).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function opLabel(field, op) {
    if (field === 'line') { if (op === 'in') return 'contains any of'; if (op === 'not_in') return 'contains none of'; }
    return OP_LABEL[op];
  }
  function listOf(c) { return Array.isArray(c.value) ? c.value : splitList(c.value); }
  function valOf(c) { return Array.isArray(c.value) ? (c.value[0] == null ? '' : String(c.value[0])) : String(c.value == null ? '' : c.value); }
  function isEmpty(c) {
    if (c.op === 'in' || c.op === 'not_in') return listOf(c).length === 0;
    return valOf(c).trim() === '';
  }

  /* Loki uses Go RE2. Block what RE2 cannot run so the UI never builds a query Loki rejects. */
  function parseRegex(p, ci, anchored) {
    var flags = ci ? 'i' : '', src = p;
    var m = /^\(\?([a-zA-Z]+)\)/.exec(src);
    if (m) { if (m[1].indexOf('i') >= 0) flags = 'i'; src = src.slice(m[0].length); }
    if (anchored) src = '^(?:' + src + ')$';
    return new RegExp(src, flags);
  }
  function condProblem(c) {
    if (c.op !== 'regex' && c.op !== 'not_regex') return null;
    var p = valOf(c);
    if (!p) return null;
    if (/\(\?<?[=!]|\\[1-9]/.test(p)) return 'Loki uses RE2, which does not support lookaround or backreferences.';
    try { parseRegex(p, false, false); } catch (e) { return 'This is not a valid regular expression.'; }
    return null;
  }
  function isActive(c) { return !isEmpty(c) && !condProblem(c); }
  function activeTree(n) {
    if (n.type === 'cond') return isActive(n) ? n : null;
    var kids = n.children.map(activeTree).filter(Boolean);
    return kids.length ? { id: n.id, type: 'group', op: n.op, children: kids } : null;
  }
  function problems(n) {
    if (n.type === 'cond') return condProblem(n) ? 1 : 0;
    return n.children.reduce(function (s, ch) { return s + problems(ch); }, 0);
  }

  var reCache = {};
  function regexFor(p, ci, anchored) {
    var k = p + '\u0000' + ci + anchored;
    if (!reCache[k]) reCache[k] = parseRegex(p, ci, anchored);
    return reCache[k];
  }
  function testCond(c, r, mc) {
    var f = FIELDS[c.field], hay = String(r[c.field] == null ? '' : r[c.field]), isLine = f.kind === 'line', ci = isLine && !mc;
    var H = ci ? hay.toLowerCase() : hay;
    function N(s) { return ci ? String(s).toLowerCase() : String(s); }
    var v = valOf(c);
    switch (c.op) {
      case 'contains': return H.indexOf(N(v)) >= 0;
      case 'not_contains': return H.indexOf(N(v)) < 0;
      case 'eq': return H === N(v);
      case 'neq': return H !== N(v);
      case 'starts': return H.indexOf(N(v)) === 0;
      case 'ends': return H.length >= N(v).length && H.slice(H.length - N(v).length) === N(v);
      case 'regex': return regexFor(v, ci, !isLine).test(hay);
      case 'not_regex': return !regexFor(v, ci, !isLine).test(hay);
      case 'in': return isLine ? listOf(c).some(function (x) { return H.indexOf(N(x)) >= 0; }) : listOf(c).indexOf(hay) >= 0;
      case 'not_in': return isLine ? !listOf(c).some(function (x) { return H.indexOf(N(x)) >= 0; }) : listOf(c).indexOf(hay) < 0;
    }
    return true;
  }
  function evalNode(n, r, mc) {
    if (n.type === 'cond') return testCond(n, r, mc);
    if (n.op === 'OR') return n.children.some(function (ch) { return evalNode(ch, r, mc); });
    return n.children.every(function (ch) { return evalNode(ch, r, mc); });
  }

  /* LogQL cannot express an arbitrary AND/OR tree in one query, so the tree becomes an OR of AND-branches (disjunctive normal form). Each branch is one Loki query. */
  function dnf(n) {
    if (n.type === 'cond') return [[n]];
    var parts = n.children.map(dnf);
    if (n.op === 'OR') return parts.reduce(function (a, p) { return a.concat(p); }, []);
    return parts.reduce(function (acc, p) {
      var out = [];
      acc.forEach(function (a) { p.forEach(function (b) { out.push(a.concat(b)); }); });
      return out;
    }, [[]]);
  }
  function q(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'; }
  function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var WEAK = { neq: 1, not_in: 1, not_regex: 1, not_contains: 1 };
  function labelMatcher(c) {
    var n = c.field, v = valOf(c), L = listOf(c);
    switch (c.op) {
      case 'eq': return n + '=' + q(v);
      case 'neq': return n + '!=' + q(v);
      case 'in': return n + '=~' + q(L.map(reEsc).join('|'));
      case 'not_in': return n + '!~' + q(L.map(reEsc).join('|'));
      case 'regex': return n + '=~' + q(v);
      case 'not_regex': return n + '!~' + q(v);
      case 'contains': return n + '=~' + q('.*' + reEsc(v) + '.*');
      case 'not_contains': return n + '!~' + q('.*' + reEsc(v) + '.*');
      case 'starts': return n + '=~' + q(reEsc(v) + '.*');
      case 'ends': return n + '=~' + q('.*' + reEsc(v));
    }
    return '';
  }
  function lineFilter(c, mc) {
    var v = valOf(c), pre = mc ? '' : '(?i)', L = listOf(c);
    switch (c.op) {
      case 'contains': return mc ? '|= ' + q(v) : '|~ ' + q(pre + reEsc(v));
      case 'not_contains': return mc ? '!= ' + q(v) : '!~ ' + q(pre + reEsc(v));
      case 'eq': return '|~ ' + q(pre + '^' + reEsc(v) + '$');
      case 'neq': return '!~ ' + q(pre + '^' + reEsc(v) + '$');
      case 'starts': return '|~ ' + q(pre + '^' + reEsc(v));
      case 'ends': return '|~ ' + q(pre + reEsc(v) + '$');
      case 'regex': return '|~ ' + q(!mc && !/^\(\?/.test(v) ? pre + v : v);
      case 'not_regex': return '!~ ' + q(!mc && !/^\(\?/.test(v) ? pre + v : v);
      case 'in': return '|~ ' + q(pre + L.map(reEsc).join('|'));
      case 'not_in': return '!~ ' + q(pre + L.map(reEsc).join('|'));
    }
    return '';
  }
  function compileBranch(conds, mc) {
    var sel = [], lines = [], labs = [], strong = false;
    conds.forEach(function (c) {
      var f = FIELDS[c.field];
      if (f.kind === 'line') lines.push(lineFilter(c, mc));
      else if (f.indexed) { sel.push(labelMatcher(c)); if (!WEAK[c.op]) strong = true; }
      else labs.push('| ' + labelMatcher(c));
    });
    /* Loki needs at least one selector that cannot match an empty value. */
    if (!strong) sel.push('service_name=~".+"');
    return '{' + sel.join(', ') + '}' + lines.concat(labs).map(function (s) { return '\n  ' + s; }).join('');
  }
  function compileAll(tree, mc) {
    if (!tree) return { branches: ['{service_name=~".+"}'], tooMany: false, count: 1 };
    var d = dnf(tree);
    if (d.length > MAX_BRANCHES) return { tooMany: true, count: d.length, branches: [] };
    var seen = {}, out = [];
    d.forEach(function (b) { var s = compileBranch(b, mc); if (!seen[s]) { seen[s] = 1; out.push(s); } });
    return { branches: out, tooMany: false, count: out.length };
  }

  function valHuman(c) {
    if (c.op === 'regex' || c.op === 'not_regex') return '/' + esc(valOf(c)) + '/';
    if (c.op === 'in' || c.op === 'not_in') return listOf(c).map(function (x) { return '“' + esc(x) + '”'; }).join(', ');
    return '“' + esc(valOf(c)) + '”';
  }
  function human(n, nested) {
    if (n.type === 'cond') return '<span class="h-f">' + FIELDS[n.field].label + '</span> <span class="h-o">' + opLabel(n.field, n.op) + '</span> <span class="h-v">' + valHuman(n) + '</span>';
    var parts = n.children.map(function (ch) { return human(ch, true); });
    var joined = parts.join(' <span class="h-k">' + n.op + '</span> ');
    return nested && parts.length > 1 ? '(' + joined + ')' : joined;
  }
  function toApi(n) {
    if (n.type === 'cond') return { field: n.field, operator: n.op, value: (n.op === 'in' || n.op === 'not_in') ? listOf(n) : valOf(n) };
    return { logic: n.op, filters: n.children.map(toApi) };
  }

  var LQ = { FIELDS: FIELDS, LEVELS: LEVELS, MAX_BRANCHES: MAX_BRANCHES, C: C, G: G, listOf: listOf, valOf: valOf, condProblem: condProblem, activeTree: activeTree, evalNode: evalNode, dnf: dnf, reEsc: reEsc, compileAll: compileAll, toApi: toApi };
  var ALIAS = { level: 'detected_level', severity: 'detected_level', lvl: 'detected_level', type: 'detected_level', app: 'service_name', service: 'service_name', name: 'service_name', apptype: 'service_category', runtime: 'service_category', lang: 'service_category', kind: 'service_category', msg: 'line', message: 'line', content: 'line', line: 'line', text: 'line' };
  var ALIAS_OF = { detected_level: 'level', service_name: 'app', service_category: 'apptype', line: 'msg' };
  var FACET_TITLE = { detected_level: 'Log Level', service_name: 'App Name', service_category: 'App Type' };
  var LV_SYN = { warning: 'warn', warnings: 'warn', err: 'error', fatal: 'error', critical: 'error', information: 'info', trace: 'debug', none: 'unknown' };
  var META = { apps: env.apps, types: env.types };
  var state = { query: env.query || '', parsed: null, saved: env.saved || [], res: env.counts ? { facets: env.counts } : null, hl: null };
  var input = { value: '', selectionStart: 0 };
  function $() { return input; }
  var store = { get: function () { return (env.recent || []).slice(); } };
  function setQuery(q) { state.query = q; state.parsed = parse(q); }
  function fmtN(n) { return n.toLocaleString('en-US'); }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function canon(field, v) {
    var low = v.toLowerCase();
    if (field === 'detected_level') return LV_SYN[low] || low;
    var list = field === 'service_name' ? META.apps : META.types;
    for (var i = 0; i < list.length; i++) if (list[i].toLowerCase() === low) return list[i];
    return v;
  }
  function regexEndAt(src, i) {
    var j = i + 1;
    while (j < src.length) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '/') return (j + 1 >= src.length || /[\s()]/.test(src[j + 1])) ? j : -1;
      j++;
    }
    return -1;
  }
  function tokenize(src) {
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '(' || ch === ')') { toks.push({ t: ch, s: i, e: i + 1 }); i++; continue; }
      var s = i, neg = false, field = null;
      if (ch === '-' && i + 1 < n && !/\s/.test(src[i + 1])) { neg = true; i++; }
      var m = /^([A-Za-z]+):/.exec(src.slice(i));
      if (m && ALIAS[m[1].toLowerCase()]) { field = ALIAS[m[1].toLowerCase()]; i += m[0].length; }
      var kind = 'word', value = '', j, v;
      if (src[i] === '"') {
        j = i + 1; v = '';
        while (j < n && src[j] !== '"') { if (src[j] === '\\' && j + 1 < n) { v += src[j + 1]; j += 2; } else v += src[j++]; }
        if (j >= n) return { error: 'The quote that starts at character ' + (i + 1) + ' is never closed.' };
        value = v; i = j + 1; kind = 'phrase';
      } else if (src[i] === '/' && regexEndAt(src, i) > 0) {
        var end = regexEndAt(src, i); v = '';
        for (j = i + 1; j < end; j++) { if (src[j] === '\\' && src[j + 1] === '/') { v += '/'; j++; } else v += src[j]; }
        value = v; i = end + 1; kind = 'regex';
      } else {
        j = i; while (j < n && !/[\s()]/.test(src[j])) j++;
        value = src.slice(i, j); i = j;
      }
      if (!field && !neg && kind === 'word') {
        if (value === 'OR') { toks.push({ t: 'or', s: s, e: i }); continue; }
        if (value === 'AND') { toks.push({ t: 'and', s: s, e: i }); continue; }
      }
      if (value === '' && kind === 'word') continue;
      toks.push({ t: 'term', neg: neg, field: field, kind: kind, value: value, s: s, e: i });
    }
    return { toks: toks };
  }
  function termToNode(t) {
    var f = t.field;
    if (f == null || f === 'line') {
      if (t.kind === 'regex') return C('line', t.neg ? 'not_regex' : 'regex', t.value);
      return C('line', t.neg ? 'not_contains' : 'contains', t.value);
    }
    if (t.kind === 'regex') return C(f, t.neg ? 'not_regex' : 'regex', t.value);
    var vals = t.kind === 'word' ? t.value.split(',').filter(Boolean) : [t.value];
    vals = vals.map(function (v) { return canon(f, v); });
    if (vals.length > 1) return C(f, t.neg ? 'not_in' : 'in', vals);
    var v = vals[0] || '';
    if (v.indexOf('*') >= 0) return C(f, t.neg ? 'not_regex' : 'regex', LQ.reEsc(v).replace(/\\\*/g, '.*'));
    return C(f, t.neg ? 'neq' : 'eq', v);
  }
  function mergeSame(kids) {
    var out = [], inc = {}, exc = {};
    kids.forEach(function (n) {
      var isInc = n.type === 'cond' && n.field !== 'line' && (n.op === 'eq' || n.op === 'in');
      var isExc = n.type === 'cond' && n.field !== 'line' && (n.op === 'neq' || n.op === 'not_in');
      if (isInc || isExc) {
        var bag = isInc ? inc : exc, m = bag[n.field];
        if (m) { LQ.listOf(n).forEach(function (v) { if (m.value.indexOf(v) < 0) m.value.push(v); }); m.spans = m.spans.concat(n.spans); return; }
        var c = C(n.field, isInc ? 'in' : 'not_in', LQ.listOf(n).slice()); c.spans = n.spans.slice(); bag[n.field] = c; out.push(c); return;
      }
      out.push(n);
    });
    out.forEach(function (n) { if (n.type === 'cond' && n.value.length === 1 && (n.op === 'in' || n.op === 'not_in')) { n.op = n.op === 'in' ? 'eq' : 'neq'; n.value = n.value[0]; } });
    return out;
  }
  function parse(src) {
    var tk = tokenize(src);
    if (tk.error) return { error: tk.error };
    var toks = tk.toks, p = 0;
    function peek() { return toks[p]; }
    function parseOr() {
      var parts = [parseAnd()];
      while (peek() && peek().t === 'or') { p++; parts.push(parseAnd()); }
      parts = parts.filter(Boolean);
      if (!parts.length) return null;
      if (parts.length === 1) return parts[0];
      var g = G('OR', parts); g.spans = [[parts[0].spans[0][0], parts[parts.length - 1].spans[0][1]]]; return g;
    }
    function parseAnd() {
      var items = [];
      while (peek() && peek().t !== 'or' && peek().t !== ')') {
        if (peek().t === 'and') { p++; continue; }
        var u = parseUnary(); if (u) items.push(u);
      }
      if (!items.length) return null;
      if (items.length === 1) return items[0];
      var g = G('AND', items); g.spans = [[items[0].spans[0][0], items[items.length - 1].spans[0][1]]]; return g;
    }
    function parseUnary() {
      var t = peek();
      if (t.t === '(') {
        p++; var e = parseOr(), c = peek();
        if (!c || c.t !== ')') throw new Error('A ( is missing its closing ).');
        p++; if (e) e.spans = [[t.s, c.e]]; return e;
      }
      var node = termToNode(t); node.spans = [[t.s, t.e]]; p++; return node;
    }
    try {
      var top = parseOr();
      if (p < toks.length) throw new Error('There is a ) without a matching (.');
      var kids = !top ? [] : (top.type === 'group' && top.op === 'AND' ? top.children : [top]);
      kids = mergeSame(kids);
      return { root: G('AND', kids), children: kids };
    } catch (e) { return { error: e.message }; }
  }
  function qv(v) { return /[\s(),"]/.test(v) ? '"' + v.replace(/"/g, '\\"') + '"' : v; }
  function termText(field, vals, neg) { return (neg ? '-' : '') + ALIAS_OF[field] + ':' + vals.map(qv).join(','); }
  function editSpans(q, spans, text) {
    var first = Math.min.apply(null, spans.map(function (s) { return s[0]; }));
    spans.slice().sort(function (a, b) { return b[0] - a[0]; }).forEach(function (s) { q = q.slice(0, s[0]) + (s[0] === first ? text : '') + q.slice(s[1]); });
    return q.replace(/\s{2,}/g, ' ').trim();
  }
  function appendTo(q, text) { q = q.trim(); return q ? q + ' ' + text : text; }
  function isInc(n, field) { return n.type === 'cond' && n.field === field && (n.op === 'eq' || n.op === 'in'); }
  function isExc(n, field) { return n.type === 'cond' && n.field === field && (n.op === 'neq' || n.op === 'not_in'); }
  function facetEdit(q, field, value, neg) {
    var p = parse(q);
    if (p.error) return appendTo(q, termText(field, [value], neg));
    var ex = p.children.filter(function (n) { return neg ? isExc(n, field) : isInc(n, field); })[0];
    if (ex) {
      var vals = LQ.listOf(ex).slice(), i = vals.indexOf(value);
      if (i >= 0) vals.splice(i, 1); else vals.push(value);
      return editSpans(q, ex.spans, vals.length ? termText(field, vals, neg) : '');
    }
    return appendTo(q, termText(field, [value], neg));
  }
  function clearField(q, field) {
    var p = parse(q); if (p.error) return q;
    var spans = []; p.children.forEach(function (n) { if (n.type === 'cond' && n.field === field) spans = spans.concat(n.spans); });
    return spans.length ? editSpans(q, spans, '') : q;
  }
  function facetToggle(field, value, neg) {
    var q = state.query;
    if (!neg && activeValues(field, true)[value]) q = facetEdit(q, field, value, true);
    if (neg && activeValues(field, false)[value]) q = facetEdit(q, field, value, false);
    setQuery(facetEdit(q, field, value, neg));
  }
  function chipText(n) {
    if (n.type === 'group') return '(' + n.children.map(chipText).join(n.op === 'OR' ? ' OR ' : ' ') + ')';
    var v = LQ.valOf(n), L = LQ.listOf(n);
    if (n.field === 'line') {
      if (n.op === 'contains') return '\u201c' + v + '\u201d';
      if (n.op === 'not_contains') return 'not \u201c' + v + '\u201d';
      if (n.op === 'regex') return '/' + v + '/';
      return 'not /' + v + '/';
    }
    var l = FACET_TITLE[n.field];
    switch (n.op) {
      case 'eq': return l + ' is ' + v;
      case 'neq': return l + ' is not ' + v;
      case 'in': return l + ' is ' + L.join(' or ');
      case 'not_in': return l + ' is not ' + L.join(' or ');
      case 'regex': return l + ' matches /' + v + '/';
      default: return l + ' does not match /' + v + '/';
    }
  }
  function isNeg(n) { return n.type === 'cond' && (n.op === 'neq' || n.op === 'not_in' || n.op === 'not_contains' || n.op === 'not_regex'); }
  function activeValues(field, neg) {
    var set = {}, p = state.parsed;
    if (p && p.children) p.children.forEach(function (n) { if (neg ? isExc(n, field) : isInc(n, field)) LQ.listOf(n).forEach(function (v) { set[v] = true; }); });
    return set;
  }
  function tokenAtCaret() {
    var inp = $('#q'), v = inp.value, c = inp.selectionStart == null ? v.length : inp.selectionStart, s = c, e = c;
    while (s > 0 && !/[\s()]/.test(v[s - 1])) s--;
    while (e < v.length && !/[\s()]/.test(v[e])) e++;
    return { s: s, e: e, text: v.slice(s, e) };
  }
  function valueOptions(field) {
    var counts = state.res ? state.res.facets[field] : {}, names;
    if (field === 'detected_level') names = LEVELS.map(function (l) { return l.v; });
    else names = (field === 'service_name' ? META.apps : META.types).slice();
    return names.map(function (v) { return { v: v, n: counts[v] || 0 }; }).sort(function (a, b) { return b.n - a.n; });
  }
  function buildSuggestions() {
    var tk = tokenAtCaret(), items = [], text = tk.text, neg = text[0] === '-' ? '-' : '', body = neg ? text.slice(1) : text;
    if (text === '-') {
      [['-level:', 'Hide log levels, for example -level:debug'], ['-app:', 'Hide apps'], ['-apptype:', 'Hide app types']].forEach(function (f) { items.push({ kind: 'field', label: f[0], hint: f[1], replace: [tk.s, tk.e], text: f[0], keep: true }); });
      return { head: 'Exclude (NOT). You can also type -word to hide lines containing it', items: items };
    }
    var m = /^([A-Za-z]+):(.*)$/.exec(body);
    if (m && ALIAS[m[1].toLowerCase()] && ALIAS[m[1].toLowerCase()] !== 'line') {
      var field = ALIAS[m[1].toLowerCase()], rest = m[2], lc = rest.lastIndexOf(','), prior = lc >= 0 ? rest.slice(0, lc + 1) : '', part = (lc >= 0 ? rest.slice(lc + 1) : rest).toLowerCase();
      var all = valueOptions(field), pre = all.filter(function (o) { return !part || o.v.toLowerCase().indexOf(part) === 0; });
      (pre.length ? pre : all.filter(function (o) { return o.v.toLowerCase().indexOf(part) >= 0; })).forEach(function (o) {
        var lv = field === 'detected_level';
        items.push({ kind: 'value', label: o.v, hint: fmtN(o.n) + ' lines', color: lv ? 'var(--lv-' + o.v + ')' : (field === 'service_name' ? 'hsl(' + hue(o.v) + ' 55% 55%)' : 'var(--accent)'), replace: [tk.s, tk.e], text: neg + m[1] + ':' + prior + o.v + ' ' });
      });
      return { head: 'Values for ' + FACET_TITLE[field], items: items };
    }
    if (body) {
      [['level:', 'Filter by log level'], ['app:', 'Filter by app name'], ['apptype:', 'Filter by app type']].forEach(function (f) {
        if (f[0].indexOf(body.toLowerCase()) === 0 && f[0] !== body.toLowerCase()) items.push({ kind: 'field', label: neg + f[0], hint: f[1], replace: [tk.s, tk.e], text: neg + f[0], keep: true });
      });
      return { head: items.length ? 'Fields' : '', items: items };
    }
    [['level:', 'error, warn, info\u2026'], ['app:', META.apps.slice(0, 2).join(', ') + '\u2026'], ['apptype:', META.types.join(', ').toLowerCase()], ['-', 'Exclude, for example -level:debug']].forEach(function (f) { items.push({ kind: 'field', label: f[0], hint: f[1], replace: [tk.s, tk.e], text: f[0], keep: true }); });
    var out = { head: 'Filter by', items: items, extra: [] };
    sortedSaved().slice(0, 5).forEach(function (s) { out.extra.push({ kind: 'saved', label: s.name, sub: s.query, hint: s.pinned ? 'Pinned' : 'Saved', whole: s.query }); });
    store.get('logbook.recent').slice(0, 5).forEach(function (qq) { out.extra.push({ kind: 'recent', label: qq, hint: 'Recent', whole: qq }); });
    return out;
  }
  function sortedSaved() { return state.saved.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.name.localeCompare(b.name); }); }
  function setHighlight(tree) {
    var srcs = [];
    (function walk(n) {
      if (n.type === 'group') return n.children.forEach(walk);
      if (n.field !== 'line') return;
      if (n.op === 'contains') srcs.push(LQ.reEsc(LQ.valOf(n)));
      else if (n.op === 'regex') srcs.push(LQ.valOf(n).replace(/^\(\?[a-zA-Z]+\)/, ''));
    })(tree || { type: 'group', children: [] });
    state.hl = null;
    if (srcs.length) { try { state.hl = new RegExp(srcs.join('|'), 'gi'); } catch (e) { state.hl = null; } }
  }
  return {
    LQ: LQ, state: state, input: input, parse: parse, tokenize: tokenize, compileAll: compileAll, activeTree: activeTree, evalNode: evalNode,
    chipText: chipText, isNeg: isNeg, editSpans: editSpans, appendTo: appendTo, facetEdit: facetEdit, clearField: clearField, facetToggle: facetToggle,
    activeValues: activeValues, buildSuggestions: buildSuggestions, tokenAtCaret: tokenAtCaret, termText: termText, qv: qv, toApi: toApi, setHighlight: setHighlight, condProblem: condProblem
  };
};
