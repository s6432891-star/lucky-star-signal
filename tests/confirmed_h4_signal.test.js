const fs = require('fs');
const assert = require('assert');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFn(name) {
  const match = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}`));
  assert(match, `index.html 應提供可測試的 ${name}() helper`);
  return match[0];
}

const src = extractFn('getConfirmedCloses');
const sandbox = {};
new Function(`${src}\nthis.getConfirmedCloses=getConfirmedCloses;`).call(sandbox);

const closes = sandbox.getConfirmedCloses([
  { close: 575.4, confirmed: true },
  { close: 567.5, confirmed: false },
]);
assert.deepStrictEqual(closes, [575.4], '未收盤 4H K 棒不得進入收盤確認訊號');

const computeStart = html.indexOf('async function computeVEGAS(sym)');
const computeEnd = html.indexOf('\nconst CG_MAP=', computeStart);
assert(computeStart >= 0 && computeEnd > computeStart, '應能定位 computeVEGAS()');
const computeSrc = html.slice(computeStart, computeEnd);
assert(computeSrc.includes('getConfirmedCloses(h4raw)'), 'computeVEGAS 應建立已收盤 4H 序列');
assert(/step3_short\s*=.*confirmed/.test(computeSrc), '做空可執行判定必須使用已收盤 4H 資料');
assert(/step3_long\s*=.*confirmed/.test(computeSrc), '做多可執行判定必須使用已收盤 4H 資料');

console.log('✅ confirmed_h4_signal.test.js passed');
