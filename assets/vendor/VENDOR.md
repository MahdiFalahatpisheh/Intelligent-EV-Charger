# Vendored browser libraries

Self-hosted, no CDN. Loaded only by the portal pages.

| Item | Value |
|---|---|
| Package | `@supabase/supabase-js` (npm) |
| Version (exact pin) | 2.117.3, published 2026-10-07 |
| File in this folder | `supabase.js` (the package's browser bundle, global `supabase`) |
| Source path in the npm tarball | `dist/umd/supabase.js` |
| SHA-256 | `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3` |
| Licence | MIT, copy in `LICENSE-supabase-js.txt` (Copyright (c) 2020 Supabase) |
| Installed with | `npm install --save-exact @supabase/supabase-js@2.117.3` in a scratch folder outside `website/` |
| `npm audit` at install (2026-10-30) | 0 vulnerabilities (package and its 8 dependencies) |
| Checks done | `grep -c "eval("` and `grep -c "new Function"` both 0; no CDN URL in the page code |

Update steps: install the new exact version outside `website/`, copy `dist/umd/supabase.js` and `LICENSE`, update this table (version, date, hash), run `npm audit`, run the portal pages in a browser. Re-check `npm audit` monthly.
