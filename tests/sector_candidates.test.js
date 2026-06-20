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
assert(
  html.includes('function openSectorDetail(name)'),
  'sector cards should have a detail modal function openSectorDetail(name)'
);
assert(
  renderBody.includes('onclick="openSectorDetail'),
  'renderSectors() should make each sector card clickable'
);
assert(
  html.includes('板塊詳情') && html.includes('openScoreDetail'),
  'sector detail modal should show sector details and allow opening coin detail'
);

console.log('sector candidate pool/detail test passed');
