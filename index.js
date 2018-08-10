'use strict'

module.exports = createFilter

/**
 * Given a filter expressed as nested arrays, return a new function
 * that evaluates whether a given feature (with a .properties or .tags property)
 * passes its test.
 *
 * @param {Array} filter mapbox gl filter
 * @returns {Function} filter-evaluating function
 */
function createFilter (filter) {
  return new Function('f', 'var p = (f && f.properties || {}); var g = (f && f.geometry || {}); return ' + compile(filter))
}

function compile (filter) {
  if (!filter) return 'true'
  var op = filter[0]
  if (filter.length <= 1) return op === 'any' ? 'false' : 'true'
  var str =
        op === '==' ? compileComparisonOp(filter[1], filter[2], '===', false)
          : op === '!=' ? compileComparisonOp(filter[1], filter[2], '!==', false)
            : op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>=' ? compileComparisonOp(filter[1], filter[2], op, true)
              : op === 'any' ? compileLogicalOp(filter.slice(1), '||')
                : op === 'all' ? compileLogicalOp(filter.slice(1), '&&')
                  : op === 'none' ? compileNegation(compileLogicalOp(filter.slice(1), '||'))
                    : op === 'in' ? compileInOp(filter[1], filter.slice(2))
                      : op === '!in' ? compileNegation(compileInOp(filter[1], filter.slice(2)))
                        : op === 'has' ? compileHasOp(filter[1])
                          : op === '!has' ? compileNegation(compileHasOp([filter[1]]))
                            : 'true'
  return '(' + str + ')'
}

function compilePropertyReference (property) {
  return property === '$type' ? 'g.type'
    : property === '$id' ? 'f.id'
      : 'p[' + JSON.stringify(property) + ']'
}

function compileComparisonOp (property, value, op, checkType) {
  var left = compilePropertyReference(property)
  var right = JSON.stringify(value)
  return (checkType ? 'typeof ' + left + '=== typeof ' + right + '&&' : '') + left + op + right
}

function compileLogicalOp (expressions, op) {
  return expressions.map(compile).join(op)
}

function compileInOp (property, values) {
  var left = JSON.stringify(values.sort(compare))
  var right = compilePropertyReference(property)

  if (values.length <= 200) return left + '.indexOf(' + right + ') !== -1'

  return 'function(v, a, i, j) {' +
        'while (i <= j) { var m = (i + j) >> 1;' +
        '    if (a[m] === v) return true; if (a[m] > v) j = m - 1; else i = m + 1;' +
        '}' +
    'return false; }(' + right + ', ' + left + ',0,' + (values.length - 1) + ')'
}

function compileHasOp (property) {
  return JSON.stringify(property) + ' in p'
}

function compileNegation (expression) {
  return '!(' + expression + ')'
}

// Comparison function to sort numbers and strings
function compare (a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}
