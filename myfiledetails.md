# myfiledetails.md — AI Generated PR Dashboard

> **Reference file for:** `ai_pr_dashboard.html`
> **Purpose:** Complete technical reference so any future session can understand and extend this file without re-reading the source from scratch.
> **Last updated:** 2026-06-03 (v2 — ADO Sprint Monitor tab added)

---

## 1. Overview

| Property | Value |
|---|---|
| **File name** | `ai_pr_dashboard.html` |
| **Type** | Single-file standalone HTML app (no server, no build step) |
| **Purpose** | Scans all GitHub repos with a configurable prefix in an org, finds PRs labelled "AI Generated", and displays them in a dashboard with Excel export |
| **Client** | TaxCaddy team (Thomson Reuters) |
| **Default org** | `tr` |
| **Default repo prefix** | `a208548_` |
| **Default label** | `AI Generated` |
| **How to run** | Double-click → opens directly in Chrome or Edge |
| **External dependency** | SheetJS CDN (xlsx) — loaded from `cdnjs.cloudflare.com` |

---

## 2. Architecture

```
ai_pr_dashboard.html
├── <head>
│   └── SheetJS CDN script (xlsx 0.18.5)
├── <style>  — all CSS, ~170 lines, CSS variables + dark mode
├── <body>
│   ├── .topbar          — sticky top nav with live badges
│   ├── .wrap
│   │   ├── .acard       — auth card (PAT input + config fields)
│   │   └── #dash        — injected after scan:
│   │       ├── .metrics         — 5 stat cards
│   │       ├── .chips           — repo chip strip
│   │       ├── .ugrid           — contributor cards
│   │       └── .tcard           — PR table with filters + export
└── <script>  — all JS, ~230 lines, vanilla ES2020
```

**Key principle:** Everything is a single `.html` file. No frameworks, no build tools, no backend. The GitHub API is called directly from the browser (`api.github.com` returns `Access-Control-Allow-Origin: *` so CORS is not an issue when opened as a local file).

---

## 3. External Libraries

| Library | Version | CDN URL | Purpose |
|---|---|---|---|
| SheetJS (xlsx) | 0.18.5 | `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` | Excel `.xlsx` export in-browser |

No other external libraries. All icons are inline SVG. No CSS framework.

---

## 4. CSS Design System

### 4.1 CSS Custom Properties (Light mode)

| Variable | Value | Usage |
|---|---|---|
| `--bg` | `#f2f0eb` | Page background |
| `--surf` | `#ffffff` | Card/component surface |
| `--surf2` | `#ece9e3` | Input backgrounds, hover states |
| `--surf3` | `#e4e0d8` | Gray pill background |
| `--bdr` | `rgba(0,0,0,0.08)` | Subtle borders |
| `--bdr2` | `rgba(0,0,0,0.14)` | Standard borders |
| `--bdr3` | `rgba(0,0,0,0.22)` | Strong borders |
| `--txt` | `#17160f` | Primary text |
| `--txt2` | `#5c5950` | Secondary text |
| `--txt3` | `#9a9790` | Tertiary / muted text |
| `--blue` | `#1254a0` | Primary accent, links |
| `--bluebg` | `#deeaf8` | Blue pill / tag background |
| `--green` | `#285e0c` | Open state, success |
| `--greenbg` | `#dff0cd` | Green pill background |
| `--purple` | `#342d8a` | Merged state |
| `--purplebg` | `#eae8fc` | Purple pill background |
| `--red` | `#8f2222` | Closed/error state |
| `--redbg` | `#f8e2e2` | Red pill background |
| `--amber` | `#7a4206` | Warning |
| `--amberbg` | `#f8e8d0` | Amber pill background |
| `--r` | `10px` | Standard border radius |
| `--rsm` | `7px` | Small border radius (inputs, buttons) |
| `--rpill` | `99px` | Pill/badge border radius |
| `--sh` | subtle shadow | Card shadow |
| `--sh2` | medium shadow | Elevated card shadow |

### 4.2 Dark Mode
Triggered via `@media(prefers-color-scheme:dark)`. All the same variables are redefined with dark equivalents. No JS needed.

