/* ============================================================
   SEYE · 文章数据源
   ------------------------------------------------------------
   这是「文章后台」的唯一数据源：每一篇文章是一个对象，
   正文用 markdown 写（## 二级标题、**加粗**、- 列表、> 引用）。

   发布流程：双击 admin.html → 文章 → 编辑 → 发布
   然后把生成的 insights/ 目录 + sitemap.xml + llms.txt 传到服务器。

   baseUrl 决定 canonical、sitemap、llms.txt 里的绝对地址 ——
   换域名时只改这一处，不要漏。
   ============================================================ */
window.SITE_CONFIG = {
  baseUrl: 'https://www.seyecosmetic.com',
  siteName: 'SEYE Biomedical',
  /* stage: true = 测试模式。全站 noindex + robots.txt 禁止抓取，
     搜索引擎不会收录，所以换正式域名时不会有任何权重损失。
     正式上线前在后台取消勾选，重新发布一次即可。 */
  stage: true
};

window.SITE_ARTICLES = [
  {
    slug: 'how-to-choose-a-skincare-oem-manufacturer',
    title: 'How to Choose a Skincare OEM Manufacturer: What to Verify Before You Sign',
    metaTitle: 'How to Choose a Skincare OEM Manufacturer | SEYE Biomedical',
    description: 'A practical checklist for vetting skincare OEM and ODM factories: licences, formula ownership, in-process QC, MOQ terms, packaging and export documentation.',
    excerpt: 'Most first-time brand owners pick a manufacturer on price per unit and sample quality. Both are the two easiest things for a factory to fake. Here is what actually predicts whether your bulk order matches your sample.',
    category: 'Sourcing',
    keywords: ['skincare OEM manufacturer', 'private label skincare', 'ODM cosmetics', 'skincare MOQ', 'GMPC', 'ISO 22716'],
    date: '2026-10-30',
    updated: '2026-10-30',
    author: 'SEYE Biomedical',
    cover: 'assets/hero.jpg',
    coverAlt: 'SEYE Biomedical production facility in Guangzhou',
    faq: [
      {
        q: 'What is the difference between OEM and ODM in skincare?',
        a: 'OEM means the factory manufactures to a formula you own or commissioned — you control the recipe and the factory may not resell it. ODM means the factory already owns a library of developed formulas and you license one, usually with lighter customisation and a faster timeline. Private label is the loosest of the three: an existing product, your brand on the label.'
      },
      {
        q: 'What is a realistic minimum order quantity for private label skincare?',
        a: 'For a standard formula in stock packaging, most factories land in the low thousands of units per SKU. Custom formula development usually pushes the MOQ higher because the batch has to be large enough to run a stability programme. Treat any MOQ quoted without a packaging specification as provisional.'
      },
      {
        q: 'How long does it take to manufacture a skincare product?',
        a: 'A realistic industry benchmark is two to four weeks for sampling and revision, then four to six weeks for bulk production after you approve the specification. Packaging with custom tooling or imported components adds several weeks on top. Ask for the lead time in writing, split into sampling, bulk and shipping.'
      },
      {
        q: 'Do I need GMPC or ISO 22716 to sell skincare in the EU?',
        a: 'EU cosmetic regulation requires that products are manufactured to Good Manufacturing Practice, and ISO 22716 is the harmonised standard that demonstrates it. Your responsible person will ask for evidence of GMP compliance, and most retailers ask for it too. Ask for the certificate and check the scope covers the site that will actually make your batch.'
      },
      {
        q: 'Can the manufacturer register my product with the FDA or CPNP for me?',
        a: 'A factory can prepare the technical file and the safety assessment inputs, and many will file on your behalf, but the registration is held by an entity in the market — the US agent for FDA, the responsible person for CPNP. Confirm in writing who holds the registration, because you cannot move it later without cooperation.'
      },
      {
        q: 'How much does private label skincare cost?',
        a: 'Unit cost is driven by four things: formula complexity, fill volume, packaging component and order quantity. Two brands quoting the same product can differ by a factor of three purely on packaging. Ask for a costed breakdown by component rather than a single landed price, so you can see where the money actually goes.'
      }
    ],
    body: [
      'A skincare OEM manufacturer is a factory that produces a product to a formula and specification you control, then hands it back to you as finished goods under your brand. The category matters less than the contractual detail: what you own, what you can audit, and what happens when a batch fails.',
      'Most first-time brand owners choose a factory on two signals — price per unit and how good the sample feels. Both are the easiest things to optimise for a single 500-gram batch and the hardest things to guarantee across twenty thousand units. The questions below are the ones that predict whether your bulk order matches your sample.',

      '## What an OEM manufacturer actually does',
      'The work splits into four stages, and it is worth knowing which stage you are buying:',
      '- **Formulation** — writing the recipe, running stability and compatibility testing, producing the specification document.',
      '- **Procurement** — sourcing raw materials and the packaging component, and qualifying each supplier.',
      '- **Production** — batching, filling, sealing, labelling, with in-process checks at each critical point.',
      '- **Release** — microbiological and physicochemical testing against the approved specification, then documentation for export.',
      'A factory that is strong at production but weak at formulation will still take your brief, quote it, and subcontract the development. That is not necessarily a problem, but you should know it is happening, because it changes who owns the formula.',

      '## OEM, ODM or private label — which one you are actually asking for',
      'These three words get used interchangeably in quotes and they mean very different things for your cost, timeline and IP:',
      '- **OEM** — the factory makes your formula. You commissioned it or you brought it. Higher development cost, slower start, but the recipe is yours and the factory cannot resell it.',
      '- **ODM** — the factory already developed the formula and licenses it to you. Faster and cheaper to start, with lighter customisation, but you are usually sharing the base with other brands.',
      '- **Private label** — an existing finished product with your logo on it. Fastest and cheapest, and the least differentiated.',
      'If a quote says "OEM" but the sample arrives in a week with no development invoice, you are being offered an ODM formula under an OEM label. Ask directly which base formula it is and how many other clients use it.',

      '## Seven things to verify before you sign',
      '### 1. The manufacturing licence and its scope',
      'Ask for the cosmetic production licence and the GMP certificate, then check that the address on both matches the site that will make your batch. Group factories frequently quote from a certified flagship and produce in a sister plant that is not on the certificate.',
      '### 2. Whose formula it is, in writing',
      'Get a clause that names the formula as your property, restricts the factory from reusing it, and says what happens to the recipe if you leave. Without this, "custom formulation" frequently means "custom for you until someone else asks".',
      '### 3. In-process control, not just final testing',
      'Final testing tells you whether a bad batch is bad. In-process checks — pH, viscosity, homogeneity, microbial load at each critical stage — are what stop the bad batch from being made. Ask which parameters are checked, at which steps, and who signs off.',
      '### 4. What the MOQ is actually quoted against',
      'An MOQ quoted without a packaging specification is provisional. The real constraint is often the component, not the formula: a stock airless pump may have a 3,000-unit minimum while a custom-moulded jar needs 30,000. Ask for MOQ per component.',
      '### 5. Packaging ownership and lead time',
      'If the factory sources the component, ask who holds the mould, who holds the stock, and what happens to leftover units. Unclaimed packaging stock is one of the most common sources of quiet cost at the end of a run.',
      '### 6. Documentation for your actual market',
      'The paperwork you need is determined by where you sell, not where you manufacture. EU needs a CPSR and a responsible person. The US needs an FDA establishment registration and a US agent. ASEAN markets need their own notifications. Confirm before the quote, not after the deposit.',
      '### 7. Who answers when something goes wrong',
      'Ask what the process is for an out-of-spec batch, how rework is handled, and who pays for it. A factory that has a written answer has dealt with it before. A factory that says "it will not happen" has not.',

      '## What documents you should receive with every batch',
      'Ask for a sample batch record before you order, so you can see what you will actually get. At minimum you should expect:',
      '- Certificate of analysis covering the released specification',
      '- Microbiology report (total plate count, yeast and mould, pathogens where relevant)',
      '- Raw material certificates of analysis for the actives that matter',
      '- Filling and labelling records with the batch code that appears on the carton',
      '- Safety data sheet for transport, if you are shipping',
      'The batch code is the thread that ties all of this together. If the code on the carton cannot be traced back to a batch record, the document set is decorative.',

      '## How MOQ, lead time and unit cost actually interact',
      'These three move together and pretending otherwise is how budgets break. Larger batches spread the fixed cost — setup, cleaning, QC release — across more units, so unit price falls. But larger batches also lock up cash in inventory and packaging, and they harden your formula decision: changing the scent after 20,000 units have been filled is not a revision, it is a write-off.',
      'As a rough industry benchmark, expect two to four weeks for sampling and revision, then four to six weeks for bulk after approval. Custom tooling and imported components routinely add four to eight weeks on top. Any quote that gives you a single delivery date without splitting those phases is a guess.',

      '## Red flags that show up in the first two calls',
      '- A per-unit price that is dramatically below everyone else, with no breakdown of what is included.',
      '- Refusal to let you see the batch record, or a certificate of analysis that is a template with the numbers typed in.',
      '- "Our MOQ is flexible" with no number attached — flexible usually means it changes after you commit.',
      '- No named person responsible for quality, only a sales contact.',
      '- Samples that arrive without a specification document. A sample without a spec is a mood, not a product.',
      'None of these are disqualifying on their own. Together they describe a supplier who is optimised for winning the order rather than for shipping the order.',

      '## Next step',
      'If you are evaluating factories now, the fastest way to shorten the process is to send a brief that is specific enough to be quoted: category, target market, reference product, preferred texture, packaging direction and expected volume. Vague briefs get vague quotes, and vague quotes hide the differences you are trying to compare.'
    ].join('\n\n')
  },
  {
    slug: 'reading-a-cosmetic-certificate-of-analysis',
    title: 'How to Read a Cosmetic Certificate of Analysis (and Spot a Fabricated One)',
    metaTitle: 'How to Read a Cosmetic Certificate of Analysis | SEYE',
    description: 'What a cosmetic CoA must contain, which results buyers misread — pH, viscosity, microbiological limits — and how to tell a genuine report from a template.',
    excerpt: 'A certificate of analysis is the only document that tells you whether the batch you received matches the batch you approved. Most buyers check that it exists and file it. Here is what to actually read.',
    category: 'Quality',
    keywords: ['certificate of analysis cosmetics', 'skincare CoA', 'microbiological limits cosmetics', 'ISO 22716 records', 'batch release'],
    date: '2026-10-28',
    updated: '2026-10-28',
    author: 'SEYE Biomedical',
    cover: 'assets/ins-coa.jpg',
    coverAlt: 'Botanical raw material specimens in laboratory glassware',
    faq: [
      {
        q: 'What is a certificate of analysis in cosmetics?',
        a: 'It is the document a manufacturing site issues for a specific production batch, stating the measured result of each tested parameter next to the specification limit it was tested against. It is a record of measurement for that batch, not a marketing document and not a safety certificate.'
      },
      {
        q: 'Who issues a certificate of analysis?',
        a: 'The quality unit of the site that manufactured the batch — not the trading company, not the sales agent. The issuing site name and address should appear on the document, and the releasing signature should belong to someone at that site.'
      },
      {
        q: 'Does a CoA prove a cosmetic product is safe?',
        a: 'No. A CoA shows that a batch met the parameters in your specification. Safety is established separately through a cosmetic safety assessment and a regulatory notification for the market you sell in. A batch can pass every chemical and microbiological test and still be unmarketable without those documents.'
      },
      {
        q: 'Is a certificate of analysis issued per batch or per product?',
        a: 'Per batch. Two shipments of the same SKU will carry different results because they are different batches, even when both pass. If a supplier offers you one CoA covering several shipment dates, ask how many batches were actually tested.'
      },
      {
        q: 'How long should certificates of analysis be kept?',
        a: 'Longer than most people expect — commonly for the shelf life of the product plus a retention period set by the market. Your responsible person or US agent will tell you the specific requirement; the practical answer is to keep every CoA indefinitely, because it is the only evidence you have if a batch is questioned years later.'
      }
    ],
    body: [
      'A certificate of analysis — usually shortened to CoA — is the document a manufacturer issues to state the measured results of one specific production batch, tested against the specification you approved. It is batch-level, not product-level: two shipments of the same SKU carry different CoAs, because they carry different numbers.',
      'There is no single compulsory format. What matters is whether the document lets you trace a result back to a batch code, a test method and a person who released it. Here is what to look for.',

      '## What a certificate of analysis is for',
      'The document does three separate jobs, and it is worth knowing which one you are relying on:',
      '- **Release** — it is the manufacturer\'s formal statement that the batch may be sold.',
      '- **Comparison** — it lets you compare what arrived with what you signed off, parameter by parameter.',
      '- **Record** — regulators and retailers expect it on file for as long as the product exists in the market.',
      'A CoA is a record of measurement. It is not a certificate of safety. Those are different documents produced by different people.',

      '## The minimum a certificate of analysis must contain',
      'Before you read any number, check that these seven things are present. If one is missing, the report cannot do its job:',
      '- Product name and the **batch or lot code**, matching the code printed on your carton',
      '- The specification it was tested against, **including limits** — not just results',
      '- Each parameter, the test method, the result, and a pass or fail',
      '- Microbiological results **with actual counts**, not the word "compliant"',
      '- Date of manufacture and date of release',
      '- The site name and address that manufactured it',
      '- A named person who released the batch, with a signature',
      'A number without a limit is decoration. If the CoA says pH 5.6 but never says what range was acceptable, you have learned nothing you can act on.',

      '## Three results buyers misread',
      '### pH',
      'pH is usually measured on neat product at a single time point, and a small drift over shelf life is normal for many emulsions. What matters is the specification range and whether the test was run at release or after accelerated ageing. Two CoAs quoting the same pH can describe quite different products if one was measured at 20 °C and the other at 25 °C.',
      '### Viscosity',
      'Viscosity depends on spindle, speed, temperature and rest time. Unless the method is stated, a viscosity figure cannot be compared between suppliers — or even between two batches from the same supplier. Ask for the test conditions rather than the number.',
      '### Microbiological limits',
      'Limits are set per gram and differ by product type: a product used near the eye is held to a tighter standard than a body lotion. "Microbiology: conforms" with no enumerations tells you nothing. You want counts for total aerobic organisms, yeast and mould, plus absence or presence results for the specific organisms the standard names.',

      '## Does the report match your specification?',
      'Compare three things, in this order: the batch code, the parameter list, then the limits.',
      'The most common failure is not a failing result — it is a CoA that tests a shorter parameter list than your specification requires. Every result passes, but the parameters you cared about were never run. If your specification names a heavy metals panel and the CoA has no heavy metals section, the batch was not tested to your specification, whatever the pass column says.',

      '## How fabricated certificates look',
      'Genuine reports have texture. Rounding reflects the precision of a real instrument. At least one parameter usually sits closer to its limit than you would like. Methods carry versions. Somebody\'s name is on the release line.',
      'Fabricated reports tend to be internally too consistent: every value sits comfortably mid-range, there is no method column, the phrasing is identical across unrelated products, and the release date sometimes precedes the manufacture date.',
      'The most reliable test is procedural rather than visual — ask for the batch record that corresponds to the CoA. A factory that can produce it on request is telling you something. One that cannot is telling you something too.',

      '## When a result lands out of specification',
      'Out-of-specification results happen in factories that test properly. What separates a good supplier is the written procedure that follows: the batch is held, an investigation is opened, the root cause is recorded, and a documented decision is made to rework, re-test or reject.',
      'Ask to see that procedure before you place the order, and ask what happens commercially to a rejected batch. A supplier who says results never fail either has very loose limits or is not running the tests.'
    ].join('\n\n')
  }
];
