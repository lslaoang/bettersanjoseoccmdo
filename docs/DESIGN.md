# Better San Jose (Occidental Mindoro): System Design

Status: MVP scaffolded in `app/`, 2026-11-21
Guide followed: https://lgu.bettergov.ph/guide (plus `/templates` and `/contributing`)

## 0. Where things stand

- **The slot is open.** The directory at github.com/jmacj/better-lgu-directory has no entry for San Jose, Occidental Mindoro.
  Nearby portals already exist: Calapan City (bettercalapan.org) and Oriental Mindoro Province.
- **Name clash.** `bettersanjose` is already used by San Jose, Antique, which has a WIP repo by that name.
  San Jose City (Nueva Ecija) and San Jose del Monte (Bulacan) are also listed.
  So the repo and domain need to say Occidental Mindoro.
- **No usable official site.** `sanjoseoccmdo.gov.ph` and `sanjoseoccidentalmindoro.gov.ph` did not resolve on 2026-11-21.
  Wikipedia cites `sanjoseoccidentalmindoro.com`, which returned nothing.
  The data will have to come mostly from FDP, COA, DBM and the LGU's Facebook page, plus in-person requests.

## 1. Requirements

### Functional (the guide's five data categories, plus what a resident actually looks for)

| #   | Feature                                                                                                 | Source of truth                         |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| F1  | Officials: mayor, vice mayor, SB members, department heads, contacts                                    | LGU FB page, COMELEC 2025 results       |
| F2  | Budget: annual budget, actual spending, SRE, COA findings, with charts                                  | FDP portal, COA audit reports, DBM      |
| F3  | Projects: infrastructure and social programs, with status, cost and barangay                            | FDP bid results, PhilGEPS, LGU posts    |
| F4  | Ordinances and resolutions, searchable                                                                  | Sangguniang Bayan office                |
| F5  | Directory: offices, hotlines, emergency numbers (MDRRMO, PNP, BFP, hospital, OMECO)                     | LGU, agencies                           |
| F6  | Services ("Paano kumuha ng…"): business permit, cedula, civil registry, etc. Requirements, fees, office | Citizen's Charter (required under ARTA) |
| F7  | 39 barangay pages: captain, hall location, population, projects in the barangay                         | PSA PSGC, DILG                          |
| F8  | About: facts, map, how to get there (airport, Caminawit Port)                                           | PSA, Wikipedia                          |
| F9  | (Phase 2) Citizen feedback form → BetterGov Discord webhook                                             | —                                       |

### Non-functional

- **Audience:** about 143k–153k residents, mostly on phones, often on prepaid mobile data outside the Poblacion.
  Pages should be under 200 KB of JS on first load and readable on 3G.
- **Languages:** Tagalog first, English second. Labels in both, data in its original language.
- **Trust:** every number and record shows its **source link** and **as-of date**. This is the product.
  A portal with unsourced figures is worse than no portal.
- **Accessibility:** WCAG 2.1 AA. Semantic HTML, contrast, works without JS for reading.
- **Cost:** about ₱0/month hosting plus about ₱600–900/year for the domain.
- **Maintainability:** non-developers edit data (JSON or a spreadsheet) through GitHub PRs. No server, no database, no admin panel.
- **Availability:** a static CDN is good enough, so there's no SLO to engineer.

### Constraints

- Volunteer team of 1–3 people, so anything stateful is a liability.
- A guide-listed template is preferred: React + TypeScript (BetterSolano, BetterLB, betterlocalgov).
- Independent of the LGU. No permission is needed, but contact the MIO/PIO early for data.

## 2. High-level design

