/* CSV export helper (docs/design/portal.md 11.4). Pure functions, no DOM.
   Cell rule (OWASP CSV injection): every cell becomes a string; if it starts with = + - @ TAB or CR, a single quote is
   prefixed; then the cell is wrapped in double quotes with each " doubled. Rows end with CRLF (RFC 4180). UTF-8 BOM first. */
(function (root) {
  'use strict';
  var DANGER = /^[=+\-@\t\r]/;
  function cell(v) {
    var s = v == null ? '' : String(v);
    if (DANGER.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  // columns: array of keys, in output order. rows: array of plain objects.
  function toCsv(rows, columns) {
    var out = [columns.map(cell).join(',')];
    (rows || []).forEach(function (r) { out.push(columns.map(function (k) { return cell(r[k]); }).join(',')); });
    return '﻿' + out.join('\r\n') + '\r\n';
  }
  // File-name slug: lower case, [a-z0-9-] only, max 40 characters, never empty.
  function slug(name) {
    var s = String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
    return s || 'device';
  }
  root.CsvExport = { toCsv: toCsv, cell: cell, slug: slug };
})(window);
