/* Safe markdown subset renderer (docs/design/portal.md 8.4).
   Builds DOM nodes with createElement and textContent only. It never parses HTML, so post text can not inject markup.
   Supported: paragraphs (blank line), line breaks (single newline), **bold**, *italic*, "- " lists, [text](https://...) links.
   Links must start with https:// ; anything else stays as plain text. Hashtags stay plain text. */
(function (root) {
  'use strict';

  function safeUrl(u) {
    if (!/^https:\/\/[^\s<>"'`]+$/i.test(u)) return null;
    try { var x = new URL(u); return x.protocol === 'https:' && x.hostname ? x.href : null; } catch (e) { return null; }
  }

  // Inline: earliest of link, bold, italic. depth stops nesting from running away.
  var INLINE = /\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)|\*\*([^*\n][^\n]*?)\*\*|\*([^*\s][^*\n]*?)\*/;
  function inline(text, parent, depth) {
    var rest = text;
    while (rest) {
      var m = INLINE.exec(rest);
      if (!m) { parent.appendChild(document.createTextNode(rest)); return; }
      if (m.index > 0) parent.appendChild(document.createTextNode(rest.slice(0, m.index)));
      if (m[1] !== undefined) {
        var href = safeUrl(m[2]);
        if (href) {
          var a = document.createElement('a');
          a.href = href; a.rel = 'noopener noreferrer'; a.target = '_blank';
          a.textContent = m[1];
          parent.appendChild(a);
        } else parent.appendChild(document.createTextNode(m[0]));
      } else if (m[3] !== undefined) {
        var b = document.createElement('strong');
        if (depth < 2) inline(m[3], b, depth + 1); else b.textContent = m[3];
        parent.appendChild(b);
      } else {
        var i = document.createElement('em');
        if (depth < 2) inline(m[4], i, depth + 1); else i.textContent = m[4];
        parent.appendChild(i);
      }
      rest = rest.slice(m.index + m[0].length);
    }
  }

  function lines(text, parent) {
    text.split('\n').forEach(function (ln, k) {
      if (k) parent.appendChild(document.createElement('br'));
      inline(ln, parent, 0);
    });
  }

  // Returns a DocumentFragment. Use: el.replaceChildren(MdRender.render(src)).
  function render(src) {
    var frag = document.createDocumentFragment();
    var text = String(src == null ? '' : src).replace(/\r\n?/g, '\n').trim();
    if (!text) return frag;
    text.split(/\n{2,}/).forEach(function (block) {
      var rows = block.split('\n');
      if (rows.every(function (r) { return /^- /.test(r); })) {
        var ul = document.createElement('ul');
        rows.forEach(function (r) { var li = document.createElement('li'); inline(r.slice(2), li, 0); ul.appendChild(li); });
        frag.appendChild(ul);
      } else {
        var p = document.createElement('p');
        lines(block, p);
        frag.appendChild(p);
      }
    });
    return frag;
  }

  // First paragraph as plain text (for news teasers).
  function firstParagraph(src) {
    var text = String(src == null ? '' : src).replace(/\r\n?/g, '\n').trim();
    return text.split(/\n{2,}/)[0] || '';
  }

  root.MdRender = { render: render, firstParagraph: firstParagraph, safeUrl: safeUrl };
})(window);
