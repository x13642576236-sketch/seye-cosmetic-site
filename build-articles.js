#!/usr/bin/env node
/* ============================================================
   SEYE · 文章构建脚本
   ------------------------------------------------------------
   把 content/articles.js 里的文章生成为静态文件：
     insights/index.html
     insights/<slug>/index.html
     sitemap.xml  robots.txt  llms.txt

   两个使用场景：
   1) 本地：node build-articles.js（或直接双击 build-articles.bat）
   2) Netlify：仓库里的构建命令设为 node build-articles.js
      这样在 Pages CMS / Decap 里点发布，Netlify 自动重新生成页面。

   浏览器里也能生成同样的结果（admin.html 用的是同一个 article-builder.js），
   这条命令只是让 CI 和本地各有一条不依赖界面的路。
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

global.window = global;
require('./content/articles.js');
require('./article-builder.js');

const B = global.SITEBuilder;
const posts = global.SITE_ARTICLES || [];
const cfg = global.SITE_CONFIG || {};

if (!B) {
  console.error('× 未能加载 article-builder.js');
  process.exit(1);
}
if (!posts.length) {
  console.warn('! 没有任何文章，只会生成空的列表页');
}

const files = B.buildAll(posts, cfg);

files.forEach(function (f) {
  const target = path.join(__dirname, f.name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, f.data, 'utf8');
  const kb = (Buffer.byteLength(f.data, 'utf8') / 1024).toFixed(1);
  console.log('  ✓ ' + f.name.padEnd(52) + kb + ' KB');
});

console.log('\n共 ' + files.length + ' 个文件，' + posts.length + ' 篇文章');

/* 首页「最新文章」区块：只替换标记之间的内容，其余 HTML 原样保留。
   标记不存在时明确报警，绝不整份覆盖 —— 首页是手写维护的。 */
const indexPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const cards = B.buildHomeCards(posts, cfg, 3);
  let out = B.injectHomeCards(html, cards);
  if (out === null) {
    console.warn('! index.html 里没有 <!-- ARTICLES:START --> 标记，首页区块未更新');
  }
  const withRobots = out === null ? null : B.injectRobotsMeta(out, cfg);
  if (withRobots === null) {
    console.warn('! index.html 里没有 <!-- ROBOTS:START --> 标记，robots 未更新');
  } else {
    out = withRobots;
  }
  if (out !== null && out !== html) {
    fs.writeFileSync(indexPath, out, 'utf8');
    console.log('  ✓ index.html 首页区块 / robots 已更新' +
      (cfg.stage ? '（测试模式：禁止收录）' : ''));
  } else if (out !== null) {
    console.log('  · index.html 无变化');
  }
} else {
  console.warn('! 找不到 index.html，跳过首页注入');
}

console.log('域名基准：' + cfg.baseUrl);
