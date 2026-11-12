const meridianDialog=make('dialog','cgMeridian','<header class="cg-dialog-head"><h2 id="cgMeridianTitle">子午线 3.0 战报与远征模拟</h2><button type="button" id="cgMeridianClose">关闭</button></header><div class="cg-dialog-body" id="cgMeridianBody"></div>');
meridianDialog.className='cg-detail-dialog';
meridianDialog.setAttribute('aria-labelledby','cgMeridianTitle');
by('connected').append(meridianDialog);
by('cgMeridianBody').innerHTML=`
 <p id="cgMeridianStatus" role="status"></p>
 <section id="cgMeridianAudit" aria-label="战报核对" hidden></section>
 <form id="cgMeridianForm">
  <details id="cgMeridianSetup" open>
   <summary>设置整局远征</summary>
   <div class="fields">
    <label>难度<select name="difficulty"><option value="standard">标准</option><option value="frontier" selected>边境</option></select></label>
    <label>协议<select name="protocol"><option value="stable">稳态巡检</option><option value="pulse">超频脉冲</option><option value="aegis">屏障阵列</option><option value="toxin">腐蚀云雾</option><option value="prism">光谱分流</option></select></label>
    <label>购买策略<select name="strategy"><option value="order">依次购买</option><option value="cheapest">价格优先</option><option value="damage_first">伤害优先</option><option value="survival_first">生存优先</option></select></label>
    <label>随机种子<input name="seed" type="number" min="0" max="4294967295" required value="42"></label>
    <label>初始物理伤害<input name="physical" type="number" min="0" max="80" step="0.25" required value="12"></label>
    <label>补给倍率<input name="supplyRate" type="number" min="0" max="9" required value="1"></label>
    <label>观察时长（秒）<input name="limitSeconds" type="number" min="1" max="86400" required value="1800"></label>
   </div>
   <div class="cg-rule-checks">
    <label><input name="auto" type="checkbox" checked>自动强化</label>
    <label><input name="offline" type="checkbox" checked>离线时作战</label>
    <label><input name="autoMedals" type="checkbox" checked>在线到达章末后立即领奖章</label>
    <label><input name="correctResidual" type="checkbox" checked>校正极小浮点残血</label>
   </div>
   <details><summary>安排回访、装备与刷取</summary>
    <p>按日历秒数填写操作。手动领章时关闭立即领章。离线从操作时点开始，value 填离线秒数。装备、合成、购买用游戏内 ID，刷取用关卡号。</p>
    <label>操作列表（JSON）<textarea name="actions" rows="4" spellcheck="false" placeholder='[{"at":45,"action":"away","value":90}]'>[]</textarea></label>
    <p>action 可填 medal（领奖章）、equip（装备）、craft（合成）、farm（刷取）、route（回主线）、buy（强化）、away（离线）。</p>
   </details>
  </details>
  <div class="actions"><button class="primary" id="cgMeridianRun">重新模拟</button><button type="button" id="cgMeridianExport" disabled>导出模拟战报</button></div>
 </form>
 <section id="cgMeridianResult" aria-label="远征结果" hidden></section>`;
const meridianForm=by('cgMeridianForm');
let meridianSource=null, meridianAudit=null, meridianResult=null, meridianWorking=false;
const meridianFields={elapsed:'游戏用时',completed:'通关状态',cleared:'逐关通关记录',medals:'奖章',chapterRewardClaimed:'最终奖章',
 wallet:'钱包',levels:'强化等级',failures:'失败场次',purchases:'购买',battles:'战斗',equipment:'装备',farmingWins:'刷取胜场'};
