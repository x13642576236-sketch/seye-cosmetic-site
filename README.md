# seye-cosmetic-site

Source for the SEYE Biomedical (Guangzhou) OEM / ODM / private-label skincare website.

Static site + a self-hosted SEO/GEO publishing system. No backend, no database, no npm
dependencies, no framework — Node built-in modules and vanilla JS only.

## Why it looks like this

- **Articles are pre-rendered, never client-side.** Google and AI crawlers do not execute
  JavaScript, so every article must be complete in the HTML source. The "latest articles"
  block on the home page is injected at build time for the same reason.
- **Copy lives in `content.js`, not `content.json`.** Under `file://`, `fetch()` is blocked by
  same-origin policy while classic `<script src>` is not. The authoring workflow is "double-click
  the file on a network share", so it has to be `.js`.
- **Directory-style URLs**: `insights/<slug>/index.html` serves as `/insights/<slug>/`.
  Article pages therefore reference assets as `../../assets/...`.
- **Home page is hand-maintained.** The build only replaces what sits between
  `<!-- ARTICLES:START --> ... <!-- ARTICLES:END -->` and `<!-- ROBOTS:START --> ... <!-- ROBOTS:END -->`.
  If a marker is missing the injector returns `null` and the caller warns without writing —
  that is intentional, not a bug.
- **`article-builder.js` is isomorphic** — the same file runs in the browser admin panel and in
  Node during CI. Do not add logic for one side only, or the preview and the deployed output drift.

## Layout

```
index.html              hand-written home page (7 sections)
admin.html              local authoring UI — not part of the deployed output
content.js              home page copy (window.SITE_CONTENT)
cms.js                  applies SITE_SCHEMA + content.js to the home page DOM
content/articles.js     all article data (window.SITE_ARTICLES + window.SITE_CONFIG)
article-builder.js      generator core, shared by browser and Node
build-articles.js       Node build script
release.js / .bat       build + rebuild dist/ + zip
assets/                 images, self-hosted woff2 fonts, insights.css
insights/               generated: article index + one directory per article
sitemap.xml robots.txt llms.txt feed.xml   generated
tools/                  chat export + handover packaging helpers
```

## Build

```bash
node build-articles.js
```

Regenerates the article pages, `insights/index.html`, `sitemap.xml`, `robots.txt`, `llms.txt`,
`feed.xml`, and injects the article list + robots directive into `index.html`.

Requires Node 18+.

## Status

`SITE_CONFIG.stage` is currently `true`: `robots.txt` disallows everything and every page
carries `noindex,nofollow`. Stage mode has to be switched off in all three layers at once —
robots, home page, article/list pages — otherwise you end up with the worse state of "home page
not indexed but articles indexed".

Canonical host in `SITE_CONFIG.baseUrl` is `https://www.seyecosmetic.com`. Publishing for real
means: set `baseUrl`, set `stage: false`, then rebuild.
