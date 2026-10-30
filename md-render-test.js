/* Test cases for md-render.js. Each case shows its input, the rendered result, and PASS or FAIL. */
(function () {
  'use strict';
  var ALLOWED = { P: 1, BR: 1, STRONG: 1, EM: 1, UL: 1, LI: 1, A: 1 };
  var cases = [
    { name: 'Paragraphs and line break', src: 'First paragraph.\nSame paragraph, new line.\n\nSecond paragraph.', expect: function (o) { return o.querySelectorAll('p').length === 2 && o.querySelectorAll('br').length === 1; } },
    { name: 'Bold and italic', src: 'This is **bold** and *italic* text.', expect: function (o) { return o.querySelector('strong').textContent === 'bold' && o.querySelector('em').textContent === 'italic'; } },
    { name: 'List', src: '- one\n- two\n- three', expect: function (o) { return o.querySelectorAll('ul > li').length === 3; } },
    { name: 'https link', src: 'See [the project](https://example.org/path?a=1).', expect: function (o) { var a = o.querySelector('a'); return a && a.href === 'https://example.org/path?a=1' && a.rel === 'noopener noreferrer'; } },
    { name: 'Hashtags stay text', src: '#SharedGarages #EV', expect: function (o) { return o.textContent === '#SharedGarages #EV' && !o.querySelector('a'); } },
    { name: 'script tag is text', src: '<script>alert(1)</script>', expect: function (o) { return !o.querySelector('script') && o.textContent.indexOf('<script>') === 0; } },
    { name: 'img onerror is text', src: '<img src=x onerror=alert(1)>', expect: function (o) { return !o.querySelector('img') && o.textContent.indexOf('<img') === 0; } },
    { name: 'javascript: link is text', src: '[click](javascript:alert(1))', expect: function (o) { return !o.querySelector('a') && o.textContent === '[click](javascript:alert(1))'; } },
    { name: 'data: and http: links are text', src: '[a](data:text/html,x) [b](http://example.org)', expect: function (o) { return !o.querySelector('a'); } },
    { name: 'HTML entities are text', src: '&lt;b&gt;not bold&lt;/b&gt; &amp; &#60;i&#62;', expect: function (o) { return !o.querySelector('b,i') && o.textContent === '&lt;b&gt;not bold&lt;/b&gt; &amp; &#60;i&#62;'; } },
    { name: 'Markup inside bold is text', src: '**<b onclick=alert(1)>x</b>**', expect: function (o) { return !o.querySelector('b') && o.querySelector('strong').textContent.indexOf('<b') === 0; } },
    { name: 'Link text with markup is text', src: '[<img src=x onerror=alert(1)>](https://example.org)', expect: function (o) { var a = o.querySelector('a'); return !o.querySelector('img') && (!a || a.textContent.indexOf('<img') === 0); } },
    { name: 'Quote break-out in URL is rejected', src: '[x](https://example.org/"onmouseover="alert(1))', expect: function (o) { return !o.querySelector('a'); } },
    { name: 'Empty input', src: '', expect: function (o) { return o.childNodes.length === 0; } }
  ];

  // Generic rule for every case: only allowed tags, only href/rel/target attributes, every link is https.
  function generic(o) {
    var ok = true;
    o.querySelectorAll('*').forEach(function (el) {
      if (!ALLOWED[el.tagName]) ok = false;
      [].forEach.call(el.attributes, function (at) { if (['href', 'rel', 'target'].indexOf(at.name) < 0) ok = false; });
      if (el.tagName === 'A' && el.getAttribute('href').indexOf('https://') !== 0) ok = false;
    });
    return ok;
  }

  var host = document.getElementById('md-cases'), pass = 0;
  window.__injected = false;
  window.alert = function () { window.__injected = true; };  // any executed payload would set this
  cases.forEach(function (c) {
    var box = document.createElement('div'), out = document.createElement('div');
    box.className = 'md-case card';
    var h = document.createElement('h2'), pre = document.createElement('pre'), res = document.createElement('p');
    h.textContent = c.name;
    pre.textContent = c.src || '(empty)';
    out.className = 'md-out';
    out.appendChild(MdRender.render(c.src));
    var ok = false;
    try { ok = !!c.expect(out) && generic(out); } catch (e) { ok = false; }
    if (ok) pass++;
    res.className = 'md-res ' + (ok ? 'is-pass' : 'is-fail');
    res.textContent = ok ? 'PASS' : 'FAIL';
    [h, pre, out, res].forEach(function (n) { box.appendChild(n); });
    host.appendChild(box);
  });
  var sum = document.getElementById('md-summary');
  var all = pass === cases.length && !window.__injected;
  sum.textContent = (all ? 'All ' : '') + pass + ' of ' + cases.length + ' cases pass. Executed payloads: ' + (window.__injected ? 'YES (fail)' : 'none') + '.';
  sum.setAttribute('data-status', all ? 'pass' : 'fail');
})();
