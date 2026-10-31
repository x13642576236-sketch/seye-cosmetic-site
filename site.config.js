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
  stage: true
};
