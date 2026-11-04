// ==UserScript==
// @name         WRE supplier scout
// @namespace    wre
// @version      1.0
// @description  One off helper for building the AroFlo supplier window: records how CNW, Tradezone and the AroFlo quote page load their search results, prices and line items, so Claude can build it without the PC. Copy the report and paste it to Claude. Remove once the supplier window's built.
// @match        https://shop.cnw.com.au/*
// @match        https://www.cnw.com.au/*
// @match        https://*.tradezone.com.au/*
// @match        https://tradezone.com.au/*
// @match        https://office.aroflo.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/wre-supplier-scout.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/wre-supplier-scout.user.js
// ==/UserScript==

// Built from src/wre-supplier-scout.js by build.py. Change src/wre-supplier-scout.js, not this file.
(function () {
  // Live updates (23/10): Tampermonkey only checks for a new version every few hours. This checks the repo's latest commit every
  // 2 min (free when nothing's changed) and keeps the newest code here, so a push runs on the next page load. If the new code needs
  // a permission this install hasn't got, or this browser won't run it, the built in copy below runs like before.
  const __wreName = "wre-supplier-scout", __wreVer = "1.0", __wreHave = new Set(["// @connect api.github.com", "// @connect raw.githubusercontent.com", "// @grant GM_getValue", "// @grant GM_setValue", "// @grant GM_xmlhttpRequest", "// @grant unsafeWindow", "// @match https://*.tradezone.com.au/*", "// @match https://office.aroflo.com/*", "// @match https://shop.cnw.com.au/*", "// @match https://tradezone.com.au/*", "// @match https://www.cnw.com.au/*", "// @run-at document-start"]);
  const __wreInfo0 = typeof GM_info != 'undefined' ? GM_info : null;
  const __wreSay = m => { try { console.log('[WRE live update] ' + __wreName + ': ' + m); } catch (e) {} };
  const __wreCmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  const __wreMeta = c => { const h = (String(c).match(/==UserScript==([\s\S]*?)==\/UserScript==/) || [])[1] || ''; return { v: (h.match(/^\/\/ @version\s+(\S+)/m) || [])[1] || '', need: (h.match(/^\/\/ @(grant|connect|match|exclude|include|run-at|sandbox)\s+.+$/gm) || []).map(s => s.replace(/\s+/g, ' ').trim()) }; };
  const __wreMissing = need => need.filter(x => !__wreHave.has(x) && !(/^\/\/ @connect /.test(x) && __wreHave.has('// @connect *')));
  // the newer code, run with GM_info saying its own version
  function __wreRun(__wreCode, __wreV) { const GM_info = __wreInfo0 ? Object.assign({}, __wreInfo0, { script: Object.assign({}, __wreInfo0.script, { version: __wreV }) }) : undefined; eval(__wreCode); }
  function __wreLive() {
    let c = null; try { c = GM_getValue('wreLiveCode', null); } catch (e) { return false; }
    if (!c || !c.code || __wreCmp(c.v, __wreVer) <= 0) return false;
    const miss = __wreMissing(__wreMeta(c.code).need); if (miss.length) { __wreSay(c.v + ' needs ' + miss.join(', ') + ', running the built in ' + __wreVer + ' till Tampermonkey updates'); return false; }
    try { eval('0'); } catch (e) { __wreSay('this browser won\'t run live code (' + e.message + '), running the built in ' + __wreVer); return false; }
    try { __wreRun(c.code, c.v); } catch (e) { if (e instanceof SyntaxError) { __wreSay(c.v + ' won\'t parse, running the built in ' + __wreVer); return false; } __wreSay(c.v + ' threw: ' + e.message); }
    __wreSay('running ' + c.v + ' (built in is ' + __wreVer + ')'); return true;
  }
  function __wreCheck() {
    try {
      if (Date.now() - GM_getValue('wreLiveAt', 0) < 2 * 60e3) return; GM_setValue('wreLiveAt', Date.now());
      const et = GM_getValue('wreLiveEtag', ''), hd = { Accept: 'application/vnd.github+json' }; if (et) hd['If-None-Match'] = et;
      GM_xmlhttpRequest({ method: 'GET', url: 'https://api.github.com/repos/Badseed26/wre-userscripts/commits/main', headers: hd, timeout: 20000, onload: r => {
        try {
          if (r.status != 200) return; // 304: nothing new, and it doesn't count against GitHub's limit
          const sha = (JSON.parse(r.responseText) || {}).sha, tag = (((r.responseHeaders || '').match(/^etag:\s*(.+)$/mi) || [])[1] || '').trim();
          if (!sha) return; if (sha == GM_getValue('wreLiveSha', '')) { if (tag) GM_setValue('wreLiveEtag', tag); return; }
          GM_xmlhttpRequest({ method: 'GET', url: 'https://raw.githubusercontent.com/Badseed26/wre-userscripts/' + sha + '/src/' + __wreName + '.js', timeout: 30000, onload: q => {
            try {
              const code = q.responseText || ''; if (q.status != 200 || !/==\/UserScript==/.test(code)) return;
              const m = __wreMeta(code); if (!m.v) return;
              if (__wreCmp(m.v, __wreVer) > 0) {
                let ok = true; try { new Function(code); } catch (e) { ok = !(e instanceof SyntaxError); }
                if (!ok) { __wreSay(m.v + ' won\'t parse, not keeping it'); GM_setValue('wreLiveSha', sha); return; }
                const old = GM_getValue('wreLiveCode', null); if (!old || old.v != m.v) __wreSay('got ' + m.v + ', it runs on the next page load');
                GM_setValue('wreLiveCode', { v: m.v, code, sha, at: Date.now() });
              } else GM_setValue('wreLiveCode', null); // Tampermonkey's copy has caught up
              GM_setValue('wreLiveSha', sha); if (tag) GM_setValue('wreLiveEtag', tag);
            } catch (e) {} } });
        } catch (e) {} } });
    } catch (e) {}
  }
  if (window.top === window.self) { __wreCheck(); setInterval(__wreCheck, 2 * 60e3 + 5000); }
  if (__wreLive()) return;
  // ---------- the built in copy (src/wre-supplier-scout.js at 1.0) ----------

(function () {
  'use strict';

  // What it does: on CNW, Tradezone and AroFlo it notes the page's own background requests (search, prices, stock, line items)
  // with a cut down sample of what came back, plus a sketch of the product cards and forms on the page. Nothing leaves the
  // phone or PC: it all sits in Tampermonkey until you hit Copy report and paste it to Claude yourself.
  // Privacy: no cookies or sign in headers are ever read, passwords and hidden values are skipped, emails, phone numbers,
  // account numbers and long tokens are blanked out, and on AroFlo only the quote line items area is sketched.

  const W = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
  const HOST = location.hostname;
  const SITE = /cnw/.test(HOST) ? 'CNW' : /tradezone/.test(HOST) ? 'Tradezone' : 'AroFlo';
  const KEY = 'scout_' + SITE;
  const CAP = 20000;                 // max report size per site
  const MAX_REQ = 40;                // requests kept per site
  const NOISE = /google|facebook|doubleclick|hotjar|clarity|newrelic|nr-data|segment|analytics|gtm|cloudflareinsights|sentry|intercom|zendesk|bing|tiktok|linkedin|\.(png|jpe?g|gif|svg|webp|woff2?|ttf|css|ico)(\?|$)/i;

  // ---------- blank out anything personal ----------
  const redact = s => String(s == null ? '' : s)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?61\s?|0)[2-478](\s?\d){8}\b/g, '[phone]')
    .replace(/((account|acct|customer|cust)\s*(no|number|#|id|code)?\s*[:#=]?\s*)[\w-]{3,}/gi, '$1[acct]')
    .replace(/("?(token|csrf\w*|auth\w*|session\w*|password|passwd|secret|apikey|api_key|jsessionid|cookie)"?\s*[:=]\s*"?)[^"&\s,}]+/gi, '$1[x]')
    .replace(/\b[A-Za-z0-9_\-]{36,}\b/g, '[long]');
  const short = (s, n) => { s = redact(String(s == null ? '' : s).replace(/\s+/g, ' ').trim()); return s.length > n ? s.slice(0, n) + '…' : s; };
  const pathOf = u => { try { const x = new URL(u, location.href); return (x.host == HOST ? '' : x.host) + x.pathname + (x.search ? short(x.search, 160) : ''); } catch (e) { return short(u, 160); } };

  // ---------- storage ----------
  const load = () => { try { return GM_getValue(KEY, null) || { req: [], pages: [] }; } catch (e) { return { req: [], pages: [] }; } };
  let store = load();
  let dirty = false;
  const save = () => { if (!dirty) return; dirty = false; try { GM_setValue(KEY, store); } catch (e) {} };
  setInterval(save, 2000);
  addEventListener('pagehide', save);

  // JSON sample: first 2 of every list, strings cut short, 5 deep
  function sampleJson(v, d) {
    if (d > 5) return '…';
    if (Array.isArray(v)) return v.length ? [`(${v.length} items)`, ...v.slice(0, 2).map(x => sampleJson(x, d + 1))] : [];
    if (v && typeof v == 'object') { const o = {}; Object.keys(v).slice(0, 40).forEach(k => { o[k] = /token|csrf|auth|session|password|secret|cookie|email|phone|mobile/i.test(k) ? '[x]' : sampleJson(v[k], d + 1); }); return o; }
    if (typeof v == 'string') return short(v, 80);
    return v;
  }
  function sampleBody(text, ct) {
    text = String(text || '');
    if (/json/.test(ct) || /^\s*[\[{]/.test(text)) { try { return JSON.stringify(sampleJson(JSON.parse(text), 0)).slice(0, 2500); } catch (e) {} }
    const noScript = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '<svg/>');
    return short(noScript, 1500);
  }

  function note(method, url, status, ct, reqBody, text) {
    if (NOISE.test(url)) return;
    let host = ''; try { host = new URL(url, location.href).host; } catch (e) {}
    if (host && host != HOST && !/cnw|tradezone|aroflo|bgwgroup|algolia|searchspring|klevu|bloomreach|coveo|constructor/i.test(host)) return;
    const p = pathOf(url);
    if (store.req.some(r => r.p == p && r.m == method)) return;   // one of each is plenty
    store.req.push({ at: new Date().toISOString().slice(11, 19), page: short(location.pathname + location.search, 100), m: method, p, s: status, ct: short(ct, 40), body: reqBody ? short(typeof reqBody == 'string' ? reqBody : '[form data]', 300) : '', got: sampleBody(text, ct || '') });
    if (store.req.length > MAX_REQ) store.req.shift();
    dirty = true; paint();
  }

  // ---------- watch the page's own requests (fetch and XHR) ----------
  try {
    const of = W.fetch;
    if (of && !of.__scout) {
      const nf = function (input, init) {
        const url = typeof input == 'string' ? input : (input && input.url) || '';
        const method = (init && init.method) || (input && input.method) || 'GET';
        const body = init && init.body;
        return of.apply(this, arguments).then(r => {
          try { const ct = r.headers.get('content-type') || ''; if (!/image|font|octet|pdf|video|audio/.test(ct)) r.clone().text().then(t => note(method, url, r.status, ct, body, t)).catch(() => {}); } catch (e) {}
          return r;
        });
      };
      nf.__scout = true; W.fetch = nf;
    }
    const XP = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
    if (XP && !XP.__scout) {
      const oo = XP.open, os = XP.send;
      XP.open = function (m, u) { this.__s = { m, u }; return oo.apply(this, arguments); };
      XP.send = function (b) {
        const x = this, s = x.__s || {};
        x.addEventListener('load', () => { try { const ct = x.getResponseHeader('content-type') || ''; if (/image|font|octet|pdf/.test(ct)) return; const t = (x.responseType == '' || x.responseType == 'text') ? x.responseText : (x.responseType == 'json' ? JSON.stringify(x.response) : ''); note(s.m || 'GET', s.u || '', x.status, ct, b, t); } catch (e) {} });
        return os.apply(this, arguments);
      };
      XP.__scout = true;
    }
  } catch (e) { store.hookErr = String(e.message || e); dirty = true; }

  // ---------- sketch the page ----------
  const cls = el => (el.className && typeof el.className == 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const sel = el => { const out = []; for (let i = 0; el && el.nodeType == 1 && i < 5; i++, el = el.parentElement) out.unshift(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls(el)); return out.join(' > '); };
  function skel(el, d, budget) {
    if (!el || budget.n <= 0) return '';
    const tag = el.tagName.toLowerCase();
    if (/^(script|style|svg|noscript|iframe)$/.test(tag)) return '';
    const attrs = [];
    if (el.id) attrs.push('#' + el.id);
    if (cls(el)) attrs.push(cls(el));
    [...el.attributes].forEach(a => { if (/^data-|^name$|^title$|^itemprop$|^aria-label$|^type$|^placeholder$/.test(a.name)) attrs.push(a.name + '="' + short(a.value, 40) + '"'); if (a.name == 'href') attrs.push('href="' + pathOf(a.value).slice(0, 80) + '"'); });
    if (/^(input|select|textarea)$/.test(tag)) { const v = el.type == 'password' || el.type == 'hidden' ? '' : short(el.value, 30); if (v) attrs.push('value="' + v + '"'); }
    const own = [...el.childNodes].filter(n => n.nodeType == 3).map(n => n.textContent).join(' ');
    const txt = short(own, 60);
    let s = '  '.repeat(d) + '<' + tag + (attrs.length ? ' ' + attrs.join(' ') : '') + '>' + (txt ? ' ' + txt : '') + '\n';
    budget.n -= s.length;
    if (d < 7) [...el.children].slice(0, 14).forEach(c => { s += skel(c, d + 1, budget); });
    return s;
  }
  // a card = the nearest parent sitting in a row of 3+ look alike siblings
  function cardOf(el) {
    for (let p = el, i = 0; p && p.parentElement && i < 10; p = p.parentElement, i++) {
      const sib = [...p.parentElement.children].filter(c => c.tagName == p.tagName && c.className == p.className);
      if (sib.length >= 3) return p;
    }
    return null;
  }

  function snapshot(manual) {
    const page = { at: new Date().toISOString().slice(11, 19), url: short(location.pathname + location.search, 160), title: short(document.title, 80), manual: !!manual };
    const body = document.body; if (!body) return;

    if (SITE == 'AroFlo') {
      // only the quote's line items: the table with Item and Qty headings, plus the buttons around it
      const tables = [...document.querySelectorAll('table')].filter(t => { const h = [...t.querySelectorAll('th,thead td')].map(x => x.innerText).join('|'); return /item/i.test(h) && /qty/i.test(h); });
      page.lineTables = tables.slice(0, 2).map(t => ({ where: sel(t), heads: [...t.querySelectorAll('th')].map(x => short(x.innerText, 20)).filter(Boolean).slice(0, 25), rows: t.querySelectorAll('tbody tr').length, sketch: [...t.querySelectorAll('tbody tr')].slice(0, 3).map(r => skel(r, 0, { n: 2500 })).join('') }));
      page.controls = [...document.querySelectorAll('[title],button,input[type=button],a.btn,a.button')].filter(e => /line|item|assembly|inventory|search|lookup|part|catalog|supplier|add/i.test((e.getAttribute('title') || '') + ' ' + (e.innerText || e.value || ''))).slice(0, 30).map(e => short((e.getAttribute('title') || e.innerText || e.value || ''), 40) + ' :: ' + sel(e) + (e.id ? '' : '') + (e.getAttribute('onclick') ? ' onclick=' + short(e.getAttribute('onclick'), 120) : ''));
      // field names on the line items (no values, no customer fields)
      const scope = tables[0] || null;
      page.lineFields = scope ? [...new Set([...scope.querySelectorAll('input,select,textarea')].map(e => (e.name || e.id || '?').replace(/\d+/g, '#') + ':' + e.type))].slice(0, 60) : [];
      page.lists = [...document.querySelectorAll('select')].filter(s => scope && scope.contains(s)).slice(0, 6).map(s => (s.name || s.id).replace(/\d+/g, '#') + ' = ' + [...s.options].slice(0, 12).map(o => short(o.text, 20)).join(' / '));
    } else {
      // prices on the page and the product card around the first one
      const leaves = [...body.querySelectorAll('*')].filter(e => e.children.length <= 2 && /\$\s?\d[\d,]*(\.\d{2})?/.test(e.innerText || '') && (e.innerText || '').length < 60);
      page.prices = leaves.slice(0, 8).map(e => short(e.innerText, 40) + ' :: ' + sel(e));
      const card = leaves.map(cardOf).find(Boolean) || (leaves[0] && leaves[0].closest('li,article,tr,.product,[class*=product]'));
      if (card) { page.card = sel(card); page.cardSketch = skel(card, 0, { n: 4000 }); }
      // stock, code and branch words
      page.words = [...body.querySelectorAll('*')].filter(e => e.children.length == 0 && /stock|soh|available|oxenford|branch|code|part\s?no|sku|cat\.?\s?no|item\s?#|uom|each|per\s?(m|metre|roll|box)|ex\.?\s?gst|inc\.?\s?gst|add to (cart|order)|qty|quantity/i.test(e.textContent || '') && (e.textContent || '').trim().length < 80).slice(0, 25).map(e => short(e.textContent, 60) + ' :: ' + sel(e));
      page.forms = [...document.forms].filter(f => f.querySelector('input:not([type=hidden]),select')).slice(0, 6).map(f => ({ action: pathOf(f.getAttribute('action') || ''), method: f.method, fields: [...f.elements].filter(e => e.name && e.type != 'password').slice(0, 20).map(e => e.name + ':' + e.type) }));
    }
    // the site's own script names and any search or price addresses mentioned in its inline code
    page.scripts = [...document.scripts].filter(s => s.src).map(s => pathOf(s.src).split('?')[0]).filter(s => !NOISE.test(s)).slice(0, 20);
    const inline = [...document.scripts].filter(s => !s.src).map(s => s.textContent).join('\n');
    page.hints = (inline.match(/.{0,80}(searchUrl|priceUrl|stockUrl|autocomplete|\/api\/|ajax|getPrice|pricing|ACC\.config|contextPath|encodedContextPath|searchapi|graphql).{0,120}/gi) || []).slice(0, 8).map(x => short(x, 200));
    // background requests the browser saw that the hooks may have missed (no bodies, just addresses)
    try { page.seen = [...new Set(performance.getEntriesByType('resource').filter(e => /fetch|xmlhttprequest/.test(e.initiatorType)).map(e => pathOf(e.name)).filter(u => !NOISE.test(u)))].slice(0, 25); } catch (e) {}

    store.pages = store.pages.filter(p => p.url != page.url || p.manual > page.manual);
    if (!store.pages.some(p => p.url == page.url)) store.pages.push(page);
    if (store.pages.length > 8) store.pages.shift();
    dirty = true; save(); paint();
  }

  // ---------- report ----------
  function siteReport(name) {
    const s = name == SITE ? store : (GM_getValue('scout_' + name, null) || { req: [], pages: [] });
    if (!s.req.length && !s.pages.length) return '';
    let out = `\n===== ${name} (${s.pages.length} pages, ${s.req.length} requests)${s.hookErr ? ' hook error: ' + s.hookErr : ''} =====\n`;
    s.pages.forEach(p => { out += `\n--- PAGE ${p.url} | ${p.title}${p.manual ? ' (tapped)' : ''}\n` + JSON.stringify(Object.assign({}, p, { url: undefined, title: undefined, manual: undefined, cardSketch: undefined, lineTables: p.lineTables ? p.lineTables.map(t => Object.assign({}, t, { sketch: undefined })) : undefined })) + '\n' + (p.cardSketch ? 'CARD:\n' + p.cardSketch : '') + (p.lineTables ? p.lineTables.map(t => 'ROWS:\n' + t.sketch).join('') : ''); });
    s.req.forEach(r => { out += `\n--- REQ ${r.m} ${r.p} -> ${r.s} ${r.ct} (on ${r.page})${r.body ? '\nSENT: ' + r.body : ''}\nGOT: ${r.got}\n`; });
    return out.length > CAP ? out.slice(0, CAP) + '\n[cut at ' + CAP + ']' : out;
  }
  const report = all => 'WRE supplier scout 1.0, ' + new Date().toString().slice(0, 21) + ', ' + (/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : 'PC') + '\n' + (all ? ['CNW', 'Tradezone', 'AroFlo'] : [SITE]).map(siteReport).join('');

  function copy(text, btn) {
    const done = ok => { btn.textContent = ok ? 'Copied ' + Math.round(text.length / 1000) + 'k, paste it to Claude' : 'Copy failed, try again'; setTimeout(() => paint(), 4000); };
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'; document.body.appendChild(t); t.focus(); t.select(); t.setSelectionRange(0, text.length); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove(); done(ok); };
    try { if (navigator.clipboard && W.isSecureContext !== false) navigator.clipboard.writeText(text).then(() => done(true), fallback); else fallback(); } catch (e) { fallback(); }
  }

  // ---------- the little panel ----------
  const TIPS = {
    CNW: 'Search a couple of things (e.g. rcbo, then 2.5mm twin and earth), open one product, then tap Grab this page on each.',
    Tradezone: 'Same as CNW: search a couple of things, open one product, tap Grab this page on each.',
    AroFlo: 'Open a quote, go to its line items, tap Add Line Item once (no need to save), then tap Grab this page.'
  };
  let box, btn, open = false;
  function paint() {
    if (!btn) return;
    btn.textContent = 'Scout ' + store.req.length + '/' + store.pages.length;
    if (!open || !box) return;
    const others = ['CNW', 'Tradezone', 'AroFlo'].filter(n => n != SITE).map(n => { const s = GM_getValue('scout_' + n, null); return n + ' ' + (s ? s.req.length + ' req, ' + s.pages.length + ' pages' : 'nothing yet'); }).join(' · ');
    box.querySelector('.st').textContent = SITE + ': ' + store.req.length + ' requests, ' + store.pages.length + ' pages grabbed. ' + others;
  }
  function ui() {
    if (document.getElementById('wre-scout')) return;
    const wrap = document.createElement('div'); wrap.id = 'wre-scout';
    wrap.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;font:14px -apple-system,Segoe UI,sans-serif;color:#222';
    btn = document.createElement('button');
    btn.style.cssText = 'background:#e8731a;color:#fff;border:0;border-radius:18px;padding:8px 12px;font:600 13px inherit;box-shadow:0 2px 6px #0004';
    box = document.createElement('div');
    box.style.cssText = 'display:none;background:#fff;border:1px solid #ccc;border-radius:10px;padding:10px;margin-bottom:6px;width:min(300px,86vw);box-shadow:0 4px 14px #0003';
    box.innerHTML = '';
    const tip = document.createElement('div'); tip.textContent = TIPS[SITE]; tip.style.cssText = 'margin-bottom:8px;line-height:1.35';
    const st = document.createElement('div'); st.className = 'st'; st.style.cssText = 'font-size:12px;color:#666;margin-bottom:8px';
    const mk = (t, f, bg) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'display:block;width:100%;margin:4px 0;padding:9px;border:0;border-radius:8px;font:600 14px inherit;color:#fff;background:' + (bg || '#4a4541'); b.onclick = e => { e.preventDefault(); f(b); }; return b; };
    box.append(tip, st,
      mk('Grab this page', b => { snapshot(true); b.textContent = 'Grabbed'; setTimeout(() => { b.textContent = 'Grab this page'; }, 1500); }, '#e8731a'),
      mk('Copy report (all 3 sites)', b => { save(); copy(report(true), b); }),
      mk('Copy this site only', b => { save(); copy(report(false), b); }),
      mk('Clear this site', b => { store = { req: [], pages: [] }; dirty = true; save(); paint(); b.textContent = 'Cleared'; setTimeout(() => { b.textContent = 'Clear this site'; }, 1500); }, '#999'));
    btn.onclick = () => { open = !open; box.style.display = open ? 'block' : 'none'; paint(); };
    wrap.append(box, btn); document.body.appendChild(wrap); paint();
  }

  const ready = () => {
    // on AroFlo only show up on quote pages
    if (SITE == 'AroFlo' && !/quote/i.test(location.href + ' ' + document.title)) return;
    ui();
    setTimeout(() => snapshot(false), 4000);   // a quiet grab once the page settles
  };
  if (document.readyState == 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
})();
