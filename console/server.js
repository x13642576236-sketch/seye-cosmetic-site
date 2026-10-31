#!/usr/bin/env node
/* ============================================================
   SEYE 控制台 —— 本地小服务（只监听 127.0.0.1，不对外）
   ------------------------------------------------------------
   做的事很少，但都是浏览器里点不到的那几件：
     GET  /            控制台页面
     GET  /api/status  线上状态 / 未发布改动 / 最后一次提交 / 文章数
     POST /api/publish 真的跑一遍 publish.js（构建 → 提交 → 推送）
     POST /api/open    打开本地编辑器或仓库文件夹

   为什么需要一个本地服务：网页没有权限启动进程，也没法读本地 git。
   双击 console.bat → 这个服务起来 → 自动打开浏览器。
   零依赖，只用 Node 自带模块。
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(__dirname, 'index.html');
const LIVE = 'https://seye-cosmetic-site.pages.dev';
const PORT_START = 4477;

/* ---------- 找 git（和 publish.js 同一套逻辑，这台机器没有系统 Git） ---------- */

function exists(p) {
  try { fs.accessSync(p); return true; } catch (e) { return false; }
}

let GIT = null;
function findGit() {
  if (GIT !== null) return GIT;
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (!probe.error && probe.status === 0) { GIT = 'git'; return GIT; }

  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd', 'git.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'cmd', 'git.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe')
  ];
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
    if (!test.error && test.status === 0) { GIT = c; return GIT; }
  }
  GIT = false;
  return GIT;
}

function git(args) {
  const bin = findGit();
  if (!bin) return { ok: false, out: '' };
  const r = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/* ---------- 状态采集 ---------- */

function ago(seconds) {
  if (seconds < 60) return '刚刚';
  const m = Math.round(seconds / 60);
  if (m < 60) return m + ' 分钟前';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' 小时前';
  return Math.round(h / 24) + ' 天前';
}

function readConfig() {
  const out = { stage: null, baseUrl: '' };
  try {
    const s = fs.readFileSync(path.join(ROOT, 'site.config.js'), 'utf8');
    const st = s.match(/stage\s*:\s*(true|false)/);
    if (st) out.stage = st[1] === 'true';
    const b = s.match(/baseUrl\s*:\s*['"]([^'"]+)['"]/);
    if (b) out.baseUrl = b[1];
  } catch (e) { /* 读不到就留空 */ }
  return out;
}

function countArticles() {
  try {
    return fs.readdirSync(path.join(ROOT, 'content', 'articles'))
      .filter(f => f.endsWith('.md')).length;
  } catch (e) { return 0; }
}

async function checkSite(url) {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { method: 'GET', signal: ctl.signal, cache: 'no-store', redirect: 'follow' });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e.name || 'error' };
  }
}

async function status() {
  const cfg = readConfig();

  const dirty = git(['status', '--porcelain']).out.split('\n').filter(Boolean);
  const ahead = git(['rev-list', '--count', '@{u}..HEAD']);
  const last = git(['log', '-1', '--format=%H%n%ct%n%s']);

  let commit = null;
  if (last.ok && last.out) {
    const [hash, ts, subject] = last.out.split('\n');
    const secs = Math.max(0, Math.floor(Date.now() / 1000) - parseInt(ts, 10));
    commit = { hash: (hash || '').slice(0, 7), subject: subject || '', ago: ago(secs) };
  }

  const site = await checkSite(cfg.baseUrl || LIVE);

  return {
    site: Object.assign({ url: cfg.baseUrl || LIVE }, site),
    git: {
      available: !!findGit(),
      dirty: dirty.length,
      files: dirty.slice(0, 12),
      ahead: ahead.ok ? parseInt(ahead.out || '0', 10) : 0,
      commit
    },
    articles: countArticles(),
    stage: cfg.stage,
    root: ROOT
  };
}

/* ---------- 发布 ---------- */

let publishing = false;

function publish(message) {
  return new Promise((resolve) => {
    if (publishing) { resolve({ ok: false, log: '已经有一次发布在跑了，等它结束。' }); return; }
    publishing = true;

    const args = ['publish.js'];
    if (message) args.push('--message', message);

    const child = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true });
    let log = '';
    const push = (d) => { log += d.toString('utf8'); if (log.length > 60000) log = log.slice(-40000); };
    child.stdout.on('data', push);
    child.stderr.on('data', push);

    /* publish.js 在没有 --message 时会问一句，这里兜住，避免卡住 */
    child.stdin.write((message || '') + '\n');
    child.stdin.end();

    const timer = setTimeout(() => { try { child.kill(); } catch (e) {} }, 180000);

    child.on('close', (code) => {
      clearTimeout(timer);
      publishing = false;
      resolve({ ok: code === 0, code: code, log: log.replace(/\x1b\[[0-9;]*m/g, '') });
    });
  });
}

/* ---------- 打开本地东西 ---------- */

function openTarget(which) {
  const map = {
    editor: path.join(ROOT, 'admin.html'),
    folder: ROOT
  };
  const target = map[which];
  if (!target) return false;

  if (which === 'folder') {
    spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
  } else {
    /* 用默认浏览器打开本地文件；start 的第一个引号参数是窗口标题，必须留空 */
    spawn('cmd', ['/c', 'start', '', 'file:///' + target.replace(/\\/g, '/')],
      { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  }
  return true;
}

/* ---------- HTTP ---------- */

function send(res, code, type, body) {
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    let html = '';
    try { html = fs.readFileSync(PAGE, 'utf8'); } catch (e) {
      return send(res, 500, 'text/plain; charset=utf-8', '找不到 console/index.html');
    }
    return send(res, 200, 'text/html; charset=utf-8', html);
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const body = await status();
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(body));
  }

  /* 写操作要求自定义头：外部网页无法在不触发预检的情况下伪造，够用了 */
  const isLocal = req.headers['x-console'] === '1';

  if (req.method === 'POST' && url.pathname === '/api/publish') {
    if (!isLocal) return send(res, 403, 'application/json; charset=utf-8', '{"ok":false}');
    const body = await readBody(req);
    const result = await publish((body.message || '').trim());
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(result));
  }

  if (req.method === 'POST' && url.pathname === '/api/open') {
    if (!isLocal) return send(res, 403, 'application/json; charset=utf-8', '{"ok":false}');
    const body = await readBody(req);
    const ok = openTarget(body.target);
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok }));
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

function listen(port, tries) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries > 0) {
      listen(port + 1, tries - 1);
    } else {
      console.error('控制台启动失败：' + e.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const addr = 'http://127.0.0.1:' + port;
    console.log('');
    console.log('  SEYE 控制台已启动');
    console.log('  ' + addr);
    console.log('  关掉这个窗口就停止。');
    console.log('');
    spawn('cmd', ['/c', 'start', '', addr], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  });
}

listen(PORT_START, 12);
