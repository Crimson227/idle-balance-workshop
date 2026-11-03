from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import shutil,json,hashlib

site=Path(__file__).resolve().parent
source=site.parent/'数值设计实用包'
dist=site/'dist'
class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        for key in ['href','src']:
            if key in a:self.links.append(a[key])

queue=['数值工坊.html','02_配置模板.html','04_多属性战斗诊断.html','06_成长模拟与卡点诊断.html']
seen=set();records=[]
while queue:
    rel=Path(queue.pop(0))
    if rel.as_posix() in seen:continue
    original=(source/rel).resolve()
    assert original.is_relative_to(source.resolve()) and original.is_file(),str(original)
    seen.add(rel.as_posix())
    target=dist/rel;target.parent.mkdir(parents=True,exist_ok=True)
    if rel.suffix.lower()=='.html':
        content=original.read_text(encoding='utf8')
        content=content.replace('离线可用 · 数据留在本机','计算在浏览器完成 · 设置可导出')
        content=content.replace('本地运行 · 文件可保存','计算在浏览器完成 · 设置可导出')
        target.write_text(content,encoding='utf8')
        parser=Links();parser.feed(content)
        for link in parser.links:
            u=urlsplit(link)
            if u.scheme or not u.path:continue
            path=(original.parent/unquote(u.path)).resolve()
            assert path.is_relative_to(source.resolve()),str(path)
            queue.append(str(path.relative_to(source.resolve())))
    else:shutil.copyfile(original,target)
    assert target.stat().st_size<25_000_000,rel
    records.append({'file':rel.as_posix(),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
shutil.copyfile(dist/'数值工坊.html',dist/'index.html')
(site/'source').mkdir(exist_ok=True)
for file in ['growth-own-simple.js','growth-search.js','growth-check.js','growth-own.js','growth-easy.html','growth-easy.js','growth-template.html','growth-app.js','growth-guide.js','growth-decision.js','growth.css','battle-template.html','battle-app.js','battle.css','config-template.html','config.css','workbench.css','workbench-shell.js','build_growth.py','build_battle.py','build_config.py','attribute-help.js']:
    shutil.copyfile(source/'_构建'/file,site/'source'/file)
(site/'release-files.json').write_text(json.dumps({'files':records,'totalBytes':sum(x['bytes']for x in records),'browserValidation':'pending'},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'files':len(records)+1,'totalMB':round(sum(x['bytes']for x in records)/1024**2,2),'largest':sorted(records,key=lambda x:x['bytes'],reverse=True)[:3]},ensure_ascii=False))
