const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('EMA576/676 必須抓足至少 677 根且不得降級冒充 EMA299', () => {
  assert.match(html, /function fetchCandlePages\s*\(/, '缺少 OKX K線分頁 helper');
  assert.match(html, /history-candles/, '沒有使用歷史 K 線端點分頁');
  assert.match(html, /fetchKlinesOHLCV\(sym,'4H',700\)/, '4H 仍未抓足 676 根');
  assert.doesNotMatch(html, /calcEMA\(daily,Math\.min\(576/, '日線 EMA576 仍會降級成短週期');
  assert.doesNotMatch(html, /calcEMA\(daily,Math\.min\(676/, '日線 EMA676 仍會降級成短週期');
  assert.doesNotMatch(html, /calcEMA\(h4,Math\.min\(576/, '4H EMA576 仍會降級成短週期');
});

test('長週期歷史不足必須保留短資料供 coverage 分類，但不得拿來計算 EMA576/676', () => {
  assert.match(html, /if\(!j\.data\.length\)\{[\s\S]{0,100}return\[\]/, 'OKX 正常回覆空歷史仍被誤判為 API 失敗');
  assert.match(html, /if\(rows===null\) return null/, 'fetchCandles 仍把正常空陣列視為 API 失敗');
  assert.match(html, /async function fetchKlines\([\s\S]{0,160}if\(rows===null\)return null/, 'fetchKlines 仍把正常空陣列視為 API 失敗');
  assert.match(html, /async function fetchKlinesOHLCV\([\s\S]{0,180}if\(rows===null\)return null/, 'fetchKlinesOHLCV 仍把正常空陣列視為 API 失敗');
  assert.match(html, /limit>=677&&rows\.length\?rows:null/, '長週期短歷史仍與 API 失敗混成 null');
  assert.match(html, /daily\.length<677\|\|h4Confirmed\.length<677[^\n]*insufficientHistory/, '短歷史沒有被明確分類為 insufficientHistory');
});

test('API 失敗時不得無期限沿用過期 K 線', () => {
  const start = html.indexOf('async function fetchCandles(');
  const end = html.indexOf('// 只回傳收盤價', start);
  const body = html.slice(start, end);
  assert.doesNotMatch(body, /即使過期/, '仍明示使用無期限過期快取');
  assert.doesNotMatch(body, /if\(c && c\.rows\.length>=limit\) return c\.rows/, '失敗分支仍直接回傳過期快取');
});

test('OKX 成交量統一成 USDT 名目額，OI 訊號使用真實 OI 變化', () => {
  assert.match(html, /function notionalVolumeUSDT\s*\(/, '缺少統一成交量單位 helper');
  assert.match(html, /vol:notionalVolumeUSDT\(t\)/, 'ticker 成交量仍未統一為 USDT');
  const saek = html.slice(html.indexOf('function buildSaek('), html.indexOf('// ═══ VEGAS', html.indexOf('function buildSaek(')));
  assert.match(saek, /oi\.oiChgReal/, 'OI異常仍未使用真實 OI 變化');
  assert.doesNotMatch(saek, /Math\.abs\(oi\.pchg\)>3/, 'OI異常仍把價格漲跌冒充 OI');
});

test('OKX 訊號開啟同一 OKX 永續商品', () => {
  assert.doesNotMatch(html, /BINANCE:\$\{v\.sym\}USDT\.P/, 'VEGAS 快訊仍導向 Binance');
  assert.match(html, /OKX:\$\{v\.sym\}USDT\.P/, 'VEGAS 快訊未導向 OKX 永續');
});
