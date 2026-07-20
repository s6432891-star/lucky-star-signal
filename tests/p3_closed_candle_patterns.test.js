const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,`找不到 ${start}`);
  return html.slice(a,b);
}

test('MOVE 型態只使用已收盤 4H OHLCV',()=>{
  const detectors=section('function detectPA(','// 舊版 detectPats');
  assert.match(html,/closedH4/, 'VEGAS 結果未保存已收盤4H K棒');
  assert.match(detectors,/getClosedH4\(c\)/, '型態偵測器未讀取已收盤4H資料');
  assert.doesNotMatch(detectors,/price_change_percentage_24h|high_24h|low_24h|total_volume/, '仍用24H單一快照冒充多根K棒');
});

test('未收盤 K 棒不得進入型態資料集',()=>{
  const helper=section('function getClosedH4(','function detectPA(');
  assert.match(helper,/\.filter\([^)]*confirmed/, '沒有過濾 confirmed=true');
  assert.doesNotMatch(helper,/confirmed\s*!==\s*false/, '未收盤或狀態不明的K棒仍可能被接受');
});

test('雙頂雙底與旗形必須由多根真實K棒結構判定',()=>{
  const pattern=section('function detectPattern(','// ── 篩選標準3');
  assert.match(pattern,/findLocalExtrema/, '雙頂雙底沒有使用局部高低點');
  assert.match(pattern,/candles\.length/, '型態沒有資料根數門檻');
  assert.match(pattern,/volumeAverage/, '旗形突破沒有使用真實成交量確認');
});

test('未收盤4H棒不得改變量價型態或VEGAS方向資料集',()=>{
  const src=section('function calcRealVolPattern(','// ═══ 成交量暴增偵測');
  const box={};
  new Function(`${src}\nthis.calcRealVolPattern=calcRealVolPattern;`).call(box);
  const closed=Array.from({length:20},(_,i)=>({confirmed:true,open:100,high:101,low:99,close:100,vol:100,ts:i}));
  closed.push({confirmed:true,open:100,high:102,low:99,close:102,vol:250,ts:20});
  const expected=box.calcRealVolPattern(closed);
  const unclosed={confirmed:false,open:102,high:110,low:80,close:81,vol:99999,ts:21};
  assert.deepEqual(box.calcRealVolPattern([...closed,unclosed]),expected,'未收盤棒改變了量價型態');
  assert.equal(expected?.name,'🚀 放量突破');
  assert.match(html,/const pat=vd\?\.volPat4H\|\|null/,'成交量頁仍未使用已收盤4H量價結果');
  assert.doesNotMatch(html,/function detectVolPattern\(/,'仍保留24H快照型態fallback');
  const compute=section('async function computeVEGAS(','const CG_MAP=');
  assert.match(compute,/const h4=h4Confirmed/,'4H EMA方向未統一使用已收盤資料');
  assert.doesNotMatch(compute,/const h4\s*=\s*h4raw\.map/,'仍把未收盤4H收盤價放入EMA方向');
});
