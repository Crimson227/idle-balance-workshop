from pathlib import Path
import json
import runpy
root=Path(__file__).resolve().parent.parent
build=root/'_构建'
runpy.run_path(str(build/'build_connected.py'))
text=(build/'growth-template.html').read_text(encoding='utf-8')
text=text.replace('__CONNECTED_HTML__',(build/'connected-html.html').read_text(encoding='utf8'))
text=text.replace('__CONNECTED_PREVIEW__',(build/'connected-preview.html').read_text(encoding='utf8'))
text=text.replace('__EASY_HTML__',(build/'growth-easy.html').read_text(encoding='utf-8')).replace('__EASY_APP__',(build/'growth-search.js').read_text(encoding='utf-8')+(build/'growth-check.js').read_text(encoding='utf-8')+(build/'growth-own.js').read_text(encoding='utf-8')+(build/'growth-own-simple.js').read_text(encoding='utf-8')+(build/'growth-easy.js').read_text(encoding='utf-8'))
recommended=json.loads((root/'支持资料/回访与攻击依赖对照/补充复核_20261030/完整结果/结果_optional_income_balanced_批1.json').read_text(encoding='utf-8'))['project']
text=text.replace('__RECOMMENDED__',json.dumps(recommended,ensure_ascii=False))
study=json.loads((root/'支持资料/回访与攻击依赖对照/补充复核_20261030/02_三十种子汇总.json').read_text(encoding='utf-8'))
evidence={x['id']:{k:x[k] for k in ['samples','finishMedian','longestHours','empty','visits','allGoals']} for x in study['configurations'] if x['id'] in ['C01','C04']}
text=text.replace('__EVIDENCE__',json.dumps(evidence,ensure_ascii=False))
for key,value in {'CSS':(build/'workbench-fonts.css').read_text(encoding='utf-8')+(build/'workbench.css').read_text(encoding='utf-8')+(build/'growth.css').read_text(encoding='utf-8'),'MODEL':(root/'支持资料/配置公式.js').read_text(encoding='utf-8'),'ENGINE':(root/'支持资料/成长模拟引擎.js').read_text(encoding='utf-8'),'DECISION':(build/'growth-decision.js').read_text(encoding='utf-8'),'GUIDE':(build/'growth-guide.js').read_text(encoding='utf-8'),'APP':(build/'growth-app.js').read_text(encoding='utf-8'),'DEFAULT':(root/'支持资料/推荐基准参数.json').read_text(encoding='utf-8'),'VERSION':'growth-event-2.0.0'}.items():text=text.replace('__'+key+'__',value)
text=text.replace('__SHELL__',(build/'workbench-shell.js').read_text(encoding='utf-8'))
text=text.replace('</style>',(build/'connected.css').read_text(encoding='utf8')+'</style>',1)
text=text.replace('</style>',(build/'connected-editorial.css').read_text(encoding='utf8')+'</style>',1)
text=text.replace('</style>',(build/'connected-expanded.css').read_text(encoding='utf8')+'</style>',1)
text=text.replace('</body>','<script>'+(build/'connected-bundle.js').read_text(encoding='utf8')+'</script></body>')
text=text.replace('__ATTRIBUTE_DATA__',(build/'attribute-catalog.json').read_text(encoding='utf-8')).replace('__ATTRIBUTE_PAGE__','growth').replace('__ATTRIBUTE_HELP__',(build/'attribute-help.js').read_text(encoding='utf-8'))
(root/'06_成长模拟与卡点诊断.html').write_text(text,encoding='utf-8')
(root/'数值工坊.html').write_text(text,encoding='utf-8')
print('Built growth workbench')
