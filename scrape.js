/**
 * Waterfront Management — AppFolio Listings Scraper
 *
 * Scrapes https://waterfrontmgmtllc.appfolio.com/listings
 * Writes data to listings.csv in this repo.
 * GitHub Actions commits the updated CSV automatically.
 *
 * No Google Cloud. No service accounts. Just GitHub.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────
const APPFOLIO_URL = 'https://waterfrontmgmtllc.appfolio.com/listings';
const OUTPUT_FILE = path.join(__dirname, 'listings.csv');

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
  // Run `node inspect.js` to dump the raw HTML and tune selectors.
  // ────────────────────────────────────────────────────────

  const listingCards = $('.listing-item').length > 0
    ? $('.listing-item')
    : $('.js-listable-card').length > 0
    ? $('.js-listable-card')
    : $('[class*="listing"]').filter(function() {
        return $(this).find('[class*="address"], [class*="rent"], [class*="price"]').length > 0;
      });

  console.log(`Found ${listingCards.length} listing cards`);

  listingCards.each((i, el) => {
    const card = $(el);

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

    if (listing.rent) {
      listing.rent = listing.rent.replace(/\s+/g, ' ').trim();
    }

    if (listing.link && !listing.link.startsWith('http')) {
      listing.link = `https://waterfrontmgmtllc.appfolio.com${listing.link}`;
    }

    if (listing.address) {
      listings.push(listing);
    }
  });

  // Fallback: try table-based scraping
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

function extractText(card, selectors, $) {
  for (const sel of selectors) {
    const el = card.find(sel).first();
    if (el.length > 0) {
      return el.text().trim();
    }
  }
  return '';
}

// ─── STEP 2: WRITE CSV ──────────────────────────────────
function writeCSV(listings) {
  const headers = [
    'Address', 'Unit', 'Rent', 'Beds', 'Baths',
    'Sq Ft', 'Available', 'Status', 'Link', 'Image URL',
    'Last Updated'
  ];

  const timestamp = new Date().toISOString();

  const rows = listings.map(l => [
    csvEscape(l.address),
    csvEscape(l.unit),
    csvEscape(l.rent),
    csvEscape(l.beds),
    csvEscape(l.baths),
    csvEscape(l.sqft),
    csvEscape(l.available),
    csvEscape(l.status),
    csvEscape(l.link),
    csvEscape(l.image),
    csvEscape(timestamp)
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  fs.writeFileSync(OUTPUT_FILE, csv, 'utf-8');
  console.log(`Written ${listings.length} listings to ${OUTPUT_FILE}`);
}

function csvEscape(val) {
  if (!val) return '';
  val = String(val);
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// ─── STEP 3: RUN ─────────────────────────────────────────
async function main() {
  try {
    const listings = await scrapeListings();

    if (listings.length === 0) {
      console.warn('WARNING: No listings found. Check selectors.');
      console.warn('Run `node inspect.js` to dump the raw HTML.');
      process.exit(1);
    }

    console.log(`Scraped ${listings.length} listings:`);
    listings.forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.address} ${l.unit} — ${l.rent}`);
    });

    writeCSV(listings);
  } catch (err) {
    console.error('Scraper failed:', err.message);
    process.exit(1);
  }
}

main();
