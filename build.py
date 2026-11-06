from argparse import ArgumentParser
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile


def build(output):
    repo = Path(__file__).resolve().parent
    source, dist = repo / "source", repo / "dist"
    if shutil.which("node") is None:
        raise SystemExit("构建需要 Node.js 22或更高版本，请先安装并加入 PATH。")
    if output == repo or output == source or source in output.parents:
        raise SystemExit("输出目录不能覆盖仓库根目录或源码目录。")
    scratch_root = (repo / "outputs").resolve()
    scratch_root.mkdir(exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="build-", dir=scratch_root)).resolve()
    assert stage.parent == scratch_root and stage.name.startswith("build-")
    try:
        shutil.copytree(dist, stage, dirs_exist_ok=True)
        shutil.copytree(source, stage / "_构建", dirs_exist_ok=True)
        shutil.copytree(source / "connected-core", stage / "支持资料/一体化成长", dirs_exist_ok=True)
        shutil.copytree(source / "build-assets", stage / "支持资料", dirs_exist_ok=True)
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        for script in ["build_config.py", "build_battle.py", "build_growth.py"]:
            subprocess.run([sys.executable, str(stage / "_构建" / script)], cwd=stage, env=env, check=True)
        if output != dist.resolve():
            shutil.copytree(dist, output, dirs_exist_ok=True)
        for name in ["数值工坊.html", "02_配置模板.html", "04_多属性战斗诊断.html", "06_成长模拟与卡点诊断.html"]:
            html = (stage / name).read_text(encoding="utf-8")
            html = html.replace("离线可用 · 数据留在本机", "计算在浏览器完成 · 设置可导出")
            html = html.replace("本地运行 · 文件可保存", "计算在浏览器完成 · 设置可导出")
            (output / name).write_text(html, encoding="utf-8")
        shutil.copyfile(output / "数值工坊.html", output / "index.html")
        print("构建完成：" + str(output))
    finally:
        if stage.parent != scratch_root or not stage.name.startswith("build-"):
            raise RuntimeError("临时构建目录超出预期范围，已停止清理。")
        shutil.rmtree(stage)


if __name__ == "__main__":
    parser = ArgumentParser(description="从本仓库构建数值工坊")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / "dist")
    build(parser.parse_args().output.resolve())
