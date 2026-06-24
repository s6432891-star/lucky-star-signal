const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

assert(html.includes('id="market-brief"'), '首頁應有 AI 市場總結卡容器');
assert(html.includes('id="movers-list"'), '首頁應有 24H 熱門異動榜容器');
assert(html.includes('function renderMarketBrief()'), '應有 renderMarketBrief 函式');
assert(html.includes('function renderHotMovers()'), '應有 renderHotMovers 函式');
assert(html.includes('function filterMovers('), '異動榜應有篩選函式');
assert(html.includes('function classifyMover('), '異動榜應有順勢/逆勢/波動分類函式');
assert(html.includes("filterMovers('aligned'"), '異動榜應有順 VEGAS 篩選按鈕');
assert(html.includes("filterMovers('against'"), '異動榜應有逆勢警告篩選按鈕');
assert(html.includes("filterMovers('volatile'"), '異動榜應有波動放大篩選按鈕');
assert(html.includes('getMarketUniverse()'), '應用真實 CoinGecko/OKX 市場資料組成異動榜');
assert(!/Math\.random\s*\(/.test(html), '不可使用 Math.random() 產生假市場數據');
assert(html.includes('不改 Top5、勝率、VEGAS、MOVE、賽克斯或 OI 計算邏輯'), '總結卡需明示只是白話整理，不改交易邏輯');

console.log('✅ market_brief_static.test.js passed');
