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
  // Off-screen hero pause stays separate. The label swaps (Pause/Play), so aria-pressed is dropped to avoid a contradictory state.
  var scene = document.querySelector('[data-hero-scene]');
  var mts = [].slice.call(document.querySelectorAll('[data-motion-toggle]'));
  var heroOff = false;
  var heroSync = function () { if (scene) scene.classList.toggle('is-paused', heroOff); };
  mts.forEach(function (mt) {
    if (reduce) { mt.parentNode.removeChild(mt); return; }  // nothing loops under reduced motion
    mt.removeAttribute('aria-pressed');
    mt.addEventListener('click', function () { root.classList.toggle('is-paused'); });
  });
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