### 4.3 Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| `≤1000px` | Metrics: 5→3 cols; auth fields: 3→2 cols; table hides repo/opened/updated cols |
| `≤640px` | Metrics: 2 cols; auth fields: 1 col; search input narrowed |

### 4.4 Key CSS Classes

| Class | Element | Description |
|---|---|---|
| `.topbar` | `<div>` | Sticky 52px nav bar |
| `.logo-icon` | `<div>` | Blue 28×28 rounded square icon container |
| `.pill` | `<span>` | Inline badge — combine with `.p-blue`, `.p-green`, `.p-purple`, `.p-red`, `.p-gray` |
| `.wrap` | `<div>` | Max-width 1340px page container |
| `.acard` | `<div>` | Auth/config card with shadow |
| `.fgrid` | `<div>` | 3-column form field grid |
| `.fg` | `<div>` | Single form field wrapper (label + input) |
| `.btn` | `<button>` | Base button — combine with `.btn-primary`, `.btn-icon`, `.btn-export` |
| `.btn-export` | `<button>` | Green export button (used on all 3 export dropdowns) |
| `.status` | `<div>` | Status bar — combine with `.s-idle`, `.s-ok`, `.s-err`, `.s-load` |
| `.prog` / `.prog-fill` | `<div>` | Progress bar track and animated fill |
| `.metrics` | `<div>` | 5-column metric card grid |
| `.mc` | `<div>` | Single metric card |
| `.sec-hd` | `<div>` | Section heading (uppercase, small) |
| `.sec-hd-row` | `<div>` | Section heading + export button row (space-between) |
| `.chips` | `<div>` | Flex wrap container for repo chips |
| `.chip` | `<div>` | Single repo chip with `.cn` count badge |
| `.ugrid` | `<div>` | Auto-fill grid of contributor cards |
| `.uc` | `<div>` | Single contributor card |
| `.av` | `<div>` | Avatar circle (36×36, shows img or initials) |
| `.tcard` | `<div>` | PR table card container |
| `.ttbar` | `<div>` | Table toolbar (search + filters + export) |
| `.tcols` | `<div>` | CSS Grid row — 7 columns for table |
| `.thead` | `<div>` | Table header row |
| `.tr` | `<div>` | Table data row |
| `.exp-wrap` | `<div>` | Export dropdown wrapper (position:relative) |
| `.exp-menu` | `<div>` | Dropdown panel — add `.open` class to show |
| `.exp-menu-item` | `<button>` | Single item inside dropdown |
| `.spin` | `<span>` | CSS spinner animation |
| `.toast` | `<div>` | Fixed bottom-right notification — add `.show` to display |

---

## 5. HTML Structure

### 5.1 Topbar (`#tbOrg`, `#tbRepos`, `#tbPRs`)
Three dynamic pill badges in the top bar:
- `#tbOrg` — always visible, updates to current org name
- `#tbRepos` — hidden until scan completes, shows repo count
- `#tbPRs` — hidden until scan completes, shows PR count

### 5.2 Auth Card
| Element ID | Type | Default | Purpose |
|---|---|---|---|
| `#tokInput` | `password` input | — | GitHub PAT |
| `#eyeSvg` | SVG inside button | eye icon | Show/hide toggle for PAT |
| `#scanBtn` | button | — | Triggers `connect()` |
| `#scanLbl` | span | "Connect & Scan" | Button label (changes to spinner) |
| `#orgInp` | text input | `tr` | GitHub org/owner |
| `#prefInp` | text input | `a208548_` | Repo name prefix filter |
| `#lblInp` | text input | `AI Generated` | PR label to search for |
| `#statusEl` | div | `.s-idle` | Status message bar |
| `#progEl` | div | `display:none` | Progress bar wrapper |
| `#progLbl` | span | — | Progress text label |
| `#progPct` | span | `0%` | Progress percentage |
| `#progFill` | div | `width:0%` | Animated fill bar |

### 5.3 Dashboard (`#dash`)
Injected entirely by `renderDash()` after a successful scan. Contains:
- `.metrics` — 5 stat cards (repos, total PRs, open, merged, authors)
- `.sec-hd-row` + `.chips` — services section with Export Services button
- `.sec-hd-row` + `.ugrid` — contributors section with Export Contributors button
- `.tcard` — PR table with toolbar (search + 3 filters + Export PRs dropdown)

