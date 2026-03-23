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
  // AppFolio uses .listing-item cards with a detail-box
  // containing labeled <dt>/<dd> pairs for Rent, Bed/Bath,
  // Square Feet, and Available. Images use lazy loading
  // with the real URL in data-original.
  //
  // Run `node inspect.js` then `node debug.js` to re-check.
  // ────────────────────────────────────────────────────────

  const listingCards = $('.listing-item');
  console.log(`Found ${listingCards.length} listing cards`);

  listingCards.each((i, el) => {
    const card = $(el);

    // --- Address ---
    const address = card.find('.js-listing-address').text().trim();

    // --- Detail-box facts (the reliable structured data) ---
    let rent = '';
    let beds = '';
    let baths = '';
    let sqft = '';
    let available = '';

    card.find('.detail-box__item').each((j, item) => {
      const label = $(item).find('.detail-box__label').text().trim().toUpperCase();
      const value = $(item).find('.detail-box__value').text().trim();

      if (label === 'RENT') rent = value;
      else if (label === 'BED / BATH' || label === 'BED/BATH') {
        const parts = value.split('/').map(s => s.trim());
        beds = parts[0] || value;
        baths = parts[1] || '';
      }
      else if (label === 'SQUARE FEET') sqft = value;
      else if (label === 'AVAILABLE') available = value;
    });

    // Fallback: blurb selectors (mobile-facing elements)
    if (!rent) rent = card.find('.js-listing-blurb-rent').text().trim();
    if (!beds) {
      const bedBath = card.find('.js-listing-blurb-bed-bath').text().trim();
      if (bedBath) {
        const parts = bedBath.split('/').map(s => s.trim());
        beds = parts[0] || bedBath;
        baths = parts[1] || '';
      }
    }
    if (!sqft) {
      const sqftText = card.find('.js-listing-square-feet').text().trim();
      sqft = sqftText.replace(/^Square Feet:\s*/i, '');
    }
    if (!available) {
      const availText = card.find('.js-listing-available').first().text().trim();
      available = availText.replace(/^Available\s*/i, '');
    }

    // --- Link ---
    let link = card.find('a.js-link-to-detail').attr('href') ||
               card.find('a').first().attr('href') || '';
    if (link && !link.startsWith('http')) {
      link = `https://waterfrontmgmtllc.appfolio.com${link}`;
    }

    // --- Image (real URL in data-original, src is placeholder) ---
    const img = card.find('img.js-listing-image');
    const image = img.attr('data-original') || img.attr('src') || '';

    if (address) {
      listings.push({ address, unit: '', rent, beds, baths, sqft, available, status: '', link, image });
    }
  });

  return listings;
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
      console.warn('Run `node inspect.js` then `node debug.js` to re-check.');
      process.exit(1);
    }

    console.log(`Scraped ${listings.length} listings:`);
    listings.forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.address} — ${l.rent} | ${l.beds} / ${l.baths} | ${l.sqft} sqft | Avail: ${l.available}`);
    });

    writeCSV(listings);
  } catch (err) {
    console.error('Scraper failed:', err.message);
    process.exit(1);
  }
}

main();
