# Waterfront AppFolio → Google Sheets → Framer Pipeline

## What This Does

Scrapes property listings from AppFolio every 10 minutes, pushes them to a Google Sheet, and displays them as a live table on the Framer website.

**Flow:** AppFolio → GitHub Actions (scraper) → Google Sheets → Framer (Custom Code component)

---

## Setup Steps

### 1. Create the Google Sheet

1. Go to Google Sheets and create a new spreadsheet
2. Rename the first tab to **"Listings"**
3. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`)
   - Example: `https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit`
4. **Publish the sheet:** File → Share → Publish to web → Entire Document → CSV → Publish
   - This lets the Framer component read it without authentication

### 2. Create a Google Cloud Service Account

This lets the scraper WRITE to the sheet. The published CSV is for reading (Framer).

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**: APIs & Services → Enable APIs → search "Google Sheets API" → Enable
4. Create a service account: APIs & Services → Credentials → Create Credentials → Service Account
   - Name: `appfolio-scraper`
   - Skip optional steps → Done
5. Create a key: Click the service account → Keys tab → Add Key → Create New Key → JSON → Download
6. Share your Google Sheet with the service account email (looks like `appfolio-scraper@your-project.iam.gserviceaccount.com`) — give **Editor** access

### 3. Create the GitHub Repository

1. Create a new private repo on GitHub
2. Push all files from this folder to it:
   ```
   git init
   git add .
   git commit -m "Initial commit: AppFolio scraper"
   git remote add origin https://github.com/YOUR_USERNAME/waterfront-scraper.git
   git push -u origin main
   ```

### 4. Add GitHub Secrets

Go to your repo → Settings → Secrets and Variables → Actions → New repository secret:

- **`GOOGLE_SHEET_ID`**: The Sheet ID from step 1
- **`GOOGLE_SERVICE_ACCOUNT_KEY`**: The entire contents of the JSON key file from step 2 (paste the whole JSON)

### 5. Test the Scraper

Before relying on the schedule, run it manually:

1. Go to Actions tab in your GitHub repo
2. Click "Scrape AppFolio Listings" workflow
3. Click "Run workflow" → Run
4. Watch the logs. If it works, your Google Sheet should populate with listings.

**If no listings are found:** The selectors probably need adjusting.

1. Run `node inspect.js` locally (after `npm install`)
2. Open `output.html` in your browser
3. Right-click a listing → Inspect Element
4. Find the CSS class names for the listing cards, address, rent, etc.
5. Update the selectors in `scrape.js`

### 6. Add to Framer

1. Open your Framer project
2. Add a **Custom Code** component where you want the availability table
3. Open `framer-embed.html` and copy everything
4. Paste into the Custom Code component's HTML field
5. Replace `YOUR_SHEET_ID` with your actual Google Sheet ID
6. Preview — you should see the listings table

### 7. Customize the Table Styling

The CSS in `framer-embed.html` is intentionally neutral. Update it to match Waterfront's brand:

- Change fonts, colors, spacing in the `<style>` block
- Adjust which columns show by editing the `DISPLAY_COLS` array
- Mobile layout automatically stacks into cards

---

## File Overview

| File | Purpose |
|------|---------|
| `scrape.js` | Main scraper — fetches AppFolio, writes to Google Sheets |
| `inspect.js` | Debug tool — dumps raw HTML so you can find CSS selectors |
| `framer-embed.html` | Copy-paste into Framer Custom Code component |
| `.github/workflows/scrape.yml` | GitHub Actions cron job (every 10 min) |
| `package.json` | Node.js dependencies |

---

## Troubleshooting

**Scraper finds 0 listings:** AppFolio's HTML structure doesn't match the selectors. Run `inspect.js`, find the right class names, update `scrape.js`.

**Google Sheets auth fails:** Make sure the service account email has Editor access to the sheet, and the JSON key is pasted correctly in GitHub Secrets.

**Framer table is empty:** Check that the sheet is published to web (File → Share → Publish to web). Also verify the Sheet ID in the embed code matches.

**GitHub Actions not running:** Free tier has a limit of 2,000 minutes/month. Every 10 minutes = ~4,320 runs/month at ~30 seconds each = ~2,160 minutes. You may need to reduce frequency to every 15 minutes (`*/15 * * * *`) to stay under the free tier.

---

## Cost

- **GitHub Actions free tier:** 2,000 min/month (run every 15 min to be safe)
- **Google Cloud:** Free (Sheets API has generous limits)
- **Google Sheets:** Free
- **Total: $0/month**
