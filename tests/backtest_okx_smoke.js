// 真實 OKX 公開資料技術煙霧測試。
// 1% SL / 2% TP / 0 成本只用來驗證程式可執行，不代表建議或使用者設定。
const bt = require('../backtest-engine.js');
const PROXY = 'https://young-glade-8c18lucky-star-proxy.s6432891.workers.dev';
const proxy = (url) => `${PROXY}/?url=${encodeURIComponent(url)}`;

async function fetchHistory(bar, total) {
  const rows = new Map();
  let after = '';
  let attempts = 0;
  while (rows.size < total && attempts < Math.ceil(total / 100) + 3) {
    const url = `https://www.okx.com/api/v5/market/history-candles?instId=BTC-USDT-SWAP&bar=${bar}&limit=100${after ? `&after=${after}` : ''}`;
    let response;
    for (let retry = 0; retry < 4; retry += 1) {
      response = await fetch(url);
      if (response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
    }
    if (!response.ok) throw new Error(`OKX ${bar} HTTP ${response.status}`);
    const json = await response.json();
    if (json.code !== '0' || !Array.isArray(json.data) || !json.data.length) break;
    json.data.forEach((row) => rows.set(row[0], row));
    const oldest = Math.min(...json.data.map((row) => Number(row[0])));
    if (String(oldest) === after) break;
    after = String(oldest);
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return [...rows.values()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(-total)
    .map((d) => ({ ts: +d[0], open: +d[1], high: +d[2], low: +d[3], close: +d[4], vol: +d[5] }));
}

(async () => {
  const h4 = await fetchHistory('4H', 800);
  const h1 = await fetchHistory('1H', 1000);
  if (h1.length < 170 || h4.length < 677) throw new Error(`歷史資料不足：1H=${h1.length}, 4H=${h4.length}`);
  const signals = bt.buildVegasSignals(h1, h4);
  const result = bt.runBacktest(h1, signals, { stopLossPct: 1, takeProfitPct: 2, feePct: 0, slippagePct: 0 });
  console.log(JSON.stringify({
    note: '技術煙霧測試參數，不是投資建議或使用者設定',
    h1Candles: h1.length,
    h4Candles: h4.length,
    first1hTs: h1[0].ts,
    last1hTs: h1.at(-1).ts,
    signals: signals.length,
    completedTrades: result.metrics.totalTrades,
    metrics: result.metrics,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
