const ConnectedIntake=(()=>{
 const C=ConnectedCore,M=C.multi,clean=s=>String(s??'').trim(),norm=s=>clean(s).toLowerCase().replace(/[\s_（）()：:／/·.\-]/g,''),clone=x=>structuredClone(x);
 const maxItems=5000,maxCells=50000,maxJSONBytes=256*1024*1024,maxTableBytes=15*1024*1024;
 function itemLimit(){throw Error('本次有超过5000项数据，请分表导入；当前项目没有改动。');}
 function gridLimit(){throw Error('JSON表格展开后超过50000个单元格，请分表导入；当前项目没有改动。');}
 const aliases={hp:['生命','血量','生命值','最大生命','生命上限','hp','maxhp'],physicalMin:['最小攻击','最小物伤','最小伤害','最小物理伤害','physicalmin'],physicalMax:['最大攻击','最大物伤','最大伤害','最大物理伤害','physicalmax'],physicalPair:['物理伤害','单击伤害','攻击伤害','物攻','hitdamage'],frequency:['攻速','攻击速度','攻击频率','攻击间隔','出手间隔','frequency','attackinterval'],critChance:['暴击率','暴击概率','critchance'],critBonus:['暴击额外伤害','额外暴伤','暴伤加成','critbonus'],armor:['护甲','防御','护甲值','armor'],flatPen:['固定穿透','固定护穿','flatpen'],percentPen:['比例穿透','百分比穿透','percentpen'],fire:['火伤','火焰伤害','fire'],ice:['冰伤','冰霜伤害','ice'],lightning:['电伤','雷伤','闪电伤害','lightning'],poison:['毒伤','毒性直伤','poison'],lightningResist:['电抗','雷抗','电抗性','闪电抗性'],iceResist:['冰抗','冰霜抗性'],fireResist:['火抗','火焰抗性'],physicalResist:['物抗','物理抗性'],poisonResist:['毒抗','毒性抗性']};
 const extras=[
 ['world.stageCount','关卡 / 总关数','count',['关数','总关数','关卡数量','一共多少关','stagecount']],
 ['world.rewardBase','奖励 / 第一关首通金币','number',['首通奖励','第一关奖励','首关金币','rewardbase']],
 ['world.rewardStep','奖励 / 后面每关多给金币','number',['奖励增量','每关奖励增加','rewardstep']],
 ['economy.initialCoins','奖励 / 初始金币','number',['初始金币','起始金币','初始资源','initialcoins']],
 ['economy.incomePerSecond','奖励 / 固定每秒金币','number',['每秒金币','每秒收入','金币秒产','固定收入','incomepersecond']],
 ['behavior.sessionMinutes','回访 / 每次在线分钟','minutes',['在线时长','每次在线','sessionminutes']],
 ['behavior.offlineCapHours','回访 / 离线收入上限小时','hours',['离线上限','离线收益上限','offlinecaphours']],
 ['simulation.observationSeconds','检查 / 最多观察时间','seconds',['观察时间','观察期','observationseconds']],
 ['rules.battleTimeoutSeconds','战斗 / 每场时限秒','seconds',['战斗时限','每场最多','战斗超时','timeout']],
 ['rules.armorK','战斗 / 护甲换算尺度','number',['护甲尺度','护甲常数','armork']]
 ];
 function targets(g){
  const rows=[];for(const side of ['player','enemy'])for(const[k,n]of [...M.FIELDS,...M.TYPES.map(t=>[t+'Reduction',M.NAMES[t]+'减抗']),['physicalPair','固定物理单击（最小和最大一起填）']])rows.push({id:(side==='player'?'player.':'world.enemy.')+k,label:(side==='player'?'角色':'敌人')+' / '+n,kind:k==='frequency'?'frequency':M.legacy.PERCENT_FIELDS.has(k)||k.endsWith('Reduction')||k==='armor'&&C.rules.defense(g)==='ratio'?'percent':'number',field:k,side,aliases:[k,n,...(aliases[k]||[])]});
  rows.push(...extras.map(([id,label,kind,alias])=>({id,label,kind,aliases:alias})));
  for(const[k,n]of M.FIELDS)rows.push({id:'world.steps.'+k,label:'关卡 / 每关增加'+n,kind:M.legacy.PERCENT_FIELDS.has(k)?'percent':'number',field:k,aliases:['每关增加'+n,'每关'+n+'增加',k+'step']});
  for(const u of g.upgrades)for(const[k,label]of [['increment','每级增加数值'],['costBase','第一次购买金币'],['costStep','以后每级多花金币'],['maxLevel','最多升级次数']])rows.push({id:'upgrade.'+u.id+'.'+k,label:(u.name||u.id)+'升级 / '+label,kind:k==='maxLevel'?'count':k==='increment'&&M.legacy.PERCENT_FIELDS.has(u.fields[0])?'percent':'number',upgrade:u.id,upgradeKey:k,aliases:[label,k,...(k==='costBase'?['首次费用','初始价格','强化费用','初次费用']:k==='costStep'?['每级涨价','加价','价格增量']:k==='increment'?['每级增加','每级提升','每级加成','升级增量']:['等级上限','最高等级'])]});
  return rows;
 }
 function entries(sheets){const out=[],add=item=>{if(out.length===maxItems)itemLimit();out.push(item);};
  for(const sheet of sheets){const data=sheet.rows;if(!Array.isArray(data)||!data.length)continue;const headers=data[0].map(clean),patt={owner:/^(对象|归属|所属|角色|类型|owner|side|group|name)$/i,key:/^(属性|字段|参数|项目|attribute|field|key|stat)$/i,value:/^(值|数值|数量|value|amount)$/i,unit:/^(单位|unit)$/i};const indices=Object.fromEntries(Object.entries(patt).map(([k,re])=>[k,headers.findIndex(h=>re.test(h))]));
   if(indices.key>=0&&indices.value>=0){for(let i=1;i<data.length;i++){const row=data[i],name=clean(row[indices.key]);if(!name)continue;const owner=indices.owner>=0?clean(row[indices.owner]):sheet.name,unit=indices.unit>=0?clean(row[indices.unit]):'';add({key:sheet.name+'|'+owner+'|'+name,source:sheet.name+' · '+(i+1)+'行',owner,name,unit,value:row[indices.value]??'',row:i,column:indices.value});}}
   else if(headers.length===2&&!data.slice(1).some(row=>Array.isArray(row)&&row.length>2)&&headers.some(h=>/属性|参数|字段|value|key|数值/.test(h))){for(let i=1;i<data.length;i++)if(clean(data[i][0]))add({key:sheet.name+'||'+clean(data[i][0]),source:sheet.name+' · '+(i+1)+'行',owner:sheet.name,name:clean(data[i][0]),value:data[i][1]??'',unit:'',row:i,column:1});}
   else {for(let i=1;i<data.length;i++){const row=data[i],owner=indices.owner>=0?clean(row[indices.owner]):sheet.name;for(let j=0;j<headers.length;j++){if(j===indices.owner||!headers[j]||row[j]===undefined||row[j]==='')continue;add({key:sheet.name+'|'+owner+'|'+headers[j]+(data.length>2&&indices.owner<0?'|'+i:''),source:sheet.name+' · '+(i+1)+'行',owner,name:headers[j],value:row[j],unit:'',row:i,column:j});}}}
  }if(!out.length)throw Error('表格里没有可预览的数据。请保留首行标题，或用“对象、属性、数值、单位”四列。');return out;
 }
 function fromJSON(data){
  if(Array.isArray(data)){
   if(!data.length)throw Error('JSON表格为空');
   if(data.every(Array.isArray)){
    if(data.reduce((count,row)=>count+row.length,0)>maxCells)gridLimit();
    return [{name:'JSON',rows:data}];
   }
   if(data.every(x=>x&&typeof x==='object'&&!Array.isArray(x))){
    const fields=new Set();
    for(const row of data)for(const key of Object.keys(row)){
     fields.add(key);
     if(fields.size*(data.length+1)>maxCells)gridLimit();
    }
    const keys=[...fields];
    return [{name:'JSON',rows:[keys,...data.map(row=>keys.map(key=>row[key]??''))]}];
   }
   throw Error('JSON数组请使用对象行，或包含首行标题的二维表');
  }
  if(!data||typeof data!=='object')throw Error('JSON需要是对象或表格数组');
  const rows=[['对象','属性','数值','单位']];
  let count=0;
  function walk(x,path=[]){
   if(path.length>12||++count>maxCells)throw Error('JSON层级或条目过多，请缩小导入范围');
   for(const [key,value] of Object.entries(x)){
    if(value&&typeof value==='object')walk(value,[...path,key]);
    else{
     if(rows.length>maxItems)itemLimit();
     rows.push([path.join(' / '),key,value??'','']);
    }
   }
  }
  walk(data);
  return [{name:'JSON',rows}];
 }
 async function readFile(file,XLSX){
  const isJSON=/\.json$/i.test(file.name);
  if(file.size>(isJSON?maxJSONBytes:maxTableBytes))throw Error(isJSON?'文件超过256MB，请减少一次导出的记录':'表格超过15MB，请缩小表格后导入');
  if(isJSON){
   try{return {data:JSON.parse(await file.text())};}
   catch{throw Error('JSON格式有误，请检查逗号与括号；当前项目未改动');}
  }
  if(!XLSX)throw Error('表格读取组件未载入，请刷新页面再试');
  const bytes=await file.arrayBuffer();
  let raw;
  if(/\.(csv|tsv)$/i.test(file.name)){
   try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
   catch{raw=new TextDecoder('gb18030').decode(bytes);}
  }
  const book=XLSX.read(raw??bytes,{type:raw!==undefined?'string':'array',raw:true,cellNF:true,cellFormula:true});
  return {sheets:readBook(book,XLSX)};
 }
 function exportJSON(data){
  const tooLarge=()=>Error('导出的记录超过256MB。可以导出当前试算或只导出项目配置。');
  let text;
  try{text=JSON.stringify(data);}
  catch(error){if(error instanceof RangeError)throw tooLarge();throw error;}
  if(text.length>maxJSONBytes)throw tooLarge();
  const options={type:'application/json'};
  const blob=new Blob([text],options);
  if(blob.size>maxJSONBytes)throw tooLarge();
  return blob.size<=1024*1024?new Blob([JSON.stringify(data,null,2)],options):blob;
 }
 function readBook(book,XLSX){return book.SheetNames.map(name=>{const sheet=book.Sheets[name],range=sheet['!ref']?XLSX.utils.decode_range(sheet['!ref']):null;if(range&&(range.e.r>5000||range.e.c>99||(range.e.r+1)*(range.e.c+1)>50000))throw Error('工作表“'+name+'”超过5000行、100列或50000个单元格，请缩小范围');const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''}),formulas=[];for(const[ref,c]of Object.entries(sheet)){if(ref[0]==='!')continue;const p=XLSX.utils.decode_cell(ref);if(c.f)formulas.push({cell:ref,formula:c.f,cached:c.v??null});if(c.z&&/%/.test(c.z)&&typeof c.v==='number'&&rows[p.r])rows[p.r][p.c]=C.scaled(String(c.v),'100')+'%';}return {name,rows,formulas};});}
 function suggestAll(items,list,saved={}){
  const targets=new Map(list.map(target=>[target.id,target])),byAlias=new Map(),fallback=new Map();
  for(const target of list)for(const alias of new Set(target.aliases.map(norm))){
   if(!byAlias.has(alias))byAlias.set(alias,[]);
   byAlias.get(alias).push(target);
  }
  for(const item of items)fallback.set('|'+item.owner+'|'+item.name,undefined);
  for(const [key,mapping] of Object.entries(saved)){
   for(let at=key.indexOf('|');at!==-1;at=key.indexOf('|',at+1)){
    const suffix=key.slice(at);
    if(!fallback.has(suffix))continue;
    const old=fallback.get(suffix),{target,unit}=mapping;
    if(old===undefined)fallback.set(suffix,{target,unit});
    else if(old&&(old.target!==target||old.unit!==unit))fallback.set(suffix,null);
   }
  }
  return items.map(entry=>suggest(entry,targets,byAlias,saved[entry.key]||fallback.get('|'+entry.owner+'|'+entry.name)));
 }
 function suggest(entry,targets,byAlias,old){if(old&&(!old.target||targets.has(old.target))){const target=targets.get(old.target),inferred=inferUnit(entry,target),explicit=clean(entry.unit)||/[%％]|毫秒|分钟|小时|ms|hz|秒/i.test(entry.name+' '+entry.value),unitChanged=!!(target&&explicit&&old.unit&&inferred&&old.unit!==inferred);return {...old,unit:unitChanged?'':old.unit,reused:true,unitChanged};}const owner=norm(entry.owner),name=norm(entry.name.replace(/\([^)]*\)|（[^）]*）/g,'').replace(/[/／](ms|s|秒|毫秒|%|次.*)$/i,'')),isEnemy=/敌|怪|boss|enemy|monster/.test(owner),isPlayer=/角色|自己|玩家|player|hero/.test(owner);let candidates=byAlias.get(name)||[];
  if(/升级|强化|upgrade/.test(owner)){candidates=candidates.filter(t=>t.upgrade);const relevant=(/生命|血量|vitality|hp/.test(owner)?'vitality':/冰|ice/.test(owner)?'ice':/火|fire/.test(owner)?'fire':/攻|物理|physical/.test(owner)?'physical':null);if(relevant)candidates=candidates.filter(t=>t.upgrade===relevant||t.label.includes(entry.owner));}
  else if(isEnemy||isPlayer)candidates=candidates.filter(t=>t.side===(isEnemy?'enemy':'player'));
  else {const clear=candidates.filter(t=>!t.side&&!t.upgrade);candidates=clear.length?clear:candidates.filter(t=>t.side);}
  return {target:candidates.length===1?candidates[0].id:'',unit:'',reused:false,ambiguous:candidates.length>1,candidates:candidates.map(t=>t.id)};
 }
 function inferUnit(entry,target){const u=norm(entry.name+' '+entry.unit),rawUnit=norm(entry.unit);if(!target)return'';if(target.kind==='percent'){if(/%|％|百分比|百分数/.test(u+entry.value))return 'percent';if(/小数|fraction|ratio|0到1/.test(u))return'ratio';return clean(entry.value)==='0'?'percent':'';}
  if(target.kind==='frequency'){if(/毫秒|ms/.test(u))return'intervalMs';if(/^(s|秒|seconds?)$/.test(rawUnit)||/间隔.*秒|interval.*s|秒每次|s次/.test(u))return'intervalSeconds';if(/次分钟|次分|perminute/.test(u))return'perMinute';if(/次秒|次每秒|persecond|hz/.test(u))return'perSecond';return'';}
  if(['seconds','minutes','hours'].includes(target.kind)){if(/毫秒|ms/.test(u))return'milliseconds';if(/分钟|minutes?|min$/.test(u))return'minutes';if(/小时|hours?|hr$/.test(u))return'hours';if(/秒|seconds?|s$/.test(u))return'seconds';return'';}return'number';}
 function convert(entry,target,unit){if(!target)return {value:null,text:'原值保留，不参与计算'};if(!unit)throw Error('请确认原表单位');const allowed={number:['number'],count:['number'],percent:['percent','ratio'],frequency:['perSecond','perMinute','intervalMs','intervalSeconds'],seconds:['seconds','minutes','hours','milliseconds'],minutes:['seconds','minutes','hours'],hours:['seconds','minutes','hours']};if(!allowed[target.kind]?.includes(unit))throw Error('这个单位不适用于所选字段，请重新选择');if(target.kind==='percent'&&/[％%]$/.test(clean(entry.value))&&unit!=='percent')throw Error('原值已带%，请选择“20表示20%”');const raw=clean(entry.value).replace(/[％%]$/,'').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'');if(!raw)throw Error('原值为空，请补值或选择保留');let n;try{n=C.number(raw);if(!Number.isFinite(n))throw Error();}catch{throw Error('原值不是有效数值');}let value=raw;
  if(target.kind==='percent')value=unit==='percent'?C.scaled(raw,'0.01'):raw;
  else if(target.kind==='frequency'){if(n<=0)throw Error('攻速或间隔必须大于0');value=unit==='intervalMs'?C.fraction('1000',raw):unit==='intervalSeconds'?C.fraction('1',raw):unit==='perMinute'?C.fraction(raw,'60'):raw;}
  else if(['seconds','minutes','hours'].includes(target.kind)){const scale={milliseconds:'0.001',seconds:'1',minutes:'60',hours:'3600'};value=C.fraction(C.scaled(raw,scale[unit]),scale[target.kind]);}
  if(target.kind==='count'&&!Number.isInteger(C.number(value)))throw Error('这里需要整数');return {value,text:clean(entry.value)+(entry.unit?' '+entry.unit:'')+' → '+(target.kind==='percent'?C.number(C.scaled(value,'100'))+'%':value+(target.kind==='frequency'?' 次/秒':['seconds','minutes','hours'].includes(target.kind)?{seconds:' 秒',minutes:' 分钟',hours:' 小时'}[target.kind]:''))};
 }
 function inspect(list,mappings,items){const issues=[],issueIndices=new Set(),used=new Map(),targets=new Map(list.map(t=>[t.id,t])),combat=id=>/^(player\.|world\.enemy\.|rules\.(armorK|battleTimeoutSeconds)$)/.test(id),add=(index,message,ids=[])=>{issueIndices.add(index);issues.push({index,message,affects:ids.some(combat)||!ids.length?'combat':'growth'});};for(let i=0;i<items.length;i++){const m=mappings[i]||{},t=targets.get(m.target);if(!m.target){if(m.ambiguous&&!m.resolved)add(i,'名称有多个对应，请选择字段，或明确选择保留原值',m.candidates);continue;}if(!t){add(i,'字段对应已经变化，请重新选择',[m.target]);continue;}try{convert(items[i],t,m.unit);}catch(e){add(i,e.message,[t.id]);}const keys=t.field==='physicalPair'?['physicalMin','physicalMax'].map(k=>t.id.replace(/physicalPair$/,k)):[t.id];for(const k of keys){if(used.has(k)){add(i,t.label+'对应了多笔原值，请只保留一笔',[t.id]);if(!issueIndices.has(used.get(k)))add(used.get(k),'这个字段还对应了另一笔原值，请只保留一笔',[t.id]);}else used.set(k,i);}}return issues;}
 function apply(g,list,mappings,items){const issue=inspect(list,mappings,items)[0];if(issue){const e=Error(issue.message);e.itemIndex=issue.index;throw e;}const next=clone(g),used=new Set(),changes=[],enabled=new Set();for(let i=0;i<items.length;i++){const m=mappings[i];if(!m?.target)continue;const t=list.find(t=>t.id===m.target);if(!t)throw Error('字段对应已经变化，请重新选择');const keys=t.field==='physicalPair'?[t.id.replace(/physicalPair$/,'physicalMin'),t.id.replace(/physicalPair$/,'physicalMax')]:[t.id];if(keys.some(k=>used.has(k)))throw Error(t.label+'对应了多笔原值，请只保留一笔；工具不会猜测多行之间的增长公式');keys.forEach(k=>used.add(k));const value=convert(items[i],t,m.unit).value;if(t.upgrade){const u=next.upgrades.find(u=>u.id===t.upgrade);if(!u)throw Error('新项目中没有这项升级，请重新选择对应');u[t.upgradeKey]=t.upgradeKey==='maxLevel'?Number(value):value;u.enabled=true;enabled.add((u.name||u.id)+'升级');}
   else if(t.side){const a=t.side==='player'?next.player:next.world.enemy;if(t.field==='physicalPair'){a.physicalMin=value;a.physicalMax=value;}else a[t.field]=value;}
   else{const p=t.id.split('.');let obj=next;for(const key of p.slice(0,-1))obj=obj[key];obj[p.at(-1)]=t.kind==='count'?Number(value):value;}
   const fields=t.upgrade?next.upgrades.find(u=>u.id===t.upgrade).fields:t.field?[t.field]:[];for(const k of fields){for(const type of M.TYPES)if(k.startsWith(type)){next.types[type]=true;enabled.add(M.NAMES[type]+'伤害');}if(k==='physicalPair'){next.types.physical=true;enabled.add('物理伤害');}for(const[mechanism,keys]of Object.entries(M.MECHANISMS))if(keys.includes(k)){next.mechanisms[mechanism]=true;enabled.add({critical:'暴击',armor:'护甲',block:'格挡',leech:'吸血',regen:'回血',bonuses:'伤害增强',resistance:'抗性'}[mechanism]);}if(M.TYPES.some(t=>k===t+'Reduction')){next.mechanisms.resistance=true;enabled.add('抗性');}}
   changes.push(t.label+' = '+value);
  }return {game:next,changes,enabled:[...enabled]};}
 return {VERSION:'table-intake-1.0.0',targets,entries,fromJSON,readFile,readBook,exportJSON,suggestAll,inferUnit,convert,inspect,apply};
})();
