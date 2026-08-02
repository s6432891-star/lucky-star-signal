const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function loadOkxLimiter(fetchImpl) {
  const start = html.indexOf('const _okxRL=');
  const end = html.indexOf('// ═══ COINGECKO', start);
  assert.ok(start >= 0 && end > start, '找不到 OKX 限速器程式碼');
  const context = {
    fetch: fetchImpl,
    sleep: ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 2))),
    console
  };
  vm.createContext(context);
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.__okx={okxFetch,_okxRL};`, context);
  return context.__okx;
}

function loadCandleCache(fetchPagesImpl) {
  const start = html.indexOf('const _klCache');
  const end = html.indexOf('// 只回傳收盤價', start);
  assert.ok(start >= 0 && end > start, '找不到 K 線快取程式碼');
  const storage = new Map();
  const context = {
    __fetchPages: fetchPagesImpl,
    okxFetch: async () => null,
    sleep: async () => {},
    console,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    }
  };
  vm.createContext(context);
  vm.runInContext(
    `${html.slice(start, end)}\nfetchCandlePages=globalThis.__fetchPages;globalThis.__candles={fetchCandles};`,
    context
  );
  return context.__candles;
}

test('冷啟動必須先完成 VEGAS，再載入次要即時指標，避免共用 OKX 佇列互搶', () => {
  assert.match(
    html,
    /loadFast\(\)\.then\(\(\)=>\{[\s\S]{0,180}loadVEGAS\(\)\.then\(\(\)=>loadRealIndicators\(\)\)/,
    '目前仍同時啟動 loadVEGAS 與 loadRealIndicators'
  );
});

test('VEGAS 掃描期間每分鐘更新不得再啟動次要即時指標', () => {
  assert.match(
    html,
    /setInterval\(\(\)=>\{loadFast\(\);if\(!_vegasRunning\)loadRealIndicators\(\);\},60000\)/,
    '每分鐘更新仍會在 VEGAS 掃描期間插隊'
  );
});

test('OKX 限速器維持單通道，避免實測中雙通道反而拖慢回應', async () => {
  let active = 0;
  let peak = 0;
  const fetchImpl = async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 15));
    active--;
    return { status: 200, ok: true, json: async () => ({ code: '0', data: [] }) };
  };
  const {okxFetch, _okxRL} = loadOkxLimiter(fetchImpl);
  _okxRL.minGap = 0;
  await Promise.all([okxFetch('/a'), okxFetch('/b')]);
  assert.equal(peak, 1, 'OKX 不應同時發出兩個請求');
  assert.equal(_okxRL.max, 1);
});

test('OKX 回傳 429 時立即降回單通道並重試', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return { status: 429, ok: false, json: async () => ({}) };
    return { status: 200, ok: true, json: async () => ({ code: '0', data: [] }) };
  };
  const {okxFetch, _okxRL} = loadOkxLimiter(fetchImpl);
  _okxRL.minGap = 0;
  const result = await okxFetch('/rate-limited');
  assert.equal(result.code, '0');
  assert.equal(calls, 2);
  assert.equal(_okxRL.max, 1, '遇到 429 後沒有降回單通道');
});

test('相同幣種週期與根數的同時 K 線請求共用同一個下載', async () => {
  let calls = 0;
  const rows = Array.from({length: 150}, (_, i) => [String(i), '1', '1', '1', '1', '1', '0', '0', '1']);
  const {fetchCandles} = loadCandleCache(async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 15));
    return rows;
  });
  const [first, second] = await Promise.all([
    fetchCandles('BTC', '1H', 150),
    fetchCandles('BTC', '1H', 150)
  ]);
  assert.equal(calls, 1, '同一份 K 線被重複下載');
  assert.equal(first.length, 150);
  assert.equal(second.length, 150);
});

test('VEGAS 批次間不再額外等待，統一由 OKX 限速器控制速度', () => {
  assert.doesNotMatch(
    html,
    /if\(i\+batchSize<SYMS\.length\) await sleep\(500\)/,
    'VEGAS 仍有重複的批次等待時間'
  );
});
