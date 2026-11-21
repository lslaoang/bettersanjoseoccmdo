# Better San Jose (Occidental Mindoro)

A community-run portal for the Municipality of San Jose, Occidental Mindoro. It is volunteer-built and **not** the official LGU website.
It is part of the [Better LGU](https://lgu.bettergov.ph) movement and was started from the [betterlocalgov](https://github.com/iyanski/betterlocalgov) template.

Every figure on the site shows where it came from and when. Anything unconfirmed carries a "Needs verification" badge.

## Run it

```bash
npm install
npm run dev
```

`npm run build` runs the data check first (`npm run check-data`).

## Editing data

Everything lives in [`data/`](data/) as JSON:

| File             | What                                             |
| ---------------- | ------------------------------------------------ |
| `hotlines.json`  | Emergency and office numbers                     |
| `officials.json` | Elected officials                                |
| `barangays.json` | All 39 barangays with PSGC codes                 |
| `budget.json`    | Yearly revenue, expenditure, assets, liabilities |

Each file has a file-level `source` and `as_of`. Any item can override them with its own.
The rules the build enforces:

- **Provenance.** Every item needs a `source` (a URL or a document citation) and an `as_of` date (`YYYY-MM-DD`).
- **Unconfirmed data.** Set `"needs_verification": true` when a figure isn't confirmed against an official record.
- **Money.** Amounts are integers in **centavos** (`₱802.2M` → `80220000000`).
- **Barangays** are keyed by their 10-digit PSGC code.

Spotted wrong data? Open an issue with the correct value and a source.

## Crowdsourced submissions

`/contribute` lets anyone send information about San Jose or a barangay, with up to 5 photos or PDFs. Nothing is published automatically.

- **Backend:** [`api/submit.py`](api/submit.py) is a Lambda behind API Gateway, reached through CloudFront at `/api/*`. Submissions go to DynamoDB `bettersanjose-submissions`. Files upload straight to the private S3 bucket `bettersanjose-submissions-<account>` through presigned POST forms, which cap them at 10 MB and allow only images and PDFs. A honeypot field and a 5-per-hour limit per visitor IP stop spam. Only a hash of the IP is stored.
- **Setup or update:** `AWS_PROFILE=<profile> ./api/infra.sh`. It's safe to re-run.
- **Review:** `scripts/review.py list`, then `show <id>` (downloads the files to `submissions/`, which is gitignored), then `approve` or `reject`. To publish, edit `data/*.json`, use the submission id as the source, and deploy.
- **Privacy promise:** run `scripts/review.py purge --yes` now and then. It deletes unpublished submissions older than 12 months.

## Hosting

The site is a static build on AWS. It's served from a private S3 bucket through CloudFront, using Origin Access Control.

- **Live URL:** https://djy3esom4bpw1.cloudfront.net (no custom domain yet)
- **Deploy:** `AWS_PROFILE=<profile> ./deploy.sh`. It builds, syncs to S3 and invalidates CloudFront.
- **SPA routing:** CloudFront serves `/index.html` with a 200 for any 403 or 404 from S3, so `/budget` and other client routes load directly.
- **Caching:** hashed `assets/` files are cached for a year. Everything else is `no-cache`.

## Docs

- [docs/DESIGN.md](docs/DESIGN.md): system design, data model, roadmap
- [docs/TEMPLATE-README.md](docs/TEMPLATE-README.md): the original template's README

## License

CC0 1.0, inherited from the template.
