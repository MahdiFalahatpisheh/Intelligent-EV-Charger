// W-SEC-2: theme init moved out of the inline head script; must load synchronously before the stylesheet.
try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}
// W-SEO-7.6: html.js is set here, before first paint, so CSS keyed on it (Pause button, theme button slot, hero scene) lays out once; site.js sets it again (harmless).
document.documentElement.classList.add('js');
