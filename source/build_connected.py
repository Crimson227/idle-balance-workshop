from pathlib import Path
import json,hashlib,subprocess
root=Path(__file__).resolve().parent.parent
build=root/'_构建';core=root/'支持资料/一体化成长'
names=['战斗引擎.cjs','原成长核心.cjs','一体化核心.cjs','示例.cjs','多属性战斗.cjs','旧多属性规则.cjs','方案搜索.cjs','规则库.cjs','规则战斗.cjs','规则模块示例.cjs','收入节拍.cjs','规则检查.cjs','推进归因.cjs','数值验证.cjs']
meridian_names=['子午线.cjs', *['meridian/'+file+'.cjs' for file in ['engine','workbench','Balance','Combat','Chapter']]]
def make_loader(modules):
    entries=[]
    for name in modules:
        source=(core/name).read_text(encoding='utf8')
        entries.append(json.dumps('./'+name,ensure_ascii=False)+':function(module,exports,require){\n'+source+'\n}')
    return 'const modules={'+',\n'.join(entries)+'};const cache={};const Buffer={byteLength:(s)=>new TextEncoder().encode(s).length};function load(name){if(cache[name])return cache[name].exports;if(!modules[name])throw Error("未提供计算模块"+name);const module={exports:{}};cache[name]=module;modules[name](module,module.exports,load);return module.exports;}\n'
loader=make_loader(names)
main='const ConnectedCore=(()=>{'+loader+'return load("./一体化核心.cjs");})();\nconst CONNECTED_EXAMPLE=(()=>{'+loader+'return load("./示例.cjs").ruins();})();\n'
main+='const ConnectedSearch=(()=>{'+loader+'return load("./方案搜索.cjs");})();\n'
main+='const ConnectedValidation=(()=>{'+loader+'return load("./数值验证.cjs");})();\n'
worker=make_loader(names+meridian_names)+(build/'connected-worker-tail.js').read_text(encoding='utf8')
main+='const CONNECTED_ATTRS='+json.dumps([f for f in json.loads((build/'attribute-catalog.json').read_text(encoding='utf8'))['fields'] if f['page']=='battle'],ensure_ascii=False)+';\nconst CONNECTED_ICE_EXAMPLE='+json.dumps(json.loads((core/'冰霜手算案例.json').read_text(encoding='utf8')),ensure_ascii=False)+';\n'
app=(build/'connected-app.js').read_text(encoding='utf8').replace('/*__CONNECTED_WORKSPACE__*/','\n'.join((build/name).read_text(encoding='utf8') for name in ['connected-workspace.js','connected-preflight.js','connected-projects.js','connected-intake-ui.js','connected-sample.js','connected-verification.js','connected-meridian.js']))
script=main+'const CONNECTED_WORKER_SOURCE='+json.dumps(worker,ensure_ascii=False)+';\n'+(build/'connected-rules.js').read_text(encoding='utf8')+'\n'+(build/'connected-v2-editor.js').read_text(encoding='utf8')+'\n'+(build/'connected-lookup.js').read_text(encoding='utf8')+'\n'+(build/'connected-intake.js').read_text(encoding='utf8')+'\n'+(build/'connected-charts.js').read_text(encoding='utf8')+'\n'+app
(build/'connected-bundle.js').write_text(script,encoding='utf8')
data=json.loads(subprocess.check_output(['node','-e',"const C=require('./一体化核心.cjs'),D=require('./示例.cjs'),fs=require('fs'),vm=require('vm');const g=vm.runInNewContext(fs.readFileSync('../../_构建/connected-v2-editor.js','utf8')+';ConnectedV2.example()',{ConnectedCore:C,CONNECTED_EXAMPLE:D.ruins(),structuredClone});const r=C.run(g,42);console.log(JSON.stringify(r.visits))"],cwd=core,text=True,encoding='utf8'))
cum=0;bars=[]
for i,row in enumerate(data):
    cum+=row['newStages'];height=210*cum/60;x=38+i*96
    color='#b43632' if i==len(data)-1 else '#20211f'
    bars.append(f'<rect x="{x}" y="{250-height:g}" width="66" height="{height:g}" fill="{color}"/><text x="{x+33}" y="{236-height:g}" fill="#20211f" text-anchor="middle" font-size="24">{cum}</text><text x="{x+33}" y="277" fill="#62615b" text-anchor="middle" font-size="13">第{i+1}次回访</text>')
preview='<figure class="editorial-preview"><svg viewBox="0 0 340 290" width="340" height="290" role="img" aria-label="遗迹守卫五通道示例编号42的实际回访进度">'+''.join(bars)+'</svg><figcaption>柱高表示累计通过关数。0、5、12小时回访。<br>《遗迹守卫》v2，编号42；可载入后修改并复算。</figcaption></figure>'
(build/'connected-preview.html').write_text(preview,encoding='utf8')
(root/'支持资料/一体化成长/来源版本.json').write_text(json.dumps({'version':'connected-growth-1.0.0','battleSource':'挂机数值诊断工具_目标推荐版_20261102/计算核心/已验收模拟/战斗引擎.cjs','growthSource':'同目录成长模拟.cjs，原文件保留，复用校验、精确分数、种子寻址及截尾重放','changes':'新增同一游戏的明确关卡编译、回访与离线收入调度，保留逐击战斗','sha256':{name:hashlib.sha256((core/name).read_bytes()).hexdigest()for name in names+meridian_names}},ensure_ascii=False,indent=2),encoding='utf8')
print('Built connected browser/worker bundle')
