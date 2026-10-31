#!/usr/bin/env node
/* ============================================================
   换品牌 / 换域名 —— 一条命令改完所有硬编码
   ------------------------------------------------------------
   这套站的文案里品牌名是写死的（首页 45 处、404 页 4 处、文章若干），
   域名在 site.config.js。以后换成新公司时，不用一处处翻。

   用法（默认只预览，不动文件）：

     node tools/swap-brand.js --brand "ACME Biotech"
     node tools/swap-brand.js --brand "ACME Biotech" --site "acme.com"
     node tools/swap-brand.js --brand "ACME Biotech" --site "acme.com" --apply

   --site 只写域名（acme.com），不带 https://，协议会自动补。

   它不会动的东西（这些必须人来判断）：
     · 联系方式（邮箱、电话、WhatsApp）—— 换了公司一定也换了
     · 文章正文里的公司自述、案例、数字
     · 图片素材（厂房、证书都是实拍，换品牌要换图）
     · assets/ 里的图片和字体

   所以跑完 --apply 之后，务必用 git diff 逐条看一遍再发布。
   ============================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* 只改会发布出去、或决定发布结果的文本文件。
   dist/ 是构建产物，会被重新生成，不碰。 */
const TARGETS = [
  'index.html',
  '404.html',
  'site.config.js',
  'llms.txt',
  'functions/api/enquiry.js',
  'console/index.html',
  'content/articles'
];

function parseArgs(argv) {
  const out = { apply: false, brand: '', site: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--brand') out.brand = (argv[++i] || '').trim();
    else if (a === '--site') out.site = (argv[++i] || '').trim();
  }
  return out;
}

function walk(p) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return [];
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    return fs.readdirSync(abs)
      .flatMap(name => walk(path.join(p, name)));
  }
  return /\.(html|js|md|txt|yml|json)$/i.test(abs) ? [p] : [];
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.brand && !args.site) {
    console.log('\n至少给一个参数：--brand "新品牌名" 或 --site 新域名\n');
    console.log('示例：node tools/swap-brand.js --brand "ACME Biotech" --site acme.com\n');
    process.exit(1);
  }

  /* 旧值从配置里读，避免写死；品牌名的"短名"用 siteName 的第一段 */
  global.window = global;
  require(path.join(ROOT, 'site.config.js'));
  const cfg = global.SITE_CONFIG || {};
  const oldFull = (cfg.siteName || '').trim();
  const oldShort = oldFull.split(/\s+/)[0];
  const oldHost = (cfg.baseUrl || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  if (!oldFull || !oldShort) {
    console.log('读不到 site.config.js 里的 siteName，无法确定旧品牌名。');
    process.exit(1);
  }

  const newFull = args.brand || oldFull;
  const newShort = newFull.split(/\s+/)[0];
  const newHost = args.site ? args.site.replace(/^https?:\/\//, '').replace(/\/+$/, '') : oldHost;

  /* 顺序很重要：先长后短，否则 "SEYE Biomedical" 会被拆成 "ACME Biomedical" */
  const rules = [];
  if (args.brand) {
    rules.push([oldFull, newFull]);      // SEYE Biomedical → ACME Biotech
    if (oldShort !== oldFull) rules.push([oldShort, newShort]); // SEYE → ACME
  }
  if (args.site && newHost !== oldHost) {
    rules.push([oldHost, newHost]);      // 域名（含 canonical、JSON-LD、llms.txt）
  }

  console.log('\n替换规则：');
  for (const [from, to] of rules) console.log(`  ${from}  →  ${to}`);
  console.log(`\n模式：${args.apply ? '实际写入' : '预览（加 --apply 才写）'}\n`);

  const files = [...new Set(TARGETS.flatMap(walk))];
  let totalHits = 0;
  let touched = 0;
  const report = [];

  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    const before = fs.readFileSync(abs, 'utf8');
    let after = before;

    for (const [from, to] of rules) {
      if (!from) continue;
      after = after.split(from).join(to);
    }

    if (after === before) continue;

    let hits = 0;
    for (const [from] of rules) {
      if (!from) continue;
      hits += before.split(from).length - 1;
    }

    totalHits += hits;
    touched++;
    report.push(`  ${String(hits).padStart(3)} 处  ${rel}`);

    if (args.apply) fs.writeFileSync(abs, after, 'utf8');
  }

  if (!touched) {
    console.log('没有命中任何内容 —— 检查一下参数是否和现有品牌名一致。\n');
    process.exit(0);
  }

  console.log('命中：');
  report.forEach(l => console.log(l));
  console.log(`\n合计 ${totalHits} 处，涉及 ${touched} 个文件。`);

  if (args.apply) {
    console.log('\n已写入。接下来：');
  } else {
    console.log('\n这是预览，什么都没改。确认无误后加 --apply 再跑一次。\n接下来：');
  }
  console.log('  1. git diff 逐条检查（尤其文章正文里的公司自述）');
  console.log('  2. 改联系方式：邮箱、电话、WhatsApp（脚本不碰这些）');
  console.log('  3. 换图片素材：厂房、证书、产品图都是实拍');
  console.log('  4. 新域名要在 Cloudflare Pages 里绑定，并更新环境变量 SITE_BASE_URL');
  console.log('  5. node publish.js --message "chore: 换品牌" 发布\n');
}

main();
