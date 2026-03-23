# Waterfront Management — AppFolio Scraper

Scrapes property listings from AppFolio and displays them on your Framer website.

## How it works

1. **GitHub Actions** runs `scrape.js` every 15 minutes
2. Scraper fetches listings from AppFolio, writes `listings.csv`
3. GitHub Actions commits the updated CSV back to the repo
4. Framer embed reads the CSV from the raw GitHub URL and renders a table

**No Google Cloud. No API keys. No service accounts. Zero cost.**

## Setup

### 1. Make the repo public
The Framer embed fetches the CSV from `raw.githubusercontent.com`, which requires the repo to be public. Go to Settings → Danger Zone → Change visibility → Public.

If you need it private, use GitHub Pages to serve the CSV instead.

### 2. Test the scraper locally
```bash
npm install
node inspect.js    # Check what AppFolio HTML looks like
node scrape.js     # Run the scraper — creates listings.csv
```

### 3. Tune selectors (if needed)
Run `node inspect.js` to dump the AppFolio page HTML. If listings aren't being picked up, adjust the CSS selectors in `scrape.js` to match AppFolio's actual HTML structure.

### 4. Add the Framer embed
Copy the contents of `framer-embed.html` into a Custom Code component in your Framer project. The CSV URL is already set to this repo.

### 5. Verify GitHub Actions
Go to the repo → Actions tab. You should see "Scrape AppFolio Listings" running on schedule. Click "Run workflow" to trigger it manually.

## Files

| File | What it does |
|------|-------------|
| `scrape.js` | Fetches AppFolio listings, writes `listings.csv` |
| `inspect.js` | Debug tool — dumps raw AppFolio HTML for selector tuning |
| `framer-embed.html` | Copy into Framer Custom Code component |
| `listings.csv` | Auto-generated — the scraper output |
| `.github/workflows/scrape.yml` | GitHub Actions cron job |

## Cost

$0/month. GitHub Actions free tier gives 2,000 minutes/month. At every 15 minutes, this uses ~1,440 runs × ~0.5 min = ~720 minutes/month.

## Troubleshooting

- **No listings found**: Run `node inspect.js` and check the HTML structure. AppFolio may have changed their markup.
- **GitHub Action failing**: Check the Actions tab for error logs. Most common issue is selector mismatch.
- **Framer not showing data**: Make sure the repo is public and `listings.csv` exists. Check the browser console for CORS errors.
- **Stale data**: GitHub raw URLs cache for ~5 minutes. The embed includes a cache-buster parameter.

## Handoff

To transfer this to the client:
1. Settings → Danger Zone → Transfer repository → enter their GitHub username
2. They accept the transfer
3. Done — GitHub Actions keeps running under their account
