from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
build=root/'_构建'
engine=(root/'支持资料/战斗诊断引擎.js').read_text(encoding='utf-8')
app=(build/'battle-app.js').read_text(encoding='utf-8')
page=(build/'battle-template.html').read_text(encoding='utf-8').replace('__CSS__',(build/'workbench-fonts.css').read_text(encoding='utf-8')+(build/'workbench.css').read_text(encoding='utf-8')+(build/'battle.css').read_text(encoding='utf-8')).replace('__ENGINE__',engine).replace('__APP__',app)
page=page.replace('__SHELL__',(build/'workbench-shell.js').read_text(encoding='utf-8'))
page=page.replace('__ATTRIBUTE_DATA__',(build/'attribute-catalog.json').read_text(encoding='utf-8')).replace('__ATTRIBUTE_PAGE__','battle').replace('__ATTRIBUTE_HELP__',(build/'attribute-help.js').read_text(encoding='utf-8'))
target=root/'04_多属性战斗诊断.html'
target.write_text(page,encoding='utf-8')
print(json.dumps({'path':str(target),'bytes':target.stat().st_size,'engine_sha256':hashlib.sha256(engine.encode()).hexdigest()},ensure_ascii=False))
