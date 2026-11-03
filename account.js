/* account.html: signed-in customer. Own devices, 14-day report table, one bar chart, per-day power path.
   All data comes through Row Level Security. Everything is written with textContent; no innerHTML. */
(function () {
  'use strict';
  var P = window.Portal;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var STATUS = { active: 'Active', inactive: 'Inactive', fault: 'Needs attention', unknown: 'Unknown' };
  var msg = $('acct-msg');

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function say(node, text, kind, retry) {
    node.textContent = text || '';
    node.hidden = !text;
    node.className = 'notice' + (kind ? ' notice-' + kind : '');
    if (retry && text) {
      node.appendChild(document.createTextNode(' '));
      var b = el('button', 'link-btn', 'Try again');
      b.type = 'button'; b.addEventListener('click', retry); node.appendChild(b);
    }
  }
  // 'YYYY-MM-DD' to a local Date (no time zone shift).
  function day(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDay(s) { return day(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function fmtShort(s) { return day(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
  function fmtTime(t) { return t ? new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '–'; }
  function fmtDate(s) { return day(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function num(v, d) { return v == null ? '–' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }

  if (!P || !P.ready) { say(msg, 'The portal is not available right now. Try again later.', 'warn'); return; }

  var csvDays = [], devices = [], reports = [], selDate = null, demoAny = false, uid = null;  // uid comes from the verified session only

  function setDemo(on) { $('demo-banner').hidden = !on; demoAny = on; }

  function loadDevices() {
    say(msg, 'Loading your devices…');
    $('devices-sec').hidden = true; $('report-sec').hidden = true;
    P.client.from('devices').select('id,name,location_label,installed_on,status,is_demo').eq('owner_id', uid).order('name').then(function (r) {
      if (r.error) { say(msg, 'We could not load your devices. Check your connection and try again.', 'error', loadDevices); return; }
      devices = r.data || [];
      if (!devices.length) { say(msg, 'No devices yet. When a charger is linked to your account, it will appear here.', 'empty'); return; }
      say(msg, '');
      setDemo(devices.some(function (d) { return d.is_demo; }));
      drawDevices();
      var pick = $('dev-pick'); pick.textContent = '';
      devices.forEach(function (d) { var o = el('option', '', d.name); o.value = d.id; pick.appendChild(o); });
      $('devices-sec').hidden = false; $('report-sec').hidden = false;
      loadReports(devices[0].id);
    }, function () { say(msg, 'We could not load your devices. Check your connection and try again.', 'error', loadDevices); });
  }

  function drawDevices() {
    var ul = $('dev-list'); ul.textContent = '';
    devices.forEach(function (d) {
      var li = el('li', 'dev card');
      li.appendChild(el('h3', '', d.name));
      var dl = el('dl', 'dev-meta');
      [['Location', d.location_label || 'Not set'], ['Installed', d.installed_on ? fmtDate(d.installed_on) : 'Not set']].forEach(function (p) {
        var row = el('div'); row.appendChild(el('dt', '', p[0])); row.appendChild(el('dd', '', p[1])); dl.appendChild(row);
      });
      var st = el('div'); st.appendChild(el('dt', '', 'Status'));
      var dd = el('dd'); dd.appendChild(el('span', 'dot dot-' + (STATUS[d.status] ? d.status : 'unknown')));
      dd.appendChild(document.createTextNode(STATUS[d.status] || 'Unknown')); st.appendChild(dd); dl.appendChild(st);
      li.appendChild(dl);
      if (d.is_demo) li.appendChild(el('p', 'tag-demo', 'Demo data'));
      ul.appendChild(li);
    });
  }

  function loadReports(deviceId) {
    // Only devices from the owner-filtered list may be queried (an admin can read every device, so never trust the picker value).
    if (!devices.some(function (d) { return d.id === deviceId; })) { say($('rep-msg'), 'That charger is not on your account.', 'error'); return; }
    var end = new Date(), start = new Date(); start.setDate(end.getDate() - 13);
    say($('rep-msg'), 'Loading the report…');
    $('chart-fig').hidden = true; $('table-wrap').hidden = true; $('path-sec').hidden = true; $('csv-row').hidden = true;
    P.client.from('daily_reports')
      .select('report_date,energy_delivered_kwh,peak_power_kw,avg_power_kw,session_start,session_end,power_path,is_demo')
      .eq('device_id', deviceId).gte('report_date', iso(start)).lte('report_date', iso(end)).order('report_date', { ascending: true })
      .then(function (r) {
        if (r.error) { say($('rep-msg'), 'We could not load the report. Check your connection and try again.', 'error', function () { loadReports(deviceId); }); return; }
        reports = r.data || [];
        if (reports.some(function (x) { return x.is_demo; })) setDemo(true);
        else setDemo(devices.some(function (d) { return d.is_demo; }));
        draw(start);
      }, function () { say($('rep-msg'), 'We could not load the report. Check your connection and try again.', 'error', function () { loadReports(deviceId); }); });
  }

  function draw(start) {
    var days = [], map = {};
    reports.forEach(function (x) { map[x.report_date] = x; });
    for (var i = 0; i < 14; i++) { var d = new Date(start); d.setDate(start.getDate() + i); days.push(iso(d)); }
    if (!reports.length) { say($('rep-msg'), 'No reports yet for this device in the last two weeks.', 'empty'); return; }
    say($('rep-msg'), '');
    var last = reports[reports.length - 1].report_date;
    $('chart-fig').hidden = false; $('table-wrap').hidden = false;  // visible first, so the chart can measure its width
    drawTable(days, map);
    selDate = selDate && map[selDate] ? selDate : last;
    drawChart(days, map); select(selDate, days, map); hintScroll();
    $('csv-row').hidden = false; csvDays = days;
  }

  function drawTable(days, map) {
    var body = $('rep-body'); body.textContent = '';
    days.slice().reverse().forEach(function (s) {
      var x = map[s], tr = el('tr'); tr.setAttribute('data-date', s);
      var th = el('th'); th.scope = 'row';
      if (x) {
        var b = el('button', 'link-btn', fmtDay(s)); b.type = 'button';
        b.addEventListener('click', function () { select(s, days, map); });
        th.appendChild(b);
      } else th.textContent = fmtDay(s);
      tr.appendChild(th);
      if (x) {
        [num(x.energy_delivered_kwh, 1), num(x.peak_power_kw, 1), num(x.avg_power_kw, 1)].forEach(function (v) { tr.appendChild(el('td', 'num', v)); });
        tr.appendChild(el('td', '', fmtTime(x.session_start))); tr.appendChild(el('td', '', fmtTime(x.session_end)));
      } else {
        var td = el('td', 'muted', 'No session'); td.colSpan = 5; tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  }

  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; var st = [1, 1.2, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10].filter(function (k) { return k >= f - 1e-9; })[0]; return st * p; }

  // Bar chart drawn at its real pixel width (viewBox = width), so axis text stays 11 px at every size.
  // Single series, so no legend box; the caption names it. Bars max 24 px, 4 px rounded tip, square at the baseline.
  var chartState = null;
  function drawChart(days, map) {
    chartState = { days: days, map: map };
    var host = $('chart-host'); host.textContent = '';
    var W = Math.max(260, Math.round(host.clientWidth || 320)), narrow = W < 480, H = narrow ? 210 : 240;
    var L = 38, R = 4, T = 22, B = 26, iw = W - L - R, ih = H - T - B;
    var max = niceMax(Math.max.apply(null, reports.map(function (x) { return +x.energy_delivered_kwh; })));
    var s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', focusable: 'false', 'aria-labelledby': 'chart-title' });
    var t = svg('title', { id: 'chart-title' }); t.textContent = 'Bar chart of daily energy delivered in kilowatt-hours for the last two weeks. The table below has the same values.'; s.appendChild(t);
    var g = svg('g', { 'class': 'ch-axis' });
    [0, .5, 1].forEach(function (f) {
      var y = T + ih - f * ih;
      g.appendChild(svg('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': f === 0 ? 'ch-base' : 'ch-grid' }));
      var tx = svg('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }); tx.textContent = (max * f).toLocaleString(undefined, { maximumFractionDigits: 1 }); g.appendChild(tx);
    });
    s.appendChild(g);
    var slot = iw / days.length, bw = Math.min(24, slot * .64), tip = $('chart-tip');
    function showTip(ev, text) {
      tip.textContent = text; tip.hidden = false;
      var r = host.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      tip.style.left = Math.max(4, Math.min(r.width - tip.offsetWidth - 4, x - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
    }
    days.forEach(function (d, i) {
      var x = map[d], cx = L + i * slot + slot / 2, label;
      if (x) {
        var h = Math.max(4, (+x.energy_delivered_kwh / max) * ih), x0 = cx - bw / 2, y0 = T + ih - h, rr = Math.min(4, h, bw / 2);
        var path = 'M' + x0 + ' ' + (T + ih) + 'V' + (y0 + rr) + 'Q' + x0 + ' ' + y0 + ' ' + (x0 + rr) + ' ' + y0 + 'H' + (x0 + bw - rr) + 'Q' + (x0 + bw) + ' ' + y0 + ' ' + (x0 + bw) + ' ' + (y0 + rr) + 'V' + (T + ih) + 'Z';
        s.appendChild(svg('path', { d: path, 'class': 'ch-bar', 'data-date': d }));
        label = fmtDay(d) + ': ' + num(x.energy_delivered_kwh, 1) + ' kWh';
      } else {
        // No-session day: a short muted cap on the baseline, so the gap reads as an empty day, not a missing bar.
        s.appendChild(svg('rect', { x: cx - 6, y: T + ih - 4, width: 12, height: 4, rx: 2, 'class': 'ch-none' }));
        label = fmtDay(d) + ': No session';
      }
      var hit = svg('rect', { x: cx - slot / 2, y: T, width: slot, height: ih + B, 'class': 'ch-hit', 'data-date': d });
      hit.addEventListener('mousemove', function (ev) { showTip(ev, label); });
      hit.addEventListener('mouseleave', function () { tip.hidden = true; });
      if (x) hit.addEventListener('click', function () { select(d, days, map); });
      s.appendChild(hit);
      if (!narrow || i % 2 === 1) {
        var lb = svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'class': 'ch-x' }); lb.textContent = day(d).getDate(); s.appendChild(lb);
      }
    });
    host.appendChild(s);
    $('chart-yt').textContent = 'Energy delivered (kWh)';
    $('chart-xt').textContent = 'Day of the month, ' + fmtShort(days[0]) + ' to ' + fmtShort(days[days.length - 1]);
    $('chart-cap').textContent = demoAny ? 'Demo data — illustrative values, not measured by a charger.' : '';
    $('chart-cap').hidden = !demoAny;
    markSel();
  }
  function markSel() {
    document.querySelectorAll('.ch-bar').forEach(function (b) { b.classList.toggle('is-sel', b.getAttribute('data-date') === selDate); });
    var old = document.querySelector('.ch-val'); if (old) old.remove();
    var bar = document.querySelector('.ch-bar.is-sel');
    if (bar && chartState) {
      var bb = bar.getBBox(), x = chartState.map[selDate], sv = bar.ownerSVGElement;
      var tx = svg('text', { x: bb.x + bb.width / 2, y: bb.y - 6, 'text-anchor': 'middle', 'class': 'ch-val' });
      tx.textContent = num(x.energy_delivered_kwh, 1); sv.appendChild(tx);
    }
  }

  function select(date, days, map) {
    selDate = date;
    if (chartState) markSel();
    document.querySelectorAll('#rep-body tr').forEach(function (tr) {
      var on = tr.getAttribute('data-date') === date; tr.classList.toggle('is-sel', on);
      var bt = tr.querySelector('button'); if (bt) { if (on) bt.setAttribute('aria-current', 'true'); else bt.removeAttribute('aria-current'); }
    });
    var x = map[date], list = $('path-list'); list.textContent = '';
    $('path-h').textContent = 'Power path on ' + fmtDay(date);
    var stages = x && Array.isArray(x.power_path) ? x.power_path : [];
    if (!stages.length) { $('path-sec').hidden = true; return; }
    stages.forEach(function (st) {
      var li = el('li', 'path3-step');
      li.appendChild(el('span', 'path3-label', String(st.label || st.stage || '')));
      var kw = st.kw;
      if (kw == null) li.appendChild(el('span', 'path3-kw is-null', x.is_demo ? 'Not shown in demo' : 'Not available'));
      else li.appendChild(el('span', 'path3-kw', num(kw, 1) + ' kW'));
      list.appendChild(li);
    });
    $('path-note').textContent = 'Each value is the highest power seen at that step on this day.';
    $('path-sec').hidden = false;
  }

  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (chartState && !$('chart-fig').hidden) { drawChart(chartState.days, chartState.map); hintScroll(); } }, 150); });
  function hintScroll() { var w = $('table-wrap'); w.classList.toggle('can-scroll', w.scrollWidth > w.clientWidth + 2); }
  $('table-wrap').addEventListener('scroll', function () { this.classList.toggle('at-end', this.scrollLeft + this.clientWidth >= this.scrollWidth - 2); }, { passive: true });
  // CSV: built from the rows already on screen (no new query). Fixed column order; cells are escaped in csv.js.
  var CSV_COLS = ['device_name', 'report_date', 'energy_delivered_kwh', 'peak_power_kw', 'avg_power_kw', 'session_start', 'session_end', 'demo'];
  $('csv-btn').addEventListener('click', function () {
    if (!reports.length || !window.CsvExport) return;
    var dev = devices.filter(function (d) { return d.id === $('dev-pick').value; })[0];
    if (!dev) return;
    var rows = reports.map(function (x) {
      return { device_name: dev.name, report_date: x.report_date, energy_delivered_kwh: x.energy_delivered_kwh, peak_power_kw: x.peak_power_kw,
               avg_power_kw: x.avg_power_kw, session_start: x.session_start, session_end: x.session_end, demo: x.is_demo ? 'yes' : 'no' };
    });
    var text = window.CsvExport.toCsv(rows, CSV_COLS);
    var name = 'daily-report-' + window.CsvExport.slug(dev.name) + '-' + csvDays[0] + '-' + csvDays[csvDays.length - 1] + '.csv';
    var url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  $('dev-pick').addEventListener('change', function () { selDate = null; loadReports(this.value); });

  $('signout').addEventListener('click', function () { P.signOut().then(function () { window.location.replace('login.html'); }); });

  P.getSession().then(function (s) {
    if (!s) { window.location.replace('login.html'); return; }
    uid = s.user.id;
    P.getRole(s).then(function (role) {
      $('who').textContent = 'Signed in as ' + (s.user.email || 'your account') + '.';
      $('portal-bar').hidden = false;
      if (role === 'disabled') { say(msg, 'Your account is disabled. Contact the site admin.', 'warn'); return; }  // no further requests
      if (role === 'admin') $('admin-link').hidden = false;
      loadDevices();
    });
  });
  P.client.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') window.location.replace('login.html'); });
})();
