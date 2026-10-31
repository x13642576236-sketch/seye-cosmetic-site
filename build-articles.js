#!/usr/bin/env node
/* ============================================================
   SEYE · 文章构建脚本
   ------------------------------------------------------------
   把 content/articles/*.md 里的文章生成为静态文件：
     insights/index.html
     insights/<slug>/index.html
     sitemap.xml  robots.txt  llms.txt  feed.xml

   两个使用场景：
   1) 本地：node build-articles.js（或双击 publish.bat）
   2) Netlify：项目里的构建命令就是 node build-articles.js
      在线后台（Pages CMS）每次保存都提交一个 md，Netlify 自动重新生成。

   文章的事实来源是 md 文件。content/articles.js 是同名数据的**生成产物**，
   只是留给本地 admin.html 做离线预览用，不要手改 —— 每次构建都会覆盖。
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

global.window = global;
require('./site.config.js');
require('./article-builder.js');
/* 首页的 og 文案和 title 同源，都取自 content.js，避免两处各写一遍 */
try { require('./content.js'); } catch (e) {
  console.warn('! content.js 读取失败，首页 og 文案将回退到 index.html 里的值');
}

const { loadArticles } = require('./articles-md.js');

const B = global.SITEBuilder;
const posts = loadArticles();

/* 绝对地址的唯一来源。Netlify 会在构建时注入 URL 环境变量，
   所以预览部署的 canonical 会指向预览域名 —— 这正是想要的：
   预览站本来就不该被索引，指向自己也比指向正式站诚实。 */
function resolveBaseUrl(cfg) {
  const fromEnv = (process.env.SITE_BASE_URL || process.env.URL || '').trim();
  const raw = (fromEnv || cfg.baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+/.test(raw)) {
    console.error('× baseUrl 不是合法的绝对地址：' + JSON.stringify(raw));
    console.error('  canonical / sitemap / 分享卡片都会失效，先改 site.config.js 再构建。');
    process.exit(1);
  }
  return raw;
}

const cfg = Object.assign({}, global.SITE_CONFIG || {});
cfg.baseUrl = resolveBaseUrl(cfg);

if (!B) {
  console.error('× 未能加载 article-builder.js');
  process.exit(1);
}
if (!posts.length) {
  console.warn('! content/articles/ 里没有 md 文件，只会生成空的列表页');
}

/* 给本地后台用的数据镜像，内容固定、顺序固定，重复构建不会产生 diff */
const mirrorPath = path.join(__dirname, 'content', 'articles.js');
const mirror = '/* 自动生成，请勿手改。\n' +
  '   文章的事实来源是 content/articles/*.md（在线后台 Pages CMS 编辑的就是它们）。\n' +
  '   这里只是给 admin.html 的离线预览用的镜像，每次构建都会覆盖。 */\n' +
  'window.SITE_ARTICLES = ' + JSON.stringify(posts, null, 2) + ';\n';
if (!fs.existsSync(mirrorPath) || fs.readFileSync(mirrorPath, 'utf8') !== mirror) {
  fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
  fs.writeFileSync(mirrorPath, mirror, 'utf8');
  console.log('  ✓ content/articles.js 镜像已更新（' + posts.length + ' 篇文章）');
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
  /* canonical + og/twitter 绝对地址 + JSON-LD：交给 builder 生成，别在这儿拼字符串 */
  const withSeo = out === null ? null : B.injectHomeSeo(out, cfg, global.SITE_CONTENT && global.SITE_CONTENT.meta);
  if (withSeo === null) {
    console.warn('! index.html 里没有 <!-- SEO:START --> 标记，canonical 与分享卡片未更新');
  } else {
    out = withSeo;
  }
  if (out !== null && out !== html) {
    fs.writeFileSync(indexPath, out, 'utf8');
    console.log('  ✓ index.html 首页区块 / robots / SEO 头已更新' +
      (cfg.stage ? '（测试模式：禁止收录）' : ''));
  } else if (out !== null) {
    console.log('  · index.html 无变化');
  }
} else {
  console.warn('! 找不到 index.html，跳过首页注入');
}

console.log('域名基准：' + cfg.baseUrl);
