# Project website

Static public site for the EV charging load-management project. Plain HTML and one CSS file; no build step, no external fonts or trackers. All links are relative.

## Files
- `index.html`, `how-it-works.html`, `technology.html`, `project.html`, `contact.html` - the five pages
- `style.css` - shared styles
- `.github/workflows/pages.yml` - deploys to GitHub Pages on push to `main` or manual run

## Preview locally
```
python3 -m http.server 8000
```
Then open http://localhost:8000/ (or open `index.html` directly).

## One-time setup
In the repository: Settings > Pages > Source = **GitHub Actions**. Then push to `main` (or run the workflow manually from the Actions tab).
- Run `./check.sh` before deploying; it must exit 0.
