# NodeMG Studio — Social Analytics Dashboard

Turn your Google Sheet (daily data for YouTube, Instagram, and Facebook) into a YouTube Studio-style dashboard.

## What you get

| Section | What it shows |
|---|---|
| **Dashboard** | Total views, platform-wise views, engagement, day-over-day comparison, trend charts, KPI cards |
| **Content** | Full table of videos — search, filter, sort; click any row for complete details |
| **YouTube / Instagram / Facebook** | Platform-specific metrics (Stayed, AVD, Non-subs, Replay, Non-followers, Saves, Shares…) |
| **Comments** | Comments from all three platforms and the comment rate per 1000 views |
| **Insights & Actions** | Items from the sheet’s “Fix for next video” section become to-do cards with checkboxes |
| **Script Pipeline** | “Pending” scripts (with doc links) and published videos |

**View different days:** the top of the screen includes a day strip with one button per date.

## Folder structure

```
index.html          Dashboard page
profile.jpg         ← Add your profile photo
youtube.jpg         ← Add the YouTube logo
instagram.jpg       ← Add the Instagram logo
facebook.jpg        ← Add the Facebook logo
css/style.css       Styling
js/config.js        Name, language, and image settings
js/vault.js         Private settings protected by a password (Apps Script URL, etc.)
js/gate.js          Password lock screen
tools/vault-tool.html  Tool to create/update vault.js in the browser
tools/make-vault.js    Same task via Node
js/parser.js        Converts sheet text into analytics data
js/app.js           Dashboard logic
js/i18n.js          Hindi/English text
apps-script/Code.gs Google Sheets data provider
```

The dashboard still works without images — if no image is available, a letter-based icon is shown instead.

## Setup (10 minutes)

### 1. Connect your Google Sheet to the dashboard
1. Open your sheet → **Extensions → Apps Script**
2. Paste the full contents of `apps-script/Code.gs` there. Set `SHEET_NAME` to your tab name (for example, `Sheet1`).
3. Choose **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
4. Copy the generated URL (`https://script.google.com/macros/s/.../exec`)
5. Open `tools/vault-tool.html` in a browser → set the password, choose Data source = `appsscript`, and enter your Apps Script URL
6. Open the page and enter the password. If **"Live from Google Sheet"** appears under the sidebar, the connection is working

> If you change the Apps Script code: **Deploy → Manage deployments → ✏️ → New version → Deploy**.

**Alternative without Apps Script:** In the sheet, choose *File → Share → Publish to web → CSV* and copy the link; then use that link in the vault tool.

### 2. Run it / publish it online
- **On your computer:** run `python3 -m http.server 8000` in the project folder and open `http://localhost:8000` (or open `index.html` directly)
- **GitHub Pages:** push the repository → *Settings → Pages → Deploy from a branch → main / root*. The same approach works on Netlify or Cloudflare Pages.

Add a new row to the sheet each day — the page reloads or the refresh button loads the latest data.

## Sheet format (what the dashboard understands)

Columns are detected by their names (keep the names as they are; columns can move left or right).

| Column | Example format |
|---|---|
| Date | `2026-10-19` or `19/10/2026` |
| Video / Script Title | `Script 03: Name (tag)` or `Name (Script 02 - tag)` — `Script NN` and the final `( )` are automatically turned into a badge/tag |
| Video / Doc Link | YouTube link → thumbnail + “Open video”; Google Doc link → “Open script” |
| YouTube Views / Engaged Views / Likes | Numbers only |
| YouTube Stayed to Watch % & AVD | `50.7% Stayed • 0:17 / 0:44 AVD (97.5% Non-Subs • 17.3% TV)` |
| Instagram Views | Number |
| Instagram Unique Viewers & Replay | `135 Viewers (8.88x Replay • 91.9% Non-Followers)` |
| Instagram Reactions | `7 Likes / 0 Saves / 0 Shares` |
| Facebook Views / Reactions | `1037` / `6 Reactions` |
| Total Views | Number (if blank, it is auto-calculated from all three platforms) |
| Top Comments | `0 Comments across YT / IG / FB` or actual comments like `YT: Great tip \| IG: 🔥 \| FB: Thanks` |
| Key Insights & Action for Next Script | `...analysis... Fix for next video: first; second; third` — each section separated by `;` becomes a checklist item |

**If a script has not been published yet:** type `Pending` in the metrics columns; it appears in the “Pending” section.

`N/A` or blank cells are accepted — they display as `—`.

## Password lock — how it works

When the page loads, only the profile, name, and password box are visible. After entering the correct password, the dashboard unlocks.

- The password is not stored anywhere in the code, neither in plain text nor as a hash. Viewing source or using Inspect won’t reveal it.
- Private settings (Apps Script URL, key, demo data) are stored in `js/vault.js` and encrypted using **AES-256-GCM**.
- After 3 failed attempts, a short delay is triggered.
- **To change the password:** create a new `vault.js` with a new password using the vault tool, then replace the old file.
- **Important limitation:** this is a static website, not a server. Therefore, anyone who can access the file can inspect `vault.js` in the browser.
- After entering the correct password, the Apps Script URL appears in the browser’s Network tab (this is visible to the same person using the browser).
- You entered the password in this chat; if this chat is visible to others, the password may be exposed.

## Important notes

- **Apps Script access:** the script is published with “Anyone”, so anyone with the URL can read your sheet data.
- **Internet is required:** fonts and chart libraries (Chart.js) are loaded from a CDN.
- **Image thumbnails:** when a YouTube link is used, thumbnails come from `i.ytimg.com`.
- **Checked action items** are saved only in the current browser (not written back to the sheet).
- If the sheet cannot be found, the dashboard shows the last saved copy and a warning at the top.

