const fs = require('fs');
const assert = require('assert');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFn(name) {
  const match = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}`));
  assert(match, `index.html 應提供可測試的 ${name}() helper`);
  return match[0];
}

const src = extractFn('classifyPullbackDistance');
const sandbox = {};
new Function(`${src}\nthis.classifyPullbackDistance=classifyPullbackDistance;`).call(sandbox);

// 2026-07-20 BNB 實例：價格 567.5、4H 通道下緣 575.3667，距離 1.3673%。
// 肉眼仍未碰到通道，只能列為接近回踩，不可貼「回踩到位」或給回踩勝率加分。
const bnb = sandbox.classifyPullbackDistance(1.3673);
assert.strictEqual(bnb.state, 'near', 'BNB 距通道 1.3673% 應是接近回踩');
assert.strictEqual(bnb.isPullback, false, 'BNB 距通道 1.3673% 不得算回踩到位');
assert.strictEqual(bnb.wr, 0, '接近回踩不得給回踩勝率加分');
assert.match(bnb.label, /接近回踩/, '接近回踩應使用誠實標籤');

// 真正貼近通道（±0.5%）才可算回踩到位；≤0.3% 才能稱為極佳。
const touched = sandbox.classifyPullbackDistance(0.3);
assert.strictEqual(touched.state, 'at', '距通道 0.3% 應算回踩到位');
assert.strictEqual(touched.isPullback, true, '距通道 0.3% 應可標示回踩到位');
assert.strictEqual(touched.wr, 0.74, '距通道 0.3% 維持極佳回踩品質');
assert.match(touched.label, /極佳回踩/, '距通道 0.3% 可標示極佳回踩');

const outside = sandbox.classifyPullbackDistance(2.01);
assert.strictEqual(outside.state, 'none', '超過 2% 不應列為回踩或接近回踩');
assert.strictEqual(outside.isPullback, false, '超過 2% 不得有回踩標籤');

// 0.5%~2% 的 near 狀態必須進入「快回踩預警」，不能從畫面消失。
const renderNearStart = html.indexOf('function renderNearPullback()');
const renderNearEnd = html.indexOf('\nfunction renderVegas()', renderNearStart);
assert(renderNearStart >= 0 && renderNearEnd > renderNearStart, '應能定位 renderNearPullback()');
const renderNearSrc = html.slice(renderNearStart, renderNearEnd);
assert(renderNearSrc.includes("v.pullbackState==='near'"), '快回踩預警應接收 0.5%~2% 的 near 狀態');
assert(renderNearSrc.includes('v.pullbackDist-0.5'), '預警應以 0.5% 到位線計算還差距離');

assert(!/Math\.random\s*\(/.test(html), '不得使用 Math.random() 製造市場資料');
console.log('✅ pullback_distance.test.js passed');
