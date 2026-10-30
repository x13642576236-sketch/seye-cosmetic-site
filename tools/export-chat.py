#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 WorkBuddy 的会话 jsonl 导出成一份人能读、别的 AI 也能直接喂的 Markdown。

只取 role=user / role=assistant 的文字块（input_text / output_text），
丢弃 reasoning、function_call、function_call_result 和图片二进制引用。

用法：
    python export-chat.py <会话.jsonl> <输出.md>
"""
import json
import re
import sys
from datetime import datetime

# 这些是宿主注入的上下文，不是用户真正说的话
NOISE = re.compile(
    r'<system-reminder[\s\S]*?</system-reminder>'
    r'|<user_info>[\s\S]*?</user_info>'
    r'|<identity_context>[\s\S]*?</identity_context>'
    r'|<project_context>[\s\S]*?</project_context>'
    r'|<additional_data>[\s\S]*?</additional_data>'
    r'|<connector-status>[\s\S]*?</connector-status>'
    r'|<memory>[\s\S]*?</memory>'
    r'|<memory_and_skills_reminder>[\s\S]*?</memory_and_skills_reminder>'
    r'|<content_policy>[\s\S]*?</content_policy>'
    r'|<task-notification>[\s\S]*?</task-notification>'
    r'|<conversation_history_summary>[\s\S]*?</conversation_history_summary>'
    r'|<craft_mode>[\s\S]*?</craft_mode>'
)


def blocks_text(content):
    """把 content 里所有文字块拼起来，非文字块用标记占位。"""
    if isinstance(content, str):
        return content
    parts = []
    for b in content or []:
        if not isinstance(b, dict):
            continue
        t = b.get('type') or ''
        if t.endswith('_text') or t == 'text':
            parts.append(b.get('text') or b.get('content') or '')
        elif 'image' in t:
            parts.append('（[附图]）')
    return '\n\n'.join(p for p in parts if p)


def ts(v):
    if not v:
        return ''
    try:
        return datetime.fromisoformat(str(v).replace('Z', '+00:00')).astimezone()
    except Exception:
        return ''


def main(src, dst):
    rows = []
    with open(src, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            if o.get('type') != 'message':
                continue
            m = o.get('message') or o
            role = m.get('role')
            if role not in ('user', 'assistant'):
                continue
            text = blocks_text(m.get('content'))
            if role == 'user':
                text = NOISE.sub('', text)
            # 去掉包装标签，只留正文；本地图片路径对其他机器没意义
            text = re.sub(r'<image_local_path>[\s\S]*?</image_local_path>', '', text)
            text = re.sub(r'</?user_query>', '', text)
            text = re.sub(r'</?image_local_path>', '', text)
            text = text.strip()
            if not text:
                continue
            rows.append((ts(o.get('timestamp')), role, text))

    # 连续同角色合并，避免一来一回被拆成几十段
    merged = []
    for t, role, text in rows:
        if merged and merged[-1][1] == role:
            merged[-1][2].append(text)
        else:
            merged.append([t, role, [text]])

    out = ['# SEYE 站点 · 对话记录', '']
    out.append('导出时间：' + datetime.now().strftime('%Y-%m-%d %H:%M'))
    out.append('原始条数：%d 条消息，合并后 %d 段' % (len(rows), len(merged)))
    out.append('')
    out.append('> 说明：工具调用过程（读文件、跑命令、截图）已省略，只保留对话正文。')
    out.append('')
    out.append('---')
    out.append('')

    for t, role, texts in merged:
        who = '你' if role == 'user' else '助手'
        head = '## ' + who
        if t:
            head += '　<sub>' + t.strftime('%m-%d %H:%M') + '</sub>'
        out.append(head)
        out.append('')
        out.append('\n\n'.join(texts))
        out.append('')

    with open(dst, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))
    print('已写出 %s（%.1f KB）' % (dst, len('\n'.join(out).encode('utf-8')) / 1024))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
