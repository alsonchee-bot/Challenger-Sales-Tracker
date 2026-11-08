# Murano Sell-Thru Tracker

Weekly sell-thru and stock on hand (SOH) by brand, outlet and SKU. Static site, no build step.
All files live in the repository root (no folders):

    index.html              the dashboard
    xlsx.full.min.js        Excel reader (SheetJS 0.18.5). Import does not work without it.
    weeks.json              published data: one line per brand and week
    vercel.json             headers
    README.md, .gitignore   notes

Brands in weeks.json today: PANZERGLASS, PITAKA.

## Deploy (GitHub + Vercel)

1. Put ALL of the files above in the root of your GitHub repository (main branch).
   On github.com: Add file, Upload files, select every file, Commit changes.
2. In Vercel: Add New, Project, import the repository. Framework Preset: Other.
   Leave Build Command and Output Directory empty. Deploy.

Every push to main redeploys the site.

## Check it worked

Open these in a browser; none should say "NOT_FOUND":

    https://YOUR-SITE.vercel.app/weeks.json
    https://YOUR-SITE.vercel.app/xlsx.full.min.js

The page header should read "Published data: 9 weeks, 2 brands".

## Weekly update (any brand)

1. Open the live site and import the new weekly Excel file. The brand is read from the file
   ("Brand Name" on the Information sheet) and can be corrected in the import preview.
2. In the Loaded weeks section click Download data file. It saves weeks.json with every brand and week.
3. Replace weeks.json in the repository with that file and commit.
   On github.com: open weeks.json, click the pencil, paste the new contents, Commit changes.
4. Vercel redeploys on its own, usually within a minute.

Importing a week that already exists for a brand replaces it. Visitors who import files only change
their own browser; Reset to published data returns them to what is in weeks.json.

## Notes

- Sell-thru rate = units sold / (units sold + on hand). Weeks of cover = on hand / average weekly
  sell-thru over the last four weeks.
- The data is public to anyone with the site URL. For private access use Vercel Deployment Protection
  (password or SSO, on paid plans), and keep the GitHub repository private.

## Weekly auto-import (Google Drive → Supabase)

`api/sync.js` runs daily from a Vercel cron (see `vercel.json`). It reads Excel files modified in the last 14 days from a Google Drive folder, parses them with the same logic as the site (`api/_parse.js`), and saves Mazer, Panzerglass, Pitaka and Sudio weeks to Supabase. Re-running is safe: saving a week replaces it.

Vercel environment variables:

| Name | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the service account key file (raw JSON or base64) |
| `DRIVE_FOLDER_ID` | ID of the "Challenger SOH 2026" folder (shared with the service account as Viewer) |
| `CRON_SECRET` | any long random string (Vercel sends it with cron calls) |
| `SYNC_BRANDS` | optional, default `MAZER,PANZERGLASS,PITAKA,SUDIO` |
| `SYNC_DAYS` | optional, default `14` |

Check without saving: `/api/sync?dry=1` (send header `Authorization: Bearer <CRON_SECRET>`).
