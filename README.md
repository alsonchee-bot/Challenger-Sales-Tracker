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

## SKU stats

Data menu, SKU stats. One row per SKU across every loaded week and all outlets (the brand buttons still
apply; the week and outlet filters do not). Use the search box to find SKUs by description, item ID or
brand, tick the ones you want, then Export selected. In the export dialog choose which stats to include,
and optionally add a Weekly detail sheet (SKU x week) and an Outlet detail sheet (SKU x outlet).
Click an item name to see its weekly and outlet breakdown. Everything is calculated in the browser from the
same data as the other views, so no database change is needed.

Stats: weeks of data, first and latest week, on hand / sold / sell-thru rate / weeks of cover for the latest
week, total, average and peak weekly sold, peak week, weeks with no sales, average weekly on hand, and
outlets in stock / at 0 / listed in the latest week. "Latest week" is each SKU's own last week of data.

## Users and sign-in

Sign-in uses Supabase Auth (`auth.users`, passwords stored as bcrypt hashes). Usernames map to `<username>@sellthru.example.com`. `public.profiles` links each auth user to a username, display name, role (`admin` / `user`) and a `must_change_password` flag. Only admins can add users, reset passwords or remove users (RPC functions `admin_*`). Self sign-up is blocked by a trigger on `auth.users`. All sell-thru data is readable and writable only by signed-in users.
