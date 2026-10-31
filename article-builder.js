/* ============================================================
   SEYE · Insights 页面生成器
   ------------------------------------------------------------
   输入：文章数据（标题 / 摘要 / 正文 markdown / FAQ …）
   输出：完整的静态 HTML 字符串 + sitemap + llms.txt

   为什么是「生成静态 HTML」而不是运行时渲染：
   SEO 和 GEO 都要求文章在 HTML 源码里就是完成态 —— 爬虫和
   AI 抓取器不执行 JS，运行时渲染的内容等于不存在。

   同一份代码在浏览器（admin.html）和 Node（构建验证）里跑，
   避免「后台预览」和「实际产物」出现两套逻辑。
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function anchorId(text) {
    return String(text).trim().toLowerCase()
      .replace(/[`*_~\[\]()]/g, '')
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .trim().replace(/\s+/g, '-').slice(0, 60) || 'section';
  }
  function slugify(text) {
    return String(text).trim().toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return String(iso || '');
    return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
  }
  function readingTime(md) {
    var text = String(md || '').replace(/```[\s\S]*?```/g, ' ');
    var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var latin = text.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(function (w) {
      return /[A-Za-z0-9]/.test(w);
    }).length;
    return Math.max(1, Math.round((latin + cjk / 1.7) / 220));
  }
  function sortPosts(posts) {
    return posts.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
  }
  function shorten(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.;:]$/, '') + '…';
  }

  /* ---------------- markdown → html（够用的子集） ---------------- */
  function inline(s) {
    var t = esc(s);
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    return t;
  }

  function mdToHtml(md) {
    var lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    var out = [], buf = [], listType = null, i = 0;

    function flushP() {
      if (buf.length) { out.push('<p>' + inline(buf.join(' ')) + '</p>'); buf = []; }
    }
    function closeList() {
      if (listType) { out.push('</' + listType + '>'); listType = null; }
    }

    while (i < lines.length) {
      var line = lines[i].trim();
      var m;

      if (!line) {
        flushP();
        /* 空行不一定要结束列表：条目之间夹空行是常见写法。
           往后看一行，如果还是同类列表项就继续，否则才闭合。 */
        if (listType) {
          var j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          var nx = j < lines.length ? lines[j].trim() : '';
          var stillUl = listType === 'ul' && /^[-*]\s+/.test(nx);
          var stillOl = listType === 'ol' && /^\d+[.)]\s+/.test(nx);
          if (!stillUl && !stillOl) closeList();
        }
        i++; continue;
      }

      if (/^#{2,4}\s+/.test(line)) {
        flushP(); closeList();
        var level = line.match(/^#+/)[0].length;
        var text = line.replace(/^#+\s+/, '');
        out.push('<h' + level + ' id="' + attr(anchorId(text)) + '">' + inline(text) + '</h' + level + '>');
        i++; continue;
      }

      if (/^```/.test(line)) {
        flushP(); closeList();
        var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushP(); closeList(); out.push('<hr>'); i++; continue; }

      if (/^>\s?/.test(line)) {
        flushP(); closeList();
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          q.push(lines[i].trim().replace(/^>\s?/, '')); i++;
        }
        out.push('<blockquote><p>' + q.map(inline).join('</p><p>') + '</p></blockquote>');
        continue;
      }

      if ((m = line.match(/^[-*]\s+(.*)$/))) {
        flushP();
        if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
        out.push('<li>' + inline(m[1]) + '</li>'); i++; continue;
      }

      if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
        flushP();
        if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
        out.push('<li>' + inline(m[1]) + '</li>'); i++; continue;
      }

      if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
        flushP(); closeList();
        out.push('<img src="' + attr(m[2]) + '" alt="' + attr(m[1]) + '" loading="lazy">');
        i++; continue;
      }

      buf.push(line); i++;
    }
    flushP(); closeList();
    return out.join('\n');
  }

  function headings(md) {
    var res = [], ls = String(md || '').split('\n');
    for (var i = 0; i < ls.length; i++) {
      var m = /^##\s+(.+)$/.exec(ls[i].trim());
      if (m) res.push({ id: anchorId(m[1]), text: m[1].replace(/[*`]/g, '') });
    }
    return res;
  }

  /* ---------------- 公共片段 ---------------- */
  function head(opts) {
    var p = opts.prefix;
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + esc(opts.title) + '</title>\n' +
      '<meta name="description" content="' + attr(opts.description) + '">\n' +
      (opts.keywords ? '<meta name="keywords" content="' + attr(opts.keywords) + '">\n' : '') +
      '<link rel="canonical" href="' + attr(opts.canonical) + '">\n' +
      (opts.noindex
        ? '<meta name="robots" content="noindex,nofollow">\n'
        : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">\n') +
      '<meta name="author" content="' + attr(opts.author) + '">\n' +
      '<link rel="icon" href="' + p + 'assets/favicon.svg" type="image/svg+xml">\n' +
      '<link rel="alternate icon" href="' + p + 'assets/favicon-32.png" sizes="32x32">\n' +
      '<link rel="apple-touch-icon" href="' + p + 'assets/apple-touch-icon.png">\n' +
      '<meta name="theme-color" content="#244A35">\n' +
      '<meta property="og:type" content="' + (opts.ogType || 'article') + '">\n' +
      '<meta property="og:site_name" content="' + attr(opts.siteName) + '">\n' +
      '<meta property="og:title" content="' + attr(opts.title) + '">\n' +
      '<meta property="og:description" content="' + attr(opts.description) + '">\n' +
      '<meta property="og:url" content="' + attr(opts.canonical) + '">\n' +
      (opts.image ? '<meta property="og:image" content="' + attr(opts.image) + '">\n' +
        '<meta property="og:image:alt" content="' + attr(opts.title) + '">\n' : '') +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<meta name="twitter:title" content="' + attr(opts.title) + '">\n' +
      '<meta name="twitter:description" content="' + attr(opts.description) + '">\n' +
      (opts.image ? '<meta name="twitter:image" content="' + attr(opts.image) + '">\n' : '') +
      '<link rel="stylesheet" href="' + p + 'assets/fonts.css">\n' +
      '<link rel="stylesheet" href="' + p + 'assets/insights.css">\n' +
      (opts.jsonld ? '<script type="application/ld+json">\n' + opts.jsonld + '\n</script>\n' : '') +
      (opts.analytics || '') +
      '</head>\n';
  }

  function header(prefix, active) {
    function cur(k) { return active === k ? ' aria-current="page"' : ''; }
    return '<header class="ihdr"><div class="wrap ihdr__in">' +
      '<a class="brand" href="' + prefix + 'index.html" aria-label="SEYE Biomedical — home">SEYE</a>' +
      '<nav class="inav" aria-label="Primary">' +
      '<a href="' + prefix + 'index.html">Home</a>' +
      '<a href="' + prefix + 'index.html#products">Products</a>' +
      '<a href="' + prefix + 'index.html#factory">Our Factory</a>' +
      '<a href="' + prefix + 'insights/"' + cur('insights') + '>Insights</a>' +
      '</nav>' +
      '<a class="btn btn-solid" href="' + prefix + 'index.html#contact">Start Your Project</a>' +
      '</div></header>\n';
  }

  function footer(prefix) {
    return '<footer class="iftr"><div class="wrap iftr__in">' +
      '<span>&copy; ' + new Date().getFullYear() + ' SEYE Biomedical Co., Ltd.</span>' +
      '<nav aria-label="Footer">' +
      '<a href="' + prefix + 'index.html">Home</a>' +
      '<a href="' + prefix + 'insights/">Insights</a>' +
      '<a href="' + prefix + 'index.html#products">Products</a>' +
      '<a href="' + prefix + 'index.html#contact">Contact</a>' +
      '</nav></div></footer>\n';
  }

  /* ---------------- 组织信息（E-E-A-T / GEO 实体锚点） ---------------- */
  function orgLd(cfg) {
    var base = String(cfg.baseUrl || '').replace(/\/+$/, '');
    return {
      '@type': 'Organization',
      '@id': base + '/#organization',
      name: 'SEYE Biomedical',
      alternateName: 'SEYE Biomedical Co., Ltd.',
      url: base + '/',
      logo: { '@type': 'ImageObject', url: base + '/assets/apple-touch-icon.png', width: 180, height: 180 },
      description: 'Guangzhou-based OEM, ODM and private-label skincare manufacturer with 80,000 m² of medical-grade production capacity.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Baiyun Meiwan Beauty & Health Industrial Park',
        addressLocality: 'Guangzhou',
        addressRegion: 'Guangdong',
        addressCountry: 'CN'
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: '+86-180-4077-7742',
        email: 'inquiry@seyecosmetic.com',
        availableLanguage: ['en', 'zh']
      }
    };
  }

  /* ---------------- 文章页 ---------------- */
  function buildArticle(post, cfg, allPosts) {
    var base = cfg.baseUrl.replace(/\/$/, '');
    var prefix = '../../';
    var url = base + '/insights/' + post.slug + '/';
    var read = readingTime(post.body);
    var toc = headings(post.body);

    var graph = [
      orgLd(cfg),
      {
        '@type': 'WebSite',
        '@id': base + '/#website',
        url: base + '/',
        name: 'SEYE Biomedical',
        publisher: { '@id': base + '/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': url + '#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: 'Insights', item: base + '/insights/' },
          { '@type': 'ListItem', position: 3, name: post.title, item: url }
        ]
      },
      {
        '@type': 'Article',
        '@id': url + '#article',
        headline: post.title,
        description: post.description,
        url: url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        datePublished: post.date,
        dateModified: post.updated || post.date,
        inLanguage: 'en',
        articleSection: post.category || 'Manufacturing',
        keywords: (post.keywords || []).join(', '),
        wordCount: String(post.body || '').split(/\s+/).filter(Boolean).length,
        author: { '@type': 'Organization', name: post.author || 'SEYE Biomedical', url: base + '/' },
        publisher: { '@id': base + '/#organization' },
        image: post.cover ? [base + '/' + post.cover.replace(/^\/+/, '')] : [base + '/assets/og-cover.jpg'],
        isAccessibleForFree: true
      }
    ];

    if (post.faq && post.faq.length) {
      graph.push({
        '@type': 'FAQPage',
        '@id': url + '#faq',
        mainEntity: post.faq.map(function (f) {
          return {
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          };
        })
      });
    }

    var jsonld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);

    var h = head({
      prefix: prefix,
      analytics: analyticsTag(cfg),
      title: post.metaTitle || (post.title + ' — SEYE Biomedical'),
      description: post.description,
      keywords: (post.keywords || []).join(', '),
      canonical: url,
      author: post.author || 'SEYE Biomedical',
      siteName: 'SEYE Biomedical',
      image: post.cover ? base + '/' + post.cover.replace(/^\/+/, '') : base + '/assets/og-cover.jpg',
      ogType: 'article',
      noindex: !!cfg.stage,
      jsonld: jsonld
    });

    var tocHtml = toc.length > 2
      ? '<nav class="toc" aria-label="On this page"><p>On this page</p><ol>' +
        toc.map(function (t) { return '<li><a href="#' + attr(t.id) + '">' + esc(t.text) + '</a></li>'; }).join('') +
        '</ol></nav>\n'
      : '';

    var faqHtml = (post.faq && post.faq.length)
      ? '<section class="faq" id="faq" aria-labelledby="faq-h">\n' +
        '<h2 id="faq-h">Frequently asked questions</h2>\n' +
        post.faq.map(function (f) {
          return '<div class="faq__item"><h3>' + esc(f.q) + '</h3><p>' + esc(f.a) + '</p></div>';
        }).join('\n') +
        '\n</section>\n'
      : '';

    var coverHtml = post.cover
      ? '<figure class="art-cover"><img src="' + attr(prefix + post.cover.replace(/^\/+/, '')) +
        '" alt="' + attr(post.coverAlt || post.title) + '" fetchpriority="high"></figure>\n'
      : '';

    /* 相关阅读：同分类优先，不足则用最新的补齐。内链是文章页最重要的 SEO 杠杆。 */
    var related = [];
    if (allPosts && allPosts.length > 1) {
      var others = allPosts.filter(function (p) { return p.slug !== post.slug; });
      related = others.filter(function (p) { return p.category === post.category; })
        .concat(sortPosts(others).filter(function (p) { return p.category !== post.category; }))
        .slice(0, 3);
    }
    var relatedHtml = related.length
      ? '<nav class="related" aria-label="Related reading">\n' +
        '<p>Related reading</p>\n' +
        related.map(function (p) {
          return '<a href="../' + attr(p.slug) + '/"><time datetime="' + attr(p.date) + '">' +
            esc(fmtDate(p.date)) + '</time><span>' + esc(p.title) + '</span></a>';
        }).join('\n') +
        '\n</nav>\n'
      : '';

    return h +
      '<body>\n' +
      header(prefix, 'insights') +
      '<main>\n' +
      '<div class="wrap">\n' +
      '<nav class="crumbs" aria-label="Breadcrumb"><ol>' +
      '<li><a href="' + prefix + 'index.html">Home</a></li>' +
      '<li><a href="' + prefix + 'insights/">Insights</a></li>' +
      '<li aria-current="page">' + esc(post.title.length > 52 ? post.title.slice(0, 52) + '…' : post.title) + '</li>' +
      '</ol></nav>\n' +
      '<article class="art">\n' +
      '<header class="art-head">\n' +
      '<p class="kicker"><span>' + esc(post.category || 'Manufacturing') + '</span></p>\n' +
      '<h1>' + esc(post.title) + '</h1>\n' +
      (post.excerpt ? '<p class="art-lede">' + esc(post.excerpt) + '</p>\n' : '') +
      '<div class="art-meta">' +
      '<span>Published <b><time datetime="' + attr(post.date) + '">' + esc(fmtDate(post.date)) + '</time></b></span>' +
      (post.updated && post.updated !== post.date
        ? '<span>Updated <b><time datetime="' + attr(post.updated) + '">' + esc(fmtDate(post.updated)) + '</time></b></span>' : '') +
      '<span>By <b>' + esc(post.author || 'SEYE Biomedical') + '</b></span>' +
      '<span><b>' + read + ' min</b> read</span>' +
      '</div>\n' +
      '</header>\n' +
      coverHtml +
      tocHtml +
      '<div class="prose">\n' + mdToHtml(post.body) + '\n</div>\n' +
      faqHtml +
      relatedHtml +
      '<aside class="cta-box">\n' +
      '<h2>Working on a product like this?</h2>\n' +
      '<p>Send us your brief — category, target market, expected volume — and we will come back with formula directions, MOQ tiers and an indicative quote within two business days.</p>\n' +
      '<a class="btn" href="' + prefix + 'index.html#contact">Start Your Project</a>\n' +
      '</aside>\n' +
      '</article>\n' +
      '</div>\n' +
      '</main>\n' +
      footer(prefix) +
      '</body>\n</html>\n';
  }

  /* ---------------- 列表页 ---------------- */
  function buildIndexPage(posts, cfg) {
    var base = cfg.baseUrl.replace(/\/$/, '');
    var prefix = '../';
    var url = base + '/insights/';
    var sorted = posts.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    var jsonld = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        orgLd(cfg),
        {
          '@type': 'CollectionPage',
          '@id': url,
          url: url,
          name: 'Insights — Skincare Manufacturing & Sourcing',
          description: 'Practical guidance on skincare OEM, ODM and private-label manufacturing, quality control and export documentation.',
          isPartOf: { '@id': base + '/#website' }
        },
        {
          '@type': 'ItemList',
          itemListElement: sorted.map(function (p, i) {
            return {
              '@type': 'ListItem', position: i + 1,
              url: base + '/insights/' + p.slug + '/', name: p.title
            };
          })
        }
      ]
    }, null, 2);

    var list = sorted.length
      ? '<div class="posts">\n' + sorted.map(function (p) {
          return '<article class="post">' +
            '<time datetime="' + attr(p.date) + '">' + esc(fmtDate(p.date)) + '</time>' +
            '<div><h2><a href="' + attr(p.slug) + '/">' + esc(p.title) + '</a></h2>' +
            '<p>' + esc(p.description) + '</p></div>' +
            '<svg class="go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>' +
            '</article>';
        }).join('\n') + '\n</div>\n'
      : '<p class="empty">No articles yet.</p>\n';

    return head({
      prefix: prefix,
      analytics: analyticsTag(cfg),
      title: 'Insights — Skincare OEM, ODM & Private Label | SEYE Biomedical',
      description: 'Practical guidance on skincare manufacturing: choosing a manufacturer, QC checkpoints, MOQs, packaging and export documentation for brands worldwide.',
      canonical: url,
      author: 'SEYE Biomedical',
      siteName: 'SEYE Biomedical',
      image: base + '/assets/og-cover.jpg',
      ogType: 'website',
      noindex: !!cfg.stage,
      jsonld: jsonld
    }) +
      '<body>\n' +
      header(prefix, 'insights') +
      '<main><div class="wrap">\n' +
      '<header class="list-head">\n' +
      '<p class="kicker"><span>Insights</span></p>\n' +
      '<h1>Notes from the factory floor.</h1>\n' +
      '<p>How skincare brands are actually made — formulation, quality control, MOQs, packaging and the paperwork that gets products across borders.</p>\n' +
      '</header>\n' +
      list +
      '</div></main>\n' +
      footer(prefix) +
      '</body>\n</html>\n';
  }

  /* ---------------- 首页「最新文章」卡片 ----------------
     输出的是静态 HTML，由构建/发布时写回 index.html 的标记区间内 ——
     不用 JS 注入，爬虫拿到的就是成品。 */
  function buildHomeCards(posts, cfg, limit) {
    var list = sortPosts(posts).slice(0, limit || 3);
    if (!list.length) return '<!-- 还没有文章 -->';
    return list.map(function (p) {
      return '<a class="ins-card reveal" href="insights/' + attr(p.slug) + '/">' +
        '<figure class="ins-card__img">' +
        (p.cover
          ? '<img src="' + attr(p.cover.replace(/^\/+/, '')) + '" alt="' +
            attr(p.coverAlt || p.title) + '" loading="lazy">'
          : '') +
        '</figure>' +
        '<time datetime="' + attr(p.date) + '">' + esc(fmtDate(p.date)) + '</time>' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p>' + esc(shorten(p.description, 132)) + '</p>' +
        '</a>';
    }).join('\n');
  }

  var HOME_RE = /<!-- ARTICLES:START -->[\s\S]*?<!-- ARTICLES:END -->/;

  /* 只替换标记之间的内容；标记不存在就返回 null，让调用方提示用户，
     绝不会把整份 index.html 覆盖掉。 */
  function injectHomeCards(html, cards) {
    if (!HOME_RE.test(html)) return null;
    return html.replace(HOME_RE,
      '<!-- ARTICLES:START -->\n      ' + cards + '\n      <!-- ARTICLES:END -->');
  }

  function rfc822(iso) {
    var d = new Date(String(iso) + 'T09:00:00Z');
    return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
  }

  /* ---------------- RSS 2.0 ---------------- */
  function buildFeed(posts, cfg) {
    var base = cfg.baseUrl.replace(/\/$/, '');
    var list = sortPosts(posts);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
      '  <title>SEYE Biomedical — Insights</title>\n' +
      '  <link>' + esc(base + '/insights/') + '</link>\n' +
      '  <description>Practical guidance on skincare OEM, ODM and private-label manufacturing, quality control and export documentation.</description>\n' +
      '  <language>en</language>\n' +
      '  <lastBuildDate>' + rfc822(list.length ? list[0].updated || list[0].date : '2026-01-01') + '</lastBuildDate>\n' +
      '  <atom:link href="' + esc(base + '/feed.xml') + '" rel="self" type="application/rss+xml"/>\n' +
      list.map(function (p) {
        var url = base + '/insights/' + p.slug + '/';
        return '  <item>\n' +
          '    <title>' + esc(p.title) + '</title>\n' +
          '    <link>' + esc(url) + '</link>\n' +
          '    <guid isPermaLink="true">' + esc(url) + '</guid>\n' +
          '    <pubDate>' + rfc822(p.date) + '</pubDate>\n' +
          '    <description>' + esc(p.description) + '</description>\n' +
          (p.category ? '    <category>' + esc(p.category) + '</category>\n' : '') +
          '  </item>';
      }).join('\n') + '\n</channel>\n</rss>\n';
  }

  /* ---------------- sitemap / robots / llms.txt ---------------- */
  function buildSitemap(posts, cfg) {
    var base = cfg.baseUrl.replace(/\/$/, '');
    var today = new Date().toISOString().slice(0, 10);
    var urls = [
      { loc: base + '/', lastmod: today, pri: '1.0', freq: 'monthly' },
      { loc: base + '/insights/', lastmod: today, pri: '0.9', freq: 'weekly' }
    ].concat(posts.map(function (p) {
      return {
        loc: base + '/insights/' + p.slug + '/',
        lastmod: p.updated || p.date,
        pri: '0.8', freq: 'yearly'
      };
    }));

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(function (u) {
        return '  <url>\n    <loc>' + esc(u.loc) + '</loc>\n' +
          '    <lastmod>' + esc(u.lastmod) + '</lastmod>\n' +
          '    <changefreq>' + u.freq + '</changefreq>\n' +
          '    <priority>' + u.pri + '</priority>\n  </url>';
      }).join('\n') + '\n</urlset>\n';
  }

  /* 测试模式下 robots.txt 全站禁止抓取，连 sitemap 都不给 ——
     在会被弃用的域名上积累收录没有意义，反而制造一次搬家损失。 */
  function buildRobots(cfg) {
    var base = cfg.baseUrl.replace(/\/$/, '');
    if (cfg.stage) {
      return '# 测试模式：全站暂不对外开放抓取。\n' +
        '# 正式域名上线后，在后台取消「测试模式」再发布一次即可。\n' +
        'User-agent: *\nDisallow: /\n';
    }
    return 'User-agent: *\nAllow: /\n\n' +
      'Sitemap: ' + base + '/sitemap.xml\n';
  }

  /* 首页 head 里的 robots 由标记区间控制，发布时写入 */
  function robotsMeta(cfg) {
    return cfg.stage
      ? '<meta name="robots" content="noindex,nofollow">'
      : '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">';
  }

  var ROBOTS_RE = /<!-- ROBOTS:START -->[\s\S]*?<!-- ROBOTS:END -->/;

  function injectRobotsMeta(html, cfg) {
    if (!ROBOTS_RE.test(html)) return null;
    return html.replace(ROBOTS_RE,
      '<!-- ROBOTS:START -->' + robotsMeta(cfg) + '<!-- ROBOTS:END -->');
  }

  /* ---------------- 首页 head：canonical / 分享卡片 / JSON-LD ----------------
     文章页的这套东西是 builder 自己拼的；首页是手写的，所以只能反过来
     在标记区间里生成。绝对地址一律由 cfg.baseUrl 拼，避免"部署时再重写"
     这种从来没实现过的承诺。

     标题和描述仍以 index.html 里手写的那两行 <title>/<meta description> 为准，
     这里只负责补上 canonical、把 og:image 变成绝对地址、加结构化数据。      */
  var SEO_RE = /<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/;

  function decodeEntities(s) {
    return String(s || '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function pageTitle(html) {
    var m = /<title>([\s\S]*?)<\/title>/i.exec(html);
    return m ? decodeEntities(m[1]).trim() : '';
  }

  function pageDescription(html) {
    var m = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html);
    return m ? decodeEntities(m[1]).trim() : '';
  }

  /* ---------------- 访问统计 ----------------
     配置为空时返回空串 —— 页面不会多一个请求，等于没装。
     defer 保证不阻塞首屏解析。 */
  var ANALYTICS_RE = /<!-- ANALYTICS:START -->[\s\S]*?<!-- ANALYTICS:END -->/;

  function analyticsTag(cfg) {
    var a = (cfg && cfg.analytics) || {};
    if (a.provider === 'umami' && a.umamiWebsiteId) {
      return '<script defer src="' + attr(a.umamiScript || 'https://cloud.umami.is/script.js') +
        '" data-website-id="' + attr(a.umamiWebsiteId) + '"></script>\n';
    }
    if (a.provider === 'plausible' && a.plausibleDomain) {
      return '<script defer data-domain="' + attr(a.plausibleDomain) +
        '" src="https://plausible.io/js/script.js"></script>\n';
    }
    return '';
  }

  function injectAnalytics(html, cfg) {
    if (!ANALYTICS_RE.test(html)) return null;
    return html.replace(ANALYTICS_RE,
      '<!-- ANALYTICS:START -->' + analyticsTag(cfg) + '<!-- ANALYTICS:END -->');
  }

  /* meta 参数来自 content.js 的 SITE_CONTENT.meta（ogTitle / ogDesc），
     和首页文案共用同一份数据；缺省时退回 html 里的 title/description。 */
  function buildHomeSeo(html, cfg, meta) {
    meta = meta || {};
    var base = String(cfg.baseUrl || '').replace(/\/+$/, '');
    var site = cfg.siteName || 'SEYE Biomedical';
    var title = (meta.title || pageTitle(html) || site).trim();
    var desc = (meta.description || pageDescription(html) || '').trim();
    var ogTitle = (meta.ogTitle || title).trim();
    var ogDesc = (meta.ogDesc || desc).trim();
    var image = base + '/assets/og-cover.jpg';

    var graph = {
      '@context': 'https://schema.org',
      '@graph': [
        orgLd(cfg),
        {
          '@type': 'WebSite',
          '@id': base + '/#website',
          url: base + '/',
          name: site,
          description: desc,
          publisher: { '@id': base + '/#organization' },
          inLanguage: 'en'
        },
        {
          '@type': 'WebPage',
          '@id': base + '/#webpage',
          url: base + '/',
          name: title,
          description: desc,
          isPartOf: { '@id': base + '/#website' },
          about: { '@id': base + '/#organization' },
          primaryImageOfPage: { '@type': 'ImageObject', url: image },
          inLanguage: 'en'
        }
      ]
    };

    return [
      '<link rel="canonical" href="' + attr(base + '/') + '">',
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="' + attr(site) + '">',
      '<meta property="og:title" content="' + attr(ogTitle) + '">',
      '<meta property="og:description" content="' + attr(ogDesc) + '">',
      '<meta property="og:url" content="' + attr(base + '/') + '">',
      '<meta property="og:image" content="' + attr(image) + '">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta property="og:image:alt" content="' + attr(ogTitle) + '">',
      '<meta property="og:locale" content="en_US">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="' + attr(ogTitle) + '">',
      '<meta name="twitter:description" content="' + attr(ogDesc) + '">',
      '<meta name="twitter:image" content="' + attr(image) + '">',
      '<script type="application/ld+json">\n' +
        JSON.stringify(graph, null, 2) + '\n</script>'
    ].map(function (l) { return l.indexOf('\n') === -1 ? '  ' + l : l; }).join('\n');
  }

  function injectHomeSeo(html, cfg, meta) {
    if (!SEO_RE.test(html)) return null;
    return html.replace(SEO_RE,
      '<!-- SEO:START -->\n' + buildHomeSeo(html, cfg, meta) + '\n<!-- SEO:END -->');
  }

  /* llms.txt —— 给 AI 抓取器的站点摘要，GEO 的实际抓手之一 */
  function buildLlms(posts, cfg) {
    var base = cfg.baseUrl.replace(/\/$/, '');
    return '# SEYE Biomedical\n\n' +
      '> Guangzhou-based OEM, ODM and private-label skincare manufacturer. 80,000 m² of medical-grade\n' +
      '> production capacity, in-house R&D and quality control, export documentation for 30+ markets.\n' +
      '> Services: custom formulation, filling and assembly, regulatory support (GMPC, ISO 22716, US FDA,\n' +
      '> CPNP, BPOM, HALAL), packaging sourcing. Minimum order quantities in the low thousands per SKU,\n' +
      '> quoted against a specific packaging component.\n\n' +
      '## Key pages\n\n' +
      '- [Home](' + base + '/): company overview, capabilities, certifications, enquiry form\n' +
      '- [Insights](' + base + '/insights/): articles on manufacturing, quality control and sourcing\n' +
      '- [Contact](' + base + '/#contact): enquiry form, WhatsApp +86 180 4077 7742, inquiry@seyecosmetic.com\n\n' +
      '## Articles\n\n' +
      (posts.length ? posts.slice().sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      }).map(function (p) {
        return '- [' + p.title + '](' + base + '/insights/' + p.slug + '/): ' + p.description;
      }).join('\n') : '- (none yet)') + '\n';
  }

  /* ---------------- 纯 JS 打 zip（store 模式，无依赖） ----------------
     后台没有 Node / Python，要让用户「一键拿到整包文件」只能自己拼 zip。
     只做存储不压缩：文章是文本，体积本来就不大，省掉 deflate 实现。 */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function zip(files) {
    var chunks = [], central = [], offset = 0;
    var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

    files.forEach(function (f) {
      var nameBytes = enc ? enc.encode(f.name) : utf8(f.name);
      var data = f.data instanceof Uint8Array ? f.data : (enc ? enc.encode(f.data) : utf8(f.data));
      var crc = crc32(data);
      var local = [].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0),
        u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0)
      );
      var head = new Uint8Array(local);
      chunks.push(head, nameBytes, data);
      central.push({
        name: nameBytes, crc: crc, size: data.length, offset: offset
      });
      offset += head.length + nameBytes.length + data.length;
    });

    var cdStart = offset, cdSize = 0;
    central.forEach(function (c) {
      var rec = new Uint8Array([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
        u16(0), u16(0), u32(c.crc), u32(c.size), u32(c.size),
        u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset)
      ));
      chunks.push(rec, c.name);
      cdSize += rec.length + c.name.length;
    });

    chunks.push(new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(cdSize), u32(cdStart), u16(0)
    )));

    var total = chunks.reduce(function (n, c) { return n + c.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  /* ---------------- 一次性生成全部产物 ----------------
     files 的 name 是相对站点根目录的路径。 */
  function buildAll(posts, cfg) {
    var files = [];
    files.push({ name: 'insights/index.html', data: buildIndexPage(posts, cfg) });
    posts.forEach(function (p) {
      files.push({ name: 'insights/' + p.slug + '/index.html', data: buildArticle(p, cfg, posts) });
    });
    files.push({ name: 'sitemap.xml', data: buildSitemap(posts, cfg) });
    files.push({ name: 'robots.txt', data: buildRobots(cfg) });
    files.push({ name: 'llms.txt', data: buildLlms(posts, cfg) });
    files.push({ name: 'feed.xml', data: buildFeed(posts, cfg) });
    return files;
  }

  root.SITEBuilder = {
    esc: esc, slugify: slugify, fmtDate: fmtDate, readingTime: readingTime,
    mdToHtml: mdToHtml, headings: headings, shorten: shorten, sortPosts: sortPosts,
    buildArticle: buildArticle, buildIndexPage: buildIndexPage,
    buildSitemap: buildSitemap, buildRobots: buildRobots, buildLlms: buildLlms,
    buildFeed: buildFeed, buildHomeCards: buildHomeCards, injectHomeCards: injectHomeCards,
    robotsMeta: robotsMeta, injectRobotsMeta: injectRobotsMeta,
    buildHomeSeo: buildHomeSeo, injectHomeSeo: injectHomeSeo, orgLd: orgLd,
    analyticsTag: analyticsTag, injectAnalytics: injectAnalytics,
    buildAll: buildAll, zip: zip, utf8: utf8
  };
})(typeof window !== 'undefined' ? window : global);
