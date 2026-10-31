/* ============================================================
   SEYE · 站点配置（唯一一处）
   ------------------------------------------------------------
   baseUrl 决定全站所有绝对地址：canonical、og:url、og:image、
   sitemap.xml、llms.txt、feed.xml、JSON-LD 的 @id。
   换域名时只改这一行，跑一次构建，上面全部跟着变。

   现在填的是当前实际能打开的地址。这一点很重要：canonical 指向
   一个打不开的域名，等于告诉 Google "真身在别处"，权重直接丢掉。
   正式域名解析好之后再改成 https://www.seyecosmetic.com。

   不想改代码也行：构建时读环境变量 SITE_BASE_URL（其次是 Netlify
   自动注入的 URL）。优先级：SITE_BASE_URL > URL > 这里的 baseUrl。

   stage: true = 测试模式。全站 noindex + robots.txt 禁止抓取，
   搜索引擎不会收录，所以换正式域名时不会有任何权重损失。
   正式上线前把它改成 false，再发布一次即可（三层收口同时生效）。

   注意：这个文件是经典 <script>（不是 .json）。file:// 协议下
   fetch() 会被同源策略拦死，<script src> 不受限 —— 后台和构建
   都要读它，所以必须保持 .js。
   ============================================================ */
window.SITE_CONFIG = {
  baseUrl: 'https://seye-cosmetic-site.netlify.app',
  siteName: 'SEYE Biomedical',
  stage: true,

  /* ---------------- 访问统计 ----------------
     provider: 'umami' | 'plausible' | ''（空字符串 = 关闭）

     umami：cloud.umami.is 注册 → Add website → 复制 Website ID（一串 UUID）
     填到 umamiWebsiteId 后跑一次构建，统计脚本会同时出现在首页和所有文章页。
     它是无 cookie 的，欧盟访客不需要同意弹窗，也不影响页面加载速度（defer）。

     umamiWebsiteId 为空时构建不输出任何脚本，等于没装 —— 所以可以先把
     管道放这儿，等 ID 拿到再填。
  ------------------------------------------------ */
  analytics: {
    provider: 'umami',
    umamiWebsiteId: 'bd986006-faf9-4f64-94bd-0ee7d508c644',
    umamiScript: 'https://cloud.umami.is/script.js',
    plausibleDomain: ''
  }
};
