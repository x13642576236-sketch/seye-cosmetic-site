/* ============================================================
   POST /api/enquiry —— 询盘表单的接收端
   ------------------------------------------------------------
   为什么需要它：站点的询盘表单原来提交到站点根目录，由 Netlify Forms
   接管。那是 Netlify 的专属功能，换到 Cloudflare 之后 POST / 直接返回
   405，访客会看到"发送失败"，线索就丢了。Pages Function 补上这一环。

   它做四件事：
     1) 丢弃机器人（隐藏的 bot-field 一旦有值就静默成功，不告诉对方）
     2) 必填校验 + 长度截断，避免有人刷超长字段
     3) 转发给 FormSubmit，由它发邮件；收件人地址放在环境变量
        ENQUIRY_TO 里，不进公开仓库（这个仓库是公开的）
     4) 统一返回 JSON，前端只看 ok 字段

   收件邮箱改成谁：在 Cloudflare 项目 Settings → Variables and Secrets
   里改 ENQUIRY_TO，不用改代码、不用重新部署。
   ============================================================ */

const REQUIRED = ['name', 'email', 'category', 'quantity', 'brief'];
const MAX_LEN = { name: 120, email: 200, category: 80, quantity: 80, brief: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

export async function onRequestGet() {
  return json({ ok: false, error: 'Use POST.' }, 405);
}

export async function onRequestPost({ request, env }) {
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: false, error: 'Unsupported body.' }, 400);
  }

  /* 蜜罐：真人看不到这个字段，填写的一定是脚本。假装成功，别给对方反馈。 */
  const trap = form.get('bot-field');
  if (typeof trap === 'string' && trap.trim()) {
    return json({ ok: true });
  }

  const data = {};
  for (const key of REQUIRED) data[key] = await readField(form, key);

  const missing = REQUIRED.filter(k => !data[k]);
  if (missing.length) {
    return json({ ok: false, error: 'Missing fields: ' + missing.join(', ') }, 422);
  }
  if (!EMAIL_RE.test(data.email)) {
    return json({ ok: false, error: 'Invalid email address.' }, 422);
  }

  const to = (env && env.ENQUIRY_TO) || '';
  if (!to) {
    /* 没配收件人时不能假装成功 —— 那样线索就静默丢了 */
    return json({ ok: false, error: 'Enquiry endpoint is not configured.' }, 503);
  }

  const payload = {
    name: data.name,
    email: data.email,
    category: data.category,
    quantity: data.quantity,
    brief: data.brief,
    _replyto: data.email,
    _subject: 'SEYE 网站询盘 · ' + data.category + ' · ' + data.name,
    _template: 'table',
    _captcha: 'false'
  };

  /* FormSubmit 会校验来源站点：没有 Origin 时它当成"本地打开 HTML 文件"直接拒绝，
     所以这里把本站的 origin 显式带上（服务端转发时浏览器头不会被继承）。 */
  const siteOrigin = new URL(request.url).origin;

  let upstream;
  try {
    upstream = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(to), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        origin: siteOrigin,
        referer: siteOrigin + '/'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ ok: false, error: 'Delivery service unreachable.' }, 502);
  }

  /* 上游用字符串 "true"/"false"，不是布尔值；HTTP 200 也可能表示"待激活"或"被限流"，
     所以必须看 body，不能只看状态码。 */
  let reply = null;
  try { reply = await upstream.json(); } catch (e) { /* 非 JSON */ }
  const accepted = reply && String(reply.success) === 'true';

  if (!upstream.ok || !accepted) {
    return json({
      ok: false,
      error: (reply && reply.message) || ('Delivery failed (HTTP ' + upstream.status + ').')
    }, 502);
  }

  return json({ ok: true });
}
