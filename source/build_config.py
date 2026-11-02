from pathlib import Path
import json

root=Path(__file__).resolve().parent.parent
build=root/'_构建'

def render_config(config=None,model=None):
    if config is None:
        config=json.loads((root/'支持资料/推荐基准参数.json').read_text(encoding='utf8'))
    if model is None:
        model=(root/'支持资料/配置公式.js').read_text(encoding='utf8')
    css=''.join((build/n).read_text(encoding='utf8') for n in ['workbench-fonts.css','workbench.css','config.css'])
    return (build/'config-template.html').read_text(encoding='utf8').replace('__CSS__',css).replace('__MODEL__',model).replace('__CONFIG__',json.dumps(config,ensure_ascii=False,separators=(',',':'))).replace('__SHELL__',(build/'workbench-shell.js').read_text(encoding='utf8'))

if __name__=='__main__':
    (root/'02_配置模板.html').write_text(render_config(),encoding='utf8')
    print('Built styled configuration page')
