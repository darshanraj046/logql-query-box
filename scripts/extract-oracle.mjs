import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) {
  console.error('usage: node scripts/extract-oracle.mjs <path to prototype index.html>')
  process.exit(1)
}

const lines = readFileSync(source, 'utf8').split('\n')

function between(startMarker, endMarker) {
  const start = lines.findIndex((l) => l.includes(startMarker))
  const end = lines.findIndex((l, i) => i > start && l.includes(endMarker))
  if (start < 0 || end < 0) throw new Error(`markers not found: ${startMarker} / ${endMarker}`)
  return lines.slice(start, end).join('\n')
}

function take(kind, name) {
  const head = `  ${kind} ${name}${kind === 'function' ? '(' : ' ='}`
  const start = lines.findIndex((l) => l.startsWith(head))
  if (start < 0) throw new Error(`not found: ${name}`)
  if (kind === 'var') return lines[start]
  const opensAndCloses = lines[start].trimEnd().endsWith('}') && !lines[start].trimEnd().endsWith('{')
  if (opensAndCloses) return lines[start]
  const end = lines.findIndex((l, i) => i > start && l === '  }')
  return lines.slice(start, end + 1).join('\n')
}

const core = between('/* indexed:true means', '/* Sample data */')
const vars = ['ALIAS', 'ALIAS_OF', 'FACET_TITLE', 'LV_SYN'].map((n) => take('var', n))
const fns = [
  'fmtN', 'hue', 'canon', 'regexEndAt', 'tokenize', 'termToNode', 'mergeSame', 'parse', 'qv', 'termText',
  'editSpans', 'appendTo', 'isInc', 'isExc', 'facetEdit', 'clearField', 'facetToggle', 'chipText', 'isNeg',
  'activeValues', 'tokenAtCaret', 'valueOptions', 'buildSuggestions', 'sortedSaved', 'setHighlight'
].map((n) => take('function', n))

const out = `module.exports = function createPrototype(env) {
  'use strict';
${core}
  var LQ = { FIELDS: FIELDS, LEVELS: LEVELS, MAX_BRANCHES: MAX_BRANCHES, C: C, G: G, listOf: listOf, valOf: valOf, condProblem: condProblem, activeTree: activeTree, evalNode: evalNode, dnf: dnf, reEsc: reEsc, compileAll: compileAll, toApi: toApi };
${vars.join('\n')}
  var META = { apps: env.apps, types: env.types };
  var state = { query: env.query || '', parsed: null, saved: env.saved || [], res: env.counts ? { facets: env.counts } : null, hl: null };
  var input = { value: '', selectionStart: 0 };
  function $() { return input; }
  var store = { get: function () { return (env.recent || []).slice(); } };
  function setQuery(q) { state.query = q; state.parsed = parse(q); }
${fns.join('\n')}
  return {
    LQ: LQ, state: state, input: input, parse: parse, tokenize: tokenize, compileAll: compileAll, activeTree: activeTree, evalNode: evalNode,
    chipText: chipText, isNeg: isNeg, editSpans: editSpans, appendTo: appendTo, facetEdit: facetEdit, clearField: clearField, facetToggle: facetToggle,
    activeValues: activeValues, buildSuggestions: buildSuggestions, tokenAtCaret: tokenAtCaret, termText: termText, qv: qv, toApi: toApi, setHighlight: setHighlight, condProblem: condProblem
  };
};
`

const target = fileURLToPath(new URL('../test/oracle/prototype.cjs', import.meta.url))
writeFileSync(target, out)
console.log(`wrote ${target} (${out.length} bytes)`)
