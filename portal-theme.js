/* Applies the saved theme before first paint (external file so the portal pages need no inline script). */
try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
