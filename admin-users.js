/* admin-users.html: admins see every user, change roles, invite users and remove users.
   Security rules: the database function admin_set_role and the admin-users Edge Function make the real decisions (the page only
   hides controls); the session token goes only in the Authorization header of the request to the project's own function URL;
   text is written with textContent; every destructive step is confirmed (removal needs the user's email typed); error text shown
   to the page is generic; nothing is logged; nothing here can command a charger. */
(function () {
  'use strict';
  var P = window.Portal, cfg = window.PORTAL_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var PAGE = 50, ROLES = { customer: 'Customer', admin: 'Admin', disabled: 'Disabled' };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function say(node, text, kind, retry) {
    node.textContent = text || ''; node.hidden = !text; node.className = 'notice' + (kind ? ' notice-' + kind : '');
    if (retry && text) { node.appendChild(document.createTextNode(' ')); var b = el('button', 'link-btn', 'Try again'); b.type = 'button'; b.addEventListener('click', retry); node.appendChild(b); }
  }
  function fmtDate(t) { return t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
  function fieldError(input, text) {
    var id = input.id + '-err', e = $(id);
    if (!text) { if (e) e.remove(); input.removeAttribute('aria-invalid'); return; }
    if (!e) { e = el('p', 'field-error'); e.id = id; input.parentNode.appendChild(e); }
    e.textContent = text; input.setAttribute('aria-invalid', 'true');
  }
  var G = {
    network: 'We could not reach the service. Check your connection and try again.',
    failed: 'That did not work. Try again in a moment.',
    denied: 'That was not allowed. Sign in with an admin account.',
    lastAdmin: 'You can\'t remove the last admin. Make another user an admin first.',
    notFound: 'That user no longer exists. The list has been refreshed.'
  };
  // Edge Function error codes (docs/design/portal.md 12.4). Unknown codes get the generic text; no free text from the server is shown.
  var FN_ERR = {
    has_devices: 'This user has chargers. Remove them or disable the account instead.',
    last_admin: G.lastAdmin,
    self: 'You can\'t remove your own account here.',
    not_found: G.notFound,
    already_exists: 'That email already has an account.',
    invalid_email: 'Enter a valid email address, such as name@example.com.',
    rate_limited: 'Too many emails were sent just now. Wait a few minutes and try again.',
    not_admin: G.denied, unauthorized: 'Your session has ended. Sign in again.', forbidden_origin: G.failed,
    invite_failed: 'The invitation was not sent. Try again in a moment.', delete_failed: 'The user was not removed. Try again in a moment.'
  };
  function fnMsg(r, fallback) { return r.network ? G.network : (FN_ERR[r.error] || fallback || G.failed); }

  if (!P || !P.ready) { say($('ad-msg'), 'The portal is not available right now. Try again later.', 'warn'); return; }

  var me = null, page = 0, query = '', hasNext = false, rows = [], act = null, actOpener = null, resTimer = null;

  function result(text, kind) {
    say($('us-result'), text, kind || 'ok'); clearTimeout(resTimer);
    if (kind !== 'error') resTimer = setTimeout(function () { say($('us-result'), ''); }, 6000);
  }
  function esc(s) { return s.replace(/[\\%_]/g, function (c) { return '\\' + c; }); }

  // ---- list ----
  function load() {
    say($('us-msg'), 'Loading users…');
    var q = P.client.from('profiles').select('id,email,email_confirmed_at,role,created_at').order('created_at', { ascending: false });
    if (query) q = q.ilike('email', '%' + esc(query) + '%');
    q.range(page * PAGE, page * PAGE + PAGE).then(function (r) {
      if (r.error) { say($('us-msg'), 'We could not load the users. Check your connection and try again.', 'error', load); return; }
      rows = r.data || []; hasNext = rows.length > PAGE; rows = rows.slice(0, PAGE);
      say($('us-msg'), rows.length ? '' : (query ? 'No users match that search.' : 'No users yet.'), rows.length ? '' : 'empty');
      draw();
      $('us-pager').hidden = !(page > 0 || hasNext);
      $('us-prev').disabled = page === 0; $('us-next').disabled = !hasNext; $('us-page').textContent = 'Page ' + (page + 1);
    }, function () { say($('us-msg'), 'We could not load the users. Check your connection and try again.', 'error', load); });
  }
  var confirmHome = $('us-confirm').parentNode;
  function park() { if ($('us-list').contains($('us-confirm'))) confirmHome.insertBefore($('us-confirm'), $('us-pager')); }
  function draw() {
    park(); closeAct(false);
    var ul = $('us-list'); ul.textContent = '';
    rows.forEach(function (u) {
      var li = el('li', 'post-item user-item' + (u.role === 'disabled' ? ' is-disabled' : '')), mine = me && u.id === me;
      var info = el('div', 'post-pick');
      var tt = el('span', 'post-title', u.email || '(no email)'); tt.title = u.email || ''; info.appendChild(tt);
      var meta = el('span', 'post-meta');
      meta.appendChild(el('span', 'tag tag-role-' + u.role, ROLES[u.role] || 'Unknown'));
      meta.appendChild(el('span', 'tag ' + (u.email_confirmed_at ? 'tag-published' : 'tag-src'), u.email_confirmed_at ? 'Confirmed' : 'Not confirmed'));
      meta.appendChild(el('span', '', 'Signed up ' + fmtDate(u.created_at) + (mine ? ', this is you' : '')));
      info.appendChild(meta);
      if (u.role === 'disabled') info.appendChild(el('span', 'user-note', 'Disabled: cannot use the portal.'));
      li.appendChild(info);
      if (!mine) {  // Own row: no role dropdown and no Remove, a UI choice to avoid self lock-out. The database allows an admin to change their own role while another admin remains (docs/design/portal.md 12.2); only the last admin is protected there.
        var row = el('div', 'user-actions');
        var f = el('div', 'field field-inline');
        var lab = el('label', '', 'Role'); var sid = 'role-' + u.id; lab.setAttribute('for', sid); lab.className = 'visually-hidden'; lab.textContent = 'Role for ' + (u.email || 'this user');
        var sel = document.createElement('select'); sel.id = sid;
        Object.keys(ROLES).forEach(function (k) { var o = el('option', '', ROLES[k]); o.value = k; if (k === u.role) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', function () { askRole(u, sel); });
        f.appendChild(lab); f.appendChild(sel); row.appendChild(f);
        var br = el('button', 'btn btn-danger btn-small', 'Remove'); br.type = 'button'; br.setAttribute('aria-label', 'Remove user: ' + (u.email || 'this user'));
        br.addEventListener('click', function () { askRemove(u, br); });
        row.appendChild(br); li.appendChild(row);
      }
      ul.appendChild(li);
    });
  }
  $('us-prev').addEventListener('click', function () { if (page > 0) { page--; load(); } });
  $('us-next').addEventListener('click', function () { if (hasNext) { page++; load(); } });
  $('us-search').addEventListener('submit', function (e) { e.preventDefault(); query = $('us-q').value.trim().slice(0, 100); page = 0; load(); });

  // ---- confirm panel (under the row it is about; focus on Cancel; Escape cancels) ----
  function closeAct(refocus) {
    $('us-confirm').hidden = true; $('us-type-wrap').hidden = true; $('us-type').value = ''; $('us-yes').disabled = false;
    var a = act, op = actOpener; act = null; actOpener = null;
    if (a && a.kind === 'role' && a.select) a.select.value = a.user.role;  // put the dropdown back when cancelled
    if (refocus && op && document.body.contains(op)) op.focus();
  }
  function openAct(a, opener, q, note, yes, typed) {
    closeAct(false);
    act = a; actOpener = opener;
    $('us-q-text').textContent = q; $('us-note').textContent = note; $('us-yes').textContent = yes;
    var row = opener.closest('li'); if (row) row.appendChild($('us-confirm'));
    if (typed) { $('us-type-label').textContent = 'Type ' + typed + ' to confirm'; $('us-type-wrap').hidden = false; $('us-yes').disabled = true; $('us-type').value = ''; }
    $('us-confirm').hidden = false; $('us-no').focus();
  }
  function askRole(u, sel) {
    var to = sel.value, email = u.email || 'this user';
    if (to === u.role) return;
    if (to === 'admin') {
      openAct({ kind: 'role', user: u, to: to, select: sel }, sel,
        'Make ' + email + ' an admin?',
        'Admins can see every customer\'s email and chargers, add, edit and remove chargers, write, publish and delete news posts, change other users\' roles, invite users and remove users. They cannot change charging. Only make someone an admin if you trust them with all of this.',
        'Make admin');
    } else if (to === 'disabled') {
      openAct({ kind: 'role', user: u, to: to, select: sel }, sel, 'Disable ' + email + '?', 'A disabled user cannot use the portal. You can change the role back later.', 'Disable user');
    } else {
      openAct({ kind: 'role', user: u, to: to, select: sel }, sel, 'Change ' + email + ' from ' + (ROLES[u.role] || 'their current role') + ' to ' + ROLES[to] + '?',
        u.role === 'admin' ? 'They will no longer be able to manage users, chargers or posts.' : 'They can use the portal as a customer again.', 'Change role');
    }
  }
  function askRemove(u, opener) {
    var email = u.email || '';
    openAct({ kind: 'remove', user: u }, opener, 'Remove user ' + (email || 'this user') + '?',
      'This deletes the account and cannot be undone. Their chargers and report history are not deleted by this page.', 'Remove user', email || u.id);
  }
  $('us-no').addEventListener('click', function () { closeAct(true); });
  $('us-confirm').addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeAct(true); } });
  $('us-type').addEventListener('input', function () {
    if (act && act.kind === 'remove') $('us-yes').disabled = this.value.trim() !== (act.user.email || act.user.id);
  });
  $('us-yes').addEventListener('click', function () {
    var a = act; if (!a) return;
    if (a.kind === 'remove' && $('us-type').value.trim() !== (a.user.email || a.user.id)) return;  // belt and braces: the button is disabled until it matches
    $('us-yes').disabled = true;
    if (a.kind === 'role') {
      P.client.rpc('admin_set_role', { target: a.user.id, new_role: a.to }).then(function (r) {
        if (r.error) {
          // Match on the error code (or a message equal to the code), never on free text.
          var c = r.error.code || '', m = r.error.message || '';
          closeAct(true);
          if (c === 'PT409' || m === 'last_admin') result(G.lastAdmin, 'error');
          else if (c === 'PT404' || m === 'not_found') { result(G.notFound, 'error'); load(); }
          else if (c === 'PT403' || m === 'not_admin' || c === '42501') result(G.denied, 'error');
          else result(G.failed, 'error');
          return;
        }
        var changed = !(r.data && r.data.changed === false);
        a.select = null; act = null; closeAct(false); result(changed ? 'Role changed.' : 'No change: that user already has this role.'); load();
      }, function () { closeAct(true); result(G.network, 'error'); });
    } else {
      call({ action: 'delete', user_id: a.user.id }).then(function (ok) {
        if (!ok.ok) { closeAct(true); result(fnMsg(ok), 'error'); if (ok.error === 'not_found') load(); return; }
        closeAct(false); result('User removed.'); load();
      });
    }
  });

  // ---- Edge Function call: token only in the Authorization header, only to the project's own URL ----
  function call(body) {
    return P.getSession().then(function (s) {
      if (!s) return { ok: false };
      return fetch(cfg.url + '/functions/v1/admin-users', {
        method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token, 'apikey': cfg.key },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: !!(j && j.ok === true), error: j && j.error }; }, function () { return { ok: false }; }); });
    }).catch(function () { return { ok: false, network: true }; });
  }

  // ---- invite ----
  function validEmail(v) { return v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  $('iv-form').addEventListener('submit', function (e) {
    e.preventDefault(); say($('iv-msg'), '');
    var inp = $('iv-email'), v = inp.value.trim();
    if (!v) { fieldError(inp, 'Enter an email address.'); inp.focus(); return; }
    if (!validEmail(v)) { fieldError(inp, 'Enter a valid email address, such as name@example.com.'); inp.focus(); return; }
    fieldError(inp, ''); var b = $('iv-send'); b.disabled = true; b.textContent = 'Sending…'; b.setAttribute('aria-busy', 'true');
    call({ action: 'invite', email: v }).then(function (r) {
      b.disabled = false; b.textContent = 'Send invitation'; b.setAttribute('aria-busy', 'false');
      if (r.ok) { inp.value = ''; say($('iv-msg'), 'Invitation sent to ' + v + '.', 'ok'); load(); return; }
      say($('iv-msg'), fnMsg(r, 'The invitation was not sent. Check the address and try again.'), 'error');
    });
  });

  $('signout').addEventListener('click', function () { P.signOut().then(function () { window.location.replace('login.html'); }); });

  // Role check first; no profile request unless admin.
  P.getSession().then(function (s) {
    if (!s) { window.location.replace('login.html'); return; }
    me = s.user.id;
    P.getRole(s).then(function (role) {
      $('who').textContent = 'Signed in as ' + (s.user.email || 'your account') + '.'; $('portal-bar').hidden = false;
      if (role !== 'admin') { say($('ad-msg'), ''); $('denied').hidden = false; return; }
      say($('ad-msg'), ''); $('admin-main').hidden = false; load();
    });
  });
  P.client.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') window.location.replace('login.html'); });
})();
