/* ============================================================
   POST /api/enquiry —— 询盘表单的接收端
   ------------------------------------------------------------
   为什么需要它：站点的询盘表单原来提交到站点根目录，由 Netlify Forms
   接管。那是 Netlify 的专属功能，换到 Cloudflare 之后 POST / 直接返回
   405，访客会看到"发送失败"，线索就丢了。Pages Function 补上这一环。

   它做四件事：
     1) 丢弃机器人（隐藏的 bot-field 一旦有值就静默成功，不告诉对方）
     2) 必填校验 + 长度截断，避免有人刷超长字段
     3) 转发给 Web3Forms，由它发邮件；access key 放在环境变量
        WEB3FORMS_KEY 里，不进公开仓库（这个仓库是公开的）
     4) 统一返回 JSON，前端只看 ok 字段

   为什么不用 FormSubmit：它按来源 IP 限流，Cloudflare 的出口 IP 是共享的，
   实测直接返回 "Rate limit exceeded"，从服务器端转发根本发不出去。
   Web3Forms 用 key 鉴权，跟 IP 无关。

   收件邮箱改成谁：Web3Forms 的 key 是绑邮箱的，换邮箱等于换 key ——
   去 web3forms.com 用新邮箱再取一个，改掉 Cloudflare 环境变量即可，
   不用动代码。
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

  const accessKey = (env && env.WEB3FORMS_KEY) || '';
  if (!accessKey) {
    /* 没配 key 时不能假装成功 —— 那样线索就静默丢了 */
    return json({ ok: false, error: 'Enquiry endpoint is not configured.' }, 503);
  }

  const payload = {
    access_key: accessKey,
    subject: 'SEYE 询盘 · ' + data.category + ' · ' + data.name,
    from_name: 'SEYE Website',
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
