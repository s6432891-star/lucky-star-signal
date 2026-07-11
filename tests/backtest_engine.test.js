const assert = require('assert');
const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, '..', 'backtest-engine.js');
assert(fs.existsSync(enginePath), '應存在獨立 backtest-engine.js');
const bt = require(enginePath);

assert(!fs.readFileSync(enginePath, 'utf8').includes('Math.random('), '回測引擎不得使用假資料');
for (const name of ['emaSeries', 'buildVegasSignals', 'runBacktest', 'calculateMetrics']) {
  assert.strictEqual(typeof bt[name], 'function', `應匯出 ${name}()`);
}

const ema = bt.emaSeries([1, 2, 3, 4, 5], 3);
assert.deepStrictEqual(ema.slice(0, 2), [null, null], 'EMA 暖機完成前應為 null');
assert.strictEqual(ema[2], 2, 'EMA 種子應使用前 N 根 SMA');
assert.strictEqual(ema[4], 4, 'EMA 後續值應依公式遞推');

// 人工 OHLC 僅用於單元測試數學，不作為網站市場資料。
const candles = [
  { ts: 1, open: 100, high: 101, low: 99, close: 100 },
  { ts: 2, open: 100, high: 101, low: 99, close: 100 },
  { ts: 3, open: 100, high: 103, low: 99, close: 102 },
  { ts: 4, open: 102, high: 105, low: 101, close: 104 },
  { ts: 5, open: 104, high: 105, low: 99, close: 100 },
];
const signals = [
  { index: 2, ts: 3, side: 'long', reason: '測試訊號' },
  { index: 2, ts: 3, side: 'long', reason: '同一根重複訊號不得重複進場' },
];
const result = bt.runBacktest(candles, signals, {
  stopLossPct: 1,
  takeProfitPct: 2,
  feePct: 0,
  slippagePct: 0,
});
assert.strictEqual(result.trades.length, 1, '一次只能持有一筆，且訊號下一根開盤進場');
assert.strictEqual(result.trades[0].entryTs, 4, '不得在訊號當根收盤進場');
assert.strictEqual(result.trades[0].exitReason, 'take_profit', '應依下一根之後的 OHLC 判定出場');
assert(Math.abs(result.trades[0].rMultiple - 2) < 1e-9, '2% TP / 1% SL 應為 2R');

const bothHit = [
  { ts: 1, open: 100, high: 101, low: 99, close: 100 },
  { ts: 2, open: 100, high: 103, low: 98, close: 101 },
];
const conservative = bt.runBacktest(bothHit, [{ index: 0, ts: 1, side: 'long', reason: '測試' }], {
  stopLossPct: 1, takeProfitPct: 2, feePct: 0, slippagePct: 0,
});
assert.strictEqual(conservative.trades[0].exitReason, 'stop_loss', '同根同時碰 SL/TP 必須保守判定先止損');

const metrics = bt.calculateMetrics([
  { rMultiple: 2 }, { rMultiple: -1 }, { rMultiple: -1 }, { rMultiple: 2 },
]);
assert.strictEqual(metrics.totalTrades, 4);
assert.strictEqual(metrics.winRate, 50);
assert.strictEqual(metrics.profitFactor, 2);
assert.strictEqual(metrics.maxLosingStreak, 2);
assert.strictEqual(metrics.maxDrawdownR, 2);
assert.strictEqual(metrics.expectancyR, 0.5);

console.log('✅ backtest_engine.test.js passed');
