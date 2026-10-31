/* ============================================================
   SEYE · 站点配置（唯一一处）
   ------------------------------------------------------------
   baseUrl 决定 canonical、sitemap、llms.txt 里的绝对地址 ——
   换域名时只改这一处，不要漏。

   stage: true = 测试模式。全站 noindex + robots.txt 禁止抓取，
   搜索引擎不会收录，所以换正式域名时不会有任何权重损失。
   正式上线前把它改成 false，再发布一次即可（三层收口同时生效）。

   注意：这个文件是经典 <script>（不是 .json）。file:// 协议下
   fetch() 会被同源策略拦死，<script src> 不受限 —— 后台和构建
   都要读它，所以必须保持 .js。
   ============================================================ */
window.SITE_CONFIG = {
  baseUrl: 'https://www.seyecosmetic.com',
  siteName: 'SEYE Biomedical',
  stage: true
};
