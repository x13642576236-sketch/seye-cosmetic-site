#!/usr/bin/env node
/* ============================================================
   SEYE · 一条命令发布
   ------------------------------------------------------------
   把原来五步手工流程收成一步：
     1) 重新生成所有文章页 / sitemap / robots / llms / RSS
     2) 回写首页的「最新文章」区块与 robots 标记
     3) 按白名单重建 dist/（顺手清掉陈旧文件与误拷进来的素材）
     4) 打包 seye-site-dist.zip

   用法：
     node release.js            # 完整流程
     node release.js --no-zip   # 只重建 dist，不打包

   之后只需要把 dist 文件夹拖进 Netlify（或把 zip 上传），
   不需要再在本地翻文件、手动挑要传什么。
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ZIP = path.join(ROOT, 'seye-site-dist.zip');
const NO_ZIP = process.argv.includes('--no-zip');

/* ---------- 白名单：dist 里只允许出现这些 ---------- */
const FILES = [
  'index.html',
  '404.html',
  'content.js',
  'cms.js',
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'feed.xml',
  '_headers'
];
const DIRS = [
  'insights',
  'assets'
];

/* 绝对不进部署包的东西。_unused-source-png 曾经被整目录同步进去，
   让 2.3MB 的站点变成 4.0MB，所以这里明确挡一道。 */
const BLOCK = [
  /(^|[\\/])_unused-source-png([\\/]|$)/,
  /(^|[\\/])_quarantine([\\/]|$)/,
  /(^|[\\/])Thumbs\.db$/i,
  /(^|[\\/])\.DS_Store$/i,
  /(^|[\\/])\.git([\\/]|$)/,
  /\.map$/i
];

function blocked(p) {
  const rel = path.relative(ROOT, p);
  return BLOCK.some(re => re.test(rel)) || BLOCK.some(re => re.test(p));
}

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

function copyTree(src, dst) {
  ensureDir(dst);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (blocked(s)) continue;
    const st = fs.statSync(s);
    if (st.isDirectory()) copyTree(s, d);
    else if (st.isFile()) fs.copyFileSync(s, d);
  }
}

/* 删掉 dist 里本轮没有产出的文件/目录（旧文章、改过名的 slug 等）。

   注意 UNC 路径上的一个坑：删文件没问题，但删空目录会被运行环境的
   安全删除垫片转去回收站，而回收站不支持网络路径 → 直接抛错。
   所以空目录改用 rename 挪到 _quarantine，不改用更暴力的删除手段。 */
const STAMP = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const STALE_DIR = path.join(ROOT, '_quarantine', 'stale-' + STAMP);
let quarantined = 0;

function sideLine(p) {
  try {
    ensureDir(STALE_DIR);
    let target = path.join(STALE_DIR, path.relative(DIST, p).split(path.sep).join('_'));
    let n = 1;
    while (fs.existsSync(target)) target = target + '.' + (n++);
    fs.renameSync(p, target);
    quarantined++;
  } catch (e) {
    console.warn('  ! 无法清理 ' + path.relative(DIST, p) + '：' + e.message.slice(0, 60));
  }
}

function prune(dir, keep) {
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      removed += prune(p, keep);
      if (fs.readdirSync(p).length === 0) {
        try { fs.rmdirSync(p); removed++; }
        catch (e) { sideLine(p); }
      }
    } else if (!keep.has(path.relative(DIST, p).split(path.sep).join('/'))) {
      try { fs.unlinkSync(p); removed++; }
      catch (e) { sideLine(p); }
    }
  }
  return removed;
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.add(path.relative(DIST, p).split(path.sep).join('/'));
  }
}


/* ============ 1. 生成文章 ============ */
console.log('\n[1/4] 生成文章页面');
require('./build-articles.js');

/* ============ 2. 重建 dist ============ */
console.log('\n[2/4] 重建 dist/');
ensureDir(DIST);

let copied = 0;
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { console.warn('  ! 缺少 ' + f + '，跳过'); continue; }
  fs.copyFileSync(src, path.join(DIST, f));
  copied++;
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) { console.warn('  ! 缺少 ' + d + '/，跳过'); continue; }
  copyTree(src, path.join(DIST, d));
  copied++;
}

