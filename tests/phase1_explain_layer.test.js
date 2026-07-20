// Phase 1 解釋層靜態安全測試
// 驗證：無假資料、禁止詞、helper 缺資料行為、判決書純顯示層、免責聲明存在
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

// ── 1. 全站不可有資料用途的 Math.random() ──
assert(!/Math\.random\s*\(/.test(html), '全站不可使用 Math.random() 產生假市場數據');

// ── 2. 禁止詞檢查：UI 文案不得出現喊單 / FOMO 用語 ──
const forbidden = ['穩賺', '必漲', '保證獲利', '100% 勝率', '100%勝率', '梭哈', '快上車', '跟單', '帶單'];
for (const word of forbidden) {
  assert(!html.includes(word), `UI 文案不得出現禁止詞：「${word}」`);
}

// ── 3. Phase 1 helper 存在性 ──
assert(html.includes('function formatDataStatus('), '應存在統一資料狀態 helper formatDataStatus()');
assert(html.includes('function buildSignalVerdict('), '應存在判決書 helper buildSignalVerdict()');
assert(html.includes('function signalMaturity('), '應存在成熟度 helper signalMaturity()');

// 從 index.html 抽出 helper 原始碼（頂層函數以「換行 + }」結尾）
function extractFn(name) {
  const m = html.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}`));
  assert(m, `無法從 index.html 抽出 function ${name}`);
  return m[0];
}
const srcFDS = extractFn('formatDataStatus');
const srcBSV = extractFn('buildSignalVerdict');
const srcERS = extractFn('executionRiskState');
const srcSM  = extractFn('signalMaturity');

// ── 4. 判決書為純顯示層：不得呼叫核心計算函數 ──
for (const core of ['computeConfidenceScore(', 'buildTop5Candidates(', 'inferNeutralDirection(']) {
  assert(!srcBSV.includes(core), `buildSignalVerdict() 不得呼叫核心計算 ${core}`);
  assert(!srcSM.includes(core), `signalMaturity() 不得呼叫核心計算 ${core}`);
}
assert(!/Math\.random/.test(srcBSV + srcSM + srcFDS), 'Phase 1 helper 不得使用 Math.random');

// 評分拆解層只讀取信心分數既有明細，核心簽名不可被改動
assert(html.includes('function computeConfidenceScore(c,type,wantBreakdown)'), '信心分數 helper 簽名不可被修改（評分拆解只讀不寫）');

// ── 5. helper 行為測試：缺資料時輸出誠實狀態，不出現 undefined / NaN ──
const sandbox = {};
new Function(`${srcFDS}\n${srcERS}\n${srcSM}\n${srcBSV}\nthis.formatDataStatus=formatDataStatus;this.signalMaturity=signalMaturity;this.buildSignalVerdict=buildSignalVerdict;`).call(sandbox);

// formatDataStatus 三態
assert(sandbox.formatDataStatus('loading') === '載入中…', "formatDataStatus('loading') 應回傳「載入中…」");
assert(sandbox.formatDataStatus('none') === '無資料', "formatDataStatus('none') 應回傳「無資料」");
assert(sandbox.formatDataStatus('partial', 3, 9) === '資料不足（3/9 項）', "formatDataStatus('partial',3,9) 應回傳「資料不足（3/9 項）」");
assert(sandbox.formatDataStatus() === '無資料', 'formatDataStatus() 無參數時應安全回傳「無資料」');
assert(sandbox.formatDataStatus('partial') === '無資料', "formatDataStatus('partial') 缺 n/m 時不得輸出 undefined");

// signalMaturity 資料不足優先
const matNoVegas = sandbox.signalMaturity('long', null, 50, 2);
assert(matNoVegas.stage === '資料不足', 'signalMaturity：VEGAS 缺資料時應回傳「資料不足」');
const matNoAux = sandbox.signalMaturity('long', { signal: 'bull' }, null, null);
assert(matNoAux.stage === '資料不足', 'signalMaturity：RSI 與 24H 皆缺時應回傳「資料不足」');
// 資料齊全時不可誤判為資料不足（不改變既有 6 狀態行為）
const matOk = sandbox.signalMaturity('long', { signal: 'bear' }, 50, 2);
assert(matOk.stage === '失效', 'signalMaturity：資料齊全且逆 VEGAS 時應維持既有「失效」判斷');

// buildSignalVerdict 缺資料情境：誠實顯示、不崩潰、不出現 undefined / NaN
const verdictHTML = sandbox.buildSignalVerdict({
  sym: 'BTC', type: 'long',
  mat: matNoVegas, v: null, wrBreakdown: null,
  rsi: null, macdOk: false, priceOk: false, chg24Ok: false,
});
assert(typeof verdictHTML === 'string' && verdictHTML.length > 0, 'buildSignalVerdict 缺資料時仍應輸出內容，不可空白');
assert(verdictHTML.includes('無法判定'), 'buildSignalVerdict：VEGAS 缺資料時方向應為「無法判定」');
assert(verdictHTML.includes('載入中…'), 'buildSignalVerdict：非同步資料應顯示「載入中…」');
assert(!/undefined|NaN|\bnull\b/.test(verdictHTML), 'buildSignalVerdict 輸出不得含 undefined / NaN / null');
assert(verdictHTML.includes('本判決書為資料整理，非投資建議'), 'buildSignalVerdict 必須包含固定免責尾句');
for (const word of forbidden) {
  assert(!verdictHTML.includes(word), `判決書輸出不得出現禁止詞：「${word}」`);
}

// 資料齊全情境：加分理由來自既有評分明細，不另造數字
const verdictFull = sandbox.buildSignalVerdict({
  sym: 'BTC', type: 'long',
  mat: matOk, v: { signal: 'bull', step2_long: true, step3_long: false },
  wrBreakdown: [
    { label: '基礎分數', detail: '條件排序起點', pts: 0.40 },
    { label: 'VEGAS 順勢', detail: '日線＋4H 多頭排列', pts: 0.08 },
    { label: 'RSI 超買', detail: 'RSI 75', pts: -0.03 },
  ],
  rsi: 75, macdOk: true, priceOk: true, chg24Ok: true,
});
assert(verdictFull.includes('VEGAS 順勢'), 'buildSignalVerdict 加分理由應來自既有評分明細');
assert(verdictFull.includes('分數 +8'), 'buildSignalVerdict 加分幅度應等於明細 pts×100，不另造數');
assert(verdictFull.includes('RSI 超買'), 'buildSignalVerdict 風險應列出明細中的扣分項');

// ── 6. 免責聲明與判決書卡存在於頁面 ──
assert(html.includes('免責聲明'), '頁面固定免責聲明必須存在');
assert(html.includes('AI 訊號判決書'), '詳情頁必須有 AI 訊號判決書卡');
assert(html.includes('資料完整度'), '詳情頁必須有資料完整度區塊');

console.log('✅ phase1_explain_layer.test.js passed');
