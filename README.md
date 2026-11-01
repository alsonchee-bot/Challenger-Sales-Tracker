# Murano Sell-Thru Tracker

Weekly sell-thru and stock on hand (SOH) by brand, outlet and SKU. Static site, no build step.

    index.html                 the dashboard
    vendor/xlsx.full.min.js    Excel reader (SheetJS 0.18.5), served from this repo
    data/weeks.json            published data: one line per brand and week
    vercel.json                headers

Brands in data/weeks.json today: PANZERGLASS, PITAKA.

## Deploy (GitHub + Vercel)

1. Create a GitHub repository and push these files to the root (main branch).
2. In Vercel: Add New, Project, import the repository.
3. Framework Preset: Other. Leave Build Command and Output Directory empty. Deploy.

Every push to main redeploys the site.

## Weekly update (any brand)

1. Open the live site and import the new weekly Excel file. The brand is read from the file
   ("Brand Name" on the Information sheet) and can be corrected in the import preview.
2. In the Loaded weeks section click Download data file. It saves weeks.json with every brand and week.
3. Replace data/weeks.json in the repository with that file and commit.
   On github.com: open data/weeks.json, click the pencil, paste the new contents, Commit changes.
4. Vercel redeploys on its own, usually within a minute.

Importing a week that already exists for a brand replaces it. Visitors who import files only change
their own browser; Reset to published data returns them to what is in data/weeks.json.

## Notes

- Sell-thru rate = units sold / (units sold + on hand). Weeks of cover = on hand / average weekly
  sell-thru over the last four weeks.
- The data is public to anyone with the site URL. For private access use Vercel Deployment Protection
  (password or SSO, on paid plans), and keep the GitHub repository private.