/* ============ 3. 清理陈旧文件 ============ */
/* 白名单要从源目录算，不能从 dist 现况算 ——
   拿 dist 自己当基准的话，陈旧的旧文章永远会被判定为「该保留」。 */
const keep = new Set(FILES.filter(f => fs.existsSync(path.join(ROOT, f))));
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) continue;
  (function collect(s) {
    for (const name of fs.readdirSync(s)) {
      const p = path.join(s, name);
      if (blocked(p)) continue;
      if (fs.statSync(p).isDirectory()) collect(p);
      else keep.add(path.relative(ROOT, p).split(path.sep).join('/'));
    }
  })(src);
}
const removed = prune(DIST, keep);
console.log('  拷贝 ' + copied + ' 项，清理陈旧文件 ' + removed + ' 个' +
  (quarantined ? '（另有 ' + quarantined + ' 个空目录移到 _quarantine/stale-' + STAMP + '）' : ''));

/* 体积报告 */
function size(p) {
  const st = fs.statSync(p);
  if (st.isFile()) return st.size;
  let n = 0;
  for (const name of fs.readdirSync(p)) n += size(path.join(p, name));
  return n;
}
const mb = (size(DIST) / 1048576).toFixed(2);
console.log('  dist 体积 ' + mb + ' MB');

/* 漏网检查：部署包里不该有源图 / 系统缓存 */
const leaked = [];
(function check(d) {
  for (const name of fs.readdirSync(d)) {
    const p = path.join(d, name);
    if (blocked(p)) leaked.push(path.relative(DIST, p));
    else if (fs.statSync(p).isDirectory()) check(p);
  }
})(DIST);
if (leaked.length) console.warn('  ! 仍有不该上传的文件：' + leaked.join(', '));

/* ============ 4. 打包 ============ */
if (NO_ZIP) {
  console.log('\n[3/4] 跳过打包（--no-zip）');
} else {
  console.log('\n[3/4] 打包 zip');
  global.window = global;
  require('./content/articles.js');
  require('./article-builder.js');
  const B = global.SITEBuilder;

  const entries = [];
  (function collect(d) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) collect(p);
      else entries.push({
        name: path.relative(DIST, p).split(path.sep).join('/'),
        data: fs.readFileSync(p)
      });
    }
  })(DIST);

  const buf = B.zip(entries);
  fs.writeFileSync(ZIP, Buffer.from(buf));
  console.log('  ✓ ' + path.basename(ZIP) + '  ' +
    (fs.statSync(ZIP).size / 1048576).toFixed(2) + ' MB / ' + entries.length + ' 个文件');
}

/* ============ 收尾提示 ============ */
const cfg = (function () {
  global.window = global;
  try { require('./content/articles.js'); } catch (e) { /* 已加载过 */ }
  return global.SITE_CONFIG || {};
})();

/* 这里的域名是构建真正用的那个（环境变量优先），
   不是 site.config.js 里写死的那个 —— 两者在托管平台上通常不一样。 */
const shownBaseUrl = (function () {
  let env = (process.env.SITE_BASE_URL || process.env.URL || '').trim();
  if (!env && process.env.CF_PAGES_URL) {
    env = process.env.CF_PAGES_URL.trim()
      .replace(/^(https?:\/\/)[0-9a-z]{6,}\.(?=[^/]*\.pages\.dev)/i, '$1');
  }
  return (env || cfg.baseUrl || '').replace(/\/+$/, '');
})();

console.log('\n[4/4] 完成');
console.log('  域名基准：' + (shownBaseUrl || '(未设置)'));
console.log('  收录状态：' + (cfg.stage
  ? '测试模式 — robots.txt 禁抓 + 全站 noindex，搜索引擎不会收录'
  : '正式模式 — 允许收录，sitemap 已指向 ' + (shownBaseUrl || '') + '/sitemap.xml'));
console.log('\n  下一步：commit + push。托管平台（Cloudflare Pages / Netlify）会自动跑\n' +
  '          这个构建，不需要手动上传 dist。\n');
