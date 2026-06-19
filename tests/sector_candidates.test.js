const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const renderMatch = html.match(/function renderSectors\(\)\{([\s\S]*?)\n\}/);
assert(renderMatch, 'renderSectors() function should exist');
const renderBody = renderMatch[1];

assert(
  html.includes('const SECTOR_SYMS'),
  'sector definitions should use symbol groups, not only CoinGecko ids'
);
assert(
  renderBody.includes('buildTop5Candidates()'),
  'renderSectors() should use full VEGAS/OKX candidate pool from buildTop5Candidates()'
);
assert(
  !renderBody.includes('Object.values(coins)'),
  'renderSectors() should not be limited to CoinGecko coins only'
);
assert(
  renderBody.includes('強') && renderBody.includes('弱'),
  'renderSectors() should show strongest and weakest coin labels'
);

console.log('sector candidate pool test passed');
