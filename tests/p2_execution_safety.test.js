const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const recs = html.slice(html.indexOf('function renderRecs('), html.indexOf('// ═══ C3', html.indexOf('function renderRecs(')));
const detail = html.slice(html.indexOf('function openMOVEDetail('), html.indexOf('async function fetchAndUpdateFRLS', html.indexOf('function openMOVEDetail(')));
const asyncMetrics = html.slice(html.indexOf('async function fetchAndUpdateFRLS'), html.indexOf('// ── 幣種快訊', html.indexOf('async function fetchAndUpdateFRLS')));

test('自動推薦只顯示信心分數，不宣稱統計勝率或自動 EV/Kelly', () => {
  assert.match(html, /function isExecutableSignal\s*\(/, '缺少統一可執行判定');
  assert.match(recs, /信心分數/, 'Top5 尚未改成信心分數');
  assert.doesNotMatch(recs, /綜合勝率評比|>勝率<|>EV<|>RR</, 'Top5 仍把手工分數當勝率／EV／RR');
  assert.doesNotMatch(detail, /const ev\s*=|const kelly\s*=|簡算勝率/, '詳情仍自動產生 EV/Kelly/假勝率');
  assert.doesNotMatch(asyncMetrics, /wr \+=|wr -=|Math\.min\(0\.82/, 'FR/L/S 仍重複加減勝率');
});

test('未達已收盤 Step3 不得提供倉位，達標也不得自動給 50/100/200%', () => {
  assert.match(html, /function positionGuidance\s*\(/, '缺少統一倉位文案 helper');
  assert.doesNotMatch(recs, /posPct=critCount>=3\?200/, 'Top5 仍自動給 200%');
  assert.doesNotMatch(detail, /positionPct=200|positionPct=100|positionPct=50/, '詳情仍自動給 50/100/200%');
  assert.match(detail, /不進場/, '未成熟訊號未明確顯示不進場');
  assert.match(detail, /自行設定單筆風險/, '成熟訊號仍未要求使用者自行設定風險');
});

test('通知只能由已收盤可執行訊號觸發', () => {
  assert.match(recs, /isExecutableSignal\(['"]long['"],/, '做多通知未檢查可執行條件');
  assert.match(recs, /isExecutableSignal\(['"]short['"],/, '做空通知未檢查可執行條件');
  assert.doesNotMatch(html, /高勝率訊號：/, '通知標題仍宣稱高勝率');
  assert.match(html, /已收盤條件成立/, '通知未說明已收盤確認');
});

function extractFunction(name){
  const start=html.indexOf(`function ${name}(`);
  assert.ok(start>=0,`找不到 ${name}`);
  const brace=html.indexOf('{',start);
  let depth=0,quote=null,escape=false;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){
      if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`無法抽出 ${name}`);
}

test('成熟度與執行閘門共用資料完整與過熱規則',()=>{
  const src=['executionRiskState','signalMaturity','isExecutableSignal','positionGuidance'].map(extractFunction).join('\n');
  const box={};
  new Function(`${src}\nthis.signalMaturity=signalMaturity;this.isExecutableSignal=isExecutableSignal;this.positionGuidance=positionGuidance;`).call(box);
  const ready={signal:'bull',step3_long:true,step3_short:false,isFakeBreakout:false};
  assert.equal(box.signalMaturity('long',ready,74,9).stage,'過熱');
  assert.equal(box.isExecutableSignal('long',ready,74,9),false,'成熟度過熱不得可執行');
  assert.equal(box.isExecutableSignal('long',ready,null,2),false,'RSI缺資料不得可執行');
  assert.equal(box.isExecutableSignal('long',{...ready,isFakeBreakout:true},60,2),false,'假突破不得可執行');
  assert.equal(box.isExecutableSignal('long',{...ready,signal:'bear'},60,2),false,'方向相反不得可執行');
  assert.equal(box.isExecutableSignal('long',ready,60,2),true,'完整且未過熱的已收盤Step3應可執行');
  const blocked=box.positionGuidance('long',{...ready,step3_long:false},60,2);
  assert.equal(blocked.executable,false);
  assert.ok(blocked.reason&&!blocked.reason.includes('undefined'),'不可執行指引必須提供具體原因');
});

test('其他入口不得殘留未校準勝率、RR、EV與自動SL',()=>{
  const volume=html.slice(html.indexOf('function calcRealVolPattern'),html.indexOf('// ═══ 即時新聞'));
  const pullback=html.slice(html.indexOf('function renderPullback'),html.indexOf('function renderNearPullback'));
  assert.doesNotMatch(volume,/\bwr\s*:|\brr\s*:|const ev\s*=|>勝率<|>RR</);
  assert.doesNotMatch(pullback,/slPct|即時勝率|止損參考/);
});

test('OKX請求與週期工作具備全域限流及single-flight',()=>{
  assert.doesNotMatch(html,/fetch\(['"`]https:\/\/www\.okx\.com/,'仍有OKX請求繞過限流器');
  assert.match(html,/let _fastRunning=false/);
  assert.match(html,/let _realIndicatorsRunning=false/);
  assert.match(html,/let _vegasRunning=false/);
});