function meridianValue(value){
 const text=value===undefined?'缺失':typeof value==='string'?value:JSON.stringify(value);
 return escape(text.length>300?text.slice(0,300)+'…':text);
}
function renderMeridianAudit(){
 const panel=by('cgMeridianAudit');
 panel.hidden=!meridianAudit;
 if(!meridianAudit){panel.replaceChildren();return;}
 const {evidence,comparison}=meridianAudit;
 const discrepancies=evidence.discrepancies.map(row=>'<li>'+escape(row.label)+'，战报 '+meridianValue(row.actual)+'，复算 '+meridianValue(row.expected)+'</li>').join('');
 const floating=evidence.floating.map(row=>'<li>第'+row.stage+'关第'+row.turn+'击后残血 '+row.enemyHp.toExponential(3)+'。原战报第'+row.recordedEnd+'秒结束，随后多受到 '+f(row.extraCounterDamage)+' 点反击伤害。</li>').join('');
 const mechanics=Object.entries(evidence.mechanics).map(([name,count])=>escape(name)+' '+count+'次').join('、');
 const simulated=!!meridianSource.workshopSimulation;
 panel.innerHTML='<h3>'+(simulated?'工坊模拟战报':'原战报核对')+'</h3><p>读取 '+meridianSource.cleared.length+' / 12 关、'+evidence.battles+' 场 3.0 战斗、'+evidence.turns+' 次逐击和 '+evidence.purchases+' 笔强化。'+
  (evidence.differenceCount?'发现 '+evidence.differenceCount+' 处记录与规则不一致。':'已核对的字段与原版规则一致。')+'</p>'+
  (comparison?'<p>'+(simulated?'已按随战报保存的规则和操作重跑。':'按战报设置开局、在线立即领奖章。')+(comparison.different.length?'整局对照有差异（'+comparison.different.map(k=>meridianFields[k]).join('、')+'）。'+(simulated?'':'原战报未记下完整的玩家操作，已知操作可填入下方重跑。'):'整局过关时点、钱包、购买与逐击记录均可重现。')+'</p>':'')+
  (!evidence.completeHistory?'<p>战报只保存了部分历史战斗，逐击核对覆盖文件中的记录。</p>':'')+
  (evidence.legacyFights?'<p>含 '+evidence.legacyFights+' 场旧版本战斗。逐击只核对 3.0 记录，混合版本的价格和首通奖励不作逐笔判断。</p>':'')+
  (mechanics?'<p>触发记录　'+mechanics+'。</p>':'')+
  (discrepancies?'<details><summary>查看核对差异（最多 50 项）</summary><ul>'+discrepancies+'</ul></details>':'')+
  (floating?'<details open><summary>发现浮点残血（'+evidence.floating.length+' 场）</summary><ul>'+floating+'</ul></details>':'');
}
function renderMeridianResult(){
 const panel=by('cgMeridianResult');
 panel.hidden=!meridianResult;
 by('cgMeridianExport').disabled=!meridianResult||meridianWorking;
 if(!meridianResult){panel.replaceChildren();return;}
 const {report,wallSeconds,completionWallSeconds,claimed,medalDue,parts,crystals,equipment}=meridianResult;
 const rows=Array.from({length:12},(_,i)=>'<tr><th scope="row">第'+(i+1)+'关</th>'+
  (meridianSource?'<td>'+time(meridianSource.cleared[i]?.time??null)+'</td>':'')+
  '<td>'+time(report.cleared[i]?.time??null)+'</td></tr>').join('');
 panel.innerHTML='<h3>本次模拟</h3><p>通过 '+report.cleared.length+' / 12 关。游戏内 '+time(report.elapsed)+'，'+
  (completionWallSeconds===null?'观察至日历 '+time(wallSeconds)+'。':'首次通关日历用时 '+time(completionWallSeconds)+'。')+
  (medalDue?'第'+medalDue+'关奖章待领，主线暂停。':'')+'</p>'+
  '<p>金币余额 '+f(report.wallet.balance)+'，固定补给 '+f(report.wallet.passive)+'，战斗奖励 '+f(report.wallet.rewards)+'，强化花费 '+f(report.wallet.spent)+'。机件 '+parts+'，晶体 '+crystals+'，刷取胜场 '+report.farmingWins+'。</p>'+
  (equipment.length?'<p>已装备 '+equipment.map(item=>escape(item.name)+' '+item.level+'级').join('、')+'。</p>':'')+
  (claimed.length?'<ul>'+claimed.map(row=>'<li>'+time(row.elapsed)+'领取第'+row.stage+'关奖章，每批补给 '+row.payoutBefore+' → '+row.payoutAfter+'</li>').join('')+'</ul>':'')+
  '<div class="cg-table-scroll"><table class="cg-check-table"><thead><tr><th>关卡</th>'+
  (meridianSource?'<th>原战报用时</th>':'')+'<th>模拟用时</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function configureMeridian(settings,limit,correctResidual){
 meridianForm.reset();
 if(settings)for(const [key,value] of Object.entries(settings)){
  const control=meridianForm.elements.namedItem(key);
  if(!control)continue;
  if(control.type==='checkbox')control.checked=value;
  else control.value=String(value);
 }
 meridianForm.elements.limitSeconds.value=limit;
 meridianForm.elements.correctResidual.checked=correctResidual;
 by('cgMeridianSetup').open=!settings;
}
function showMeridian(source=null,audited=null){
 meridianSource=source;
 meridianAudit=audited;
 meridianResult=audited?.simulation??null;
 configureMeridian(audited?.settings,source?Math.min(86400,Math.max(900,source.elapsed)):1800,!source);
 if(source?.workshopSimulation&&meridianResult){
  const options=meridianResult.options, fields=meridianForm.elements;
  fields.limitSeconds.value=options.limitSeconds;
  fields.autoMedals.checked=options.autoMedals;
  fields.correctResidual.checked=options.correctResidual;
  fields.actions.value=JSON.stringify(options.actions,null,2);
 }
 by('cgMeridianStatus').textContent=source?'已直接读取子午线 3.0 战报。':'使用子午线 3.0 原版规则模拟三章远征。';
 renderMeridianAudit();
 renderMeridianResult();
 if(!meridianDialog.open)meridianDialog.showModal();
}
async function openMeridianReport(report){
 if(busy)throw Error('请等当前计算结束，再导入子午线战报。');
 lock(true);
 try{showMeridian(report,await callWorker({type:'meridianAudit',report}));notice('已读取子午线 3.0 战报。');}
 finally{lock(false);}
}
const openMeridianButton=make('button','cgOpenMeridian','子午线 3.0');
openMeridianButton.type='button';
entryIndex.append(openMeridianButton);
homeImport.textContent='导入数值表、项目或战报';
openMeridianButton.onclick=()=>{if(!busy)showMeridian();};
by('cgMeridianClose').onclick=()=>{if(!meridianWorking)meridianDialog.close();};
meridianDialog.addEventListener('cancel',e=>{if(meridianWorking)e.preventDefault();});
by('cgMeridianExport').onclick=()=>{if(meridianResult)download('子午线-工坊模拟战报.json',{...meridianResult.report,workshopSimulation:meridianResult.options});};
meridianForm.onsubmit=async e=>{
 e.preventDefault();
 if(busy||meridianWorking)return;
 const fields=meridianForm.elements;
 let actions;
 try{actions=JSON.parse(fields.actions.value||'[]');}
 catch{by('cgMeridianStatus').textContent='操作列表的 JSON 格式有误。';return;}
 const settings={difficulty:fields.difficulty.value,protocol:fields.protocol.value,strategy:fields.strategy.value,
  seed:fields.seed.valueAsNumber,physical:fields.physical.valueAsNumber,supplyRate:fields.supplyRate.valueAsNumber,
  auto:fields.auto.checked,offline:fields.offline.checked};
 const options={limitSeconds:fields.limitSeconds.valueAsNumber,autoMedals:fields.autoMedals.checked,
  correctResidual:fields.correctResidual.checked,actions};
 meridianWorking=true;
 lock(true);
 by('cgMeridianRun').disabled=by('cgMeridianClose').disabled=by('cgMeridianExport').disabled=true;
 by('cgMeridianStatus').textContent='正在复算整局远征…';
 try{
  meridianResult=await callWorker({type:'meridianSimulate',settings,options});
  by('cgMeridianStatus').textContent=options.correctResidual?'已复算，启用浮点残血校正。':'已复算，采用原版浮点判定。';
 }catch(error){by('cgMeridianStatus').textContent=error.message+(meridianResult?' 已保留上一次结果。':'');}
 finally{
  lock(false);
  meridianWorking=false;
  by('cgMeridianRun').disabled=by('cgMeridianClose').disabled=false;
  renderMeridianResult();
 }
};
