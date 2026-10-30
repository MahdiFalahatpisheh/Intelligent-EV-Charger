/* Home "News" section and post.html. Reads published posts straight from the Supabase REST endpoint with the public key
   (one allowed external origin, decision D-007). Row Level Security lets the public key read published posts only.
   Text goes in with textContent (md-render.js); never innerHTML. If anything fails, the Home section simply stays hidden. */
(function () {
  'use strict';
  var cfg = window.PORTAL_CONFIG, R = window.MdRender;
  if (!cfg || !cfg.url || !cfg.key || !R) return;
  var COLS = 'id,title,body_md,image_url,image_alt,published_at';

  function api(query) {
    return fetch(cfg.url + '/rest/v1/posts?' + query, { headers: { apikey: cfg.key, Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function fmtDate(t) { return t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
  function image(p, cls) {
    var path = p.image_url;
    if (!path || !/^assets\/[A-Za-z0-9._\/-]+$/.test(path) || path.indexOf('..') >= 0) return null;
    var im = document.createElement('img');
    im.src = path; im.alt = p.image_alt || ''; im.width = 1200; im.height = 1200; im.loading = 'lazy'; im.decoding = 'async'; im.className = cls;
    im.addEventListener('error', function () { if (im.parentNode) im.parentNode.removeChild(im); });
    return im;
  }

  // Home: latest three.
  var list = document.getElementById('news-list'), sec = document.getElementById('news');
  if (list && sec) {
    api('select=' + COLS + '&status=eq.published&order=published_at.desc&limit=3').then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) return;
      rows.forEach(function (p) {
        var li = el('li', 'news-card card'), href = 'post.html?id=' + encodeURIComponent(p.id);
        var im = image(p, 'news-img');
        if (im) { var a0 = el('a', 'news-img-link'); a0.href = href; a0.tabIndex = -1; a0.setAttribute('aria-hidden', 'true'); a0.appendChild(im); li.appendChild(a0); }
        var d = el('time', 'news-date', fmtDate(p.published_at)); d.setAttribute('datetime', p.published_at || ''); li.appendChild(d);
        var h = el('h3', 'news-title'), a = el('a', '', p.title); a.href = href; h.appendChild(a); li.appendChild(h);
        var ex = el('div', 'news-excerpt'); ex.appendChild(R.render(R.firstParagraph(p.body_md))); li.appendChild(ex);
        var more = el('a', 'news-more', 'Read the post'); more.href = href; more.setAttribute('aria-label', 'Read the post: ' + p.title); li.appendChild(more);
        list.appendChild(li);
      });
      sec.hidden = false;
    }).catch(function () { /* quiet: the section stays hidden */ });
  }

  // post.html: one post by id.
  var body = document.getElementById('post-body');
  if (body) {
    var msg = document.getElementById('post-msg'), h1 = document.getElementById('post-h'), dt = document.getElementById('post-date');
    var id = new URLSearchParams(window.location.search).get('id') || '';
    function none(text) { msg.textContent = text; msg.hidden = false; msg.className = 'notice notice-empty'; }
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) { none('That post could not be found. Go back to Home to see the latest news.'); return; }
    api('select=' + COLS + '&status=eq.published&id=eq.' + encodeURIComponent(id) + '&limit=1').then(function (rows) {
      var p = Array.isArray(rows) && rows[0];
      if (!p) { none('That post could not be found. Go back to Home to see the latest news.'); return; }
      document.title = p.title + ' - Shared EV Charging';
      h1.textContent = p.title;
      dt.textContent = fmtDate(p.published_at); dt.hidden = false;
      var im = image(p, 'post-img'); if (im) body.appendChild(im);
      body.appendChild(R.render(p.body_md));
      msg.hidden = true; body.hidden = false;
    }).catch(function () { none('We could not load this post. Check your connection and try again.'); });
  }
})();
