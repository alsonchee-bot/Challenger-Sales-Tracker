# PanzerGlass Sell-Thru Tracker

Static site. No build step, no dependencies.

    index.html        the dashboard (Excel reader included, works offline)
    data/weeks.json   the weeks everyone sees when they open the site
    vercel.json       headers and clean URLs

## Deploy

Vercel dashboard: Add New, Project, import this folder (or its Git repo). Framework preset: Other.
Leave Build Command and Output Directory empty.

CLI:

    npm i -g vercel
    vercel --prod

## Weekly update

1. Open the live site and import the new weekly Excel file.
2. In "Loaded weeks" click Download data file. This saves weeks.json with every loaded week.
3. Replace data/weeks.json with that file and redeploy (git push, or `vercel --prod`).

Visitors who import files only change their own browser. Their changes are kept locally;
"Reset to published data" returns them to what is in weeks.json.

## Notes

- The data is public to anyone with the URL. For private access use Vercel Deployment Protection
  (password or SSO, on paid plans).
- The data file is read with a no-cache request, so a redeploy shows new weeks right away.
