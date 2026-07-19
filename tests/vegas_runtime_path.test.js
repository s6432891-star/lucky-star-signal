const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function grabFunction(name) {
  const plainStart = html.indexOf(`function ${name}(`);
  if (plainStart < 0) throw new Error(`找不到函式 ${name}`);
  const asyncPrefix = 'async ';
  const start = html.slice(Math.max(0, plainStart - asyncPrefix.length), plainStart) === asyncPrefix
    ? plainStart - asyncPrefix.length
    : plainStart;
  const brace = html.indexOf('{', plainStart);
  let depth = 0;
  for (let i = brace; i < html.length; i += 1) {
    if (html[i] === '{') depth += 1;
    if (html[i] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`無法解析函式 ${name}`);
}

function buildContext() {
  const context = {
    console,
    coins: {},
    fetchOIChange: async () => null,
    symToCG: () => null,
  };
  const daily = Array.from({ length: 700 }, (_, i) => 100 + i * 0.2);
  const dailyOhlcv = daily.map((close, i) => ({
    ts: i, open: close - 0.05, high: close + 0.1, low: close - 0.1, close, vol: 2000 + i, confirmed: true
  }));
  const h4 = Array.from({ length: 700 }, (_, i) => {
    const close = 100 + i * 0.1;
    return { ts: i, open: close - 0.05, high: close + 0.1, low: close - 0.1, close, vol: 1000 + i, confirmed: true };
  });
  const h1 = Array.from({ length: 150 }, (_, i) => 100 + i * 0.05);
  const m15 = Array.from({ length: 150 }, (_, i) => 100 + i * 0.03);
  context.fetchKlines = async (_sym, bar) => bar === '1D' ? daily : bar === '1H' ? h1 : m15;
  context.fetchKlinesOHLCV = async (_sym, bar) => bar === '1D' ? dailyOhlcv : h4;
  vm.createContext(context);
  const source = [
    grabFunction('calcEMA'),
    grabFunction('classifyPullbackDistance'),
    grabFunction('calcQQEMOD'),
    grabFunction('getConfirmedCloses'),
    grabFunction('calcRealVolPattern'),
    grabFunction('computeVEGAS'),
    'this.computeVEGAS = computeVEGAS;'
  ].join('\n');
  vm.runInContext(source, context);
  return context;
}

test('computeVEGAS 完整執行路徑不得因未定義變數靜默回傳 null', async () => {
  const context = buildContext();
  const result = await context.computeVEGAS('TEST');
  assert.ok(result, 'computeVEGAS 不應把執行期錯誤吞掉後回傳 null');
  assert.equal(result.sym, 'TEST');
  assert.equal(typeof result.priceAboveEMA12, 'boolean');
  assert.equal(typeof result.priceBelowEMA12, 'boolean');
});
