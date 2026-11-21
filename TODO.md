# TODO

## Waiting on Laurel

- [ ] **Own photos of San Jose and Iling Island.** Make a "Better San Jose" album in Photos with scenery shots. Avoid recognizable people unless they've agreed. Then export it (AppleScript), compress the photos, and add them to `/visit` and a gallery, credited to the photographer.
- [ ] **Domain.** `betterlgu.org` subdomain vs `bettersanjoseoccmdo.org`. Waiting on the BetterGov Discord discussion.

## Data

- [ ] **Barangay officials (2023–2028).** The punong barangay, 7 kagawad, SK chair, secretary and treasurer for each of the 39 barangays. No reachable public list: barangaydirectory.com is down, and the LGU posts on Facebook. Ask the MIO/DILG San Jose, or the Liga ng mga Barangay.
- [ ] **Officials' photos.** Official portraits are on the LGU and MIO Facebook pages. Government works have no copyright (RA 8293 §176), but the photos have to be fetched by someone logged in, or provided by the MIO.
- [ ] **Confirm the 2025 results against the official Comelec canvass.** The current list is Rappler's unofficial 100% tally. Add the ex-officio SB members: ABC president, SK Federation president, IPMR.

- [ ] Local hotlines: MDRRMO, PNP, BFP, hospital, OMECO.
- [ ] Services pages: replace the template's generic text with San Jose's Citizen's Charter.
- [ ] Budget: link FDP and COA documents. Verify the 2024 figures.
- [ ] Ambulong Island and salt farm photos. Wikimedia rate-limited the download.

## Tech

- [ ] Cut the first-load bundle (about 345 KB gzip). Replace `import * as LucideIcons` with named imports.
- [ ] Point the footer "Community Discord" link at https://discord.gg/bettergovph.
- [ ] Custom domain: Route 53 zone, ACM certificate (us-east-1), CloudFront alias. Then flip the directory row to 🟢 Active.