```
 ┌─────────────── data sources (manual, quarterly) ───────────────┐
 │ FDP portal · COA reports · DBM · LGU FB · SB office · PSA PSGC │
 └───────────────────────────────┬────────────────────────────────┘
                                 │ volunteer transcribes → PR
                                 ▼
 ┌──────────── GitHub repo: better-sanjose-occmdo ─────────────────┐
 │ data/*.json   (one file per entity, each record sourced)        │
 │ data/docs/    (mirrored PDFs, in case originals vanish)         │
 │ src/          (template app: React + TS + Vite)                 │
 │ CI: schema-validate data → build → link-check                   │
 └───────────────────────────────┬─────────────────────────────────┘
                                 │ push to main
                                 ▼
             Static host (Cloudflare Pages or GitHub Pages)
                                 │
                       bettersanjoseoccmdo.org
                                 │
                       residents (mobile, low bandwidth)

 Phase 2:  form ──► Cloudflare Worker (Turnstile + rate limit) ──► Discord webhook
```

There is no backend. The JSON files are the database, git is the audit log, and PR review is the moderation step.

## 3. Deep dive

### 3.1 Data model (`data/`)

Every record carries the same provenance fields:

```ts
type Sourced = {
  source: string; // URL, or "SB Office, request dated 2026-11-10"
  as_of: string; // ISO date the figure was true
  verified_by?: string; // GitHub handle
};
```

| File                 | Shape (key fields)                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `officials.json`     | `{ name, position, term: "2025-2028", committee?, contact?, photo? } & Sourced`                                     |
| `barangays.json`     | `{ psgc, name, captain, population_2024?, hall_location?: [lat,lng] } & Sourced`, 39 rows, PSGC 175110001–175110040 |
| `offices.json`       | `{ id, name, head, phone[], email?, location, hours } & Sourced`                                                    |
| `hotlines.json`      | `{ agency, numbers[], category: "emergency"\|"utility"\|"office" } & Sourced`                                       |
| `services.json`      | `{ slug, title_tl, title_en, office_id, requirements[], fees[], steps[], processing_time } & Sourced`               |
| `budget/<year>.json` | `{ year, total_appropriation, by_sector: {name, amount}[], actual?: {...}, documents[] } & Sourced`                 |
| `projects.json`      | `{ id, title, category, barangay_psgc?, amount, contractor?, status, start?, end?, documents[] } & Sourced`         |
| `ordinances.json`    | `{ number, year, title, summary?, date_approved, pdf? } & Sourced`                                                  |

Rules:

- Amounts are stored as integers in **centavos** (no float drift).
  For example, ₱802.2 million is stored as `80220000000`.
- Barangays are keyed by PSGC code, not by name. Names like "Labangan Poblacion" and "Barangay 1 (Poblacion)" are easy to typo.
- A schema file per entity (zod or JSON Schema) is checked in CI. A PR with a missing `source` or `as_of` fails the build.

### 3.2 Pages

```
/                      quick tasks: hotlines, services, budget at a glance
/opisyal               officials
/budget, /budget/2025  sector chart, year-over-year, source PDFs
/proyekto              filter by barangay, status, year
/ordinansa             client-side search (data is small, no search server)
/serbisyo/:slug        Citizen's Charter entries
/barangay/:psgc        39 pages
/tungkol               about, map, getting here
/ambag                 how to contribute or report wrong data
```

Every page shows its as-of date and links its sources.
The budget, projects and ordinances pages also offer the raw JSON for download, as open data.

### 3.3 Build and caching

- Vite static build (or prerender) so content is in the HTML. That gives SEO and works with no JS.
- Assets are hashed and served with `Cache-Control: immutable`. HTML gets a short TTL. This is the host's default, so nothing custom is needed.
- Charts: one small lib, lazy-loaded only on `/budget`.

### 3.4 Feedback intake (phase 2)

Per the guide, intake must be protected against bots before Discord grants a webhook:

- Cloudflare Worker endpoint.
- Turnstile token verified server-side, plus a per-IP rate limit (for example 5 per hour).
- The webhook URL is kept as a Worker secret, never in the frontend bundle.
- No PII is stored: forward and forget.

### 3.5 Errors and failure modes

| Failure                                      | Handling                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Source PDF link rots (common with LGU sites) | Mirror to `data/docs/`. Link to both the original and the mirror.                               |
| Stale data                                   | CI warns when any `as_of` is older than 6 months. The page shows an "outdated" badge.           |
| Wrong data reported                          | `/ambag` links a GitHub issue template plus a Messenger link for non-GitHub users.              |
| Maintainer disappears                        | Directory "⚠ Stale / Open for Adoption" process. Data lives in plain JSON, so adoption is easy. |

