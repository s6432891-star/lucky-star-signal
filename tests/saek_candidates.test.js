const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const match = html.match(/function buildSaek\(\)\{([\s\S]*?)\n\}/);
assert(match, 'buildSaek() function should exist');
const body = match[1];

assert(
  body.includes('buildTop5Candidates()'),
  'buildSaek() should use the full VEGAS/OKX candidate pool from buildTop5Candidates()'
);
assert(
  !body.includes('Object.values(coins)'),
  'buildSaek() should not be limited to CoinGecko coins only'
);

console.log('saek candidate pool test passed');