### 5.4 PR Table Columns (`.tcols` grid)
```
70px | 2.4fr | 1fr | 1.4fr | 84px | 82px | 80px
PR # | Title | Author | Repository | State | Opened | Updated
```
Columns 4, 6, 7 (Repository, Opened, Updated) are hidden at ≤1000px.

### 5.5 Export Dropdown IDs
| ID | Section | Trigger button |
|---|---|---|
| `#menuRepos` | Services section | "Export Services ▾" |
| `#menuContrib` | Contributors section | "Export Contributors ▾" |
| `#menuPRs` | PR table toolbar | "Export PRs ▾" |

---

## 6. JavaScript — Global State

| Variable | Type | Description |
|---|---|---|
| `ALL` | Array | All PRs fetched from GitHub (across all repos). Each item is a GitHub PR object extended with `_repo` (repo short name) and `_full` (full_name). |
| `FILT` | Array | Filtered subset of `ALL` — updated by `refilter()` on every filter/search change |
| `PAGE` | Number | Current page number in the PR table (1-indexed) |
| `REPOS_META` | Array | Full repo metadata objects for export — populated during scan |
| `PG` | Constant `25` | Rows per page in PR table |

---

## 7. JavaScript — Functions Reference

### 7.1 Utility Functions

| Function | Signature | Description |
|---|---|---|
| `$` | `(id) => Element` | Shorthand for `document.getElementById` |
| `toast` | `(msg, ms=2800)` | Shows bottom-right toast notification |
| `ago` | `(dateStr) => string` | Converts ISO date to relative time ("3d ago") |
| `fmtDate` | `(dateStr) => string` | Formats ISO date to "Jun 3, 2026, 10:30 AM" for Excel |
| `ini` | `(name) => string` | Returns 2-char uppercase initials from a username |
| `esc` | `(str) => string` | HTML-escapes a string (prevents XSS in innerHTML) |
| `stOf` | `(pr) => string` | Returns `'open'`, `'merged'`, or `'closed'` for a PR object |

### 7.2 UI State Functions

| Function | Description |
|---|---|
| `setSt(html, type)` | Updates `#statusEl`. `type` = `'idle'` \| `'ok'` \| `'err'` \| `'loading'`. Renders matching SVG icon. |
| `setProg(cur, tot, lbl)` | Updates progress bar. Pass `tot=0` to hide. |
| `toggleTok()` | Toggles PAT input between `password` and `text`, swaps eye icon SVG |

### 7.3 GitHub API Functions

| Function | Description |
|---|---|
| `ghFetch(url, token)` | Single authenticated GET to GitHub API. Throws on non-OK status. |
| `ghPages(base, token)` | Paginates through all pages of a GitHub API endpoint (100 per page) and returns combined array. |

### 7.4 Main Flow

| Function | Description |
|---|---|
| `connect()` | Main entry point. Reads form inputs, discovers repos with prefix, fetches all PRs with matching label across all repos, stores in `ALL` and `REPOS_META`, calls `renderDash()`. |

**Flow inside `connect()`:**
1. Validate token + org + prefix
2. Try `GET /orgs/{org}/repos`, fallback to `GET /users/{org}/repos`
3. Filter repos by `name.startsWith(prefix)`
4. For each repo: `GET /repos/{full_name}/pulls?state=all` (paginated)
5. Filter PRs whose `.labels` array contains the target label (case-insensitive)
6. Attach `_repo` and `_full` to each PR
7. Call `renderDash(repos, label)`

### 7.5 Render Functions

| Function | Description |
|---|---|
| `renderDash(repos, label)` | Builds the entire `#dash` innerHTML. Computes aggregations (byUser, byRepo), builds filter `<select>` options, renders metrics/chips/users/table. |
| `refilter()` | Re-applies all 4 filters (state, user, repo, search text) to `ALL`, updates `FILT`, resets `PAGE=1`, calls `renderRows()`. |
| `renderRows()` | Renders the current page of `FILT` into `#tbody` and updates `#tpag` pagination controls. |
| `chPg(dir)` | Increments/decrements `PAGE` by `dir` (+1 or -1), calls `renderRows()`. |

