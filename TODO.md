# TODO

## Waiting on Laurel

- [ ] **Own photos of San Jose and Iling Island.** Make a "Better San Jose" album in Photos with scenery shots. Avoid recognizable people unless they've agreed. Then export it (AppleScript), compress the photos, and add them to `/visit` and a gallery, credited to the photographer.
- [ ] **Domain.** `betterlgu.org` subdomain vs `bettersanjoseoccmdo.org`. Waiting on the BetterGov Discord discussion.

## Data

- [ ] **Barangay officials (2023–2028).** 20 of 39 punong barangay are done, sourced from LGU news posts. Still missing: 19 captains, plus all kagawad, SK chairs, secretaries and treasurers. Candidates still to check: Pag-asa (Hermenegildo P. Bleza) and Ipil (Ronnie B. Encarguez Jr.), both seen only in barangaydirectory.com search snippets; and PBs Edgardo G. Gamboa, Abelardo C. Sunga and Junjie Tria, whose barangays aren't stated.
- [ ] **Officials' photos.** Official portraits are on the LGU and MIO Facebook pages. Government works have no copyright (RA 8293 §176), but the photos have to be fetched by someone logged in, or provided by the MIO.
- [ ] **IPMR.** The indigenous peoples' mandatory representative on the SB isn't listed yet.
- [ ] **Mine the official site, sanjoseoccimindoro.gov.ph.** It has the Citizen's Charter, ordinances, the 2025/2026 annual budgets, department offices, contact details, and a history for each barangay.

- [ ] Local hotlines: MDRRMO, PNP, BFP, hospital, OMECO.
- [ ] Services pages: replace the template's generic text with San Jose's Citizen's Charter.
- [ ] Budget: link FDP and COA documents. Verify the 2024 figures.
- [ ] Ambulong Island and salt farm photos. Wikimedia rate-limited the download.

## Tech

- [ ] Review `/contribute` submissions regularly: `scripts/review.py list`. Run `purge --yes` monthly.
- [ ] Optional: notify on new submissions (an email via SES, or the BetterGov Discord webhook once the mods issue one).

- [ ] Cut the first-load bundle (about 345 KB gzip). Replace `import * as LucideIcons` with named imports.
- [ ] Point the footer "Community Discord" link at https://discord.gg/bettergovph.
- [ ] Custom domain: Route 53 zone, ACM certificate (us-east-1), CloudFront alias. Then flip the directory row to 🟢 Active.
