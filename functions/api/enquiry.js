/* ============================================================
   POST /api/enquiry —— 询盘表单的接收端
   ------------------------------------------------------------
   为什么需要它：站点的询盘表单原来提交到站点根目录，由 Netlify Forms
   接管。那是 Netlify 的专属功能，换到 Cloudflare 之后 POST / 直接返回
   405，访客会看到"发送失败"，线索就丢了。Pages Function 补上这一环。

   它做六件事：
     1) 拦住跨站来源（浏览器从别的域名提交，直接 403）
     2) 限制请求体大小，避免有人灌大包
     3) 每个 IP 十分钟最多 5 次，防止脚本刷爆 Web3Forms 的免费额度
     4) 丢弃机器人（隐藏的 bot-field 一旦有值就静默成功，不告诉对方）
     5) 必填校验 + 长度截断
     6) 转发给 Web3Forms，由它发邮件

   access key 放在环境变量 WEB3FORMS_KEY 里，不进公开仓库
   （这个仓库是公开的）。品牌名走 BRAND_NAME，换公司只改环境变量。

   为什么不用 FormSubmit：它按来源 IP 限流，Cloudflare 的出口 IP 是共享的，
   实测直接返回 "Rate limit exceeded"，从服务器端转发根本发不出去。
   Web3Forms 用 key 鉴权，跟 IP 无关。

   限流的局限：内存计数只在单个 isolate 内有效，冷启动会清零，
   多数据中心之间也不共享。它挡不住大规模分布式攻击，但能挡住
   绝大多数"写个循环脚本刷表单"的情况。真要更严，就上
   Cloudflare Turnstile 或 KV 计数。
   ============================================================ */

const REQUIRED = ['name', 'email', 'category', 'quantity', 'brief'];
const MAX_LEN = { name: 120, email: 200, category: 80, quantity: 80, brief: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/* 模块级计数，isolate 生命周期内有效 */
const HITS = new Map();

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

async function readField(form, key) {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim().slice(0, MAX_LEN[key] || 500) : '';
}

/* 返回 true 表示这次请求应当被拒 */
function overLimit(ip) {
  if (!ip) return false;
  const now = Date.now();
  const recent = (HITS.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    HITS.set(ip, recent);
    return true;
  }
  recent.push(now);
  HITS.set(ip, recent);

  /* 顺手清理陈旧条目，避免 Map 无限增长 */
  if (HITS.size > 5000) {
    for (const [key, stamps] of HITS) {
      if (!stamps.length || now - stamps[stamps.length - 1] > WINDOW_MS) HITS.delete(key);
    }
  }
  return false;
}

export async function onRequestGet() {
  return json({ ok: false, error: 'Use POST.' }, 405);
}

export async function onRequestPost({ request, env }) {
  /* 1) 跨站来源。带 Origin 的通常是浏览器，来源必须是自己。
        没有 Origin 的是服务端调用（比如自测脚本），放行但照样限流。 */
  const origin = request.headers.get('origin');
  if (origin) {
    let from = '';
    try { from = new URL(origin).host; } catch (e) { from = ''; }
    const self = new URL(request.url).host;
    if (from && from !== self) {
      return json({ ok: false, error: 'Cross-origin submission rejected.' }, 403);
    }
  }

  /* 2) 体积。content-length 可能缺失（chunked），所以只作为第一道闸。 */
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'Request body too large.' }, 413);
  }

  /* 3) 频率 */
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (overLimit(ip)) {
    return json({ ok: false, error: 'Too many submissions. Please try again later.' }, 429);
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: false, error: 'Unsupported body.' }, 400);
  }

  /* 4) 蜜罐：真人看不到这个字段，填写的一定是脚本。假装成功，别给对方反馈。 */
  const trap = form.get('bot-field');
  if (typeof trap === 'string' && trap.trim()) {
    return json({ ok: true });
  }

  /* 5) 校验 */
  const data = {};
  for (const key of REQUIRED) data[key] = await readField(form, key);

  const missing = REQUIRED.filter(k => !data[k]);
  if (missing.length) {
    return json({ ok: false, error: 'Missing fields: ' + missing.join(', ') }, 422);
  }
  if (!EMAIL_RE.test(data.email)) {
    return json({ ok: false, error: 'Invalid email address.' }, 422);
  }

  const accessKey = (env && env.WEB3FORMS_KEY) || '';
  if (!accessKey) {
    /* 没配 key 时不能假装成功 —— 那样线索就静默丢了 */
    return json({ ok: false, error: 'Enquiry endpoint is not configured.' }, 503);
  }

  const brand = (env && env.BRAND_NAME) || 'SEYE';

  /* 6) 转发 */
  const payload = {
    access_key: accessKey,
    subject: brand + ' enquiry · ' + data.category + ' · ' + data.name,
    from_name: brand + ' Website',
    replyto: data.email,
    name: data.name,
    email: data.email,
    category: data.category,
    quantity: data.quantity,
    brief: data.brief
  };

  let upstream;
  try {
    upstream = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ ok: false, error: 'Delivery service unreachable.' }, 502);
  }

  /* Web3Forms 用布尔 success；HTTP 200 也可能是业务失败（key 失效、额度用尽），
     所以必须看 body，不能只看状态码。 */
  let reply = null;
  try { reply = await upstream.json(); } catch (e) { /* 非 JSON */ }
  const accepted = reply && reply.success === true;

  if (!upstream.ok || !accepted) {
    return json({
      ok: false,
      error: (reply && reply.message) || ('Delivery failed (HTTP ' + upstream.status + ').')
    }, 502);
  }

  return json({ ok: true });
}
