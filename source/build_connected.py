from pathlib import Path
import json,hashlib,subprocess
root=Path(__file__).resolve().parent.parent
build=root/'_构建';core=root/'支持资料/一体化成长'
names=['战斗引擎.cjs','原成长核心.cjs','一体化核心.cjs','示例.cjs']
entries=[]
for name in names:
    source=(core/name).read_text(encoding='utf8')
    entries.append(json.dumps('./'+name,ensure_ascii=False)+':function(module,exports,require){\n'+source+'\n}')
loader='const modules={'+',\n'.join(entries)+'};const cache={};const Buffer={byteLength:(s)=>new TextEncoder().encode(s).length};function load(name){if(cache[name])return cache[name].exports;if(!modules[name])throw Error("未提供计算模块"+name);const module={exports:{}};cache[name]=module;modules[name](module,module.exports,load);return module.exports;}\n'
main='const ConnectedCore=(()=>{'+loader+'return load("./一体化核心.cjs");})();\nconst CONNECTED_EXAMPLE=(()=>{'+loader+'return load("./示例.cjs").ruins();})();\n'
worker=loader+(build/'connected-worker-tail.js').read_text(encoding='utf8')
script=main+'const CONNECTED_WORKER_SOURCE='+json.dumps(worker,ensure_ascii=False)+';\n'+(build/'connected-app.js').read_text(encoding='utf8')
(build/'connected-bundle.js').write_text(script,encoding='utf8')
data=json.loads(subprocess.check_output(['node','-e',"const C=require('./一体化核心.cjs'),D=require('./示例.cjs');const r=C.run(D.ruins(),42);console.log(JSON.stringify(r.visits))"],cwd=core,text=True,encoding='utf8'))
cum=0;bars=[]
for i,row in enumerate(data):
    cum+=row['newStages'];height=210*cum/60;x=38+i*96
    bars.append(f'<rect x="{x}" y="{250-height:g}" width="66" height="{height:g}" fill="#d95854"/><text x="{x+33}" y="{236-height:g}" fill="#f3efe6" text-anchor="middle" font-size="24">{cum}</text><text x="{x+33}" y="277" fill="#c7c2ba" text-anchor="middle" font-size="13">第{i+1}次回访</text>')
preview='<figure class="editorial-preview"><svg viewBox="0 0 340 290" width="340" height="290" role="img" aria-label="遗迹守卫示例编号42，三次回访累计通过23、50、60关">'+''.join(bars)+'</svg><figcaption>柱高表示累计通过关数。0、5、12小时回访。<br>《遗迹守卫》v1，编号42；可载入后修改并复算。</figcaption></figure>'
(build/'connected-preview.html').write_text(preview,encoding='utf8')
(root/'支持资料/一体化成长/来源版本.json').write_text(json.dumps({'version':'connected-growth-1.0.0','battleSource':'挂机数值诊断工具_目标推荐版_20261102/计算核心/已验收模拟/战斗引擎.cjs','growthSource':'同目录成长模拟.cjs，原文件保留，复用校验、精确分数、种子寻址及截尾重放','changes':'新增同一游戏的明确关卡编译、回访与离线收入调度，保留逐击战斗','sha256':{name:hashlib.sha256((core/name).read_bytes()).hexdigest()for name in names}},ensure_ascii=False,indent=2),encoding='utf8')
print('Built connected browser/worker bundle')
