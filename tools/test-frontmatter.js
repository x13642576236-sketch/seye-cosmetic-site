const md = require('../articles-md.js');

const cases = [
  {
    name: '折叠块 >-',
    src: '---\ntitle: T\ndescription: >-\n  line one\n  line two\n  line three\n---\nbody',
    check: (d) => d.description === 'line one line two line three'
  },
  {
    name: '字面块 |',
    src: '---\ntitle: T\nnotes: |\n  a\n  b\n---\nbody',
    check: (d) => d.notes === 'a\nb'
  },
  {
    name: '双引号折行',
    src: '---\ntitle: "a long\n  title here"\n---\nbody',
    check: (d) => d.title === 'a long title here'
  },
  {
    name: '无引号折行',
    src: '---\nexcerpt: first part\n  second part\n  third part\n---\nbody',
    check: (d) => d.excerpt === 'first part second part third part'
  },
  {
    name: '单引号与转义',
    src: "---\ntitle: 'It''s here'\n---\nbody",
    check: (d) => d.title === "It's here"
  },
  {
    name: 'flow 数组',
    src: '---\nkeywords: [a, "b c", d]\n---\nbody',
    check: (d) => JSON.stringify(d.keywords) === '["a","b c","d"]'
  },
  {
    name: '空数组',
    src: '---\nfaq: []\nkeywords:\n---\nbody',
    check: (d) => Array.isArray(d.faq) && d.faq.length === 0 && d.keywords === ''
  },
  {
    name: '值内带冒号和竖线',
    src: '---\nmetaTitle: How to Choose | SEYE\nslug: a-b-c\n---\nbody',
    check: (d) => d.metaTitle === 'How to Choose | SEYE' && d.slug === 'a-b-c'
  },
  {
    name: '嵌套对象列表 + 折行答案',
    src: '---\nfaq:\n  - q: "Q1?"\n    a: "long answer\n      continued here"\n  - q: Q2?\n    a: plain answer\n      continued\n---\nbody',
    check: (d) =>
      d.faq.length === 2 &&
      d.faq[0].a === 'long answer continued here' &&
      d.faq[1].a === 'plain answer continued'
  },
  {
    name: '布尔与数字',
    src: '---\ndraft: false\nweight: 12\nratio: 1.5\n---\nbody',
    check: (d) => d.draft === false && d.weight === 12 && d.ratio === 1.5
  },
  {
    name: 'CRLF 行尾',
    src: '---\r\ntitle: Win\r\ndescription: "a\r\n  b"\r\n---\r\nbody',
    check: (d) => d.title === 'Win' && d.description === 'a b'
  },
  {
    name: '正文保留 markdown',
    src: '---\ntitle: T\n---\n# H1\n\n- item\n- item2\n\n> quote',
    check: (d, body) => body.trim() === '# H1\n\n- item\n- item2\n\n> quote'
  }
];

let fail = 0;
for (const c of cases) {
  try {
    const r = md.parseFrontmatter(c.src);
    if (!c.check(r.data, r.body)) {
      console.log('  ✗ ' + c.name + '\n    得到: ' + JSON.stringify(r.data));
      fail++;
    } else {
      console.log('  ✓ ' + c.name);
    }
  } catch (e) {
    console.log('  ✗ ' + c.name + ' → 抛错: ' + e.message);
    fail++;
  }
}

/* 再跑一遍真实文件，确认往返写入后还能读回来 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'content', 'articles');
for (const f of fs.readdirSync(dir).filter((x) => /\.md$/.test(x))) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const first = md.parseFrontmatter(raw).data;
  const again = md.parseFrontmatter(md.toMarkdown({
    ...first,
    body: md.parseFrontmatter(raw).body
  })).data;
  const keys = ['title', 'slug', 'description', 'excerpt', 'category', 'author', 'cover'];
  const bad = keys.filter((k) => String(first[k] || '') !== String(again[k] || ''));
  if (bad.length || (first.faq || []).length !== (again.faq || []).length) {
    console.log('  ✗ 往返丢内容 ' + f + ' → ' + bad.join(','));
    fail++;
  } else {
    console.log('  ✓ 往返一致 ' + f + '（' + (first.faq || []).length + ' 条 FAQ）');
  }
}

console.log(fail ? '\n失败 ' + fail + ' 项' : '\n全部通过');
process.exit(fail ? 1 : 0);
