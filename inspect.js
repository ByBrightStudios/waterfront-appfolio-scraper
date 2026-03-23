/**
 * Inspection utility — dumps the raw HTML from the AppFolio page
 * so you can find the right CSS selectors for scrape.js
 *
 * Run: node inspect.js
 * Then open output.html in your browser and use DevTools to find selectors.
 */

const axios = require('axios');
const fs = require('fs');

const APPFOLIO_URL = 'https://waterfrontmgmtllc.appfolio.com/listings';

async function inspect() {
  console.log('Fetching page...');

  const { data: html } = await axios.get(APPFOLIO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  // Save raw HTML
  fs.writeFileSync('output.html', html);
  console.log('Saved raw HTML to output.html');
  console.log(`Page size: ${(html.length / 1024).toFixed(1)}KB`);

  // Quick analysis
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  console.log('\n--- Quick DOM Analysis ---');
  console.log(`Title: ${$('title').text()}`);
  console.log(`Tables: ${$('table').length}`);
  console.log(`Links: ${$('a').length}`);
  console.log(`Images: ${$('img').length}`);

  // Find likely listing containers
  const candidates = [
    '.listing-item', '.listing-card', '.js-listable-card',
    '.js-listing-card', '.property-listing', '.listing-row',
    '[class*="listing"]', '[class*="property"]', '[class*="unit"]'
  ];

  console.log('\n--- Selector Matches ---');
  candidates.forEach(sel => {
    const count = $(sel).length;
    if (count > 0) {
      console.log(`  ${sel}: ${count} matches`);
    }
  });

  // Show all unique class names that contain "list" or "property"
  const relevantClasses = new Set();
  $('[class]').each((i, el) => {
    const classes = $(el).attr('class').split(/\s+/);
    classes.forEach(c => {
      if (c.match(/list|property|unit|rent|avail|addr|price/i)) {
        relevantClasses.add(c);
      }
    });
  });

  console.log('\n--- Relevant CSS Classes Found ---');
  [...relevantClasses].sort().forEach(c => console.log(`  .${c}`));
}

inspect().catch(err => {
  console.error('Failed:', err.message);
});
