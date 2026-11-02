/* login.html: sign in, sign up, reset password, optional magic link. Error text never says whether an email exists. */
(function () {
  'use strict';
  var P = window.Portal, cfg = window.PORTAL_CONFIG || {};
  var msg = document.getElementById('auth-msg');
  var forms = {
    signin: document.getElementById('form-signin'), signup: document.getElementById('form-signup'), reset: document.getElementById('form-reset'),
    magic: document.getElementById('form-magic'), newpass: document.getElementById('form-newpass')
  };
  var signedIn = document.getElementById('signed-in');
  var H = document.getElementById('auth-h'), L = document.getElementById('auth-lede');
  var TITLES = {
    signin: ['Sign in', 'Use your account to see your chargers and daily reports.'],
    signup: ['Create an account', 'Make an account with your email and a password. We will email you a link to confirm it.'],
    reset: ['Reset your password', 'Enter your email and we will send a link to choose a new password.'],
    magic: ['Email me a sign-in link', 'Enter your email and we will send a link that signs you in.'],
    newpass: ['Choose a new password', 'Enter a new password for your account.'],
    done: ['You are signed in', 'Continue to your page or sign out.']
  };
  var T = {
    network: 'We could not reach the sign-in service. Check your connection and try again.',
    badLogin: 'That email and password did not match. Check them and try again.',
    needEmail: 'Enter your email address.',
    badEmail: 'Enter a valid email address, such as name@example.com.',
    needPass: 'Enter your password.',
    sentCheck: 'If that email can be used, we have sent a message to it. Check your inbox and spam folder.',
    unavailable: 'The sign-in service is not available right now. Try again later.',
    weakPass: 'That password was not accepted. Try a longer one that you do not use elsewhere.',
    newPassDone: 'Your password is saved. You are signed in.'
  };

  function show(mode) {
    Object.keys(forms).forEach(function (k) { forms[k].hidden = k !== mode; });
    signedIn.hidden = mode !== 'done';
    H.textContent = TITLES[mode][0]; L.textContent = TITLES[mode][1];
    document.title = TITLES[mode][0] + ' - Shared EV Charging';
    clearFields();
    if (forms[mode]) { var f = forms[mode].querySelector('input'); if (f && mode !== 'signin') f.focus(); }
  }
  function say(text, kind) {
    msg.textContent = text || '';
    msg.hidden = !text;
    msg.className = 'notice' + (kind ? ' notice-' + kind : '');
  }
  function fieldError(input, text) {
    var id = input.id + '-err', e = document.getElementById(id);
    if (!text) { if (e) e.remove(); input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); return; }
    if (!e) { e = document.createElement('p'); e.id = id; e.className = 'field-error'; input.parentNode.appendChild(e); }
    e.textContent = text; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', id);
  }
  function clearFields() {
    document.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
    document.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function checkEmail(input) {
    var v = input.value.trim();
    if (!v) { fieldError(input, T.needEmail); return false; }
    if (!validEmail(v)) { fieldError(input, T.badEmail); return false; }
    fieldError(input, ''); return true;
  }
  function checkPass(input) {
    if (!input.value) { fieldError(input, T.needPass); return false; }
    fieldError(input, ''); return true;
  }
  function busy(form, on) {
    var b = form.querySelector('button[type=submit]');
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.disabled = on; b.setAttribute('aria-busy', on ? 'true' : 'false');
    b.textContent = on ? b.dataset.busy + '…' : b.dataset.label;
  }
  function firstBad(form) { return form.querySelector('[aria-invalid="true"]'); }

  function go(session) {
    P.getRole(session).then(function (role) { window.location.replace(P.home(role)); });
  }

  if (!P || !P.ready) {
    Object.keys(forms).forEach(function (k) { forms[k].hidden = true; });
    say(T.unavailable, 'warn');
    return;
  }
  forms.signin.hidden = false;  // forms stay hidden until this script runs, so a no-JS visitor never gets a working GET/POST form
  document.getElementById('go-signup').hidden = !cfg.allowSignUp;
  document.getElementById('go-magic').hidden = !cfg.magicLink;

  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { say(''); show(b.getAttribute('data-go')); });
  });

  forms.signin.addEventListener('submit', function (e) {
    e.preventDefault(); say('');
    var em = document.getElementById('si-email'), pw = document.getElementById('si-pass');
    var ok = checkEmail(em), ok2 = checkPass(pw);
    if (!ok || !ok2) { firstBad(forms.signin).focus(); return; }
    busy(forms.signin, true);
    P.client.auth.signInWithPassword({ email: em.value.trim(), password: pw.value }).then(function (r) {
      if (r.error) {
        busy(forms.signin, false);
        say(r.error.status === 0 || /fetch|network/i.test(r.error.message || '') ? T.network : T.badLogin, 'error');
        pw.value = ''; pw.focus(); return;
      }
      go(r.data.session);
    }, function () { busy(forms.signin, false); say(T.network, 'error'); });
  });

  forms.signup.addEventListener('submit', function (e) {
    e.preventDefault(); say('');
    if (!cfg.allowSignUp) { say(T.unavailable, 'warn'); return; }
    var em = document.getElementById('su-email'), pw = document.getElementById('su-pass');
    var ok = checkEmail(em), ok2 = checkPass(pw);
    if (!ok || !ok2) { firstBad(forms.signup).focus(); return; }
    busy(forms.signup, true);
    P.client.auth.signUp({ email: em.value.trim(), password: pw.value, options: { emailRedirectTo: P.pageUrl('login.html') } }).then(function (r) {
      busy(forms.signup, false);
      if (r.error && /password/i.test(r.error.message || '')) { fieldError(pw, T.weakPass); pw.focus(); return; }
      if (r.error && (r.error.status === 0 || /fetch|network/i.test(r.error.message || ''))) { say(T.network, 'error'); return; }
      // Same message whether or not the address already has an account.
      pw.value = ''; say(T.sentCheck, 'ok');
    }, function () { busy(forms.signup, false); say(T.network, 'error'); });
  });

  function emailOnly(form, input, call) {
    form.addEventListener('submit', function (e) {
      e.preventDefault(); say('');
      var em = document.getElementById(input);
      if (!checkEmail(em)) { em.focus(); return; }
      busy(form, true);
      call(em.value.trim()).then(function (r) {
        busy(form, false);
        if (r && r.error && (r.error.status === 0 || /fetch|network/i.test(r.error.message || ''))) { say(T.network, 'error'); return; }
        say(T.sentCheck, 'ok');
      }, function () { busy(forms.reset, false); say(T.network, 'error'); });
    });
  }
  emailOnly(forms.reset, 'rs-email', function (email) {
    return P.client.auth.resetPasswordForEmail(email, { redirectTo: P.pageUrl('login.html') });
  });
  emailOnly(forms.magic, 'mg-email', function (email) {
    return P.client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: P.pageUrl('login.html'), shouldCreateUser: false } });
  });

  forms.newpass.addEventListener('submit', function (e) {
    e.preventDefault(); say('');
    var pw = document.getElementById('np-pass');
    if (!pw.value) { fieldError(pw, T.needPass); pw.focus(); return; }
    fieldError(pw, ''); busy(forms.newpass, true);
    P.client.auth.updateUser({ password: pw.value }).then(function (r) {
      busy(forms.newpass, false);
      if (r.error) { fieldError(pw, T.weakPass); pw.focus(); return; }
      say(T.newPassDone, 'ok'); setTimeout(function () { P.getSession().then(go); }, 1200);
    }, function () { busy(forms.newpass, false); say(T.network, 'error'); });
  });

  document.getElementById('signed-out-btn').addEventListener('click', function () {
    P.signOut().then(function () { say('You are signed out.', 'ok'); show('signin'); });
  });

  // Recovery link: the library exchanges the code in the URL, then fires PASSWORD_RECOVERY.
  var recovering = /type=recovery/.test(window.location.href) || false;
  P.client.auth.onAuthStateChange(function (ev) {
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; show('newpass'); }
  });

  // Already signed in (and not in the middle of a recovery): offer to continue.
  P.getSession().then(function (s) {
    if (recovering || !s) return;
    window.setTimeout(function () {
      if (recovering) return;
      P.getRole(s).then(function (role) {
        document.getElementById('signed-in-text').textContent = 'You are signed in as ' + (s.user.email || 'your account') + '.';
        document.getElementById('signed-in-go').setAttribute('href', P.home(role));
        show('done');
      });
    }, 400);
  });
  // Failed email link (expired or already used) arrives as ?error=... or #error=...
  if (/[?#&]error(_code|_description)?=/.test(window.location.href)) {
    say('That link has expired or was already used. Request a new one.', 'error');
    try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
  }
})();