### 7.6 Excel Export Functions

| Function | Output file | Sheets |
|---|---|---|
| `exportRepos()` | `TaxCaddy_Repos_{org}_{date}.xlsx` | **Repositories** (all repo details), **Summary** (stats + language breakdown) |
| `exportContributors()` | `TaxCaddy_Contributors_{date}.xlsx` | **Contributors** (ranked: username, total/open/merged/closed PRs, repos count) |
| `exportAllPRs()` | `TaxCaddy_All_PRs_{date}.xlsx` | **Pull Requests**, **By Repository**, **By Author** |
| `exportFilteredPRs()` | `TaxCaddy_Filtered_PRs_{date}.xlsx` | Same 3 sheets but only `FILT` (current filter) |
| `exportPRData(data, label)` | Internal helper used by above two | Builds the 3-sheet PR workbook for any PR array |

**Shared Excel helpers:**

| Function | Description |
|---|---|
| `xlsxHdr(ws, headers, row=1)` | Applies blue header row style (white bold text on `#1254A0` background) |
| `autoWidth(ws, data, headers)` | Sets column widths based on content (min 10, max 60 chars) |
| `freezeRow(ws)` | Freezes the top header row |
| `addFilter(ws, numCols)` | Adds Excel AutoFilter to all columns |

**Excel columns per export:**

*Repositories sheet:*
Repository Name, Full Name, Description, Language, Default Branch, Visibility, Stars, Forks, Open Issues, Topics, Created, Last Updated, Last Push, GitHub URL

*Contributors sheet:*
Rank, GitHub Username, Profile URL, Total PRs, Open, Merged, Closed, Repos Contributed, Repositories

*Pull Requests sheet:*
PR Number, Title, Repository, Author, State, Created, Updated, Merged At, Branch (from), Branch (into), Labels, PR URL

*By Repository sheet:*
Repository, Total PRs, Open, Merged, Closed, Unique Authors

*By Author sheet:*
Author, Total PRs, Open, Merged, Closed, Repos Contributed

### 7.7 Export Dropdown

| Function | Description |
|---|---|
| `toggleMenu(id)` | Closes all `.exp-menu` dropdowns, then toggles the target one by adding/removing `.open` class |
| `document click listener` | Closes all open export menus when clicking outside `.exp-wrap` |

---

## 8. GitHub API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /orgs/{org}/repos?type=all&per_page=100` | List all repos in an org (primary) |
| `GET /users/{org}/repos?per_page=100` | Fallback if org endpoint returns 404 |
| `GET /repos/{full_name}/pulls?state=all&per_page=100` | All PRs (open + closed + merged) for a repo |

**Auth header:** `Authorization: Bearer {token}` + `X-GitHub-Api-Version: 2022-11-28`

**CORS:** `api.github.com` returns `Access-Control-Allow-Origin: *` — works from a local `file://` HTML page with no proxy needed.

**PR label filtering:** Done client-side — all PRs are fetched, then filtered by `pr.labels.some(l => l.name.toLowerCase() === label.toLowerCase())`.

---

## 9. Data Shapes

### 9.1 PR object in `ALL` array
Standard GitHub REST API PR object, extended with:
```js
{
  // ...all GitHub PR fields (number, title, state, user, labels, html_url,
  //   created_at, updated_at, head, base, pull_request, merged_at, etc.)
  _repo: "a208548_api_TaxCaddyService",   // repo short name
  _full: "tr/a208548_api_TaxCaddyService" // full_name
}
```

### 9.2 REPOS_META item
```js
{
  name, full_name, description, language, default_branch,
  visibility,       // "Public" or "Private"
  stars, forks, open_issues,
  created_at, updated_at, pushed_at,
  url,              // html_url
  topics            // comma-separated string
}
```

---

## 10. Known Issues & History

| Date | Issue | Fix |
|---|---|---|
| Initial | "Failed to fetch" error in claude.ai widget | Iframe sandbox blocks all external fetches. Fixed by making it a standalone HTML file (not embedded). |
| Initial | Needed Node.js server | Confirmed `api.github.com` sends `Access-Control-Allow-Origin: *`, so no proxy needed. |
| Post-export PR | `RICO is not defined` error | Variable was defined as `Rico` (camelCase) but referenced as `RICO` (uppercase). Fixed by correcting reference to `Rico`. |

