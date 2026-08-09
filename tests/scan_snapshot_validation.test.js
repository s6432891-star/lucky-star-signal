const fs=require('fs');
const path=require('path');
const assert=require('assert');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const match=html.match(/function validateScanSnapshot\(snapshot,now=Date\.now\(\)\)\{[\s\S]*?\n\}/);
assert.ok(match,'找不到 validateScanSnapshot');
const validate=new Function('SCAN_LOGIC_VERSION','SCAN_SNAPSHOT_MAX_AGE_MS',`${match[0]}; return validateScanSnapshot;`)('2026-08-07-v1',30*60*1000);
const now=Date.parse('2026-08-07T04:40:00+08:00');
const base={
  schemaVersion:1,
  complete:true,
  logicVersion:'2026-08-07-v1',
  startedAt:'2026-08-07T04:33:00+08:00',
  completedAt:'2026-08-07T04:34:50+08:00',
  generatedAt:'2026-08-07T04:35:00+08:00',
  sourceSha:'0'.repeat(40),
  universeSourceOk:true,
  universeHash:'1'.repeat(64),
  contentSha256:'2'.repeat(64),
  scannedTotal:2,
  validTotal:1,
  symbols:['BTC','ETH'],
  coverage:{universeSourceOk:true,attempted:2,succeeded:1,insufficientHistory:1,failed:0,bySymbol:{BTC:{status:'succeeded',reason:''},ETH:{status:'insufficientHistory',reason:'confirmed_history_below_677'}}},
  vegasData:[{sym:'BTC',signal:'bull',score:80}]
};

assert.equal(validate(base,now).ok,true,'30分鐘內完整快照應通過');
assert.equal(validate({...base,complete:false},now).ok,false,'未完成快照必須拒絕');
assert.equal(validate({...base,universeSourceOk:false},now).ok,false,'動態幣池來源失敗必須拒絕');
assert.equal(validate({...base,coverage:{...base.coverage,failed:1,insufficientHistory:0,bySymbol:{...base.coverage.bySymbol,ETH:{status:'failed',reason:'api'}}}},now).ok,false,'任一核心掃描失敗必須拒絕');
assert.equal(validate({...base,logicVersion:'old'},now).ok,false,'舊策略版本快照必須拒絕');
assert.equal(validate({...base,generatedAt:'2026-08-07T04:09:59+08:00'},now).ok,false,'超過30分鐘快照必須拒絕');
assert.equal(validate({...base,scannedTotal:3},now).ok,false,'掃描總數不符必須拒絕');
assert.equal(validate({...base,symbols:['BTC','BTC']},now).ok,false,'重複幣種快照必須拒絕');
assert.equal(validate({...base,validTotal:2},now).ok,false,'有效結果數不符必須拒絕');
assert.equal(validate({...base,vegasData:[{sym:'DOGE',signal:'bull',score:80}]},now).ok,false,'結果不在掃描清單必須拒絕');
assert.equal(validate({...base,vegasData:[{sym:'BTC',signal:'bull',score:null}]},now).ok,false,'缺少分數快照必須拒絕');
assert.equal(validate({...base,vegasData:[{sym:'BTC',signal:'bull',score:NaN}]},now).ok,false,'NaN 分數快照必須拒絕');
assert.equal(validate({...base,vegasData:[{sym:'BTC',signal:'bull',score:Infinity}]},now).ok,false,'Infinity 分數快照必須拒絕');
assert.equal(validate({...base,vegasData:[{sym:'BTC',signal:'execute-now',score:80}]},now).ok,false,'未知 signal 快照必須拒絕');

console.log('✅ scan_snapshot_validation.test.js passed');