## 4. Scale and reliability

- **Load:** even if 10% of residents visit monthly, that's about 15k visits, or about 0.01 req/s average. A static CDN won't notice it.
- **Spikes:** typhoon or disaster days drive traffic to `/hotlines`.
  Keep that page tiny and inline the hotline list into the home page HTML.
- **Repo size:** PDFs could reach hundreds of MB over the years. Use Git LFS or a separate `docs` repo once the repo passes about 500 MB.
- **Monitoring:** a free uptime check (UptimeRobot) plus the scheduled CI staleness and link-check job. Nothing more.

## 5. Trade-offs

| Decision   | Chosen                                                                     | Rejected                               | Why                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Template   | **betterlocalgov** (React 19 + Vite + TS + Tailwind, BetterGov `kapwa` UI) | BetterSolano, BetterLB, Calapan's repo | Guide-listed and generic. BetterSolano turned out to be hand-written Solano HTML pages, and BetterLB's repo is about 850 MB. Calapan's portal is still a good reference for Mindoro-specific content. |
| Data store | JSON in git                                                                | Headless CMS, Google Sheets, DB        | Free, versioned, reviewable, and survives the maintainer leaving. Cost: editors must learn GitHub PRs. A Sheets → JSON import script can come later.                                                  |
| Hosting    | Cloudflare Pages                                                           | Vercel, GH Pages, AWS                  | Free, fast in PH, and the same account hosts the phase 2 Worker and Turnstile. GH Pages is fine if phase 2 never ships.                                                                               |
| Domain     | `bettersanjoseoccmdo.org`                                                  | `bettersanjose.org`, `bettersjom.org`  | Avoids the collision with San Jose, Antique and stays recognizable. Your call (§7).                                                                                                                   |
| Language   | Tagalog-first UI                                                           | English-first                          | Matches how residents search and talk.                                                                                                                                                                |
| Search     | Client-side filter                                                         | Algolia, Pagefind                      | There are only hundreds of ordinances. Move to Pagefind if that grows past a few thousand.                                                                                                            |

## 6. Rollout (from the guide's steps)

1. PR to `better-lgu-directory`, adding this row to `README.md` in A–Z order, next to the other San Jose rows:
   `| San Jose, Occidental Mindoro | - | [GitHub](…) | - | 🔵 Planned | [@handle](…) |`
   PR title: `Add San Jose, Occidental Mindoro to directory`.
2. Fork the template and rename the repo. Make it public.
3. **MVP (2–3 weekends):** hotlines, officials, 39 barangays, services (top 5), and the latest year's budget.
   These are the highest value and the easiest data.
4. Register the domain, deploy, and flip the directory row to 🟢 Active.
5. Then: projects, ordinances, budget history.
   Optionally add a `budget.` subdomain row in `BUDGET.md`, then the phase 2 feedback form.
6. Every quarter: a data review session, recorded as a GitHub issue checklist.

## 7. Open questions

- **Domain name and who registers it.** Who owns the renewal matters for continuity.
- **Maintainer handle(s)** for the directory row, and whether there's a local co-maintainer in San Jose.
- **Mayor and vice mayor.** Wikipedia lists Rey Ladaga and Santiago "Sonny" Javier, but the term isn't stated. Verify against COMELEC 2025 results before publishing.
- **Population.** Wikipedia gives 153,267 (2020) and 143,495 (2024). The drop is suspicious, so check it against the PSA release.

## 8. Revisit as it grows

- More than one active data editor who isn't on GitHub → add a Sheets/CSV import or Decap CMS.
- PDFs over 500 MB → move them to LFS or a separate repo.
- Feedback volume beyond what Discord can triage → a real ticket store (and only then a backend).
- If the LGU ever publishes structured data or an API → ingest it in CI instead of transcribing by hand.
