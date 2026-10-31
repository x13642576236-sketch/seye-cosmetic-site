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
  `<!-- ARTICLES:START --> ... <!-- ARTICLES:END -->`, `<!-- ROBOTS:START --> ... <!-- ROBOTS:END -->`
  and `<!-- SEO:START --> ... <!-- SEO:END -->`.
  If a marker is missing the injector returns `null` and the caller warns without writing —
  that is intentional, not a bug.
- **Every absolute URL is derived from `SITE_CONFIG.baseUrl`.** Canonical, `og:url`, `og:image`,
  sitemap, feed, `llms.txt` and the JSON-LD `@id`s are all generated from it at build time —
  there is no "rewrite on deploy" step, because there never was. Change `baseUrl` (or set
  `SITE_BASE_URL`) and rebuild; nothing else needs touching.
- **Articles are markdown files, one per article.** `content/articles/<slug>.md` holds YAML
  frontmatter (title, SEO meta, cover, FAQ) plus a markdown body. `content/articles.js` is a
  **generated** mirror kept only so `admin.html` can preview offline — never edit it by hand,
  every build overwrites it.
- **`article-builder.js` is isomorphic** — the same file runs in the browser preview and in
  Node during CI. Do not add logic for one side only, or the preview and the deployed output drift.

## Write

Online authoring runs on [Pages CMS](https://app.pagescms.org), configured by `.pages.yml`.
Sign in with GitHub, pick this repository, and the "文章（Insights）" collection gives you a form
for the metadata, a rich-text body, and image uploads that land in `assets/uploads/`. Saving
commits a markdown file; Cloudflare Pages rebuilds.

`admin.html` still works for the home-page copy. Its article tab is read-only on purpose — it
would write into the generated mirror, and the next build would silently discard it.

## Layout

```
index.html              hand-written home page (7 sections)
404.html                not-found page, served with a 404 status by the host
admin.html              local tool: home-page copy editor (articles moved online)
site.config.js          window.SITE_CONFIG — baseUrl + stage flag, single source
content/articles/*.md   articles: YAML frontmatter + markdown body (source of truth)
content/articles.js     generated mirror of the above, for admin.html offline preview
content.js              home page copy (window.SITE_CONTENT)
cms.js                  applies SITE_SCHEMA + content.js to the home page DOM
articles-md.js          frontmatter parser + markdown writer (no dependencies)
article-builder.js      generator core
build-articles.js       Node build script
publish.bat / .js       build + commit + push
console.bat / console/  local control room: status, entry points, publish button
functions/api/enquiry.js  Pages Function: enquiry form → Web3Forms email
_headers                Cloudflare Pages: caching + security response headers
netlify.toml            legacy: same rules for Netlify, ignored by Cloudflare
.pages.yml              Pages CMS schema for online authoring
assets/                 images, self-hosted woff2 fonts, insights.css
assets/uploads/         images uploaded from Pages CMS land here
insights/               generated: article index + one directory per article
sitemap.xml robots.txt llms.txt feed.xml   generated
tools/                  chat export, handover packaging, one-off md migration
```

## Build

```bash
node build-articles.js
```

Regenerates the article pages, `insights/index.html`, `sitemap.xml`, `robots.txt`, `llms.txt`,
`feed.xml`, and injects the article list + robots directive + canonical/OG/JSON-LD block into
`index.html`.

The base URL resolution order is `SITE_BASE_URL` → `URL` (Netlify) → `CF_PAGES_URL` (Cloudflare,
with the per-deploy hash stripped off) → `baseUrl` in `site.config.js`. A build with an invalid
absolute URL fails loudly instead of emitting a broken canonical.

There are two build paths, and they must not be confused:

```bash
node build-articles.js        # regenerate pages in place (local preview, publish.js)
node release.js --no-zip      # the above, then rebuild dist/ from a whitelist → what CI deploys
```

Cloudflare Pages runs `node release.js --no-zip` and publishes `dist`. Publishing only the
whitelisted output is what keeps `admin.html`, `content/` and the build scripts off the public
site — there are no block rules to maintain.

Requires Node 18+.

## Enquiry form

The contact form posts to `/api/enquiry`, a Pages Function (`functions/api/enquiry.js`) that
validates the fields and forwards them to Web3Forms, which sends the email. Netlify Forms is gone —
it does not exist on Cloudflare, where a plain `POST /` returns 405.

Web3Forms' access key is **not** in this repository (it is public). It lives in the host's build
environment variables:

| Variable | Purpose |
|---|---|
| `WEB3FORMS_KEY` | access key for the Web3Forms form; without it the function returns 503 instead of pretending to succeed |
| `SITE_BASE_URL` | canonical host for absolute URLs |
| `NODE_VERSION` | pins the build runtime |

To change the receiving inbox, create a new key at web3forms.com under that address and replace
`WEB3FORMS_KEY` — no code change. `functions/` must stay at the repo root, not inside `dist`;
Cloudflare picks it up from there regardless of the build output directory.


## Publish

Double-click `console.bat` for the control room — it starts a local server on 127.0.0.1 (first free
port from 4477), opens the page, and gives you one screen with the site status, the entry points
(Pages CMS, Umami, Cloudflare, the local editor, the repo) and a real publish button. Nothing is
exposed to the network; closing the console window stops it.

Or from a terminal:

```bash
node publish.js            # build, commit, push
node publish.js --dry-run  # show what would be committed, touch nothing
```

`publish.bat` is a thin wrapper around `publish.js`. The logic lives in Node because this
machine has no system Git — `git.exe` only exists inside WorkBuddy's PortableGit, which is not
on a plain `cmd` PATH, so the script probes `PATH` first and then falls back to the known
install locations. It also stops if `index.html` has been polluted by a visual editor
(`data-page-node-id` attributes) or if the build fails, so a broken build never reaches GitHub.

The host rebuilds from GitHub on every push to `main` — nothing else to do after `publish.js`.
`release.bat` (build + zip) is legacy from the manual-drag era and is no longer needed.

## Status

`SITE_CONFIG.stage` is currently `true`: `robots.txt` disallows everything and every page
carries `noindex,nofollow`. Stage mode has to be switched off in all three layers at once —
robots, home page, article/list pages — otherwise you end up with the worse state of "home page
not indexed but articles indexed".

Canonical host in `SITE_CONFIG.baseUrl` is `https://seye-cosmetic-site.pages.dev` — the address
that actually resolves today. Pointing canonical at a domain that does not resolve yet tells
Google the real page lives elsewhere and throws the ranking away; the real domain gets switched in
when its DNS is live.

Going live for real means two changes: set `baseUrl` to the production domain (or set the
`SITE_BASE_URL` environment variable in the host's build settings), and set `stage: false`. Then rebuild — every
absolute URL on the site follows automatically.
