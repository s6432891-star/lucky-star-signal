const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const renderMatch = html.match(/function renderOI\(\)\{([\s\S]*?)\n\}/);
assert(renderMatch, 'renderOI() function should exist');
const renderBody = renderMatch[1];

const helperMatch = html.match(/function getOIVegasTag\(oi, vd\)\{([\s\S]*?)\n\}/);
assert(helperMatch, 'should define independent getOIVegasTag(oi, vd) helper');
const helperBody = helperMatch[1];

assert(
  html.includes('順勢多') && html.includes('順勢空') && html.includes('逆勢多') && html.includes('逆勢空') && html.includes('等VEGAS確認'),
  'helper should include all OI+VEGAS tag labels'
);
assert(
  renderBody.includes('getOIVegasTag'),
  'renderOI() should call getOIVegasTag()'
);
assert(
  renderBody.includes('OI+VEGAS'),
  'OI table should include a separate OI+VEGAS column'
);
assert(
  !/wr\s*[+\-]=|winRate|computeWR|estWinRate/.test(helperBody),
  'OI+VEGAS tag helper should not modify win-rate formula'
);

console.log('oi vegas tag test passed');
