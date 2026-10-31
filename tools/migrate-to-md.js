#!/usr/bin/env node
/* 一次性迁移：content/articles.js  →  content/articles/<slug>.md
 *
 * 迁移后 md 是唯一事实来源，Pages CMS 直接编辑这些 md。
 * 跑完会做一次往返校验：md 读回来的对象必须和原对象完全一致，
 * 任何一个字段不一致都会打印差异并以非零退出。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'content', 'articles.js'));

const md = require(path.join(ROOT, 'articles-md.js'));
const posts = global.SITE_ARTICLES || [];

if (!posts.length) {
  console.error('× content/articles.js 里没有文章');
  process.exit(1);
}

const outDir = path.join(ROOT, 'content', 'articles');
fs.mkdirSync(outDir, { recursive: true });

let failed = 0;

posts.forEach((post) => {
  const file = path.join(outDir, post.slug + '.md');
  const text = md.toMarkdown(post);
  fs.writeFileSync(file, text, 'utf8');

  const back = md.loadArticles(outDir).find((p) => p.slug === post.slug);
  const diffs = [];

  md.META_KEYS.forEach((k) => {
    const a = JSON.stringify(post[k] === undefined ? null : post[k]);
    const b = JSON.stringify(back[k] === undefined ? null : back[k]);
    if (a !== b) diffs.push(`${k}\n    原: ${a.slice(0, 160)}\n    回: ${b.slice(0, 160)}`);
  });
  const bodyA = String(post.body || '').trim();
  const bodyB = String(back.body || '').trim();
  if (bodyA !== bodyB) {
    diffs.push(`body 长度 ${bodyA.length} → ${bodyB.length}\n    原头: ${bodyA.slice(0, 120)}\n    回头: ${bodyB.slice(0, 120)}`);
  }

  if (diffs.length) {
    failed++;
    console.log(`✗ ${post.slug}`);
    diffs.forEach((d) => console.log('  · ' + d));
  } else {
    console.log(`✓ ${post.slug}  (${(text.length / 1024).toFixed(1)} KB, 往返一致)`);
  }
});

console.log(`\n共 ${posts.length} 篇，${posts.length - failed} 篇往返一致`);
process.exit(failed ? 1 : 0);
