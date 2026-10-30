/* Portal client: one Supabase client plus small helpers. Needs assets/vendor/supabase.js and portal-config.js loaded first. */
(function () {
  'use strict';
  var cfg = window.PORTAL_CONFIG, lib = window.supabase;
  var P = window.Portal = { ready: false, client: null };
  // Clickjacking guard for the portal pages (a meta CSP cannot set frame-ancestors).
  try { if (window.top !== window.self) document.documentElement.hidden = true; } catch (e) { document.documentElement.hidden = true; }
  if (!cfg || !cfg.url || !cfg.key || !lib || !lib.createClient) return;
  P.client = lib.createClient(cfg.url, cfg.key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  P.ready = true;

  // Current session or null. Never throws.
  P.getSession = function () {
    return P.client.auth.getSession().then(function (r) { return (r && r.data && r.data.session) || null; }, function () { return null; });
  };
  // 'customer' | 'admin' | null (null when signed out or the row cannot be read). Reads the user's own profile row only.
  P.getRole = function (session) {
    return Promise.resolve(session || P.getSession()).then(function (s) {
      if (!s || !s.user) return null;
      return P.client.from('profiles').select('role').eq('id', s.user.id).maybeSingle().then(function (r) {
        return r && r.data && r.data.role ? r.data.role : null;
      }, function () { return null; });
    });
  };
  P.signOut = function () {
    return P.client.auth.signOut().then(function () { return true; }, function () { return false; });
  };
  // Absolute URL of a sibling page, used as redirect target for email links (must be on the allow-list).
  P.pageUrl = function (name) { return new URL(name, window.location.href).href; };
  // Where a role goes after sign-in.
  P.home = function (role) { return role === 'admin' ? 'admin.html' : 'account.html'; };
})();
