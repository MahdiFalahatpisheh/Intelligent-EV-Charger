/* Progressive enhancement for the CSS-only menu. The menu works without this file. */
(function () {
  var t = document.getElementById('nav-toggle');
  if (!t) return;
  t.setAttribute('role', 'button');
  function sync() { t.setAttribute('aria-expanded', t.checked ? 'true' : 'false'); }
  t.addEventListener('change', sync);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && t.checked) { t.checked = false; sync(); t.focus(); }
  });
  sync();
})();

/* Theme toggle, scroll reveal, capacity demo. All optional enhancements. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { threshold: 0.1 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Theme
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  var b = document.getElementById('theme-toggle');
  if (b) {
    var isDark = function () {
      var t = root.getAttribute('data-theme');
      return t ? t === 'dark' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    };
    // Tooltip text (data-tip, shown by CSS) = the current action label; no title attribute, so only one tooltip appears.
    var tip = function () {
      var l = isDark() ? 'Light mode' : 'Dark mode';
      b.setAttribute('data-tip', l);
    };
    b.hidden = false;
    tip();
    b.addEventListener('click', function () {
      var n = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', n);
      try { localStorage.setItem('theme', n); } catch (e) {}
      tip();
    });
  }

  // Motion pause (WCAG 2.2.2): one button pauses every looping scene on the page via html.is-paused.
  // Off-screen hero pause stays separate. 
  var scene = document.querySelector('[data-hero-scene]');
  var mts = [].slice.call(document.querySelectorAll('[data-motion-toggle]'));
  var heroOff = false;
  var heroSync = function () { if (scene) scene.classList.toggle('is-paused', heroOff); };
  mts.forEach(function (mt) {
    if (reduce) { mt.parentNode.removeChild(mt); return; }  // nothing loops under reduced motion
    mt.addEventListener('click', function () { root.classList.toggle('is-paused'); });
  });
  // aria-pressed mirrors html.is-paused on every toggle (true = paused); the visible Pause/Play labels are swapped by CSS from the same class.
  var mtSync = function () {
    var p = root.classList.contains('is-paused') ? 'true' : 'false';
    mts.forEach(function (mt) { mt.setAttribute('aria-pressed', p); });
  };
  mtSync();
  if ('MutationObserver' in window) new MutationObserver(mtSync).observe(root, { attributes: true, attributeFilter: ['class'] });
  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.target === scene) { heroOff = !e.isIntersecting; heroSync(); }
        else e.target.classList.toggle('is-paused', !e.isIntersecting);
      });
    });
    [].forEach.call(document.querySelectorAll('[data-hero-scene],[data-demo-scene],.cutnet-fig,.cutaway-stage'), function (el) { vio.observe(el); });
  }

  // Scroll story: sets --p (0..1) on [data-story] while motion is allowed; without JS or with motion off it stays a static sequence.
  var story = document.querySelector('[data-story]');
  if (story && !reduce) {
    var s3 = story.closest('.story3') || story.parentNode;
    var hdrEl = document.querySelector('.site-header');
    var stage = story.querySelector('.story3-stage');
    var sTick = false, lastP = -1;
    var sMeasure = function () {
      if (s3 && hdrEl) s3.style.setProperty('--hdr', hdrEl.offsetHeight + 'px');
    };
    var sUpdate = function () {
      sTick = false;
      if (root.classList.contains('is-paused')) return;
      sMeasure();
      var r = story.getBoundingClientRect();
      var h = stage ? stage.offsetHeight : window.innerHeight;
      var hd = hdrEl ? hdrEl.offsetHeight : 0;
      var span = r.height - h;
      var p = span > 0 ? (hd - r.top) / span : 0;
      p = Math.max(0, Math.min(1, p));
      if (p !== lastP) { lastP = p; story.style.setProperty('--p', p.toFixed(4)); }
    };
    var sReq = function () { if (!sTick) { sTick = true; requestAnimationFrame(sUpdate); } };
    var sSync = function () {
      var live = !root.classList.contains('is-paused');
      story.classList.toggle('is-live', live);
      if (live) { lastP = -1; sMeasure(); sReq(); }
    };
    window.addEventListener('scroll', sReq, { passive: true });
    window.addEventListener('resize', function () { sMeasure(); sReq(); }, { passive: true });
    if ('MutationObserver' in window) new MutationObserver(sSync).observe(root, { attributes: true, attributeFilter: ['class'] });
    sSync();
  }

  // 3D scenes (W-3D-6): per-scene --fp 0..1 from scroll position (all browsers), pause off-screen, optional pointer tilt.
  // Without JS, or with reduced motion, nothing is set here: --fp stays 1 (assembled). Inline --fp overrides the CSS scroll timeline.
  var sc3 = [].slice.call(document.querySelectorAll('.scene3d'));
  if (sc3.length && !reduce) {
    var vis = [], fpTick = false;
    var fpOf = function (el) {
      var r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
      // 0 as the top edge enters the lower part of the screen, 1 once the scene is about 55% up (mirrors the CSS range)
      var a = vh * 0.9, b = vh * 0.45;
      return Math.max(0, Math.min(1, (a - r.top) / (a - b)));
    };
    var fpUpdate = function () {
      fpTick = false;
      vis.forEach(function (el) {
        var v = fpOf(el).toFixed(3);
        if (el._fp !== v) { el._fp = v; el.style.setProperty('--fp', v); }
      });
    };
    var fpReq = function () { if (!fpTick) { fpTick = true; requestAnimationFrame(fpUpdate); } };
    if ('IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var el = e.target, i = vis.indexOf(el);
          el.classList.toggle('is-paused', !e.isIntersecting);
          if (e.isIntersecting && i < 0) vis.push(el);
          if (!e.isIntersecting && i > -1) vis.splice(i, 1);
        });
        fpReq();
      }, { rootMargin: '10% 0px 10% 0px' });
      sc3.forEach(function (el) { el.style.setProperty('--fp', fpOf(el).toFixed(3)); sio.observe(el); });
      window.addEventListener('scroll', fpReq, { passive: true });
      window.addEventListener('resize', fpReq, { passive: true });
    }

    // Single pointer tilt, fine pointers with hover only, max 4deg, applied with the individual `rotate` property so the CSS transform is untouched.
    if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var MAX = 4 / Math.SQRT2, tRig = null, tx = 0, ty = 0, tCur = [0, 0], tRaf = 0;
      var tApply = function () {
        tRaf = 0;
        if (!tRig) return;
        tCur[0] += (tx - tCur[0]) * 0.18; tCur[1] += (ty - tCur[1]) * 0.18;
        var m = Math.sqrt(tCur[0] * tCur[0] + tCur[1] * tCur[1]);
        tRig.style.rotate = m < 0.01 ? '' : tCur[1].toFixed(3) + ' ' + (-tCur[0]).toFixed(3) + ' 0 ' + m.toFixed(3) + 'deg';
        // axis vector (dy, -dx) scaled by degrees; magnitude doubles as the angle
        if (Math.abs(tx - tCur[0]) + Math.abs(ty - tCur[1]) > 0.01) tRaf = requestAnimationFrame(tApply);
        else if (!tx && !ty) { tRig.style.rotate = ''; tRig = null; }
      };
      document.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || root.classList.contains('is-paused')) return;
        var st = e.target.closest && e.target.closest('.s3-stage');
        if (st && !st.parentNode.classList.contains('is-paused')) {
          var rig = st.querySelector('.s3-rig');
          if (!rig) return;
          if (tRig && tRig !== rig) { tRig.style.rotate = ''; tCur = [0, 0]; }
          tRig = rig;
          var r = st.getBoundingClientRect();
          tx = ((e.clientX - r.left) / r.width - 0.5) * 2 * MAX;
          ty = ((e.clientY - r.top) / r.height - 0.5) * 2 * MAX;
        } else { tx = 0; ty = 0; }
        if (tRig && !tRaf) tRaf = requestAnimationFrame(tApply);
      }, { passive: true });
      document.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (tRig && !tRaf) tRaf = requestAnimationFrame(tApply); });
    }
  }

  // Live garage hero (W-P-LG): cars arrive, charge (badge counts up to 100), hold full, leave. Illustration only, numbers are not data.
  // Virtual clock advances only while running, so html.is-paused, off-screen (.is-paused from the scene observer) and hidden tabs freeze it.
  // Reduced motion / no JS: the static markup is left untouched.
  (function () {
  var lg = document.querySelector('[data-live-garage]');
  if (lg && !reduce) {
    var bays = [].slice.call(lg.querySelectorAll('.car3[data-bay]')).map(function (car, i) {
      var n = car.querySelector('.soc-n');
      if (n) n.setAttribute('aria-hidden', 'true');
      var b = { car: car, n: n, ended: false, row: i < 3 ? 0 : 1, ph: 'empty', t0: 0, until: 0, s0: 0, dur: 1, shown: -1 };
      // switch state when the slide really ends; the timeout below (CSS duration + 200 ms) is only a fallback
      car.addEventListener('animationend', function (e) { if (e.target === car && /^s3-(arrive|leave)$/.test(e.animationName)) b.ended = true; });
      return b;
    });
    var CLS = ['is-arriving', 'is-charging', 'is-full', 'is-leaving'];
    var T_ARRIVE = 2400, T_LEAVE = 2200, T_HOLD = 1500;  // match the CSS animation lengths
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var ease = function (x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
    var clock = 0, prev = 0, running = false;
    var setPh = function (b, ph) {
      b.ph = ph; b.t0 = clock; b.ended = false;
      CLS.forEach(function (c) { b.car.classList.remove(c); });
      if (ph !== 'empty') b.car.classList.add('is-' + { arriving: 'arriving', charging: 'charging', full: 'full', leaving: 'leaving' }[ph]);
    };
    var show = function (b, s) {
      b.car.style.setProperty('--soc', s.toFixed(3));
      var v = s >= 1 ? 100 : Math.min(99, Math.floor(s * 100));  // 100 only together with is-full
      if (b.n && v !== b.shown) { b.shown = v; b.n.textContent = v; }
    };
    var present = function () { return bays.filter(function (b) { return b.ph !== 'empty' && b.ph !== 'leaving'; }).length; };
    bays.forEach(function (b) {
      // adopt the static markup: charging bays get a start value, the full bay holds
      if (b.car.classList.contains('is-charging')) {
        var cur = parseFloat(b.car.style.getPropertyValue('--soc')) || .4;
        b.ph = 'charging'; b.s0 = cur; b.dur = rnd(6000, 12000) * (1 - cur) + 1500; show(b, cur);
      } else if (b.car.classList.contains('is-full')) { b.ph = 'full'; b.until = rnd(800, 2500); show(b, 1); }
      else { b.until = rnd(1000, 3000); }
    });
    var step = function (b) {
      var el = clock - b.t0;
      if (b.ph === 'empty') {
        if (el < b.until) return;
        var rowBusy = bays.some(function (o) { return o !== b && o.row === b.row && o.ph === 'arriving'; });
        if (present() >= 5 || rowBusy) { b.t0 = clock - b.until + 400; return; }
        b.s0 = rnd(.1, .6); show(b, b.s0); setPh(b, 'arriving');
      } else if (b.ph === 'arriving') {
        if (b.ended || el >= T_ARRIVE + 200) { b.dur = rnd(6000, 12000) * (1 - b.s0) / .9 + 800; setPh(b, 'charging'); }
      } else if (b.ph === 'charging') {
        var x = Math.min(1, el / b.dur);
        show(b, b.s0 + (1 - b.s0) * ease(x));
        if (x >= 1) { show(b, 1); b.until = T_HOLD; setPh(b, 'full'); }
      } else if (b.ph === 'full') {
        if (el >= Math.max(b.until, T_HOLD) && present() > 3) setPh(b, 'leaving');
      } else if (b.ph === 'leaving') {
        if (b.ended || el >= T_LEAVE + 200) { setPh(b, 'empty'); b.until = rnd(1000, 4000); b.shown = -1; if (b.n) b.n.textContent = ''; b.car.style.setProperty('--soc', 0); }
      }
    };
    var frame = function (now) {
      var go = !root.classList.contains('is-paused') && !lg.classList.contains('is-paused') && !document.hidden;
      if (go) { clock += Math.min(100, prev ? now - prev : 0); bays.forEach(step); }
      prev = go ? now : 0;
      requestAnimationFrame(frame);
    };
    // adopt initial numbers once, then run
    bays.forEach(function (b) { if (b.ph === 'full') show(b, 1); });
    requestAnimationFrame(frame);
  }
  })();

  // Live chart: sweep across the evening, loop gently; paused off-screen or by html.is-paused; static under reduced motion.
  var ch = document.querySelector('[data-chart="demand"]');
  var chSvg = ch && ch.querySelector('svg.chart-svg');
  var unc = ch && ch.querySelector('[data-series="uncontrolled"]');
  var ctl = ch && ch.querySelector('[data-series="controlled"]');
  var ph = ch && ch.querySelector('[data-playhead]');
  var ov = ch && ch.querySelector('[data-region="over"]');
  if (chSvg && unc && ctl && ph && ov && !reduce && unc.getTotalLength) {
    var NS = 'http://www.w3.org/2000/svg', X0 = 56, X1 = 544;
    var defs = chSvg.querySelector('defs');
    var mk = function (id, h) {
      var cp = document.createElementNS(NS, 'clipPath'), rc = document.createElementNS(NS, 'rect');
      cp.setAttribute('id', id);
      rc.setAttribute('x', 0); rc.setAttribute('y', 0); rc.setAttribute('width', 0); rc.setAttribute('height', h);
      cp.appendChild(rc); defs.appendChild(cp); return rc;
    };
    var rAll = mk('sweep-all', 300), rOver = mk('sweep-over', 100);
    var ovLab = ch.querySelector('.over-lab');
    // sample the uncontrolled curve so the playhead can ride it (x is monotonic)
    var tot = unc.getTotalLength(), pts = [], i;
    for (i = 0; i <= 200; i++) pts.push(unc.getPointAtLength(tot * i / 200));
    var yAt = function (x) {
      for (var k = 1; k < pts.length; k++) if (pts[k].x >= x) {
        var a = pts[k - 1], b = pts[k], d = b.x - a.x;
        return d ? a.y + (b.y - a.y) * (x - a.x) / d : b.y;
      }
      return pts[pts.length - 1].y;
    };
    var T_SWEEP = 6500, T_HOLD = 1800, T_FADE = 500, T = T_SWEEP + T_HOLD + T_FADE;
    var ease = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    unc.setAttribute('clip-path', 'url(#sweep-all)');
    ctl.setAttribute('clip-path', 'url(#sweep-all)');
    ov.setAttribute('clip-path', 'url(#sweep-over)');
    var draw = function (frac, fade) {
      var x = X0 + (X1 - X0) * frac;
      rAll.setAttribute('width', x + 6); rOver.setAttribute('width', x);
      ph.setAttribute('cx', x.toFixed(1)); ph.setAttribute('cy', yAt(x).toFixed(1));
      ph.style.opacity = fade;
      if (ovLab) ovLab.style.opacity = x > 250 ? Math.min(1, (x - 250) / 40) * fade : 0;
    };
    var cOn = false, cRun = false, elapsed = 0, last = 0;
    var frame = function (now) {
      cRun = cOn && !root.classList.contains('is-paused');
      if (!cRun) { last = 0; return; }
      if (last) elapsed = (elapsed + now - last) % T;
      last = now;
      var f = 1;
      if (elapsed < T_SWEEP) { draw(ease(elapsed / T_SWEEP), 1); }
      else if (elapsed < T_SWEEP + T_HOLD) { draw(1, 1); }
      else { f = 1 - (elapsed - T_SWEEP - T_HOLD) / T_FADE; draw(1, f); }
      requestAnimationFrame(frame);
    };
    var kick = function () { if (cOn && !cRun && !root.classList.contains('is-paused')) { cRun = true; last = 0; requestAnimationFrame(frame); } };
    draw(0, 1);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { cOn = es[0].isIntersecting; kick(); }, { threshold: 0.25 }).observe(ch);
    } else { draw(1, 1); }
    if ('MutationObserver' in window) new MutationObserver(kick).observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  // Demo (relative units only, never shown)
  var demo = document.querySelector('.demo');
  if (demo) {
    var cap = demo.querySelector('#demo-cap'), sum = demo.querySelector('#demo-sum');
    var cars = [].slice.call(demo.querySelectorAll('.demo-car'));
    var meter = demo.querySelector('[data-demo-meter]');
    var track = demo.querySelector('.demo-meter-track');
    var scn = document.querySelector('[data-demo-scene]');
    var minis = scn ? [].slice.call(scn.querySelectorAll('.mini-car')) : [];
    var CAP = 40, MIN = 12, words = ['No', 'One', 'Two', 'Three', 'Four'];
    var update = function () {
      var on = [];
      cars.forEach(function (c, i) { if (c.querySelector('input').checked) on.push(i); });
      var total = +cap.value, active = on.slice();
      while (active.length && total / active.length < MIN) active.pop();
      var share = active.length ? Math.min(CAP, total / active.length) : 0;
      cars.forEach(function (c, i) {
        var charging = active.indexOf(i) > -1, plugged = on.indexOf(i) > -1;
        c.querySelector('.demo-bar').style.width = charging ? Math.max(4, share / CAP * 100) + '%' : '0%';
        c.classList.toggle('is-paused', plugged && !charging);
        var mc = minis[i];
        if (mc) { mc.classList.toggle('is-off', !plugged); mc.classList.toggle('is-paused', plugged && !charging); }
        c.querySelector('.demo-state').textContent = !plugged ? 'Not plugged in' : charging ? 'Charging' : 'Paused';
      });
      if (meter) meter.style.width = (active.length ? Math.min(+cap.value, active.length * CAP) : 0) + '%';
      if (track) track.style.setProperty('--limit', cap.value + '%');
      var p = on.length - active.length, s;
      if (!on.length) s = 'No cars plugged in.';
      else {
        s = words[active.length] + (active.length === 1 ? ' car' : ' cars') + ' charging';
        if (p) s += ', ' + words[p].toLowerCase() + ' paused';
        s += '.';
      }
      sum.textContent = s;
    };
    var rb = demo.querySelector('[data-demo-reset]');
    if (rb) rb.addEventListener('click', function () {
      cap.value = cap.defaultValue;
      cars.forEach(function (c) { c.querySelector('input').checked = true; });
      update();
    });
    demo.addEventListener('input', update);
    demo.addEventListener('change', update);
    update();
  }

  // Cut the internet
  var cn = document.querySelector('[data-cutnet]');
  if (cn) {
    var cb = cn.querySelector('[data-cutnet-toggle]'), cl = cn.querySelector('[data-cutnet-label]');
    var onTxt = cl ? cl.textContent : '', offTxt = 'Restore the internet';
    // Label changes with state, so use no aria-pressed; a hidden live region announces the result.
    var st = document.createElement('p');
    st.className = 'visually-hidden';
    st.setAttribute('role', 'status');
    cn.appendChild(st);
    if (cb) {
      cb.removeAttribute('aria-pressed');
      cb.addEventListener('click', function () {
        var off = cn.getAttribute('data-offline') !== 'true';
        cn.setAttribute('data-offline', off ? 'true' : 'false');
        if (cl) cl.textContent = off ? offTxt : onTxt;
        st.textContent = off ? 'Internet link cut in the illustration.' : 'Internet link restored in the illustration.';
      });
    }
  }

  // Cutaway
  var ca = document.querySelector('[data-cutaway]');
  if (ca) {
    var hs = [].slice.call(ca.querySelectorAll('.hotspot[data-part]'));
    var setPart = function (name) {
      hs.forEach(function (h) { h.setAttribute('aria-expanded', h.getAttribute('data-part') === name ? 'true' : 'false'); });
      [].forEach.call(ca.querySelectorAll('[data-part-card]'), function (c) { c.classList.toggle('is-active', c.getAttribute('data-part-card') === name); });
      [].forEach.call(ca.querySelectorAll('[data-part-art]'), function (a) { var v = a.getAttribute('data-part-art'); a.classList.toggle('is-active', !!name && (v === name || v.indexOf(name + '-') === 0)); });
    };
    hs.forEach(function (h) {
      h.addEventListener('click', function () {
        var n = h.getAttribute('data-part');
        setPart(h.getAttribute('aria-expanded') === 'true' ? null : n);
      });
    });
    ca.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var open = hs.filter(function (h) { return h.getAttribute('aria-expanded') === 'true'; })[0];
        if (open) { setPart(null); open.focus(); }
      }
    });
  }

  // Timeline
  var tl = document.querySelector('[data-timeline]');
  if (tl) {
    // Stage labels may be static spans (no dead controls without JS); upgrade them to real buttons here.
    var sb = [].slice.call(tl.querySelectorAll('[data-stage-btn]')).map(function (el) {
      var li = el.closest('[data-stage]'), d = li && li.querySelector('.tl-detail');
      if (el.tagName === 'BUTTON') return el;
      var b = document.createElement('button');
      b.type = 'button'; b.className = el.className; b.setAttribute('data-stage-btn', '');
      b.textContent = el.textContent;
      if (d) b.setAttribute('aria-controls', d.id);
      b.setAttribute('aria-expanded', li && li.classList.contains('is-active') ? 'true' : 'false');
      el.parentNode.replaceChild(b, el);
      return b;
    });
    sb.forEach(function (btn) {
      btn.addEventListener('click', function () {
        sb.forEach(function (o) {
          var on = o === btn;
          o.setAttribute('aria-expanded', on ? 'true' : 'false');
          o.closest('[data-stage]').classList.toggle('is-active', on);
        });
      });
    });
  }
})();

/* W-P-4 */
/* Story tabs (Charger = frame 2, Floor = frame 4, Building = frame 5), charger hotspots, floor reveal. Controls ship with `hidden` and are shown here; without JS the frames and the fallback list stay. */
(function () {
  var root = document.documentElement;
  var track = document.querySelector('[data-story]');
  if (!track) return;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var tabsBox = document.querySelector('[data-s4-tabs]');
  var tabs = [].slice.call(document.querySelectorAll('[data-s4-tab]'));
  var hs = document.querySelector('[data-s4-hs]');
  var info = document.querySelector('[data-s4-info]');
  var fallback = document.querySelector('[data-s4-fallback]');
  var flWrap = document.querySelector('[data-s4-fl]');
  var frames = [].slice.call(track.querySelectorAll('[data-frame]'));
  var live = function () { return track.classList.contains('is-live'); };
  var setInert = function (el, off) { if (el) { if (off) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } };

  if (tabsBox) tabsBox.hidden = false;
  if (hs) hs.hidden = false;
  if (info) info.hidden = false;
  if (fallback) fallback.hidden = true;
  if (flWrap) flWrap.hidden = false;

  // Scroll progress at which each frame is fully shown in the scroll-linked layout (matches the --in/--co windows in style.css).
  var P = { 2: 0.345, 4: 0.745, 5: 0.985 };
  var hdr = function () { var h = document.querySelector('.site-header'); return h ? h.offsetHeight : 0; };
  var goTo = function (n) {
    var behavior = reduce ? 'auto' : 'smooth', y;
    if (live()) {
      var stage = track.querySelector('.story3-stage');
      var span = track.offsetHeight - (stage ? stage.offsetHeight : 0);
      y = track.getBoundingClientRect().top + window.pageYOffset - hdr() + P[n] * span;
    } else {
      var f = track.querySelector('[data-frame="' + n + '"]');
      if (!f) return;
      y = f.getBoundingClientRect().top + window.pageYOffset - hdr() - 8;
    }
    window.scrollTo({ top: Math.max(0, y), behavior: behavior });
  };
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var n = +t.getAttribute('data-s4-tab');
      tabs.forEach(function (o) { if (o === t) o.setAttribute('aria-current', 'true'); else o.removeAttribute('aria-current'); });
      goTo(n);
    });
  });
  if (tabsBox) tabsBox.addEventListener('keydown', function (e) {
    var i = tabs.indexOf(document.activeElement), k = e.key, j = -1;
    if (i < 0) return;
    if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i + tabs.length - 1) % tabs.length;
    else if (k === 'Home') j = 0;
    else if (k === 'End') j = tabs.length - 1;
    if (j > -1) { e.preventDefault(); tabs[j].focus(); }
  });

  // Which frame is on screen decides the current tab and which hotspot/floor controls can be reached (stacked frames are transparent, not removed).
  var cur = function () {
    if (live()) {
      var p = parseFloat(track.style.getPropertyValue('--p')) || 0;
      return p >= 0.77 ? 5 : p >= 0.57 ? 4 : p >= 0.37 ? 3 : p >= 0.19 ? 2 : 1;
    }
    var mid = (window.innerHeight || 1) / 2, n = 0;
    frames.forEach(function (f) { var r = f.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) n = +f.getAttribute('data-frame'); });
    return n;
  };
  var tick = false;
  var sync = function () {
    tick = false;
    var n = cur(), lv = live();
    tabs.forEach(function (t) {
      if (+t.getAttribute('data-s4-tab') === n) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
    });
    setInert(hs, lv && n !== 2);
    setInert(info, lv && n !== 2);
    setInert(flWrap, lv && n !== 5);
  };
  var req = function () { if (!tick) { tick = true; requestAnimationFrame(sync); } };
  window.addEventListener('scroll', req, { passive: true });
  window.addEventListener('resize', req, { passive: true });
  if ('MutationObserver' in window) {
    new MutationObserver(req).observe(track, { attributes: true, attributeFilter: ['style', 'class'] });
    new MutationObserver(req).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  sync();

  // Hotspots on the exploded charger: each toggles its own description.
  var parts = [].slice.call(document.querySelectorAll('[data-s4-part]'));
  var hint = info && info.querySelector('.s4-hint');
  var setPart = function (btn) {
    var any = false;
    parts.forEach(function (b) {
      var on = b === btn;
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      var d = document.getElementById(b.getAttribute('aria-controls'));
      if (d) d.hidden = !on;
      if (on) any = true;
    });
    if (hint) hint.hidden = any;
  };
  parts.forEach(function (b) {
    // .s4-hs is pointer-events:none and only .is-live re-enables the pins; the static story (reduced motion) needs it too.
    b.style.pointerEvents = 'auto';
    b.addEventListener('click', function () { setPart(b.getAttribute('aria-expanded') === 'true' ? null : b); });
  });
  if (hs) hs.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var open = parts.filter(function (b) { return b.getAttribute('aria-expanded') === 'true'; })[0];
      if (open) { setPart(null); open.focus(); }
    }
  });

  // Floor reveal on the building frame: tap a floor (or the load unit), a polite live panel shows one short line.
  var FL = {
    upper: 'Chargers on this floor are designed to link to each other and to the load-management unit.',
    middle: 'Same design on every floor: chargers linked by the wireless mesh.',
    lower: 'Chargers here join the same wireless mesh as the floors above.',
    unit: 'One load-management unit is designed to share the building\'s power between all chargers.'
  };
  var flBtns = [].slice.call(document.querySelectorAll('[data-s4-floor]'));
  var out = document.querySelector('[data-s4-floor-out]');
  var scene = track.querySelector('[data-frame="5"] .s3x');
  var dflt = out ? out.textContent : '';
  flBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-s4-floor'), off = b.getAttribute('aria-pressed') === 'true';
      flBtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b && !off ? 'true' : 'false'); });
      if (out) out.textContent = off ? dflt : FL[k];
      if (scene) { if (off) scene.removeAttribute('data-s4-floor'); else scene.setAttribute('data-s4-floor', k); }
    });
  });
})();

