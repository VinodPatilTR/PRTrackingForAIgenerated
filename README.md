# TaxCaddy Team Dashboard

A single-page team dashboard for **Thomson Reuters TaxCaddy** engineers and managers.
Deployed as a static site on **GitHub Pages** — no backend, no build step.

## 🔗 Live Dashboard

> `https://<your-org>.github.io/<repo-name>/`
> *(URL available under Settings → Pages after first deploy)*

---

## Features

### Tab 1 — GitHub · AI Generated PRs
- Scans all repos with prefix `a208548_` in the `tr` org
- Finds every PR labelled **"AI Generated"**
- Shows contributor cards, per-service PR counts, full PR table
- Filters: service, state (open/merged/closed), author, free-text search
- **Excel export**: repos details, contributors summary, PR list

### Tab 2 — Azure DevOps · Sprint Monitor
- Connects to `tr-tax / TaxProf / surePrep-tcd-elite`
- Auto-detects current sprint; dropdown to switch to any past/future sprint
- Team member cards — click to filter work items by that person
- Work items table with type/state/member/search filters
- Sprint health: days remaining, state breakdown, story points
- **Excel export**: work items, by-member breakdown, sprint summary

---

## Project Structure

```
taxcaddy-dashboard/
├── index.html                   # Main page (HTML skeleton)
├── assets/
│   ├── css/
│   │   └── dashboard.css        # All styles + dark mode + responsive
│   └── js/
│       └── dashboard.js         # All logic (GitHub API + ADO API + Excel export)
├── .github/
│   └── workflows/
│       └── deploy.yml           # Auto-deploy to GitHub Pages on push to main
├── .gitignore
└── README.md
```

---

## Deployment — GitHub Pages

### First-time setup (5 minutes)

1. **Create a new GitHub repo** (can be private or public)

2. **Push this code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit — TaxCaddy Team Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-org>/<repo-name>.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to repo → **Settings** → **Pages**
   - Source: **GitHub Actions**
   - Click Save

4. The workflow runs automatically. Your dashboard will be live at:
   `https://<your-org>.github.io/<repo-name>/`

### After that — every push to `main` auto-deploys in ~30 seconds.

---

## Authentication (Runtime — no secrets stored in repo)

All credentials are entered by the user in the browser at runtime. Nothing is stored in the repo or on any server.

### GitHub PAT
- Go to [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=repo&description=PR+Dashboard)
- Scopes needed: **repo** (read)
- Paste into the GitHub tab when using the dashboard

### Azure DevOps PAT
- Go to `dev.azure.com` → your profile icon → **Personal Access Tokens**
- Scopes needed: **Work Items — Read**
- Paste into the ADO tab when using the dashboard

---

## Local Development

No build tools needed. Just open `index.html` in Chrome or Edge:

```bash
# Option 1 — open directly
open index.html

# Option 2 — serve locally (avoids any file:// quirks)
npx serve .
# or
python3 -m http.server 8080
```

---

## Technical Notes

- **No CORS issues** — `api.github.com` and `dev.azure.com` both allow direct browser requests with proper auth headers
- **No frameworks** — vanilla HTML/CSS/JS only
- **Excel export** — powered by [SheetJS](https://sheetjs.com/) loaded from CDN
- **Dark mode** — automatic via `prefers-color-scheme`
- **Responsive** — works on tablets and mobile

---

## Reference

See [`myfiledetails.md`](myfiledetails.md) for the full technical reference — CSS variables, all JS functions, API endpoints, data shapes, and modification guides.
