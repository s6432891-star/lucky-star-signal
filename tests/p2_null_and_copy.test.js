const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function extractFunction(name){
  const start=html.indexOf(`function ${name}(`);assert.ok(start>=0,`找不到 ${name}`);
  const brace=html.indexOf('{',start);let depth=0,quote=null,esc=false;
  for(let i=brace;i<html.length;i++){
    const ch=html[i];
    if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===quote)quote=null;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;if(ch==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`無法抽出 ${name}`);
}

test('Top5 null 漲跌不得崩潰或冒充0%',()=>{
  const src=extractFunction('formatMarketChange');const box={};
  new Function(`${src}\nthis.fn=formatMarketChange;`).call(box);
  assert.deepEqual(box.fn(null,1),{value:null,text:'無資料',cls:'neu'});
  assert.deepEqual(box.fn(undefined,1),{value:null,text:'無資料',cls:'neu'});
  assert.equal(box.fn(1.26,1).text,'+1.3%');
  const recs=html.slice(html.indexOf('function renderRecs('),html.indexOf('// ═══ C3'));
  assert.doesNotMatch(recs,/c\.ch\.toFixed/);
});

test('缺24H資料不得生成相對BTC強弱結論',()=>{
  const src=extractFunction('compareToBTC');const box={};
  new Function(`${src}\nthis.fn=compareToBTC;`).call(box);
  assert.equal(box.fn(null,1,'long').tag,'資料不足');
  assert.equal(box.fn(1,null,'long').tag,'資料不足');
  assert.equal(box.fn(3,1,'long').tag,'強於BTC');
  const detail=html.slice(html.indexOf('function openMOVEDetail('),html.indexOf('async function fetchAndUpdateFRLS'));
  assert.doesNotMatch(detail,/\brelBTC\b/,'詳情仍引用可能把null當0的舊相對強弱變數');
});

test('任何說明與回踩文案不得繞過可執行閘門',()=>{
  assert.doesNotMatch(html,/附勝率、EV、建議倉位|高勝率反彈點|最多輕倉\s*30%|回踩到位，可進場|最佳進場時機|進場時機(?:最佳|佳)|Top5 的硬門檻|勝率較低/);
  const detail=html.slice(html.indexOf('function openMOVEDetail('),html.indexOf('async function fetchAndUpdateFRLS'));
  assert.match(detail,/guidance\.executable/,'回踩詳情未使用統一執行閘門');
  assert.match(detail,/整理中[^`]*不進場/,'VEGAS整理文案未明確禁止進場');
});
