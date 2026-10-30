/* ============================================================
   SEYE 首页 · 内容层
   ------------------------------------------------------------
   1) SITE_SCHEMA：定义「哪些字段可编辑」以及它对应页面上哪个位置。
   2) apply()：把 content.js 里的文字写进页面。

   找不到选择了就静默跳过 —— 所以 index.html 被改动、结构变了，
   页面也不会白屏，只是那一条不生效。缺 content.js 时页面显示原有文案。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 小工具：按序号生成重复卡片的字段 ---------- */
  function group(prefix, selBase, count, opts) {
    opts = opts || {};
    var hSel = opts.hSel || 'h3';
    var pSel = opts.pSel || 'p';
    var maxH = opts.maxH || 36;
    var maxP = opts.maxP || 160;
    var out = [];
    for (var i = 1; i <= count; i++) {
      out.push({
        key: prefix + '.' + (i - 1) + '.h',
        label: '第 ' + i + ' 项 · 标题',
        sel: selBase + ':nth-child(' + i + ') ' + hSel,
        max: maxH, type: 'textarea', rows: 2
      });
      out.push({
        key: prefix + '.' + (i - 1) + '.p',
        label: '第 ' + i + ' 项 · 说明',
        sel: selBase + ':nth-child(' + i + ') ' + pSel,
        max: maxP, type: 'textarea', rows: 3
      });
    }
    return out;
  }

  /* ---------- 证书 / 产品类目：由页面脚本渲染，没有静态 DOM ---------- */
  function listFields(prefix, count, keys, labels, maxes) {
    var out = [];
    for (var i = 1; i <= count; i++) {
      for (var k = 0; k < keys.length; k++) {
        out.push({
          key: prefix + '.' + (i - 1) + '.' + keys[k],
          label: '第 ' + i + ' 项 · ' + labels[k],
          max: maxes[k],
          type: labels[k].indexOf('图片') === 0 ? 'text' : 'textarea',
          rows: 2
        });
      }
    }
    return out;
  }

  var SCHEMA = [
    {
      id: 'seo', title: '页面信息', note: '影响浏览器标签、搜索结果和微信 / WhatsApp 分享卡片。改动后搜索引擎需要几天才更新。',
      fields: [
        { key: 'meta.title', label: '浏览器标签标题', sel: 'title', prop: 'text', max: 65 },
        { key: 'meta.description', label: '搜索描述', sel: 'meta[name="description"]', attr: 'content', max: 200, type: 'textarea', rows: 3, hint: 'Google 通常截断在 155–160 字，但原文案 184 字也能正常收录' },
        { key: 'meta.ogTitle', label: '分享标题', sel: 'meta[property="og:title"]', attr: 'content', max: 65 },
        { key: 'meta.ogDesc', label: '分享描述', sel: 'meta[property="og:description"]', attr: 'content', max: 200, type: 'textarea', rows: 3 }
      ]
    },
    {
      id: 'hero', title: '首屏', note: '主标题用换行控制断行，行数变多会挤压首屏高度。',
      fields: [
        { key: 'hero.eyebrowStrong', label: '小标签 · 强调字', sel: '.hero .eyebrow span', prop: 'text', max: 20 },
        { key: 'hero.eyebrowText', label: '小标签 · 后半句', sel: '.hero .eyebrow', textNode: true, pad: ' ', max: 34 },
        { key: 'hero.h1', label: '主标题', sel: '.hero h1', max: 52, type: 'textarea', rows: 3, hint: '每行一句，两到三行为佳' },
        { key: 'hero.lede', label: '副文案', sel: '.hero__lede', max: 250, type: 'textarea', rows: 4 },
        { key: 'hero.cta1', label: '主按钮文字', sel: '.hero__cta .btn-solid', textNode: true, max: 24 },
        { key: 'hero.cta2', label: '次按钮文字', sel: '.hero__cta .btn-outline-light', textNode: true, max: 24 }
      ]
    },
    {
      id: 'cert', title: '01 · 认证与合规', note: '标签数量增减会影响这一行的换行高度。',
      fields: [
        { key: 'cert.eyebrow', label: '小标题', sel: '#about .eyebrow', textNode: true, pad: ' ', max: 40 },
        { key: 'cert.h2', label: '标题', sel: '#about h2', max: 56, type: 'textarea', rows: 2 },
        { key: 'cert.lede', label: '正文', sel: '#about .lede', max: 220, type: 'textarea', rows: 3 },
        { key: 'cert.tags', label: '标签', sel: '.tags', type: 'list', max: 24, hint: '一行一个' },
        { key: 'cert.cta', label: '按钮文字', sel: '#about .btn-solid', textNode: true, max: 28 }
      ]
    },
    {
      id: 'certs', title: '01 · 证书卡片（9 张）', note: '图片文件名对应 assets/ 里的文件，改名要同步改这里。',
      fields: listFields('certs', 9, ['t', 's', 'img'], ['名称', '副标题', '图片文件名'], [28, 44, 30])
    },
    {
      id: 'qc', title: '02 · 质量控制',
      fields: [
        { key: 'qc.eyebrow', label: '小标题', sel: '#factory .qc-head .eyebrow', textNode: true, pad: ' ', max: 40 },
        { key: 'qc.h2', label: '标题', sel: '#factory .qc-head h2', max: 56, type: 'textarea', rows: 2 },
        { key: 'qc.lede', label: '正文', sel: '#factory .qc-head .lede', max: 220, type: 'textarea', rows: 3 },
        { key: 'qc.stat1n', label: '数据 1 · 数字', sel: '#factory .stat:nth-child(1) b', prop: 'text', max: 12 },
        { key: 'qc.stat1l', label: '数据 1 · 说明', sel: '#factory .stat:nth-child(1) span', prop: 'text', max: 36 },
        { key: 'qc.stat2n', label: '数据 2 · 数字', sel: '#factory .stat:nth-child(2) b', prop: 'text', max: 12 },
        { key: 'qc.stat2l', label: '数据 2 · 说明', sel: '#factory .stat:nth-child(2) span', prop: 'text', max: 36 },
        { key: 'qc.cta', label: '按钮文字', sel: '#factory .qc-stats .btn', textNode: true, max: 32 }
      ].concat(group('qc.cards', '.qc-cards > article', 4, { maxH: 30, maxP: 150 }))
    },
    {
      id: 'src', title: '03 · 定价与采购',
      fields: [
        { key: 'src.eyebrow', label: '小标题', sel: '#sourcing .eyebrow', textNode: true, pad: ' ', max: 40 },
        { key: 'src.h2', label: '标题', sel: '#sourcing h2', max: 52, type: 'textarea', rows: 2 },
        { key: 'src.lede', label: '正文', sel: '#sourcing .lede', max: 220, type: 'textarea', rows: 3 },
        { key: 'src.cta', label: '按钮文字', sel: '#sourcing .band-head .btn', textNode: true, max: 28 }
      ].concat(group('src.cards', '.src-grid > article', 3, { maxH: 34, maxP: 130, pSel: '.src-card__body p' }))
    },
    {
      id: 'sol', title: '04 · 产品类目',
      fields: [
        { key: 'sol.eyebrow', label: '小标题', sel: '#products .eyebrow', textNode: true, pad: ' ', max: 40 },
        { key: 'sol.h2', label: '标题', sel: '#products .sec-head h2', max: 52, type: 'textarea', rows: 2 },
        { key: 'sol.lede', label: '正文', sel: '#products .sec-head .lede', max: 220, type: 'textarea', rows: 3 },
        { key: 'sol.cta', label: '按钮文字', sel: '#products .sec-head__aside .btn', textNode: true, max: 28 },
        { key: 'sol.note', label: '按钮下方小字', sel: '#products .sec-note', max: 40 }
      ].concat(listFields('sol.cards', 6, ['name', 'desc', 'img'], ['名称', '描述', '图片文件名'], [22, 110, 26]))
    },
    {
      id: 'step', title: '05 · 合作流程',
      fields: [
        { key: 'step.eyebrow', label: '小标题', sel: '#process .eyebrow', textNode: true, pad: ' ', max: 40 },
        { key: 'step.h2', label: '标题', sel: '#process .sec-head h2', max: 52, type: 'textarea', rows: 2 },
        { key: 'step.lede', label: '正文', sel: '#process .sec-head .lede', max: 220, type: 'textarea', rows: 3 },
        { key: 'step.cta', label: '按钮文字', sel: '#process .sec-head__aside .btn', textNode: true, max: 28 }
      ].concat(listFields('step.items', 4, ['h', 'p'], ['标题', '说明'], [28, 140]))
    },
    {
      id: 'ins', title: 'Insights 文章入口',
      note: '这块的三张卡片由文章后台发布，这里只改标题区文字。',
      fields: [
        { key: 'ins.eyebrow', label: '小标题', sel: '#insights .eyebrow', textNode: true, max: 30 },
        { key: 'ins.h2', label: '标题', sel: '#insights h2', max: 52, type: 'textarea', rows: 2 },
        { key: 'ins.lede', label: '正文', sel: '#insights .lede', max: 220, type: 'textarea', rows: 3 },
        { key: 'ins.cta', label: '按钮文字', sel: '#insights .sec-head__aside .btn', textNode: true, max: 24 }
      ]
    },
    {
      id: 'cta', title: '06 · 询盘区',
      note: 'WhatsApp 和邮箱会同时出现在页脚，那里要一起改。',
      fields: [
        { key: 'cta.eyebrow', label: '小标题', sel: '#contact .eyebrow', textNode: true, pad: ' ', max: 40 },
        { key: 'cta.h2', label: '标题', sel: '#contact h2', max: 52, type: 'textarea', rows: 3 },
        { key: 'cta.lede', label: '正文', sel: '#contact .lede', max: 240, type: 'textarea', rows: 3 },
        { key: 'cta.whatsapp', label: 'WhatsApp 号码', sel: '.cta__row:nth-child(1) dd', prop: 'text', max: 24 },
        { key: 'cta.email', label: '联系邮箱', sel: '.cta__row:nth-child(2) dd', prop: 'text', max: 40 },
        { key: 'cta.btn', label: '提交按钮文字', sel: '#briefForm .btn-white', textNode: true, max: 28 }
      ]
    },
    {
      id: 'ftr', title: '页脚',
      fields: [
        { key: 'ftr.about', label: '品牌简介', sel: '.ftr__brand p', max: 200, type: 'textarea', rows: 3 },
        { key: 'ftr.addr', label: '地址', sel: '.ftr address span:nth-child(1)', textNode: true, max: 140 },
        { key: 'ftr.phone', label: '电话', sel: '.ftr address span:nth-child(2)', textNode: true, pad: ' ', max: 24 },
        { key: 'ftr.email', label: '邮箱', sel: '.ftr address span:nth-child(3)', textNode: true, pad: ' ', max: 40 }
      ]
    }
  ];

  window.SITE_SCHEMA = SCHEMA;

  /* ---------- 取值 / 赋值 ---------- */
  function get(obj, path) {
    var parts = path.split('.'), cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 返回 false = 这条内容在页面上没找到落点（通常是 index.html 结构被改了） */
  function applyField(f, value) {
    if (!f.sel) return true;
    var el = document.querySelector(f.sel);
    if (!el) return false;

    if (f.type === 'list') {
      el.innerHTML = value.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return true;
    }
    if (f.attr) { el.setAttribute(f.attr, value); return true; }
    if (f.prop === 'text') { el.textContent = value; return true; }

    if (f.textNode) {
      /* 只换文字、保留同级 <svg> 图标。取「第一个非空文本节点」而不是最后一个：
         .btn 里 svg 后面还有一个空白文本节点，改它会变成图标在前文字在后。 */
      var tn = null, nodes = el.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === 3 && nodes[i].nodeValue.trim()) { tn = nodes[i]; break; }
      }
      if (tn) tn.nodeValue = (f.pad || '') + value;
      else el.appendChild(document.createTextNode((f.pad || '') + value));
      return true;
    }
    el.innerHTML = esc(value).replace(/\n/g, '<br>');
    return true;
  }

  function apply() {
    var C = window.SITE_CONTENT;
    if (!C) return;
    var missed = [];
    SCHEMA.forEach(function (g) {
      g.fields.forEach(function (f) {
        var v = get(C, f.key);
        if (v === undefined || v === null) return;
        try {
          if (!applyField(f, v)) missed.push(f.key);
        } catch (e) { missed.push(f.key); }
      });
    });
    var root = document.documentElement;
    root.setAttribute('data-cms-ready', '1');
    /* 自检：改动 index.html 结构后，打开控制台看到哪条失效，不用一条条猜 */
    if (missed.length) {
      root.setAttribute('data-cms-missing', missed.join(','));
      if (window.console) console.warn('[cms] 以下字段找不到落点：', missed);
    }
  }

  window.applySiteContent = apply;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
