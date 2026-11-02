/* Test cases for csv.js */
(function () {
  'use strict';
  var C = window.CsvExport, host = document.getElementById('csv-cases'), pass = 0;
  var cases = [
    ['formula =1+1', C.cell('=1+1'), '"\'=1+1"'],
    ['formula +1', C.cell('+1'), '"\'+1"'],
    ['formula -2', C.cell('-2'), '"\'-2"'],
    ['formula @SUM(A1)', C.cell('@SUM(A1)'), '"\'@SUM(A1)"'],
    ['tab then =x', C.cell('\t=x'), '"\'\t=x"'],
    ['carriage return then =x', C.cell('\r=x'), '"\'\r=x"'],
    ['quote a"b', C.cell('a"b'), '"a""b"'],
    ['comma a,b', C.cell('a,b'), '"a,b"'],
    ['newline in a cell', C.cell('a\nb'), '"a\nb"'],
    ['non-ASCII name', C.cell('Ladestation Zürich'), '"Ladestation Zürich"'],
    ['null and undefined', C.cell(null) + '|' + C.cell(undefined), '""|""'],
    ['number', C.cell(12.5), '"12.5"'],
    ['whole file: BOM, CRLF, header', C.toCsv([{ a: 'x', b: '=y' }], ['a', 'b']), '﻿"a","b"\r\n"x","\'=y"\r\n'],
    ['slug', C.slug('Demo charger A / Ünï €'), 'demo-charger-a-n'],
    ['slug empty', C.slug('###'), 'device'],
    ['slug length', String(C.slug(new Array(80).join('ab ')).length <= 40), 'true']
  ];
  cases.forEach(function (c) {
    var ok = c[1] === c[2], box = document.createElement('div'); box.className = 'md-case card';
    var h = document.createElement('h2'), pre = document.createElement('pre'), res = document.createElement('p');
    h.textContent = c[0]; pre.textContent = JSON.stringify(c[1]) + '\nexpected ' + JSON.stringify(c[2]);
    res.className = 'md-res ' + (ok ? 'is-pass' : 'is-fail'); res.textContent = ok ? 'PASS' : 'FAIL';
    if (ok) pass++; [h, pre, res].forEach(function (n) { box.appendChild(n); }); host.appendChild(box);
  });
  var s = document.getElementById('csv-summary'), all = pass === cases.length;
  s.textContent = (all ? 'All ' : '') + pass + ' of ' + cases.length + ' cases pass.'; s.setAttribute('data-status', all ? 'pass' : 'fail');
})();
