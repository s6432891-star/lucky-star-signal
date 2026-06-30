const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(
  html.includes('const top5BySym = new Map();'),
  'buildTop5Candidates() 應使用 top5BySym Map 依 symbol 去重'
);

assert(
  /top5BySym\.set\(sym, base\)/.test(html),
  'buildTop5Candidates() 應把每個 symbol 只保留一筆候選資料'
);

assert(
  /return \[\.\.\.top5BySym\.values\(\)\]/.test(html),
  'buildTop5Candidates() 應回傳去重後的候選清單'
);

assert(!/Math\.random\s*\(/.test(html), '不可使用 Math.random() 產生假市場數據');

console.log('✅ top5_candidates_dedupe.test.js passed');
