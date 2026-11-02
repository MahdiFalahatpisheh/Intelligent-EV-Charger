/* admin-customers.html: admin lists customers and manages their chargers (devices).
   Security rules: every device query carries the chosen owner id; rows are built from named fields only; text goes in with
   textContent; every delete is confirmed; errors shown to the page are generic; nothing here can command a charger.
   The database (Row Level Security) is the real boundary. */
(function () {
  'use strict';
  var P = window.Portal;
  var $ = function (id) { return document.getElementById(id); };
  var PAGE = 50, STATUS = { active: 'Active', inactive: 'Inactive', fault: 'Needs attention', unknown: 'Unknown' };
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
  var G = { network: 'We could not reach the service. Check your connection and try again.', denied: 'That was not allowed. Sign in with an admin account.', failed: 'That did not work. Check the details and try again.' };

  if (!P || !P.ready) { say($('ad-msg'), 'The portal is not available right now. Try again later.', 'warn'); return; }

  var page = 0, query = '', hasNext = false, chosen = null, devices = [], editing = null, act = null, actOpener = null;

  // ---- customers (read only) ----
  function esc(s) { return s.replace(/[\\%_]/g, function (c) { return '\\' + c; }); }
  function loadCustomers() {
    say($('cu-msg'), 'Loading customers…');
    var q = P.client.from('profiles').select('id,email,created_at').eq('role', 'customer').not('email_confirmed_at', 'is', null).order('created_at', { ascending: false });
    if (query) q = q.ilike('email', '%' + esc(query) + '%');
    q.range(page * PAGE, page * PAGE + PAGE).then(function (r) {  // one extra row tells us whether a next page exists
      if (r.error) { say($('cu-msg'), 'We could not load the customers. Check your connection and try again.', 'error', loadCustomers); return; }
      var rows = r.data || []; hasNext = rows.length > PAGE; rows = rows.slice(0, PAGE);
      say($('cu-msg'), rows.length ? '' : (query ? 'No customers match that search.' : 'No customers yet. Customers appear here after they sign up.'), rows.length ? '' : 'empty');
      drawCustomers(rows);
      $('cu-pager').hidden = !(page > 0 || hasNext);
      $('cu-prev').disabled = page === 0; $('cu-next').disabled = !hasNext; $('cu-page').textContent = 'Page ' + (page + 1);
    }, function () { say($('cu-msg'), 'We could not load the customers. Check your connection and try again.', 'error', loadCustomers); });
  }
  function drawCustomers(rows) {
    var ul = $('cu-list'); ul.textContent = '';
    rows.forEach(function (c) {
      var li = el('li', 'post-item' + (chosen && chosen.id === c.id ? ' is-sel' : ''));
      var b = el('button', 'post-pick cu-pick'); b.type = 'button';
      var tt = el('span', 'post-title', c.email || '(no email)'); tt.title = c.email || ''; b.appendChild(tt);
      b.appendChild(el('span', 'post-meta', 'Signed up ' + fmtDate(c.created_at)));
      if (chosen && chosen.id === c.id) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { choose(c); drawCustomers(rows); });
      li.appendChild(b); ul.appendChild(li);
    });
  }
  $('cu-prev').addEventListener('click', function () { if (page > 0) { page--; loadCustomers(); } });
  $('cu-next').addEventListener('click', function () { if (hasNext) { page++; loadCustomers(); } });
  $('cu-search').addEventListener('submit', function (e) { e.preventDefault(); query = $('cu-q').value.trim().slice(0, 100); page = 0; loadCustomers(); });

  // ---- chargers of the chosen customer ----
  function choose(c) {
    chosen = c; resetForm(); closeAct(false);
    $('dv-empty').hidden = true; $('dv-panel').hidden = false;
    $('dv-owner').textContent = 'Chargers linked to ' + (c.email || 'this customer') + '.';
    loadDevices();
  }
  function loadDevices() {
    if (!chosen) return;
    var owner = chosen.id;
    say($('dv-msg'), 'Loading chargers…');
    P.client.from('devices').select('id,name,location_label,installed_on,status,is_demo,created_at').eq('owner_id', owner).order('created_at', { ascending: true }).then(function (r) {
      if (!chosen || chosen.id !== owner) return;
      if (r.error) { say($('dv-msg'), 'We could not load the chargers. Check your connection and try again.', 'error', loadDevices); return; }
      devices = r.data || [];
      say($('dv-msg'), devices.length ? '' : 'No chargers linked to this customer yet. Add the first one below.', devices.length ? '' : 'empty');
      drawDevices();
    }, function () { say($('dv-msg'), 'We could not load the chargers. Check your connection and try again.', 'error', loadDevices); });
  }
  var confirmHome = $('dv-confirm').parentNode;
  function parkConfirm() { if ($('dv-list').contains($('dv-confirm'))) confirmHome.insertBefore($('dv-confirm'), $('dv-form')); }
  function drawDevices() {
    parkConfirm();
    var ul = $('dv-list'); ul.textContent = '';
    devices.forEach(function (d) {
      var li = el('li', 'post-item');
      var info = el('div', 'post-pick');
      info.appendChild(el('span', 'post-title', d.name));
      var meta = el('span', 'post-meta');
      meta.appendChild(el('span', 'tag', STATUS[d.status] || 'Unknown'));
      if (d.is_demo) meta.appendChild(el('span', 'tag tag-src', 'Demo data'));
      meta.appendChild(el('span', '', (d.location_label || 'No location label') + (d.installed_on ? ', installed ' + fmtDate(d.installed_on + 'T00:00:00') : '')));
      info.appendChild(meta); li.appendChild(info);
      var row = el('div', 'btn-row post-actions');
      var be = el('button', 'btn btn-secondary btn-small', 'Edit'); be.type = 'button'; be.setAttribute('aria-label', 'Edit charger: ' + d.name);
      be.addEventListener('click', function () { startEdit(d); $('dv-name').focus(); });
      var br = el('button', 'btn btn-danger btn-small', 'Remove'); br.type = 'button'; br.setAttribute('aria-label', 'Remove charger: ' + d.name);
      br.addEventListener('click', function () { askRemove(d, br); });
      row.appendChild(be); row.appendChild(br); li.appendChild(row); ul.appendChild(li); li.setAttribute('data-id', d.id);
    });
  }

  // Result message at the top of the chargers panel (live region), so it is seen next to the list that changed.
  var resultTimer = null;
  function result(text) { say($('dv-result'), text, 'ok'); clearTimeout(resultTimer); resultTimer = setTimeout(function () { say($('dv-result'), ''); }, 6000); }

  // ---- add / edit form (allow-listed fields only) ----
  function resetForm() {
    editing = null; $('dv-form').reset(); $('dvf-h').textContent = 'Add a charger'; $('dv-save').textContent = 'Add charger';
    $('dv-cancel-edit').hidden = true; say($('dvf-msg'), '');
    ['dv-name', 'dv-loc', 'dv-date'].forEach(function (id) { fieldError($(id), ''); });
  }
  function startEdit(d) {
    resetForm(); editing = d;
    $('dvf-h').textContent = 'Edit charger'; $('dv-save').textContent = 'Save changes'; $('dv-cancel-edit').hidden = false;
    $('dv-name').value = d.name; $('dv-loc').value = d.location_label || ''; $('dv-date').value = d.installed_on || ''; $('dv-status').value = d.status;
  }
  $('dv-cancel-edit').addEventListener('click', resetForm);
  function readForm() {
    var ok = true, first = null;
    function bad(id, text) { fieldError($(id), text); ok = false; if (!first) first = $(id); }
    var name = $('dv-name').value.trim(), loc = $('dv-loc').value.trim(), date = $('dv-date').value, status = $('dv-status').value;
    if (!name) bad('dv-name', 'Enter a name for the charger.'); else if (name.length > 80) bad('dv-name', 'Make the name shorter.'); else fieldError($('dv-name'), '');
    if (loc.length > 80) bad('dv-loc', 'Make the location label shorter.'); else fieldError($('dv-loc'), '');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('dv-date', 'Enter a valid date.'); else fieldError($('dv-date'), '');
    if (!STATUS[status]) { ok = false; }
    if (!ok) { if (first) first.focus(); return null; }
    // Named fields only. No id, owner_id (added on insert only), is_demo or created_at ever come from the form.
    return { name: name, location_label: loc || null, installed_on: date || null, status: status };
  }
  $('dv-form').addEventListener('submit', function (e) {
    e.preventDefault(); say($('dvf-msg'), '');
    if (!chosen) return;
    var f = readForm(); if (!f) return;
    var owner = chosen.id; $('dv-save').disabled = true;
    var q = editing
      ? P.client.from('devices').update({ name: f.name, location_label: f.location_label, installed_on: f.installed_on, status: f.status }).eq('id', editing.id).eq('owner_id', owner).select('id')
      : P.client.from('devices').insert({ owner_id: owner, name: f.name, location_label: f.location_label, installed_on: f.installed_on, status: f.status }).select('id');
    q.then(function (r) {
      $('dv-save').disabled = false;
      if (r.error) { say($('dvf-msg'), /row-level|permission|42501/i.test((r.error.code || '') + (r.error.message || '')) ? G.denied : G.failed, 'error'); return; }
      if (!Array.isArray(r.data) || r.data.length !== 1) { say($('dvf-msg'), 'The charger was not saved. It may have been removed already.', 'error'); return; }
      var was = editing ? 'Changes saved.' : 'Charger added.'; resetForm(); result(was); loadDevices();
    }, function () { $('dv-save').disabled = false; say($('dvf-msg'), G.network, 'error'); });
  });

  // ---- remove with confirm; set inactive when the charger has report history ----
  function closeAct(refocus) {
    $('dv-confirm').hidden = true; act = null;
    if (refocus && actOpener && document.body.contains(actOpener)) actOpener.focus();
    actOpener = null;
  }
  function open(kind, d, opener, q, note, yes) {
    act = { kind: kind, device: d }; actOpener = opener;
    $('dv-q').textContent = q; $('dv-note').textContent = note; $('dv-yes').textContent = yes;
    var row = opener && opener.closest ? opener.closest('li') : null;
    if (row) row.appendChild($('dv-confirm'));  // the question sits directly under the row it is about
    $('dv-confirm').hidden = false; $('dv-no').focus();
  }
  function askRemove(d, opener) {
    open('remove', d, opener, 'Remove charger "' + d.name + '" from ' + (chosen.email || 'this customer') + '?', 'This cannot be undone. A charger with report history cannot be removed.', 'Remove charger');
  }
  $('dv-no').addEventListener('click', function () { closeAct(true); });
  $('dv-confirm').addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeAct(true); } });
  $('dv-yes').addEventListener('click', function () {
    var a = act; if (!a || !chosen) return;
    var d = a.device, owner = chosen.id; $('dv-yes').disabled = true;
    var q = a.kind === 'remove'
      ? P.client.from('devices').delete().eq('id', d.id).eq('owner_id', owner).select('id')
      : P.client.from('devices').update({ status: 'inactive' }).eq('id', d.id).eq('owner_id', owner).select('id');
    q.then(function (r) {
      $('dv-yes').disabled = false;
      var n = !r.error && Array.isArray(r.data) ? r.data.length : -1;
      if (a.kind === 'remove' && n === 0) {
        // Not removed: the charger has report history (or you may not delete it). Offer inactive, confirmed again. No silent retry.
        closeAct(false);
        say($('dv-msg'), 'This charger has report history, so it cannot be removed. You can set it to inactive instead.', 'warn');
        var b = el('button', 'btn btn-secondary btn-small', 'Set to inactive'); b.type = 'button';
        b.addEventListener('click', function () { open('inactive', d, b, 'Set charger "' + d.name + '" to inactive?', 'It stays on the customer\'s account with its history. Status is only a label.', 'Set to inactive'); });
        $('dv-msg').appendChild(document.createTextNode(' ')); $('dv-msg').appendChild(b);
        return;
      }
      if (n !== 1) { closeAct(false); say($('dv-msg'), r.error && /row-level|permission|42501/i.test((r.error.code || '') + (r.error.message || '')) ? G.denied : G.failed, 'error'); return; }
      closeAct(false); if (editing && editing.id === d.id) resetForm();
      loadDevices(); result(a.kind === 'remove' ? 'Charger removed.' : 'Charger set to inactive.');
    }, function () { $('dv-yes').disabled = false; closeAct(false); say($('dv-msg'), G.network, 'error'); });
  });

  $('signout').addEventListener('click', function () { P.signOut().then(function () { window.location.replace('login.html'); }); });

  // Role check first; no customer or device request is made unless the role is admin.
  P.getSession().then(function (s) {
    if (!s) { window.location.replace('login.html'); return; }
    P.getRole(s).then(function (role) {
      $('who').textContent = 'Signed in as ' + (s.user.email || 'your account') + '.'; $('portal-bar').hidden = false;
      if (role !== 'admin') { say($('ad-msg'), ''); $('denied').hidden = false; return; }
      say($('ad-msg'), ''); $('admin-main').hidden = false; loadCustomers();
    });
  });
  P.client.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') window.location.replace('login.html'); });
})();
