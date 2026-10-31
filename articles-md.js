/* ============================================================
   文章数据：Markdown + frontmatter 的读写（Node 侧）
   ------------------------------------------------------------
   为什么不装现成的 YAML 库：这个项目零依赖，Netlify 上只跑 node 原生模块。
   所以这里手写一个「够用就好」的 YAML 子集解析器，能读两种东西：
     1) 本文件 toMarkdown() 写出来的格式
     2) Pages CMS 回写的格式（块状列表、折叠块标量、不加引号的纯量）
   读不出来的语法会直接报错，不会静默吞掉内容 —— 宁可构建失败，也不要
   悄悄生成一篇残缺的文章。

   字段对应的对象结构和原来的 window.SITE_ARTICLES 完全一致，
   这样 article-builder.js 一行都不用改。
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ART_DIR = path.join(__dirname, 'content', 'articles');

/* 这些字段进 frontmatter，其余（body）是正文 */
const META_KEYS = [
  'slug', 'title', 'metaTitle', 'description', 'excerpt', 'category',
  'keywords', 'date', 'updated', 'author', 'cover', 'coverAlt', 'faq'
];

/* ---------------- 纯量 ---------------- */

function parseScalar(raw) {
  const s = String(raw).trim();
  if (!s) return '';
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s[0] === '"' && s[s.length - 1] === '"') {
    try { return JSON.parse(s); } catch (e) { return s.slice(1, -1); }
  }
  if (s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s[0] === '[') return parseFlowArray(s);
  return s;
}

function parseFlowArray(s) {
  const inner = s.replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return [];
  const out = [];
  let buf = '', quote = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (ch === '\\' && quote === '"') { buf += ch + inner[++i]; continue; }
      if (ch === quote) quote = null;
      buf += ch; continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === ',') { out.push(parseScalar(buf)); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(parseScalar(buf));
  return out;
}

const indentOf = (l) => l.match(/^ */)[0].length;
const isBlank = (l) => !l.trim() || /^\s*#/.test(l);

/* ---------------- frontmatter ---------------- */

function splitFrontmatter(text) {
  const src = String(text).replace(/\r\n/g, '\n');
  if (!/^---\n/.test(src)) throw new Error('文件不是以 --- 开头，没有 frontmatter');
  const end = src.indexOf('\n---', 3);
  if (end === -1) throw new Error('frontmatter 没有闭合的 ---');
  const fm = src.slice(4, end + 1);
  const bodyStart = src.indexOf('\n', end + 1);
  const body = bodyStart === -1 ? '' : src.slice(bodyStart + 1);
  return { fm, body: body.replace(/^\n+/, '') };
}

function parseFrontmatter(text) {
  const { fm, body } = splitFrontmatter(text);
  const lines = fm.split('\n');
  const data = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    const indent = indentOf(line);
    if (indent !== 0) { i++; continue; }

    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) throw new Error('无法解析的 frontmatter 行：' + line);
    const key = m[1];
    const rest = m[2];

    /* key: | 或 key: >- 多行标量 */
    if (/^[|>][-+]?$/.test(rest.trim())) {
      const folded = rest.trim()[0] === '>';
      const block = [];
      i++;
      while (i < lines.length && (isBlank(lines[i]) || indentOf(lines[i]) > 0)) {
        block.push(lines[i].replace(/^ {1,4}/, ''));
        i++;
      }
      while (block.length && !block[block.length - 1].trim()) block.pop();
      data[key] = folded
        ? block.join(' ').replace(/\s+/g, ' ').trim()
        : block.join('\n');
      continue;
    }

    if (rest.trim()) { data[key] = parseScalar(rest); i++; continue; }

    /* 空值：往下看是列表还是映射 */
    i++;
    const child = [];
    while (i < lines.length && (isBlank(lines[i]) || indentOf(lines[i]) > indent)) {
      child.push(lines[i]);
      i++;
    }
    data[key] = parseChildren(child);
  }

  return { data, body };
}

/* 把一组子行解析成数组或对象 */
function parseChildren(rawLines) {
  const lines = rawLines.filter((l) => !isBlank(l));
  if (!lines.length) return '';

  const baseIndent = Math.min.apply(null, lines.map(indentOf));
  const trimmed = lines.map((l) => l.slice(baseIndent));

  if (/^-\s|^-$/.test(trimmed[0])) {
    const items = [];
    let cur = null;
    for (const l of trimmed) {
      if (/^-\s|^-$/.test(l)) {
        const rest = l.slice(1).trim();
        if (rest && /^[A-Za-z_][\w-]*:/.test(rest)) {
          cur = {};
          const mm = rest.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
          cur[mm[1]] = mm[2].trim() ? parseScalar(mm[2]) : '';
          items.push(cur);
        } else if (rest) {
          cur = null;
          items.push(parseScalar(rest));
        } else {
          cur = {};
          items.push(cur);
        }
      } else if (cur && /^[A-Za-z_][\w-]*:/.test(l.trim())) {
        const mm = l.trim().match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
        cur[mm[1]] = mm[2].trim() ? parseScalar(mm[2]) : '';
      }
    }
    return items;
  }

  const obj = {};
  for (const l of trimmed) {
    const mm = l.trim().match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (mm) obj[mm[1]] = mm[2].trim() ? parseScalar(mm[2]) : '';
  }
  return obj;
}

/* ---------------- 读 ---------------- */

function loadArticles(dir) {
  const root = dir || ART_DIR;
  if (!fs.existsSync(root)) return [];

  const posts = fs.readdirSync(root)
    .filter((f) => /\.md$/.test(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(root, f), 'utf8');
      let parsed;
      try {
        parsed = parseFrontmatter(raw);
      } catch (e) {
        throw new Error(f + '：' + e.message);
      }
      const post = {};
      META_KEYS.forEach((k) => { if (parsed.data[k] !== undefined) post[k] = parsed.data[k]; });
      if (!post.slug) post.slug = f.replace(/\.md$/, '');
      post.faq = Array.isArray(post.faq) ? post.faq : [];
      post.keywords = Array.isArray(post.keywords) ? post.keywords : [];
      post.body = parsed.body;

      /* 后台的日期控件可能写成 yyyy-MM-dd，也可能带上时间。
         sitemap / JSON-LD / feed 都按纯日期用，这里统一裁到 10 位。 */
      ['date', 'updated'].forEach((k) => {
        if (typeof post[k] === 'string') {
          const m = post[k].match(/^\d{4}-\d{2}-\d{2}/);
          if (m) post[k] = m[0];
        }
      });

      return post;
    });

  return posts;
}

/* ---------------- 写（迁移用） ---------------- */

const q = (v) => JSON.stringify(String(v == null ? '' : v));

function toMarkdown(post) {
  const lines = ['---'];
  META_KEYS.forEach((k) => {
    const v = post[k];
    if (k === 'faq') {
      if (!v || !v.length) return;
      lines.push('faq:');
      v.forEach((pair) => {
        lines.push('  - q: ' + q(pair.q));
        lines.push('    a: ' + q(pair.a));
      });
      return;
    }
    if (k === 'keywords') {
      if (!v || !v.length) return;
      lines.push('keywords:');
      v.forEach((x) => lines.push('  - ' + q(x)));
      return;
    }
    if (v === undefined || v === null || v === '') return;
    lines.push(k + ': ' + q(v));
  });
  lines.push('---', '');
  lines.push(String(post.body || '').trim());
  lines.push('');
  return lines.join('\n');
}

module.exports = { loadArticles, parseFrontmatter, toMarkdown, ART_DIR, META_KEYS };