---

## 11. Future Enhancement Ideas

- [ ] Date range filter on PRs (e.g. "last 30 days")
- [ ] Click contributor card to filter table to that user
- [ ] Click repo chip to filter table to that repo
- [ ] PR count trend chart (PRs per week/month)
- [ ] Cache last scan result in `localStorage` for faster reload
- [ ] Multi-label support (OR logic across multiple labels)
- [ ] Support GitHub Enterprise (configurable base URL)
- [ ] Add "Copy PR list" button for Slack/Teams sharing
- [ ] Add commit count column to PR table

---

## 12. How to Modify

### Add a new column to the PR table
1. Add header string to the `.thead` div in `renderDash()`
2. Update `.tcols` CSS grid template (`grid-template-columns`) — add new column width
3. Add the cell `<div>` in the `.tr` template inside `renderRows()`
4. Update responsive breakpoint in `@media(max-width:1000px)` if needed

### Add a new export option
1. Add a `<button class="exp-menu-item">` inside the relevant `#menu*` div in `renderDash()`
2. Write the export function following the pattern of `exportContributors()` or `exportRepos()`
3. Use `xlsxHdr()`, `autoWidth()`, `freezeRow()`, `addFilter()` helpers for consistent formatting

### Change default org/prefix/label
Edit the `value` attributes on `#orgInp`, `#prefInp`, `#lblInp` inputs in the HTML.

### Add a new status type
Add to the `SVGS` object in the script and use `setSt('message', 'newtype')`.

---

## 13. Azure DevOps Sprint Monitor Tab (Added v2)

### 13.1 Overview
| Property | Value |
|---|---|
| Tab label | "Azure DevOps · Sprint Monitor" |
| Panel ID | `#panel-ado` |
| ADO org | `tr-tax` (default) |
| ADO project | `TaxProf` (default) |
| ADO team | `surePrep-tcd-elite` (default) |
| Sprint detection | Auto-detects current sprint (timeFrame=current); manual override supported |
| Auth method | ADO PAT via `Basic` auth: `btoa(':' + token)` → `Authorization: Basic <b64>` |

### 13.2 ADO Auth Card Fields
| Element ID | Default | Purpose |
|---|---|---|
| `#adoTok` | — | ADO Personal Access Token |
| `#adoEyeSvg` | eye icon | Show/hide toggle |
| `#adoScanBtn` | — | Triggers `adoConnect()` |
| `#adoScanLbl` | "Load Sprint" | Button label (changes to spinner) |
| `#adoOrg` | `tr-tax` | ADO organisation name |
| `#adoProject` | `TaxProf` | ADO project name |
| `#adoTeam` | `surePrep-tcd-elite` | Team name |
| `#adoSprint` | *(blank)* | Sprint name filter (blank = current) |
| `#adoStatus` | `.s-idle` | Status message bar |

### 13.3 ADO API Endpoints Used
| Endpoint | Purpose |
|---|---|
| `GET /dev.azure.com/{org}/{project}/{team}/_apis/work/teamsettings/iterations?api-version=7.1` | List all sprints + timeFrame (current/past/future) |
| `GET /dev.azure.com/{org}/{project}/{team}/_apis/work/teamsettings/iterations/{id}/workitems?api-version=7.1` | Get work item IDs in the sprint |
| `GET /dev.azure.com/{org}/_apis/wit/workitems?ids={ids}&fields={fields}&api-version=7.1` | Batch-fetch work item details (max 200 per call) |

### 13.4 Work Item Fields Fetched
`System.Id`, `System.Title`, `System.WorkItemType`, `System.State`, `System.AssignedTo`, `System.AreaPath`, `Microsoft.VSTS.Scheduling.RemainingWork`, `Microsoft.VSTS.Scheduling.StoryPoints`, `Microsoft.VSTS.Scheduling.OriginalEstimate`, `System.CreatedDate`, `System.ChangedDate`, `System.Parent`, `System.Tags`, `System.IterationPath`

