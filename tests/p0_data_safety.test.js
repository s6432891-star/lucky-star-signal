const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('外部新聞與 AI 回覆必須以純文字或 escaping 顯示', () => {
  assert.match(html, /function escapeHTML\s*\(/, '缺少共用 HTML escaping helper');
  assert.match(html, /escapeHTML\(n\.title\)/, '新聞標題未 escape');
  assert.doesNotMatch(html, /\$\{n\.title\}/, '仍有新聞標題直接插入 HTML');
  assert.doesNotMatch(html, /window\.open\('\$\{n\.url\}/, '仍有新聞 URL 直接插入 inline handler');
  assert.match(html, /safeExternalUrl\(n\.url\)/, '新聞外連未驗證 URL 協定');
  assert.match(html, /setSafeMultilineText\(el,\s*reply\)/, 'AI 回覆未使用純文字多行顯示');
});

test('缺少 VEGAS 核心資料時不得生成交易詳情', () => {
  const start = html.indexOf('function openMOVEDetail(');
  const body = html.slice(start, start + 900);
  assert.match(body, /if\s*\(\s*!v\s*\)/, '缺少 VEGAS 時沒有中止交易判決');
  assert.doesNotMatch(body, /v\?\.price\s*\|\|\s*0/, '缺價格仍被轉成 0');
  assert.doesNotMatch(body, /v\?\.chg24\s*\|\|\s*0/, '缺 24H 漲跌仍被轉成 0');
});

test('API 狀態必須包含 VEGAS 掃描結果', () => {
  assert.match(html, /const _apiState\s*=\s*\{[^}]*vegas\s*:/, 'API 狀態沒有追蹤 VEGAS');
  assert.match(html, /setApiStatus\(['"]vegas['"],\s*vegasData\.length\s*>\s*0\)/, 'VEGAS 空結果未標記失敗');
  assert.match(html, /VEGAS 計算失敗/, '使用者看不到 VEGAS 計算失敗狀態');
});
