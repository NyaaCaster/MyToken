#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MyToken restart.py —— macmini 侧：拉取镜像 → 重启容器 → 清理悬空镜像。

流程（对齐工作空间标准，先 pull 最小化停机时间）：
  1. docker compose pull
  2. docker compose down
  3. docker compose up -d
  4. docker image prune -f
  5. docker compose ps 状态报告

用法（在部署目录 /root/DockerContainer/MyToken 下）：
  python3 restart.py
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def env_with_snap() -> dict:
    """macmini Docker 为 snap 安装，/snap/bin 需进 PATH。"""
    env = dict(os.environ)
    path = env.get("PATH", "")
    if "/snap/bin" not in path:
        env["PATH"] = path + os.pathsep + "/snap/bin"
    return env


def run(cmd, **kw) -> subprocess.CompletedProcess:
    print("$ " + " ".join(cmd))
    return subprocess.run(cmd, **kw)


def main() -> int:
    # 优先 publish compose（引用私有仓库镜像）；否则回退（比如重命名为 docker-compose.yml）
    compose = ROOT / "docker-compose.publish.yml"
    if not compose.exists():
        compose = ROOT / "docker-compose.yml"
    if not compose.exists():
        print(f"错误：未找到 {ROOT / 'docker-compose.publish.yml'} 或 docker-compose.yml")
        return 1

    base = ["docker", "compose", "-f", str(compose)]
    env = env_with_snap()

    if run(base + ["pull"], env=env).returncode != 0:
        print("镜像拉取失败，中止")
        return 1
    if run(base + ["down"], env=env).returncode != 0:
        print("down 失败")
        return 1
    if run(base + ["up", "-d"], env=env).returncode != 0:
        print("up 失败")
        return 1
    run(["docker", "image", "prune", "-f"], env=env)
    if run(base + ["ps"], env=env).returncode != 0:
        pass  # ps 仅展示，失败不影响
    print("重启完成 ✔")
    return 0


if __name__ == "__main__":
    sys.exit(main())