### 13.5 Global State (ADO)
| Variable | Type | Description |
|---|---|---|
| `ADO_ITEMS` | Array | All work items fetched for the sprint |
| `ADO_FILT` | Array | Filtered subset — updated by `adoRefilter()` |
| `ADO_PAGE` | Number | Current page in work items table |
| `ADO_SPRINT_INFO` | Object | `{name, id, startDate, endDate, timeFrame, url}` |
| `ADO_PG` | Constant `30` | Rows per page in work items table |

### 13.6 ADO Data Shape (item in ADO_ITEMS)
```js
{
  id, title, type, state, assignedTo,
  areaPath, remaining, storyPoints, originalEst,
  createdDate, changedDate, parent, tags, iterationPath,
  url  // https://dev.azure.com/{org}/{project}/_workitems/edit/{id}
}
```

### 13.7 ADO State/Type Styling
| State | CSS class | Color |
|---|---|---|
| Active / In Progress | `st-active` | Green |
| New / Ready | `st-new` | Blue |
| Resolved | `st-resolved` | Purple |
| Closed / Done | `st-closed` | Gray |
| Removed | `st-removed` | Red |

| Type | CSS class | Color |
|---|---|---|
| Bug | `wi-bug` | Red |
| Task | `wi-task` | Blue |
| User Story | `wi-story` | Purple |
| Feature | `wi-feature` | Green |
| Epic | `wi-epic` | Amber |

### 13.8 ADO JavaScript Functions
| Function | Description |
|---|---|
| `toggleAdoTok()` | Show/hide ADO PAT input |
| `adoHeaders(token)` | Returns fetch headers with `Authorization: Basic btoa(':'+token)` |
| `adoFetch(url, token)` | Single authenticated GET to ADO API. Throws on error. |
| `adoConnect()` | Main entry: detects current sprint, fetches work item IDs, batch-fetches details, calls `renderAdoDash()` |
| `renderAdoDash(items, sprint)` | Builds entire `#adoDash` — sprint banner, 6 metrics, member cards, work items table |
| `filterByMember(name)` | Sets member filter dropdown and scrolls to table |
| `adoRefilter()` | Applies type/state/member/search filters, updates `ADO_FILT`, calls `adoRenderRows()` |
| `adoRenderRows()` | Renders current page of `ADO_FILT` into `#adoTbody` + pagination |
| `adoChPg(dir)` | Paginates work items table |
| `stateClass(s)` | Maps state string → CSS class name |
| `typeClass(t)` | Maps type string → CSS class name |
| `typeIcon(t)` | Returns inline SVG icon for a work item type |
| `daysLeft(endDate)` | Returns number of days until sprint ends (negative = overdue) |
| `exportAdoAll()` | Exports all `ADO_ITEMS` to Excel (3 sheets) |
| `exportAdoFiltered()` | Exports current `ADO_FILT` to Excel (3 sheets) |
| `exportAdoData(data, label)` | Helper: builds 3-sheet workbook (Work Items, By Member, Summary) |
| `exportAdoByMember()` | Exports team member summary only (1 sheet) |

### 13.9 ADO Excel Export Sheets
| Export | Sheets | Contents |
|---|---|---|
| All Work Items | Work Items, By Member, Summary | Full item list; member breakdown; sprint stats |
| Filtered View | Work Items, By Member, Summary | Same but only filtered items |
| Team Member Summary | Team Summary | Member, Total, Active, New, Resolved, Closed, SP, Remaining |

### 13.10 Sprint Banner
Shows: sprint name, date range, org/project/team, days remaining (color coded — green >3 days, amber ≤3, red = overdue), Export dropdown, Refresh button.

### 13.11 Member Cards (.mcard)
Clickable — clicking any member card sets the `#adoMemberFil` dropdown to that member and scrolls to the work items table. Shows: Active, New, Resolved, Closed counts + Story Points + Remaining Hours.

### 13.12 Topbar Badge
`#tbSprint` — shows current sprint name, hidden until ADO scan completes.

### 13.13 Tab Navigation
| Element | ID | Switches to |
|---|---|---|
| GitHub tab button | `#tab-gh` | `#panel-gh` |
| ADO Sprint tab button | `#tab-ado` | `#panel-ado` |

`switchTab(name)` function removes `.active` from all tabs/panels and adds it to the target pair.
