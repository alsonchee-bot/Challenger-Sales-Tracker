# Weekly auto-import: one-time setup (about 10 minutes, on a computer)

Use the Google account that can open the Drive folder (alson.chee@murano.com.sg). Nothing here costs money.

## 1. Create a login for the script (in the tracker)
1. Open https://challenger-sales-tracker.vercel.app/ and sign in as `alson`.
2. Tap **Users** and add a user: username `importer`, display name `Importer`, role **User**, and a password of your choice (8+ characters, not used anywhere else). Remember it for step 5.

## 2. Create the script
1. Go to https://script.google.com and click **New project**. Rename it "Sell-thru weekly import".
2. Delete the sample code, then paste in the whole contents of `Code.gs`. Click **Save**.

## 3. Turn on the Drive service
Left menu, next to **Services**, click **+**, choose **Drive API** (version v3), click **Add**.

## 4. Set the time zone
**Project Settings** (gear icon) -> **Time zone** -> choose **(GMT+08:00) Singapore** -> Save.

## 5. Store the importer password
**Project Settings** -> **Script properties** -> **Add script property**:
- Property: `IMPORTER_PASSWORD`
- Value: the password from step 1

## 6. Test without saving anything
1. In the editor, pick `dryRun` in the function dropdown and click **Run**.
2. Google asks for permission: **Review permissions** -> choose your account -> **Advanced** -> **Go to Sell-thru weekly import (unsafe)** -> **Allow**. (The warning appears because you wrote the script yourself.)
3. Open **Execution log**. It lists the weeks it would import (Mazer, Panzerglass, Pitaka, Sudio) and anything skipped.

## 7. Import now, then schedule
1. Run `importWeekly` once. You get an email summary and the tracker updates.
2. Run `installTrigger`. From now on it runs every Monday between 11:00 and 12:00 Singapore time, and emails you the result.

## Notes
- Only files changed in the last 8 days are read; templates and other brands (Laut, N.Brandz, Zagg, Saramonic) are skipped.
- To change brands, edit `BRANDS` at the top of the script.
- If Monday's files arrive after the run, run `importWeekly` by hand or wait for next Monday.
- To stop it: in the script, click the clock icon (Triggers) and delete the trigger.
