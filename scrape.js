/**
 * Waterfront Management — AppFolio Listings Scraper
 *
 * Scrapes https://waterfrontmgmtllc.appfolio.com/listings
 * Pushes data to a Google Sheet for Framer to consume.
 *
 * Runs on GitHub Actions every 10 minutes.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');

// ─── CONFIG ───────────────────────────────────────────────
const APPFOLIO_URL = 'https://waterfrontmgmtllc.appfolio.com/listings';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Listings'; // Tab name in your Google Sheet

// ─── STEP 1: SCRAPE APPFOLIO ─────────────────────────────
async function scrapeListings() {
  console.log('Fetching listings from AppFolio...');

  const { data: html } = await axios.get(APPFOLIO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(html);
  const listings = [];

  // ─── SELECTOR STRATEGY ──────────────────────────────────
  // AppFolio uses a standard listing card structure.
  // Common selectors: .listing-item, .js-listing-card, .listing-card
  //
  // IMPORTANT: After first run, inspect the actual page HTML and
  // adjust these selectors if needed. Run `node inspect.js` to
  // dump the raw HTML for review.
  //
  // Strategy: try multiple known AppFolio selectors
  // ────────────────────────────────────────────────────────

  const listingCards = $('.listing-item').length > 0
    ? $('.listing-item')
    : $('.js-listable-card').length > 0
    ? $('.js-listable-card')
    : $('[class*="listing"]').filter(function() {
        // Fallback: find any element with "listing" in the class
        // that contains address-like content
        return $(this).find('[class*="address"], [class*="rent"], [class*="price"]').length > 0;
      });

  console.log(`Found ${listingCards.length} listing cards`);

  listingCards.each((i, el) => {
    const card = $(el);

    // Extract data — adjust selectors after inspecting real HTML
    const listing = {
      address: extractText(card, [
        '.listing-item__address',
        '.js-listing-address',
        '[class*="address"]',
        'h2', 'h3'
      ], $),

      unit: extractText(card, [
        '.listing-item__unit',
        '[class*="unit"]'
      ], $),

      rent: extractText(card, [
        '.listing-item__rent',
        '.js-listing-rent',
        '[class*="rent"]',
        '[class*="price"]'
      ], $),

      beds: extractText(card, [
        '.listing-item__beds',
        '[class*="bed"]'
      ], $),

      baths: extractText(card, [
        '.listing-item__baths',
        '[class*="bath"]'
      ], $),

      sqft: extractText(card, [
        '.listing-item__sqft',
        '[class*="sqft"]',
        '[class*="size"]',
        '[class*="area"]'
      ], $),

      available: extractText(card, [
        '.listing-item__available',
        '[class*="avail"]',
        '[class*="date"]'
      ], $),

      status: extractText(card, [
        '.listing-item__status',
        '[class*="status"]'
      ], $),

      link: card.find('a').first().attr('href') || '',

      image: card.find('img').first().attr('src') ||
             card.find('[style*="background-image"]').first()
               .css('background-image')?.replace(/url\(['"]?(.*?)['"]?\)/, '$1') || ''
    };

    // Clean up rent (remove whitespace, ensure $ prefix)
    if (listing.rent) {
      listing.rent = listing.rent.replace(/\s+/g, ' ').trim();
    }

    // Make link absolute if relative
    if (listing.link && !listing.link.startsWith('http')) {
      listing.link = `https://waterfrontmgmtllc.appfolio.com${listing.link}`;
    }

    // Only add if we got at least an address
    if (listing.address) {
      listings.push(listing);
    }
  });

  // If card-based scraping found nothing, try table-based scraping
  // (some AppFolio pages use a table layout)
  if (listings.length === 0) {
    console.log('No card-based listings found. Trying table layout...');

    $('table tbody tr, .listing-row').each((i, el) => {
      const row = $(el);
      const cells = row.find('td');

      if (cells.length >= 3) {
        listings.push({
          address: $(cells[0]).text().trim(),
          unit: $(cells[1]).text().trim(),
          rent: $(cells[2]).text().trim(),
          beds: cells.length > 3 ? $(cells[3]).text().trim() : '',
          baths: cells.length > 4 ? $(cells[4]).text().trim() : '',
          sqft: cells.length > 5 ? $(cells[5]).text().trim() : '',
          available: cells.length > 6 ? $(cells[6]).text().trim() : '',
          status: cells.length > 7 ? $(cells[7]).text().trim() : '',
          link: row.find('a').first().attr('href') || '',
          image: ''
        });
      }
    });

    console.log(`Found ${listings.length} table-based listings`);
  }

  return listings;
}

/**
 * Try multiple CSS selectors and return the first match's text
 */
function extractText(card, selectors, $) {
  for (const sel of selectors) {
    const el = card.find(sel).first();
    if (el.length > 0) {
      return el.text().trim();
    }
  }
  return '';
}

// ─── STEP 2: PUSH TO GOOGLE SHEETS ───────────────────────
async function pushToSheets(listings) {
  console.log('Authenticating with Google Sheets...');

  // Auth via service account credentials (stored as GitHub secret)
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Header row
  const headers = [
    'Address', 'Unit', 'Rent', 'Beds', 'Baths',
    'Sq Ft', 'Available', 'Status', 'Link', 'Image URL',
    'Last Updated'
  ];

  // Data rows
  const timestamp = new Date().toISOString();
  const rows = listings.map(l => [
    l.address, l.unit, l.rent, l.beds, l.baths,
    l.sqft, l.available, l.status, l.link, l.image,
    timestamp
  ]);

  // Clear existing data and write fresh
  console.log(`Writing ${rows.length} listings to Google Sheets...`);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:K`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [headers, ...rows]
    }
  });

  console.log(`Done! ${rows.length} listings written to sheet.`);
}

// ─── STEP 3: RUN ─────────────────────────────────────────
async function main() {
  try {
    const listings = await scrapeListings();

    if (listings.length === 0) {
      console.warn('WARNING: No listings found. Check selectors.');
      console.warn('Run `node inspect.js` to dump the raw HTML.');
      // Don't overwrite the sheet with empty data
      process.exit(1);
    }

    console.log(`Scraped ${listings.length} listings:`);
    listings.forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.address} ${l.unit} — ${l.rent}`);
    });

    await pushToSheets(listings);
  } catch (err) {
    console.error('Scraper failed:', err.message);
    process.exit(1);
  }
}

main();
