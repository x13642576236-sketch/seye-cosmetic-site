#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""打一个可迁移的交接包。

包含：源码（带 .git 历史）+ 交接文档 + 对话记录。
排除：构建产物、部署 zip、临时区、源图、系统缓存。

用法：python tools/pack-handover.py [输出路径]
"""
import os
import sys
import zipfile
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOP = 'SEYE迁移包-' + date.today().strftime('%Y%m%d')

# 相对 seye-website/ 的排除规则（前缀匹配目录，后缀匹配文件名）
SKIP_DIRS = {'dist', '_quarantine', '迁移包', 'node_modules'}
SKIP_FILES = {'Thumbs.db', '.DS_Store', 'preview-homepage-full.jpg'}
SKIP_SUFFIX = ('.zip',)
SKIP_PATHS = {'assets/_unused-source-png'}


def rel(p):
    return os.path.relpath(p, ROOT).replace('\\', '/')


def keep(path):
    r = rel(path)
    if r in SKIP_PATHS:
        return False
    parts = r.split('/')
    for i in range(1, len(parts) + 1):
        if '/'.join(parts[:i]) in SKIP_DIRS:
            return False
    if parts[-1] in SKIP_FILES:
        return False
    if r.endswith(SKIP_SUFFIX):
        return False
    return True


def main(out):
    files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if keep(os.path.join(dirpath, d))]
        for fn in filenames:
            p = os.path.join(dirpath, fn)
            if keep(p):
                files.append(p)

    # 交接文档和对话记录放在包根，优先看到
    extras = []
    for name in ('HANDOVER.md', '对话记录.md', '从这里开始.md'):
        p = os.path.join(ROOT, '迁移包', name)
        if os.path.exists(p):
            extras.append((p, TOP + '/' + name))

    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p, arc in extras:
            z.write(p, arc)
        for p in files:
            z.write(p, TOP + '/seye-website/' + rel(p))

    size = os.path.getsize(out)
    print('输出：%s' % out)
    print('站点文件 %d 个 + 文档 %d 个，共 %.2f MB' % (len(files), len(extras), size / 1048576))

    # 自检
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        bad = [n for n in names if '/dist/' in n or n.endswith('.zip')
               or '_quarantine' in n or 'assets/_unused-source-png' in n]
        git = [n for n in names if '/.git/' in n]
        print('自检：不该含 %d 个 · .git 条目 %d 个 · 总条目 %d' % (len(bad), len(git), len(names)))
        if bad:
            print('  ! 有问题：', bad[:5])
        print('坏文件：', z.testzip())


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(ROOT), TOP + '.zip')
    main(target)
