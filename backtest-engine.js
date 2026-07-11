(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LuckyStarBacktest = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finiteNumber(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${name} 必須是有效數字`);
    return n;
  }

  function emaSeries(values, period) {
    if (!Array.isArray(values) || !Number.isInteger(period) || period < 1) return [];
    const out = Array(values.length).fill(null);
    if (values.length < period) return out;
    let seed = 0;
    for (let i = 0; i < period; i += 1) seed += finiteNumber(values[i], 'EMA 價格');
    let ema = seed / period;
    out[period - 1] = ema;
    const k = 2 / (period + 1);
    for (let i = period; i < values.length; i += 1) {
      ema = finiteNumber(values[i], 'EMA 價格') * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  function normalizeCandles(candles) {
    if (!Array.isArray(candles)) return [];
    return candles.map((c) => ({
      ts: finiteNumber(c.ts, 'K 線時間'),
      open: finiteNumber(c.open, '開盤價'),
      high: finiteNumber(c.high, '最高價'),
      low: finiteNumber(c.low, '最低價'),
      close: finiteNumber(c.close, '收盤價'),
      vol: Number.isFinite(Number(c.vol)) ? Number(c.vol) : null,
    })).sort((a, b) => a.ts - b.ts);
  }

  function buildVegasSignals(h1Input, h4Input) {
    const h1 = normalizeCandles(h1Input);
    const h4 = normalizeCandles(h4Input);
    if (h1.length < 170 || h4.length < 677) return [];

    const h1Close = h1.map((c) => c.close);
    const h4Close = h4.map((c) => c.close);
    const h1e12 = emaSeries(h1Close, 12);
    const h1e144 = emaSeries(h1Close, 144);
    const h1e169 = emaSeries(h1Close, 169);
    const h4e12 = emaSeries(h4Close, 12);
    const h4e576 = emaSeries(h4Close, 576);
    const h4e676 = emaSeries(h4Close, 676);
    const signals = [];
    let h4i = -1;
    const HOUR = 60 * 60 * 1000;

    for (let i = 169; i < h1.length; i += 1) {
      const signalCloseTs = h1[i].ts + HOUR;
      while (h4i + 1 < h4.length && h4[h4i + 1].ts + 4 * HOUR <= signalCloseTs) h4i += 1;
      if (h4i < 675 || h1e12[i - 1] == null) continue;

      const bigHigh = Math.max(h4e576[h4i], h4e676[h4i]);
      const bigLow = Math.min(h4e576[h4i], h4e676[h4i]);
      const trendLong = h4[h4i].close > bigHigh && h4e12[h4i] > bigHigh;
      const trendShort = h4[h4i].close < bigLow && h4e12[h4i] < bigLow;

      const upper = Math.max(h1e144[i], h1e169[i]);
      const lower = Math.min(h1e144[i], h1e169[i]);
      const prevUpper = Math.max(h1e144[i - 1], h1e169[i - 1]);
      const prevLower = Math.min(h1e144[i - 1], h1e169[i - 1]);
      const nowAbove = h1[i].close > upper && h1e12[i] > upper;
      const prevAbove = h1[i - 1].close > prevUpper && h1e12[i - 1] > prevUpper;
      const nowBelow = h1[i].close < lower && h1e12[i] < lower;
      const prevBelow = h1[i - 1].close < prevLower && h1e12[i - 1] < prevLower;

      if (trendLong && nowAbove && !prevAbove) {
        signals.push({
          index: i, ts: h1[i].ts, side: 'long', h4Ts: h4[h4i].ts,
          reason: '4H 大通道多頭＋1H 價格與 EMA12 同時突破 EMA144/169',
        });
      } else if (trendShort && nowBelow && !prevBelow) {
        signals.push({
          index: i, ts: h1[i].ts, side: 'short', h4Ts: h4[h4i].ts,
          reason: '4H 大通道空頭＋1H 價格與 EMA12 同時跌破 EMA144/169',
        });
      }
    }
    return signals;
  }

  function validateConfig(config) {
    const stopLossPct = finiteNumber(config.stopLossPct, '止損百分比');
    const takeProfitPct = finiteNumber(config.takeProfitPct, '止盈百分比');
    const feePct = finiteNumber(config.feePct, '單邊手續費');
    const slippagePct = finiteNumber(config.slippagePct, '單邊滑價');
    if (stopLossPct <= 0 || takeProfitPct <= 0) throw new Error('止損與止盈必須大於 0');
    if (feePct < 0 || slippagePct < 0) throw new Error('手續費與滑價不可小於 0');
    return { stopLossPct, takeProfitPct, feePct, slippagePct };
  }

  function runBacktest(candleInput, signalInput, rawConfig) {
    const candles = normalizeCandles(candleInput);
    const signals = Array.isArray(signalInput) ? [...signalInput].sort((a, b) => a.index - b.index) : [];
    const config = validateConfig(rawConfig || {});
    const trades = [];
    let lastExitIndex = -1;
    const roundTripCostPct = 2 * (config.feePct + config.slippagePct);

    for (const signal of signals) {
      const entryIndex = Number(signal.index) + 1;
      if (!Number.isInteger(entryIndex) || entryIndex <= lastExitIndex || entryIndex >= candles.length) continue;
      const entry = candles[entryIndex];
      const side = signal.side;
      if (side !== 'long' && side !== 'short') continue;
      const stopPrice = side === 'long'
        ? entry.open * (1 - config.stopLossPct / 100)
        : entry.open * (1 + config.stopLossPct / 100);
      const takePrice = side === 'long'
        ? entry.open * (1 + config.takeProfitPct / 100)
        : entry.open * (1 - config.takeProfitPct / 100);
      let exitIndex = candles.length - 1;
      let exitPrice = candles[exitIndex].close;
      let exitReason = 'end_of_data';

      for (let i = entryIndex; i < candles.length; i += 1) {
        const c = candles[i];
        const stopHit = side === 'long' ? c.low <= stopPrice : c.high >= stopPrice;
        const takeHit = side === 'long' ? c.high >= takePrice : c.low <= takePrice;
        if (stopHit) {
          exitIndex = i; exitPrice = stopPrice; exitReason = 'stop_loss'; break;
        }
        if (takeHit) {
          exitIndex = i; exitPrice = takePrice; exitReason = 'take_profit'; break;
        }
      }

      const grossPct = side === 'long'
        ? (exitPrice / entry.open - 1) * 100
        : (entry.open / exitPrice - 1) * 100;
      const netPct = grossPct - roundTripCostPct;
      const rMultiple = netPct / config.stopLossPct;
      trades.push({
        side, signalTs: Number(signal.ts), entryTs: entry.ts, exitTs: candles[exitIndex].ts,
        entryPrice: entry.open, exitPrice, stopPrice, takePrice, exitReason,
        grossPct, netPct, rMultiple, barsHeld: exitIndex - entryIndex + 1,
        reason: String(signal.reason || ''),
      });
      lastExitIndex = exitIndex;
    }
    return { trades, metrics: calculateMetrics(trades), config };
  }

  function calculateMetrics(trades) {
    const rs = (Array.isArray(trades) ? trades : []).map((t) => Number(t.rMultiple)).filter(Number.isFinite);
    let equity = 0;
    let peak = 0;
    let maxDrawdownR = 0;
    let losingStreak = 0;
    let maxLosingStreak = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    const equityCurve = [0];

    for (const r of rs) {
      equity += r;
      equityCurve.push(equity);
      peak = Math.max(peak, equity);
      maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
      if (r > 0) { wins += 1; grossProfit += r; losingStreak = 0; }
      else { grossLoss += Math.abs(r); losingStreak += 1; maxLosingStreak = Math.max(maxLosingStreak, losingStreak); }
    }
    const totalTrades = rs.length;
    return {
      totalTrades,
      wins,
      losses: totalTrades - wins,
      winRate: totalTrades ? (wins / totalTrades) * 100 : null,
      netR: equity,
      expectancyR: totalTrades ? equity / totalTrades : null,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : null),
      maxDrawdownR,
      maxLosingStreak,
      equityCurve,
    };
  }

  return { emaSeries, buildVegasSignals, runBacktest, calculateMetrics, normalizeCandles };
});
