'use strict';
const {q}=require('./原成长核心.cjs');
const modules={opening_shield:{version:'1.0.0',name:'开场护盾补给',at:'battle_start',validate:p=>{const n=q(p.amount);if(n.cmp(q(0))<0||n.cmp(q(1e7))>0)throw Error('开场补给护盾须在0至10000000之间');},apply:(api,p)=>{api.addShield(0,q(p.amount));api.log('module',{id:'opening_shield',amount:p.amount});}}};
function validate(m){if(typeof m.enabled!=='boolean'||!modules[m.id]||m.version!==modules[m.id].version)throw Error('规则模块或版本未接入');if(m.enabled)modules[m.id].validate(m.params);}
function fire(list,at,api){for(const m of list||[])if(m.enabled&&modules[m.id].at===at){validate(m);modules[m.id].apply(api,m.params);}}
module.exports={modules,validate,fire};
