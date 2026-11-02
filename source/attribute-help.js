(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else{root.AttributeHelp=factory();root.AttributeHelp.mount(root.ATTRIBUTE_CATALOG,root.ATTRIBUTE_PAGE);}})(globalThis,function(){
 'use strict';
 const normalize=s=>String(s).toLowerCase().replace(/[\d.＋+%％\-]/g,'').replace(/我方|自己|角色|敌方|敌人|怪物|我的|的|[\s，,：:（）()]/g,'');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const file={growth:'06_成长模拟与卡点诊断.html',battle:'04_多属性战斗诊断.html'};
 function find(catalog,query){const q=normalize(query);if(!q)return [];const found=catalog.fields.map(f=>{const names=[f.key,f.label,...f.aliases].map(normalize);return {field:f,rank:names.includes(q)?3:names.some(n=>n.includes(q))?2:names.some(n=>q.includes(n)&&n.length>1)?1:0};}).filter(x=>x.rank).sort((a,b)=>b.rank-a.rank);return found.some(x=>x.rank===3)?found.filter(x=>x.rank===3):found;}
 function target(field,side){return field.page==='growth'?'rule-'+field.key:['player','enemy'].includes(side)?side+'-'+field.key:null;}
 function hint(field,side,query=''){
  if(field.page==='unsupported')return field.note;
  const owner=side==='enemy'?'敌人':'角色';let s=field.page==='battle'?`${owner} → ${field.section} → ${field.label}。`:`成长设置 → ${field.label}。`;
  s+=field.percent?`填百分比数字，例如20%填20，不填0.2。允许${field.min}—${field.max}%。`:`范围${field.min}—${field.max}${field.unit||''}。`;
  const n=String(query).match(/([+-]?\d+(?:\.\d+)?)\s*[%％]/);if(n&&field.percent&&(Number(n[1])<field.min||Number(n[1])>field.max))s+='你给的百分比超出本工具范围，不能直接输入；不会替你截小。';
  if(field.percent&&/\d/.test(query)&&!n)s+='你写的数没有百分号，请先确认原游戏的单位，不会自动替你换算。';
  if(field.key==='lightningResist')s+=side==='enemy'?'减少你对敌人造成的闪电伤害；不是增加你的电伤。':'减少角色受到的闪电伤害；不是增加角色的电伤。';
  if(field.page==='growth'&&['crit_chance','push_success_threshold'].includes(field.key))s+='此处用0到1的比例，20%填0.2；战斗页的百分比输入框则填20，需按各页单位填写。';
  if(field.key==='frequency')s+='这里是每秒攻击几次。若原游戏写每次间隔0.5秒，应填2；原面板没写单位时先确认。';
  if(field.key==='poison')s+='这里只算每击直接毒伤，不是持续掉血。';return s;
 }
 function mount(catalog,page,doc=document){
  const $=id=>doc.getElementById(id),box=$('attributeResults'),input=$('attributeQuery'),side=$('attributeSide');let help=null,highlight=null,focusEpoch=0;
  function locate(field,role){const id=target(field,role),el=id&&$(id);if(!el){box.textContent='没有找到这个输入框，请刷新该工具页面后重新查找。';return false;}let p=el.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}if(help)help.remove();help=doc.createElement('small');help.className='attribute-field-hint';help.textContent='已定位到这里：'+hint(field,role,input.value);el.parentElement.append(help);if(highlight)delete highlight.dataset.attributeLocated;highlight=el;el.dataset.attributeLocated='true';const epoch=++focusEpoch;const focus=()=>{if(epoch!==focusEpoch)return;el.focus({preventScroll:true});el.scrollIntoView({block:'center'});};if(typeof requestAnimationFrame==='function')requestAnimationFrame(focus);else focus();return true;}
  function render(){for(const [id,role] of [['attributeOwnerPlayer','player'],['attributeOwnerEnemy','enemy'],['attributeOwnerUnknown','']])$(id).setAttribute('aria-pressed',String(side.value===role));const matches=find(catalog,input.value);if(!normalize(input.value)){box.textContent='输入你游戏里的叫法；例如“电抗性20%”。只帮你找位置，不会自动改数值。';return;}
   if(!matches.length){box.textContent='暂时没找到对应项。请补充它是增加伤害、减少受伤，还是影响升级与奖励；不要随便填进相似名称。';return;}
   box.innerHTML=(matches.length>1?'<p>可能对应多项，请按作用选择；不会替你猜唯一答案。</p>':'')+matches.slice(0,8).map(({field:f})=>{if(f.page==='unsupported')return `<p><strong>${esc(f.label)}：</strong>${esc(f.note)}</p>`;const role=side.value,id=target(f,role),needRole=f.page==='battle'&&!id;
    const route=f.page==='battle'&&page==='growth'?'<p>这一项在战斗工具里设置。当前成长模拟不计算这些战斗属性；改那边不会自动改变这里的过关结果。</p>':'';
    const action=needRole?'<p>先点“角色／自己”或“敌人／怪物”，再定位。</p>':f.page===page?`<button type="button" data-attribute="${esc(f.page+':'+f.key)}" data-role="${esc(role)}">定位到这个输入框</button>`:`<a target="_blank" rel="noopener" href="${file[f.page]}#${encodeURIComponent(id)}">打开${f.page==='battle'?'战斗':'成长'}工具并定位</a>`;
    return `<div class="attribute-match"><strong>${f.page==='battle'?'战斗工具':'成长工具'}：${esc(f.label)}</strong>${route}<p>${esc(needRole?'需要区分这是角色的属性，还是敌人的属性。':hint(f,role,input.value))}</p>${action}</div>`;
   }).join('')+(matches.length>8?'<p>还有其他匹配项，请输入更具体的名称。</p>':'');
  }
  input.addEventListener('input',()=>{if(/敌方|敌人|怪物/.test(input.value)&&!/我方|自己|角色|我的/.test(input.value))side.value='enemy';else if(/我方|自己|角色|我的/.test(input.value)&&!/敌方|敌人|怪物/.test(input.value))side.value='player';render();});
  $('attributeSearch').onclick=render;side.onchange=render;$('attributeOwnerChoices').addEventListener('click',e=>{const button=e.target.closest('[data-attribute-side]');if(!button)return;side.value=button.getAttribute('data-attribute-side');render();});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();render();}});
  box.addEventListener('click',e=>{const b=e.target.closest('[data-attribute]');if(!b)return;const field=catalog.fields.find(f=>f.page+':'+f.key===b.dataset.attribute);if(field&&field.page===page)locate(field,b.dataset.role);});
  render();
  function handleLocation(){let id='',incoming='';try{if(location.hash.startsWith('#locate=')){const parts=location.hash.slice(8).split('&query=');id=decodeURIComponent(parts[0]);incoming=parts[1]?decodeURIComponent(parts[1]):'';}else id=decodeURIComponent(location.hash.slice(1));}catch{return false;}const role=id.startsWith('enemy-')?'enemy':'player',field=catalog.fields.find(f=>f.page===page&&target(f,role)===id);if(!field)return false;input.value=incoming||field.label;side.value=role;render();return locate(field,role);}
  // The in-app browser may reuse an already-open tab rather than load a new document.
  window.addEventListener('hashchange',handleLocation);
  window.addEventListener('pageshow',handleLocation);
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')handleLocation();});
  handleLocation();
  return {render,locate,handleLocation};
 }
 return {find,target,hint,mount};
});
