#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MyToken rebuild.py —— Windows 研发机构建并推送 mytoken-web / mytoken-server 到私有仓库。

流程（对齐工作空间标准）：
  1. 读 .env -> PRIVATE_DOCKER_REGISTRY_HOST
  2. git rev-parse --short=7 HEAD -> 版本标签
  3. docker build --target web/server × latest + <sha>
  4. 逐个 docker push（失败重试 3 次）
  5. 注册表清理：HTTP API 删除非 latest / 非当前 sha 的旧清单
  6. 本地清理：删除本项目旧标签 + 悬空镜像
  7. 所有输出掩码仓库地址

✦ 仓库地址只从 .env 读取，绝不硬编码于 Git 跟踪文件。
✦ 仅 Python 3，无第三方依赖（registry 清理用 urllib）。
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Windows 控制台默认 GBK，编码不了 ✔/中文会崩；统一 UTF-8 + 宽容替换
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent
WEB = "mytoken-web"
SERVER = "mytoken-server"
REGISTRY_MASK = "<PRIVATE_REGISTRY>"
MANIFEST_V2 = "application/vnd.docker.distribution.manifest.v2+json"


# ---------------------------------------------------------------- 工具 ------
def mask(text: str, host: str) -> str:
    return text.replace(host, REGISTRY_MASK) if host else text


def load_env() -> dict:
    env: dict[str, str] = {}
    envfile = ROOT / ".env"
    if envfile.exists():
        for raw in envfile.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def run(cmd: list, host: str, **kw) -> subprocess.CompletedProcess:
    print("$ " + mask(" ".join(cmd), host))
    return subprocess.run(cmd, **kw)


def git_sha() -> str:
    p = subprocess.run(
        ["git", "rev-parse", "--short=7", "HEAD"],
        capture_output=True, text=True, cwd=ROOT,
    )
    return p.stdout.strip() or "unknown"


def reg_url(host: str, path: str) -> str:
    return f"http://{host}/v2{path}"


def reg_request(host: str, path: str, method="GET", accept=None):
    req = urllib.request.Request(reg_url(host, path), method=method)
    if accept:
        req.add_header("Accept", accept)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, b""


# ---------------------------------------------------------- 注册表清理 ------
def list_tags(host: str, repo: str) -> list:
    status, _, body = reg_request(host, f"/{repo}/tags/list")
    if status != 200:
        return []
    try:
        return json.loads(body).get("tags", [])
    except Exception:
        return []


def digest_of(host: str, repo: str, tag: str):
    status, headers, _ = reg_request(
        host, f"/{repo}/manifests/{tag}", accept=MANIFEST_V2
    )
    if status == 200:
        return headers.get("Docker-Content-Digest")
    return None


def cleanup_registry(host: str, repo: str, keep_tags: set) -> None:
    """删除 non-latest / non-current-sha 的旧清单。注册表不可达时仅告警，不中断。"""
    try:
        tags = list_tags(host, repo)
    except Exception as e:
        print(f"⚠️ 注册表不可达，跳过清理 {repo}: {e}")
        return
    for tag in tags:
        if tag in keep_tags:
            continue
        digest = digest_of(host, repo, tag)
        if not digest:
            continue
        status, _, _ = reg_request(
            host, f"/{repo}/manifests/{digest}", method="DELETE",
        )
        print(f"  registry delete {repo}:{tag} -> HTTP {status}")
        time.sleep(0.3)


# ---------------------------------------------------------- 本地清理 ------
def local_cleanup(repo: str, keep_tags: set) -> None:
    tags = []
    r = subprocess.run(
        ["docker", "images", "--format", "{{.Repository}}:{{.Tag}}", repo],
        capture_output=True, text=True,
    )
    if r.returncode == 0:
        tags = [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]
    for img in tags:
        if img.split(":")[-1] in keep_tags:
            continue
        run(["docker", "image", "rm", img], host="")
    run(["docker", "image", "prune", "-f"], host="")


# ----------------------------------------------------------------- 主流程 ----
def main() -> int:
    env = load_env()
    host = env.get("PRIVATE_DOCKER_REGISTRY_HOST", "").strip()
    if not host:
        print("错误：.env 缺少 PRIVATE_DOCKER_REGISTRY_HOST")
        return 1

    sha = git_sha()
    print(f"构建 sha: {sha}")
    targets = {WEB: "web", SERVER: "server"}
    keep_tags = {"latest", sha}

    for repo, target in targets.items():
        tags = [f"{host}/{repo}:latest", f"{host}/{repo}:{sha}"]
        # 构建两个标签
        cmd = ["docker", "build", "--target", target]
        for t in tags:
            cmd += ["-t", t]
        cmd.append(".")
        if run(cmd, host, cwd=ROOT).returncode != 0:
            print(f"构建失败：{repo}")
            return 1
        # 逐个推送，重试 3 次
        for t in tags:
            for attempt in range(1, 4):
                if run(["docker", "push", t], host).returncode == 0:
                    break
                if attempt == 3:
                    print(f"推送失败：{t}")
                    return 1
                print(f"  重试 {t} ({attempt}/3)…")
                time.sleep(3)

    # 注册表清理（web + server 各清一次）
    for repo in targets:
        cleanup_registry(host, repo, keep_tags)

    # 本地清理
    for repo in targets:
        local_cleanup(repo, keep_tags)

    print("完成 ✔（仓库地址已掩码，未在输出中泄露）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
