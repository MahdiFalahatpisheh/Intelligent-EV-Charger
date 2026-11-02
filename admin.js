/* admin.html: posts for admins. The database enforces admin-only writes (RLS); this page also hides the controls from others. */
(function () {
  'use strict';
  var P = window.Portal;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function say(node, text, kind, retry) {
    node.textContent = text || ''; node.hidden = !text; node.className = 'notice' + (kind ? ' notice-' + kind : '');
    if (retry && text) { node.appendChild(document.createTextNode(' ')); var b = el('button', 'link-btn', 'Try again'); b.type = 'button'; b.addEventListener('click', retry); node.appendChild(b); }
  }
  function fieldError(input, text) {
    var id = input.id + '-err', e = $(id), base = input.id + '-hint';
    if (!text) { if (e) e.remove(); input.removeAttribute('aria-invalid'); if ($(base)) input.setAttribute('aria-describedby', base); else input.removeAttribute('aria-describedby'); return; }
    if (!e) { e = el('p', 'field-error'); e.id = id; input.parentNode.appendChild(e); }
    e.textContent = text; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', id);
  }
  var T = { network: 'We could not reach the service. Check your connection and try again.', denied: 'You are not allowed to do that. Sign in with an admin account.' };
  var user = null, posts = [], cur = null;  // cur = post being edited, or null for a new post

  if (!P || !P.ready) { say($('ad-msg'), 'The portal is not available right now. Try again later.', 'warn'); return; }

  var f = { title: $('p-title'), body: $('p-body'), img: $('p-img'), alt: $('p-alt') };

  function fmtDate(t) { return t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

  function loadPosts(keepId) {
    say($('pl-msg'), 'Loading posts…');
    P.client.from('posts').select('id,title,body_md,image_url,image_alt,status,source,published_at,updated_at,created_at').order('updated_at', { ascending: false }).then(function (r) {
      if (r.error) { say($('pl-msg'), 'We could not load the posts. Check your connection and try again.', 'error', function () { loadPosts(keepId); }); return; }
      posts = r.data || [];
      if (!posts.length) say($('pl-msg'), 'No posts yet. Write the first one.', 'empty'); else say($('pl-msg'), '');
      drawList(keepId);
    }, function () { say($('pl-msg'), 'We could not load the posts. Check your connection and try again.', 'error', function () { loadPosts(keepId); }); });
  }

  var delHome = $('del-confirm').parentNode;
  function drawList(selId) {
    var ul = $('post-list');
    if (ul.contains($('del-confirm'))) delHome.insertBefore($('del-confirm'), ul);  // keep the confirm node alive across redraws
    ul.textContent = '';
    posts.forEach(function (p) {
      var li = el('li', 'post-item' + (selId === p.id ? ' is-sel' : ''));
      var info = el('div', 'post-pick');
      info.appendChild(el('span', 'post-title', p.title));
      var meta = el('span', 'post-meta');
      meta.appendChild(el('span', 'tag tag-' + p.status, p.status === 'published' ? 'Published' : 'Draft'));
      if (p.source === 'linkedin') meta.appendChild(el('span', 'tag tag-src', 'LinkedIn'));
      meta.appendChild(el('span', '', p.status === 'published' ? fmtDate(p.published_at) : 'Edited ' + fmtDate(p.updated_at)));
      info.appendChild(meta);
      li.appendChild(info);
      var row = el('div', 'btn-row post-actions');
      var be = el('button', 'btn btn-secondary btn-small', 'Edit'); be.type = 'button'; be.setAttribute('aria-label', 'Edit post: ' + p.title);
      if (selId === p.id) be.setAttribute('aria-current', 'true');
      be.addEventListener('click', function () { edit(p); $('p-title').focus(); });
      var bd = el('button', 'btn btn-danger btn-small', 'Delete'); bd.type = 'button'; bd.setAttribute('aria-label', 'Delete post: ' + p.title);
      bd.addEventListener('click', function () { askDelete(p, bd); });
      row.appendChild(be); row.appendChild(bd); li.appendChild(row); ul.appendChild(li);
    });
  }

  // Delete: inline confirm that names the post, focus on Cancel, Escape cancels. One request only after the confirm.
  var delTarget = null, delOpener = null;
  function closeDelete(refocus) {
    $('del-confirm').hidden = true; delTarget = null;
    if (refocus && delOpener && document.body.contains(delOpener)) delOpener.focus();
    delOpener = null;
  }
  function askDelete(p, opener) {
    delTarget = p; delOpener = opener;
    $('del-q').textContent = 'Delete post "' + p.title + '"? This cannot be undone.';
    $('del-note').textContent = p.status === 'published' ? 'It disappears from the Home page.' : 'It is a draft, so visitors do not see it.';
    var row = opener && opener.closest ? opener.closest('li') : null;
    if (row) row.appendChild($('del-confirm'));  // directly under the post it is about
    $('del-confirm').hidden = false; $('del-no').focus();
  }
  $('del-no').addEventListener('click', function () { closeDelete(true); });
  $('del-confirm').addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeDelete(true); } });
  $('del-yes').addEventListener('click', function () {
    var p = delTarget; if (!p) return;
    $('del-yes').disabled = true;
    P.client.from('posts').delete().eq('id', p.id).select('id').then(function (r) {
      $('del-yes').disabled = false;
      var ok = !r.error && Array.isArray(r.data) && r.data.length === 1;
      closeDelete(false);
      if (!ok) { say($('pl-msg'), r.error ? 'The post was not deleted. You may not have permission, or the connection failed.' : 'The post was not deleted. It may already be gone.', 'error'); return; }
      if (cur && cur.id === p.id) edit(null);
      say($('pl-msg'), 'Post deleted.', 'ok'); loadPostsAfterDelete();
    }, function () { $('del-yes').disabled = false; closeDelete(false); say($('pl-msg'), T.network, 'error'); });
  });
  function loadPostsAfterDelete() {
    P.client.from('posts').select('id,title,body_md,image_url,image_alt,status,source,published_at,updated_at,created_at').order('updated_at', { ascending: false }).then(function (r) {
      if (r.error) return;
      posts = r.data || []; drawList(cur ? cur.id : null);
      if (!posts.length) say($('pl-msg'), 'Post deleted. No posts left. Write the next one.', 'empty');
    });
  }

  function preview() {
    var host = $('preview'); host.textContent = '';
    var title = f.title.value.trim();
    if (!title && !f.body.value.trim()) { host.appendChild(el('p', 'muted', 'Nothing to preview yet.')); return; }
    if (title) host.appendChild(el('h4', '', title));
    var path = f.img.value.trim();
    if (path && /^assets\/[A-Za-z0-9._\/-]+$/.test(path) && path.indexOf('..') < 0) {
      var im = document.createElement('img'); im.src = path; im.alt = f.alt.value.trim(); im.loading = 'lazy'; im.className = 'post-img';
      im.addEventListener('error', function () { var ph = el('p', 'img-missing', 'Image not found: check the path.'); if (im.parentNode) im.parentNode.replaceChild(ph, im); });
      host.appendChild(im);
    }
    host.appendChild(window.MdRender.render(f.body.value));
  }

  function edit(p) {
    cur = p || null;
    $('ed-h').textContent = p ? 'Edit post' : 'New post';
    f.title.value = p ? p.title : ''; f.body.value = p ? p.body_md : ''; f.img.value = p && p.image_url ? p.image_url : ''; f.alt.value = p && p.image_alt ? p.image_alt : '';
    Object.keys(f).forEach(function (k) { fieldError(f[k], ''); });
    say($('ed-msg'), ''); $('confirm').hidden = true;
    var pub = p && p.status === 'published';
    $('b-save').textContent = pub ? 'Save changes' : 'Save draft'; $('b-save').dataset.label = $('b-save').textContent;
    $('b-publish').hidden = !!pub; $('b-unpublish').hidden = !pub;
    drawList(p ? p.id : null); preview();
  }

  function validate() {
    var ok = true, first = null;
    function bad(input, text) { fieldError(input, text); ok = false; if (!first) first = input; }
    var t = f.title.value.trim();
    if (!t) bad(f.title, 'Enter a title.'); else if (t.length > 200) bad(f.title, 'Make the title shorter.'); else fieldError(f.title, '');
    if (f.body.value.length > 20000) bad(f.body, 'Make the text shorter.'); else fieldError(f.body, '');
    var path = f.img.value.trim();
    if (path && (!/^assets\/[A-Za-z0-9._\/-]+$/.test(path) || path.indexOf('..') >= 0)) bad(f.img, 'Use a path inside the assets folder, such as assets/news/example.png.'); else fieldError(f.img, '');
    if (path && !f.alt.value.trim()) bad(f.alt, 'Describe the image, or remove the image path.'); else fieldError(f.alt, '');
    if (first) first.focus();
    return ok;
  }
  function fields() {
    var path = f.img.value.trim();
    return { title: f.title.value.trim(), body_md: f.body.value, image_url: path || null, image_alt: path ? f.alt.value.trim() : null };
  }
  function busy(on) { ['b-save', 'b-publish', 'b-unpublish', 'confirm-yes'].forEach(function (id) { $(id).disabled = on; }); }
  function fail(r) {
    busy(false);
    say($('ed-msg'), r && r.error && (r.error.code === '42501' || /row-level|permission/i.test(r.error.message || '')) ? T.denied : (r && r.error ? 'The post was not saved. Check the fields and try again.' : T.network), 'error');
  }

  // status: undefined = keep, 'published', 'draft'
  function write(status, doneText) {
    if (!validate()) return;
    var row = fields(); if (status) row.status = status;
    busy(true); say($('ed-msg'), 'Saving…');
    var q = cur ? P.client.from('posts').update(row).eq('id', cur.id).select().single()
                : P.client.from('posts').insert(Object.assign({ source: 'manual', author_id: user.id }, row, { status: status || 'draft' })).select().single();
    q.then(function (r) {
      if (r.error) return fail(r);
      busy(false); say($('ed-msg'), doneText, 'ok');
      cur = r.data; loadPosts(cur.id); edit(cur); say($('ed-msg'), doneText, 'ok');
    }, function () { fail(null); });
  }

  $('post-form').addEventListener('submit', function (e) { e.preventDefault(); write(undefined, cur && cur.status === 'published' ? 'Changes saved.' : 'Draft saved.'); });
  $('b-publish').addEventListener('click', function () {
    if (!validate()) return;
    $('confirm-q').textContent = 'Publish "' + f.title.value.trim() + '"? Visitors will see it on the Home page.';
    $('confirm').hidden = false; $('confirm-yes').focus();
  });
  $('confirm-no').addEventListener('click', function () { $('confirm').hidden = true; $('b-publish').focus(); });
  $('confirm-yes').addEventListener('click', function () { $('confirm').hidden = true; write('published', 'Published.'); });
  $('b-unpublish').addEventListener('click', function () { write('draft', 'Unpublished. The post is a draft again.'); });
  $('new-post').addEventListener('click', function () { edit(null); f.title.focus(); });
  ['title', 'body', 'img', 'alt'].forEach(function (k) { f[k].addEventListener('input', preview); });
  $('signout').addEventListener('click', function () { P.signOut().then(function () { window.location.replace('login.html'); }); });

  P.getSession().then(function (s) {
    if (!s) { window.location.replace('login.html'); return; }
    user = s.user;
    P.getRole(s).then(function (role) {
      $('who').textContent = 'Signed in as ' + (user.email || 'your account') + '.'; $('portal-bar').hidden = false;
      if (role !== 'admin') { say($('ad-msg'), ''); $('denied').hidden = false; return; }
      say($('ad-msg'), ''); $('admin-main').hidden = false; edit(null); loadPosts(null);
    });
  });
  P.client.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') window.location.replace('login.html'); });
})();
