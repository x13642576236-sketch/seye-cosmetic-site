#!/usr/bin/env node
/* 一键发布：构建 → 提交 → 推送。Cloudflare Pages 收到 push 后自己重建上线。
 *
 * 为什么用 Node 而不是纯 .bat：
 * 这台机器没有安装系统版 Git，git.exe 在 WorkBuddy 的 PortableGit 目录里，
 * 双击打开的 cmd 窗口 PATH 里没有它。Node 版可以自己找 git、能读文件、
 * 能在失败时给出人话提示，而且发布逻辑可以被测试。
 *
 * 用法：双击 publish.bat，或 node publish.js；加 --dry-run 只检查不动仓库。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');

const ROOT = __dirname;
const DRY = process.argv.includes('--dry-run');
const LIVE = 'https://seye-cosmetic-site.netlify.app';

function line(s) { console.log(s || ''); }
function step(n, s) { line(`[${n}/4] ${s}`); }

/* ---------- 找 git ---------- */

function exists(p) {
  try { fs.accessSync(p); return true; } catch (e) { return false; }
}

function findGit() {
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (!probe.error && probe.status === 0) return { bin: 'git', from: 'PATH' };

  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe')
  ];

  /* WorkBuddy 自带的便携版：按版本号目录找最新一个 */
  const pgRoot = path.join(process.env.USERPROFILE || '', '.workbuddy', 'binaries', 'PortableGit', 'versions');
  if (exists(pgRoot)) {
    const vers = fs.readdirSync(pgRoot).sort();
    for (let i = vers.length - 1; i >= 0; i--) {
      candidates.push(path.join(pgRoot, vers[i], 'cmd', 'git.exe'));
    }
  }

  for (const c of candidates) {
    if (!c || !exists(c)) continue;
    const test = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (!test.error && test.status === 0) {
      return { bin: c, from: path.basename(path.dirname(path.dirname(c))) };
    }
  }
  return null;
}

/* ---------- 主流程 ---------- */

function run(bin, args, opts) {
  return spawnSync(bin, args, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts || {}));
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve((a || '').trim()); });
  });
}

async function main() {
  line();
  line('==========================================');
  line('  SEYE 站点 · 发布上线');
  line('==========================================');

  const git = findGit();
  if (!git) {
    line();
    line('[STOP] 找不到 git。');
    line('  装了 Git for Windows 的话，重新打开窗口再试；');
    line('  没装的话，告诉我，我把路径写死进脚本。');
    return 1;
  }
  line(`  git: ${git.bin}`);

  /* 1. 首页是否被可视化编辑器污染 */
  step(1, '检查首页是否被编辑器改写');
  const indexFile = path.join(ROOT, 'index.html');
  if (!exists(indexFile)) {
    line('  [STOP] 找不到 index.html，确认这个脚本放在 seye-website 根目录。');
    return 1;
  }
  if (fs.readFileSync(indexFile, 'utf8').includes('data-page-node-id')) {
    line();
    line('  [STOP] index.html 里混进了 data-page-node-id 属性，是可视化编辑器改的。');
    line('  先执行： git checkout -- index.html   然后重跑。');
    return 1;
  }
  line('  ok');

  /* 2. 构建 */
  step(2, '重新生成文章 / sitemap / feed');
  const build = spawnSync(process.execPath, [path.join(ROOT, 'build-articles.js')], {
    cwd: ROOT, stdio: 'inherit'
  });
  if (build.status !== 0) {
    line();
    line('  [STOP] 构建失败，没有提交任何东西。看上面的报错。');
    return 1;
  }

  /* 3. 提交 */
  step(3, '提交改动');
  run(git.bin, ['add', '-A'], { stdio: 'inherit' });
  const staged = run(git.bin, ['diff', '--cached', '--quiet']);
  if (staged.status === 0) {
    line('  没有改动，不需要上传。');
    line();
    return 0;
  }

  const changed = run(git.bin, ['diff', '--cached', '--name-only']);
  const files = (changed.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  line(`  改动 ${files.length} 个文件：`);
  files.slice(0, 12).forEach((f) => line(`    · ${f}`));
  if (files.length > 12) line(`    · 还有 ${files.length - 12} 个`);

  let msg = DRY ? 'dry-run' : await ask('提交说明（直接回车用默认）：');
  if (!msg) msg = 'content: 更新站点内容';

  if (DRY) {
    line(`  [dry-run] 会提交：${msg}`);
    line('  [dry-run] 会推送：origin main');
    line();
    return 0;
  }

  const commit = run(git.bin, ['commit', '-q', '-m', msg], { stdio: 'inherit' });
  if (commit.status !== 0) {
    line();
    line('  [STOP] 提交失败，看上面的报错。');
    return 1;
  }
  line('  已提交');

  /* 4. 推送 */
  step(4, '推送到 GitHub');
  const push = run(git.bin, ['push', 'origin', 'main'], { stdio: 'inherit' });
  if (push.status !== 0) {
    line();
    line('  [STOP] 推送失败。检查网络，或手动执行： git push origin main');
    return 1;
  }

  line();
  line('  完成。Cloudflare Pages 大约一分钟后自动上线。');
  line(`  ${LIVE}`);
  line();
  return 0;
}

main().then((code) => { process.exitCode = code; });