/* W-P-5 */
/* Load chart states: Normal / Peak / Internet down. One SVG; the toggle only swaps which series are visible, plus caption, desc and live text. Illustrative shapes, no numbers. */
(function () {
  var card = document.querySelector('[data-chart="demand"]');
  var box = card && card.querySelector('[data-s5-toggle]');
  if (!box) return;
  var btns = [].slice.call(box.querySelectorAll('[data-s5-state]'));
  var cap = card.querySelector('[data-s5-caption]');
  var live = card.querySelector('[data-s5-live]');
  var desc = card.querySelector('#chart-d');
  var peak = card.querySelector('[data-s5-series="peak"]');
  var down = card.querySelector('[data-s5-series="down"]');
  var base = [].slice.call(card.querySelectorAll('[data-series],[data-region="over"],.over-lab'));
  var T = {
    normal: {
      cap: 'Cars charge in turn. Total use is designed to stay under the building limit.',
      desc: 'Illustrative curves over an evening, not measured data. Without control, use rises above the building limit. With local control, use is meant to stay below it.',
      live: 'Showing normal evening. Illustrative.'
    },
    peak: {
      cap: 'Many cars plug in together. The load-management unit is designed to share power so total use stays under the limit.',
      desc: 'Illustrative curves over a busy evening, not measured data. Without control, use climbs well above the building limit. With local control, use is meant to stay below it.',
      live: 'Showing peak evening. Illustrative.'
    },
    down: {
      cap: 'The local load-management unit is designed to keep sharing power without the internet.',
      desc: 'Illustrative curves over an evening, not measured data. The internet link is lost. The local load-management unit is meant to keep use below the building limit.',
      live: 'Showing internet down. Illustrative. The local unit is designed to keep sharing power.'
    }
  };
  var show = function (s, announce) {
    btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-s5-state') === s ? 'true' : 'false'); });
    // SVG elements have no .hidden property, so toggle the attribute.
    var hide = function (el, off) { if (el) { if (off) el.setAttribute('hidden', ''); else el.removeAttribute('hidden'); } };
    base.forEach(function (el) { hide(el, s === 'peak'); });
    hide(peak, s !== 'peak');
    hide(down, s !== 'down');
    card.setAttribute('data-s5-state', s);
    if (cap) cap.textContent = T[s].cap;
    if (desc) desc.textContent = T[s].desc;
    if (live && announce) live.textContent = T[s].live;
  };
  btns.forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-s5-state'), true); });
  });
  box.addEventListener('keydown', function (e) {
    var i = btns.indexOf(document.activeElement), k = e.key, j = -1;
    if (i < 0) return;
    if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % btns.length;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i + btns.length - 1) % btns.length;
    if (j > -1) { e.preventDefault(); btns[j].focus(); }
  });
  box.hidden = false;
  show('normal', false);
})();
