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

/* 值的引号闭合状态。plain = 没引号，closed = 完整，open = 折到下一行去了。
   Pages CMS 用的是 js-yaml，长字符串会被折行：
     description: "A practical checklist for vetting factories:
       licences, formula ownership, ..."                          ← 双引号跨行
     excerpt: Most first-time brand owners pick a manufacturer on
       price per unit and sample quality.                          ← 无引号跨行
   两种都必须支持，否则描述、摘要、FAQ 答案会被悄悄截断在第一行 —— 表面上
   构建成功，线上 meta description 却少了一半。 */
function quoteState(s) {
  const q = s[0];
  if (q !== '"' && q !== "'") return 'plain';
  let i = 1;
  while (i < s.length) {
    const ch = s[i];
    if (q === '"') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '"') return 'closed';
    } else if (ch === "'") {
      if (s[i + 1] === "'") { i += 2; continue; }
      return 'closed';
    }
    i++;
  }
  return 'open';
}

/* 收集缩进比 parentIndent 更深的所有后续行（空行也算，块标量需要它们） */
function collectBlock(ctx, parentIndent) {
  const out = [];
  while (ctx.i < ctx.lines.length) {
    const line = ctx.lines[ctx.i];
    if (isBlank(line)) { out.push(line); ctx.i++; continue; }
    if (indentOf(line) <= parentIndent) break;
    out.push(line);
    ctx.i++;
  }
  return out;
}

/* 折行标量：把第一行和续行拼回一条，再交给 parseScalar 解引号 */
function scalarFromLines(first, contLines) {
  const parts = [String(first).trim()];
  for (const l of contLines) {
    const t = l.trim();
    if (t) parts.push(t);
  }
  const raw = parts.join(' ');
  if ((raw[0] === '"' || raw[0] === "'") && quoteState(raw) === 'open') {
    throw new Error('引号没有闭合，也没找到续行：' + raw.slice(0, 60));
  }
  return parseScalar(raw);
}

/* | 和 > 块标量 */
function blockScalar(contLines, marker) {
  const filled = contLines.filter((l) => l.trim());
  const minInd = filled.length ? Math.min.apply(null, filled.map(indentOf)) : 0;
  const block = contLines.map((l) => (l.trim() ? l.slice(minInd) : ''));
  while (block.length && !block[block.length - 1].trim()) block.pop();
  const folded = marker[0] === '>';
  return folded
    ? block.join(' ').replace(/[ \t]+/g, ' ').trim()
    : block.join('\n');
}

/* 一个值：空 → 子块；|/> → 块标量；否则 → 标量（可能折行） */
function readValue(ctx, rest, parentIndent) {
  if (!rest) return parseBlock(collectBlock(ctx, parentIndent));
  if (/^[|>][-+]?$/.test(rest)) {
    return blockScalar(collectBlock(ctx, parentIndent), rest);
  }
  const cont = collectBlock(ctx, parentIndent);
  return cont.length ? scalarFromLines(rest, cont) : parseScalar(rest);
}

/* 键值映射（缩进已归一，每行缩进应等于 baseIndent） */
function parseMapping(ctx, baseIndent) {
  const obj = {};
  while (ctx.i < ctx.lines.length) {
    const line = ctx.lines[ctx.i];
    if (isBlank(line)) { ctx.i++; continue; }
    const ind = indentOf(line);
    if (ind < baseIndent) break;
    if (ind > baseIndent) {
      throw new Error('缩进对不上（期望 ' + baseIndent + '，实际 ' + ind + '）：' + line);
    }
    const m = line.slice(ind).match(/^([A-Za-z_][\w-]*):(?:\s+([\s\S]*))?$/);
    if (!m) throw new Error('无法解析的 frontmatter 行：' + line);
    const rest = (m[2] || '').trim();
    ctx.i++;
    obj[m[1]] = readValue(ctx, rest, ind);
  }
  return obj;
}

/* 序列：- 纯量 / - key: value（可跟同级续行） */
function parseSequence(lines) {
  const items = [];
  const ctx = { lines, i: 0 };
  while (ctx.i < lines.length) {
    const line = lines[ctx.i];
    if (isBlank(line)) { ctx.i++; continue; }
    const ind = indentOf(line);
    if (ind !== 0) throw new Error('序列项缩进异常：' + line);
    /* "- " 的宽度要单独量，不能把后面的内容一起算进去 */
    const dm = /^-([ \t]+|$)/.exec(line);
    if (!dm) throw new Error('无法解析的序列项：' + line);
    const dashWidth = dm[0].length;
    const rest = line.slice(dashWidth).trim();
    ctx.i++;

    if (!rest) {
      items.push(parseBlock(collectBlock(ctx, 0)));
      continue;
    }
    /* 纯量项：- skincare OEM manufacturer（也可能折行） */
    if (!/^[A-Za-z_][\w-]*:([ \t]|$)/.test(rest)) {
      const cont = collectBlock(ctx, 0);
      items.push(cont.length ? scalarFromLines(rest, cont) : parseScalar(rest));
      continue;
    }
    /* 映射项：- q: ... 后面可能跟 a: ... */
    const itemLines = [rest];
    while (ctx.i < lines.length) {
      const l = lines[ctx.i];
      if (isBlank(l)) { ctx.i++; continue; }
      if (indentOf(l) === 0) break;
      itemLines.push(l.slice(Math.min(dashWidth, indentOf(l))));
      ctx.i++;
    }
    items.push(parseBlock(itemLines));
  }
  return items;
}

/* 一组行 → 数组或对象（自动去掉公共缩进） */
function parseBlock(rawLines) {
  const lines = rawLines.filter((l) => !isBlank(l));
  if (!lines.length) return '';
  const base = Math.min.apply(null, lines.map(indentOf));
  const dedented = lines.map((l) => l.slice(base));
  if (/^-([ \t]|$)/.test(dedented[0])) return parseSequence(dedented);
  return parseMapping({ lines: dedented, i: 0 }, 0);
}

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
  const data = parseMapping({ lines, i: 0 }, 0);
  return { data, body };
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
