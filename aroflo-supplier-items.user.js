// ==UserScript==
// @name         AroFlo supplier items
// @namespace    wre
// @version      0.24
// @description  Supplier button on AroFlo quotes: search CNW and Tradezone with your own sign ins, pick an item, set the qty and it adds the line (item, part no, qty, cost in Value). Markup left alone, you press Save Quote. Order puts the quote's parts in your CNW or Tradezone cart (never checks out). Reprice, price compare, favourites, recents, stock at nearby branches and price history, synced through Todoist.
// @match        https://office.aroflo.com/ims/Site/Service/Quotes/*
// @match        https://shop.cnw.com.au/*
// @match        https://www.tradezone.com.au/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      shop.cnw.com.au
// @connect      www.tradezone.com.au
// @connect      api.todoist.com
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-supplier-items.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-supplier-items.user.js
// ==/UserScript==

// Built from src/aroflo-supplier-items.js by build.py. Change src/aroflo-supplier-items.js, not this file.
(function () {
  // Live updates (23/10): Tampermonkey only checks for a new version every few hours. This checks the repo's latest commit every
  // 2 min (free when nothing's changed) and keeps the newest code here, so a push runs on the next page load. If the new code needs
  // a permission this install hasn't got, or this browser won't run it, the built in copy below runs like before.
  const __wreName = "aroflo-supplier-items", __wreVer = "0.24", __wreHave = new Set(["// @connect api.github.com", "// @connect api.todoist.com", "// @connect raw.githubusercontent.com", "// @connect shop.cnw.com.au", "// @connect www.tradezone.com.au", "// @grant GM_getValue", "// @grant GM_setValue", "// @grant GM_xmlhttpRequest", "// @grant unsafeWindow", "// @match https://office.aroflo.com/ims/Site/Service/Quotes/*", "// @match https://shop.cnw.com.au/*", "// @match https://www.tradezone.com.au/*", "// @run-at document-idle"]);
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
  // ---------- the built in copy (src/aroflo-supplier-items.js at 0.24) ----------

(function () {
  'use strict';

  // How it works (from the supplier scout, 4/11):
  // CNW: the search page lists product cards (code, name, unit, and a number per product), then the page asks
  //   /search/product/<numbers>?stock_location=<store> for the signed in price ex GST and stock. We do the same two calls.
  // Tradezone: the search page lists .product_item cards with the part no, name and the signed in ex GST price.
  // AroFlo: each line has Item, Part No, Qty and Value columns. We press the quote's own Add Line Item, fill the new line
  //   the same way you would by hand and read it back. Nothing gets saved: you check it and press Save Quote.
  // Both suppliers are read with your own sign in on this device. If a price comes back 0 or missing you're signed out.

  const W = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
  const ORANGE = '#e8731a', GREY = '#4a4541';
  const CNW = 'https://shop.cnw.com.au', TZ = 'https://www.tradezone.com.au';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const money = n => (n == null || isNaN(n)) ? '' : '$' + Number(n).toFixed(2);
  const esc = s => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const debug = {};   // last raw bits per supplier, for Copy debug
  // where to sign back in. Sign in on the window opens the supplier's sign in page in a new tab. If you've saved
  // that supplier's login under Logins (kept in this device's Tampermonkey only, never in the repo), it fills it and
  // signs in, otherwise you tap your saved password. Once in, the tab closes itself and the window searches again.
  const LOGIN = { CNW: CNW + '/login', Tradezone: TZ + '/customer/account/login/' };
  const out_ = (sup) => { const e = new Error('Signed out of ' + sup); e.signedOut = sup; return e; };
  const signedIn = t => /logout|log out|sign out|signout/i.test(t || '');
  // CNW marks every page it sends with logged-in or logged-out on the body. Signed out, it shows the products but no prices
  // and no cart buttons (where the product number lives), which is why everything came back without a price.
  const cnwOut = t => /<body[^>]*class="[^"]*\blogged-out\b/i.test(t || '');

  // ---------- on the supplier's own site: finish a sign in the window asked for ----------
  if (/cnw\.com\.au|tradezone\.com\.au/.test(location.hostname)) { supplierLogin(); return; }
  function supplierLogin() {
    const sup = /cnw/.test(location.hostname) ? 'CNW' : 'Tradezone';
    const req = GM_getValue('loginReq', null);
    if (!req || req.sup != sup || Date.now() - req.at > 10 * 60e3) return;   // only when the window sent you here
    const pwBox = () => [...document.querySelectorAll('input[type=password]')].find(x => x.offsetParent);
    const loggedIn = () => !pwBox() && (sup == 'CNW' ? document.body && !document.body.classList.contains('logged-out') : /log ?out|sign ?out/i.test((document.body && document.body.innerText || '').slice(0, 20000)));
    let bar;
    const say = t => { if (!bar) { bar = document.createElement('div'); bar.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#4a4541;color:#fff;border-left:5px solid #e8731a;border-radius:10px;padding:12px 14px;font:600 15px -apple-system,Segoe UI,sans-serif;box-shadow:0 4px 14px #0005'; document.body.appendChild(bar); } bar.textContent = 'WRE: ' + t; };
    let finished = false, waited = 0;
    const done = () => {
      if (finished) return; finished = true;
      GM_setValue('loginDone', { sup, at: Date.now() }); GM_setValue('loginReq', null);
      say('Signed in to ' + sup + '. Closing this tab…');
      setTimeout(() => { try { (typeof unsafeWindow != 'undefined' ? unsafeWindow : window).close(); } catch (e) {} try { window.close(); } catch (e) {} setTimeout(() => say('Signed in to ' + sup + '. The iPhone won\'t let this tab close itself, so close it and go back to AroFlo. It\'s already searching again.'), 800); }, 600);
    };
    const setv = (el, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); ['input', 'change', 'keyup'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true }))); };
    const go = () => {
      if (loggedIn()) return done();
      const pw = pwBox();
      const onLogin = /\/login\b|customer\/account\/login/.test(location.pathname);
      if (!pw && !onLogin) { location.href = LOGIN[sup]; return; }
      if (!pw) { waited += 1; if (waited < 15) return setTimeout(go, 700); say('Couldn\'t find the sign in boxes on this page. Sign in here yourself, this tab closes itself once you\'re in.'); return; }
      const cred = GM_getValue('cred_' + sup, null), tries = req.tries || 0;
      if (cred && cred.u && cred.p && !tries) {
        req.tries = 1; GM_setValue('loginReq', req);   // one go only, so a wrong password can't lock you out
        const f = pw.form || document;
        const user = [...f.querySelectorAll('input')].find(i => i != pw && i.offsetParent && /^(email|text)$/i.test(i.type));
        if (!user) { say('Couldn\'t find the email box. Sign in here yourself, this tab closes itself once you\'re in.'); return; }
        setv(user, cred.u); setv(pw, cred.p);
        const rem = [...f.querySelectorAll('input[type=checkbox]')].find(c => /remember|keep|stay/i.test((c.name || '') + (c.id || '') + ((c.closest('label') || {}).textContent || '')));
        if (rem && !rem.checked) rem.click();
        say('Signing in to ' + sup + '…');
        setTimeout(() => { const b = f.querySelector('button[type=submit],input[type=submit],button:not([type])'); if (b) b.click(); else if (f.requestSubmit) f.requestSubmit(); else f.submit(); }, 400);
      } else if (cred && tries) say('The saved login didn\'t get you in. Sign in here yourself and check it under Logins on the AroFlo window. This tab closes itself once you\'re in.');
      else say('Tap your saved password, then sign in. This tab closes itself once you\'re in.');
    };
    const start = () => { say('Getting ' + sup + ' signed in…'); go(); const iv = setInterval(() => { if (finished) return clearInterval(iv); if (loggedIn()) { clearInterval(iv); done(); } }, 1000); setTimeout(() => clearInterval(iv), 5 * 60e3); };
    if (document.readyState == 'complete') setTimeout(start, 500); else addEventListener('load', () => setTimeout(start, 500));
  }

  // ---------- requests with your sign in ----------
  function get(url, json) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 25000,
        headers: json ? { Accept: 'application/json, text/javascript, */*', 'X-Requested-With': 'XMLHttpRequest' } : { Accept: 'text/html' },
        onload: r => resolve(r),
        onerror: () => reject(new Error('couldn\'t reach ' + new URL(url).host)),
        ontimeout: () => reject(new Error(new URL(url).host + ' took too long')),
      });
    });
  }
  const html = t => new DOMParser().parseFromString(t || '', 'text/html');
  function post(url, data, json) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST', url, data, timeout: 25000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Accept: json ? 'application/json, text/javascript, */*' : 'text/html, */*' },
        onload: r => resolve(r),
        onerror: () => reject(new Error('couldn\'t reach ' + new URL(url).host)),
        ontimeout: () => reject(new Error(new URL(url).host + ' took too long')),
      });
    });
  }
  const form = o => Object.keys(o).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
  // minimum order and sold-in-lots-of. Tradezone puts the step on the cart box (data-step) and spells some out in words.
  // CNW doesn't seem to use them, but the qty box and the words get checked the same way in case.
  function minStep(el) {
    if (!el) return {};
    const num = v => { const n = Number(v); return n > 1 ? n : 0; };
    let step = 0, min = 0;
    el.querySelectorAll('[data-step],[data-qty-increment],[data-increment]').forEach(x => { step = step || num(x.getAttribute('data-step') || x.getAttribute('data-qty-increment') || x.getAttribute('data-increment')); });
    el.querySelectorAll('[data-min],[data-min-qty],[data-minqty],[data-min-sale-qty]').forEach(x => { min = min || num(x.getAttribute('data-min') || x.getAttribute('data-min-qty') || x.getAttribute('data-minqty') || x.getAttribute('data-min-sale-qty')); });
    el.querySelectorAll('input[type=number],input.qty,input[name=qty]').forEach(x => { min = min || num(x.getAttribute('min')); step = step || num(x.getAttribute('step')); });
    const t = clean((el.querySelector('.purchase-increments,.increments_wrapper,.qtyBox,.min-qty,.minimum') || {}).textContent) + ' ' + clean(el.textContent).slice(0, 3000);
    const mm = t.match(/min(?:imum)?\.?\s*(?:order|purchase)?\s*(?:qty|quantity)?\s*(?:of|is|:)?\s*(\d+)/i); if (mm) min = min || num(mm[1]);
    const ss = t.match(/(?:sold|order(?:ed)?|purchase[ds]?|buy)\s+in\s+(?:multiples|lots|increments|packs)?\s*(?:of\s+)?(\d+)s?\b/i) || t.match(/(?:multiples|increments)\s+of\s+(\d+)/i); if (ss) step = step || num(ss[1]);
    return { min: min || step || 0, step: step || 0 };
  }
  // the qty you'd actually have to order: at least the minimum, rounded up to the step
  const fitQty = (q, it) => { q = Math.ceil(Number(q) - 1e-9) || 1; if (it.min && q < it.min) q = it.min; if (it.step && q % it.step) q = Math.ceil(q / it.step) * it.step; return q; };
  const lotText = it => it.step ? 'sold in ' + it.step + 's' : it.min ? 'min ' + it.min : '';
  // parts added through the window, so Order knows which supplier and product each Part No is
  const partMap = () => GM_getValue('partMap', {});
  const remember = it => { const m = partMap(); m[String(it.code).toUpperCase()] = { sup: it.sup, full: it.full || '', id: it.id || '', name: it.name, href: it.href || '', min: it.min || 0, step: it.step || 0, at: Date.now() }; const k = Object.keys(m); if (k.length > 600) k.sort((a, b) => m[a].at - m[b].at).slice(0, k.length - 600).forEach(x => delete m[x]); GM_setValue('partMap', m); };
  // a product photo's address (lazy loaded pages keep it in data-src)
  // prefers the real product photo, never the range or brand badges stuck on the corner
  const imgOf = (el, base, prefer) => { if (!el) return ''; const badge = x => x.closest('[class*=Icons],[class*=icon],[class*=badge],[class*=Badge],[class*=brand],[class*=logo],[class*=label]'); const i = (prefer && el.querySelector(prefer)) || [...el.querySelectorAll('img')].find(x => !badge(x)); if (!i) return ''; const cands = ['data-src', 'data-original', 'data-lazy', 'data-lazy-src', 'data-srcset', 'srcset', 'src'].map(a => (i.getAttribute(a) || '').split(',')[0].trim().split(' ')[0]); const u = cands.find(x => x && !/^data:|placeholder|loading|blank|spacer|\.gif$/i.test(x)) || ''; if (!u) return ''; try { return new URL(u, base).href; } catch (e) { return ''; } };

  // ---------- branches ----------
  // CNW: their store list gives each branch's number, and the price call takes it as stock_location. Default Oxenford.
  // Tradezone: each product page lists stock per branch. Default Gold Coast. Names seen get kept for the picker.
  const cnwBranch = () => GM_getValue('cnwBranch', 'Oxenford');
  const tzBranch = () => GM_getValue('tzBranch', 'Gold Coast');
  const short_ = n => clean(n).replace(/^CNW\s+/i, '');
  async function cnwStores() {
    const c = GM_getValue('cnwStores2', null);
    if (c && c.list && c.list.length && Date.now() - c.at < 7 * 864e5) return c.list;
    try {
      const r = await get(CNW + '/store-finder/storedata', true);
      const list = (JSON.parse(r.responseText).features || []).filter(f => f && f.properties && f.properties.storeId).map(f => { const p = f.properties, g = (f.geometry || {}).coordinates || []; return { id: String(p.storeId), name: short_(p.storeName || p.town), state: p.stateCode || '', lat: g.length > 1 ? Number(g[1]) : null, lon: g.length > 1 ? Number(g[0]) : null }; }).sort((a, b) => a.name.localeCompare(b.name));
      if (list.length) GM_setValue('cnwStores2', { at: Date.now(), list });
      return list;
    } catch (e) { return c && c.list || []; }
  }
  async function cnwLoc() {
    const want = cnwBranch().toLowerCase(), list = await cnwStores();
    const hit = list.find(s => s.name.toLowerCase() == want) || list.find(s => s.name.toLowerCase().includes(want));
    return hit ? hit.id : '119';
  }
  const tzSeen = names => { const have = new Set(GM_getValue('tzBranches', ['Gold Coast'])); names.forEach(n => n && have.add(n)); GM_setValue('tzBranches', [...have].sort()); };
  async function pool(list, n, fn) { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const x = list[i++]; try { await fn(x); } catch (e) {} } })); }

  // ---------- CNW ----------
  // CNW's own product number (what the price call wants). Search pages put it on the cart button, category and
  // product pages put it in other spots, so look everywhere it's been seen
  const cnwNum = el => {
    if (!el) return '';
    const h = el.outerHTML || '';
    const m = h.match(/id="(\d{2,9})-(?:addToCartButton|eligibleForAddToCart)"/) || h.match(/<span[^>]*\bid="(\d{2,9})"[^>]*class="[^"]*price/) || h.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*\bid="(\d{2,9})"/) || h.match(/data-(?:product-?)?(?:pk|id|number|num)="(\d{2,9})"/i) || h.match(/\bid="(\d{2,9})"/);
    return m ? m[1] : '';
  };
  // product cards on a CNW search or category page
  function cnwCards(doc) {
    const items = [], seen = new Set();
    doc.querySelectorAll('.scaffoldProductSearchItem').forEach(c => {
      if (c.closest('.productCarousel')) return;                 // skip "you might like" sliders
      const a = c.querySelector('a.product-title');
      const full = (c.querySelector('[data-product-code]') || { getAttribute: () => '' }).getAttribute('data-product-code') || '';
      const id = cnwNum(c);
      const code = clean((c.querySelector('a.product-code') || {}).textContent).replace(/^Code:\s*/i, '') || full || c.getAttribute('productId') || '';
      const key = id || full || code; if (!key || seen.has(key)) return; seen.add(key);
      if (!debug.cnwCard) debug.cnwCard = (c.outerHTML || '').replace(/\s+/g, ' ').slice(0, 3500);
      items.push({ sup: 'CNW', id, code, full, name: clean(a && (a.getAttribute('data-short-name') || a.getAttribute('title') || a.textContent)), uom: clean((c.querySelector('.priceUOM span') || {}).textContent), href: a ? CNW + a.getAttribute('href') : '', img: imgOf(c, CNW, 'img.product-thumb'), ...minStep(c) });
    });
    return items;
  }
  // one CNW product page: its number for the price call, code, unit and photo
  function cnwProduct(doc, url) {
    if (!doc.querySelector('.scaffoldProductDisplayData')) return null;
    const p = doc.querySelector('.supplierCost span.price[id], span.price[id]');
    const id = (p && /^\d+$/.test(p.id) ? p.id : '') || cnwNum(doc.querySelector('.scaffoldProductDisplayWrapper') || doc.body);
    if (!id && !debug.cnwPage) debug.cnwPage = ((doc.querySelector('.scaffoldProductDisplayWrapper') || doc.body || {}).outerHTML || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\s+/g, ' ').slice(0, 3500);
    return { sup: 'CNW', id, full: decodeURIComponent(((url || '').match(/\/p\/([^/?#]+)/) || [])[1] || ''), code: clean((doc.querySelector('.scaffoldProductDisplayDataCode .product-code') || {}).textContent).replace(/^Code:\s*/i, ''), name: clean((doc.querySelector('h1') || {}).textContent), uom: clean((doc.querySelector('.scaffoldUnitOfMesureCode') || {}).textContent), href: url || '', img: (doc.querySelector('meta[property="og:image"]') || { getAttribute: () => '' }).getAttribute('content') || imgOf(doc.querySelector('.scaffoldProductDisplayWrapper'), CNW) };
  }
  // page is 0 for the first page. Later pages reuse the address the first page landed on (search or category).
  async function searchCnw(term, page = 0, base = '') {
    // 1. the normal search. Some words (like GPO) jump to a category page instead, which loads its products later
    let url = CNW + '/search?text=' + encodeURIComponent(term);
    if (page > 0) { const u = new URL(base || url); if (/\/c\//.test(u.pathname) && !u.searchParams.get('q')) u.searchParams.set('q', ':relevance'); u.searchParams.set('page', page); url = u.href; }
    let r = await get(url);
    let t = r.responseText || '';
    debug.CNW = { term, tried: [], url: r.finalUrl || '', status: r.status, sample: '' }; delete debug.cnwCard; delete debug.cnwPage;
    if (/\/login\b/.test(r.finalUrl || '') || cnwOut(t)) throw out_('CNW');
    let doc = html(t);
    const loc = await cnwLoc();
    let items = cnwCards(doc);
    debug.CNW.tried.push('search ' + items.length);
    if (!items.length && !page) { const one = cnwProduct(doc, r.finalUrl); if (one) items.push(one); }
    const more = d => !!d.querySelector('a[rel="next"], li.pagination-next:not(.disabled) a, .pagination-next:not(.disabled) a, a.pagination-next');
    let next = more(doc), landed = r.finalUrl || url;
    // 2. the same search without the jump
    if (!items.length && !page) {
      const r2 = await get(CNW + '/search?q=' + encodeURIComponent(term + ':relevance'));
      const d2 = html(r2.responseText); items = cnwCards(d2);
      debug.CNW.tried.push('q ' + items.length + ' ' + (r2.finalUrl || '').replace(CNW, '').slice(0, 80));
      if (items.length) { t = r2.responseText; doc = d2; next = more(d2); landed = r2.finalUrl || landed; }
    }
    // 3. the search box's own suggestions, then each product's page for its number and photo
    if (!items.length && !page) {
      const a = await get(CNW + '/search/autocomplete/SearchBox?term=' + encodeURIComponent(term), true);
      let prods = []; try { prods = JSON.parse(a.responseText).products || []; } catch (e) {}
      debug.CNW.tried.push('suggest ' + prods.length);
      const got = [];
      await pool(prods.slice(0, 8), 4, async pr => { if (!pr.url) return; const u = CNW + pr.url; const pg = await get(u); const one = cnwProduct(html(pg.responseText), u); if (one) { one.full = one.full || pr.code; one.name = one.name || clean(pr.name); got.push(one); } });
      items = prods.map(pr => got.find(g => g.full == pr.code)).filter(Boolean);
    }
    if (!items.length) {
      const i = t.indexOf('scaffoldProductSearch');
      debug.CNW.sample = (i < 0 ? '(no product cards in the page) ' : '') + t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').slice(Math.max(0, i - 200), Math.max(0, i - 200) + 6000);
      return [];
    }
    items.page = page; items.base = page ? (base || landed) : landed; items.next = next || items.length >= 20;
    const ids = [...new Set(items.map(i => i.id).filter(Boolean))];
    if (ids.length) {
      const pr = await get(CNW + '/search/product/' + ids.join(',') + '?stock_location=' + loc, true);
      let list = []; try { list = JSON.parse(pr.responseText); } catch (e) { debug.CNW.prices = (pr.responseText || '').slice(0, 1500); }
      const by = {}; (Array.isArray(list) ? list : []).forEach(p => { by[String(p.code)] = p; });
      items.forEach(i => { const p = by[i.id]; if (p) { i.price = Number(p.price); i.branch = p.stockLevel; i.national = p.warehouseStockLevel; i.status = p.stockStatus; } });
    }
    items.forEach(i => { if (!i.id) i.note = 'couldn\'t get CNW\'s price for this one, tap view'; });
    if (items.every(i => !i.price) && items.some(i => i.id)) { if (!signedIn(t)) throw out_('CNW'); items.forEach(i => { i.note = i.note || 'no price from CNW for this one'; }); }
    return items;
  }

  // ---------- Tradezone ----------
  // page is 1 for the first page. Later pages reuse the address the first page landed on (search or category).
  async function searchTz(term, opts, page = 1, base = '') {
    const tries = page > 1 ? [null] : ['/catalogsearch/result/?q=', '/search?q='];
    let t = '', r = null;
    for (const p of tries) {
      let url = TZ + p + encodeURIComponent(term);
      if (page > 1) { const u = new URL(base); u.searchParams.set('p', page); url = u.href; }
      r = await get(url);
      t = r.responseText || '';
      if (r.status == 200 && /product_item/.test(t)) break;
    }
    debug.Tradezone = { url: r && r.finalUrl || '', status: r && r.status, sample: '' };
    if (/customer\/account\/login/.test(r && r.finalUrl || '')) throw out_('Tradezone');
    const doc = html(t);
    const items = [], seen = new Set();
    doc.querySelectorAll('.product_item[data-product-id]').forEach(c => {
      if (c.closest('.itemslider-wrapper, .owl-wrapper')) return;  // skip sliders
      const id = c.getAttribute('data-product-id'); if (seen.has(id)) return; seen.add(id);
      // the name lives on the title link; the photo link comes first in the card and often has no text
      const a = c.querySelector('.name a') || c.querySelector('a.hover_link') || c.querySelector('a.product-image');
      const txt = clean(c.textContent);
      const m = txt.match(/\$\s*([\d,]+\.\d{2})\s*ex/i);
      const st = c.querySelector('.stock_wrapper');
      items.push({ sup: 'Tradezone', id, code: clean((c.querySelector('h6.part') || {}).textContent), sku: (c.querySelector('h5.sku input') || {}).value || '', name: clean(a && (a.getAttribute('title') || a.textContent)) || clean(((c.querySelector('a.product-image') || {}).getAttribute || (() => ''))('title')) || clean((c.querySelector('img[alt]') || { getAttribute: () => '' }).getAttribute('alt')), href: a ? new URL(a.getAttribute('href'), TZ).href : '', price: m ? Number(m[1].replace(/,/g, '')) : null, stock: st ? clean(st.textContent) || (/in_stock/.test(st.className) ? 'In stock' : '') : '', img: imgOf(c, TZ, 'a.product-image img'), ...minStep(c) });
    });
    if (!items.length) debug.Tradezone.sample = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').slice(0, 8000);
    if (items.length && items.every(i => !i.price)) { if (!signedIn(t)) throw out_('Tradezone'); items.forEach(i => { i.note = 'no price from Tradezone for this one'; }); }
    if (!items.length && !signedIn(t)) throw out_('Tradezone');
    const top = items;
    top.page = page; top.base = page > 1 ? base : (r && r.finalUrl) || '';
    top.next = !!doc.querySelector('a.next, a.action.next, .pages-item-next a, a[rel="next"], .pager .next a, .pages a.i-next') || items.length >= 20;
    // each product page has stock per branch, the main photo and the price (first 8 here, the rest on a tap)
    await pool(opts && opts.pick ? opts.pick(top) : top.slice(0, 8), 4, it => tzDetail(it));
    return top;
  }

  // one Tradezone product page: stock per branch, photo, lot size and price (force takes the page's price over the card's)
  async function tzDetail(it, force) {
    if (!it.href) return;
    const pr = await get(it.href); const d = html(pr.responseText);
    it.branches = [...d.querySelectorAll('label.selector_row, .selector_rows .selector_row')].map(row => {
      const qEl = row.querySelector('.qty'); const qt = clean(qEl && qEl.textContent);
      const whole = clean((row.querySelector('.location_and_qty') || row).textContent);
      let name = clean(whole.replace(qt, '').replace(/add to cart/i, ''));
      if (!name) name = clean(whole.split(/\d/)[0]);
      const n = (qt.match(/\d[\d,]*/) || ['0'])[0];
      return { name, qty: Number(n.replace(/,/g, '')) };
    }).filter(b => b.name);
    if (it.branches.length) tzSeen(it.branches.map(b => b.name));
    if (!it.name) it.name = clean((d.querySelector('h1') || {}).textContent) || clean((d.querySelector('meta[property="og:title"]') || { getAttribute: () => '' }).getAttribute('content'));
    if (!it.img) { const og = d.querySelector('meta[property="og:image"]'); it.img = og ? og.getAttribute('content') : imgOf(d.querySelector('.product_media') || d.body, TZ); }
    if (!it.min && !it.step) Object.assign(it, minStep(d.querySelector('.product_wrapper, .product_view') || d.body));
    if (!it.price || force) { const m = clean((d.querySelector('.price_and_points') || {}).textContent).match(/\$\s*([\d,]+\.\d{2})\s*ex/i); if (m) { it.price = Number(m[1].replace(/,/g, '')); delete it.note; } }
    const want = tzBranch().toLowerCase();
    if (it.branches.length) { const b = it.branches.find(x => x.name.toLowerCase() == want) || it.branches.find(x => x.name.toLowerCase().includes(want)); it.branch = b ? b.qty : 0; it.bname = tzBranch(); }
  }

  // ---------- favourites, recents, price history and dropped matches (synced through Todoist) ----------
  // Kept in this device's Tampermonkey and, with a Todoist token saved under Logins, merged into the comments of the
  // "* Supplier items data" task in WRE job tracker > Inbox filer settings, so the phone and the PC match.
  const DAY = 864e5, today = () => Math.floor(Date.now() / DAY);
  const dmy = d => { const x = new Date(d * DAY); return x.getUTCDate() + '/' + (x.getUTCMonth() + 1); };
  const keyOf = it => (it.sup == 'CNW' ? 'C' : 'T') + ':' + String(it.code || it.part || '').toUpperCase();
  const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const slim = it => ({ sup: it.sup, code: it.code || it.part || '', full: it.full || '', id: it.id || '', name: it.name || it.item || '', uom: it.uom || '', href: it.href || '', img: it.img || '', min: it.min || 0, step: it.step || 0 });
  const blank = () => ({ fav: {}, rec: [], hist: {}, drop: {} });
  let D = Object.assign(blank(), GM_getValue('supData', {}));
  const saveLocal = () => GM_setValue('supData', D);
  const DATA_TASK = '6hw9M8p3qGw5WFhX', TDA = 'https://api.todoist.com/api/v1/';
  const tdToken = () => GM_getValue('todoistToken', '');
  const td = (method, path, body) => new Promise((res, rej) => GM_xmlhttpRequest({
    method, url: TDA + path, timeout: 20000,
    headers: { Authorization: 'Bearer ' + tdToken(), 'Content-Type': 'application/json' },
    data: body ? JSON.stringify(body) : undefined,
    onload: r => { if (r.status === 401 || r.status === 403) return rej(new Error('Todoist token not accepted')); if (r.status < 200 || r.status >= 300) return rej(new Error('Todoist said ' + r.status)); try { res(r.responseText ? JSON.parse(r.responseText) : null); } catch (e) { res(null); } },
    onerror: () => rej(new Error('couldn\'t reach Todoist')), ontimeout: () => rej(new Error('Todoist timed out')),
  }));
  function mergeData(a, b) {
    const o = blank(), later = (x, y) => !x ? y : !y ? x : ((y.at || 0) > (x.at || 0) ? y : x), keys = (p, q) => new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
    for (const k of keys(a.fav, b.fav)) { const v = later((a.fav || {})[k], (b.fav || {})[k]); if (v && !(v.del && Date.now() - v.at > 90 * DAY)) o.fav[k] = v; }
    const seen = new Set();
    o.rec = [...(a.rec || []), ...(b.rec || [])].filter(r => r && r.it).sort((p, q) => q.at - p.at).filter(r => { const k = keyOf(r.it); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
    const cut = today() - 365;
    for (const k of keys(a.hist, b.hist)) { const m = new Map(); [...((b.hist || {})[k] || []), ...((a.hist || {})[k] || [])].forEach(e => m.set(e[0], e)); const arr = [...m.values()].filter(e => e[0] >= cut).sort((p, q) => p[0] - q[0]).slice(-12); if (arr.length) o.hist[k] = arr; }
    for (const k of keys(a.drop, b.drop)) o.drop[k] = later((a.drop || {})[k], (b.drop || {})[k]);
    return o;
  }
  let syncIds = [], syncLast = '', syncMsg = '', pulled = false;
  async function pull() {
    if (!tdToken()) return false;
    const r = await td('GET', 'comments?task_id=' + DATA_TASK + '&limit=100');
    const cs = (r && r.results) || (Array.isArray(r) ? r : []);
    const parts = cs.map(c => { const m = String(c.content || '').match(/^SUPDATA (\d+)\/(\d+)\n([\s\S]*)$/); return m ? { i: +m[1], t: m[3], id: c.id } : null; }).filter(Boolean).sort((x, y) => x.i - y.i);
    syncIds = parts.map(p => p.id);
    if (parts.length) { try { D = mergeData(D, JSON.parse(parts.map(p => p.t).join(''))); saveLocal(); } catch (e) { syncMsg = 'the synced data couldn\'t be read, it\'ll be written fresh'; } }
    pulled = true; return true;
  }
  async function push() {
    if (!tdToken()) return;
    await pull();
    const s = JSON.stringify(D); if (s == syncLast) return;
    const CH = 12000, chunks = []; for (let i = 0; i < s.length; i += CH) chunks.push(s.slice(i, i + CH));
    for (let i = 0; i < chunks.length; i++) {
      const content = 'SUPDATA ' + (i + 1) + '/' + chunks.length + '\n' + chunks[i];
      if (syncIds[i]) await td('POST', 'comments/' + syncIds[i], { content }); else { const c = await td('POST', 'comments', { task_id: DATA_TASK, content }); syncIds[i] = c && c.id; }
    }
    for (let i = chunks.length; i < syncIds.length; i++) { try { await td('DELETE', 'comments/' + syncIds[i]); } catch (e) {} }
    syncIds = syncIds.slice(0, chunks.length); syncLast = s;
    syncMsg = 'Synced ' + new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }
  let pushT = null;
  // leaving the page with a change still waiting: send it now
  addEventListener('pagehide', () => { if (pushT) { clearTimeout(pushT); pushT = null; push().catch(() => {}); } });
  const changed = () => { saveLocal(); clearTimeout(pushT); pushT = setTimeout(() => push().catch(e => { syncMsg = 'Sync didn\'t go through: ' + (e.message || e); }), 4000); };
  const favOn = it => { const f = D.fav[keyOf(it)]; return !!(f && !f.del); };
  const toggleFav = it => { const k = keyOf(it); D.fav[k] = favOn(it) ? { del: true, at: Date.now() } : { it: slim(it), at: Date.now() }; changed(); };
  const addRecent = it => { const k = keyOf(it); D.rec = [{ it: slim(it), at: Date.now() }, ...D.rec.filter(r => keyOf(r.it) != k)].slice(0, 10); changed(); };
  const histOf = it => D.hist[typeof it == 'string' ? it : keyOf(it)] || [];
  function recordPrice(it, price) {
    if (!price) return; const k = keyOf(it), d = today(); const arr = (D.hist[k] || []).filter(e => e[0] >= d - 365);
    const last = arr[arr.length - 1]; if (last && last[0] == d) last[1] = price; else arr.push([d, price]);
    D.hist[k] = arr.slice(-12); changed();
  }
  // ---------- same item at the other supplier ----------
  // Codes cleaned first (case, spaces, dashes, slashes, dots). Then a straight match, or one code being the end of the
  // other with only a short run of letters in front (a brand bit like CLI). The longest match wins, and it always shows
  // as "Same item?" with both names, with an X to drop it (remembered and synced).
  function codeMatch(a, b) {
    const x = normCode(a), y = normCode(b); if (!x || !y) return 0; if (x == y) return 100;
    const [s, l] = x.length <= y.length ? [x, y] : [y, x];
    return s.length >= 5 && l.endsWith(s) && /^[A-Z]{1,4}$/.test(l.slice(0, l.length - s.length)) ? 50 + s.length : 0;
  }
  const pk = (a, b) => [keyOf(a), keyOf(b)].sort().join('|');
  const dropped = (a, b) => { const d = D.drop[pk(a, b)]; return !!(d && !d.del); };
  const slimO = x => Object.assign(slim(x), { price: x.price || 0, branch: x.branch, national: x.national, branches: x.branches, bname: x.bname });
  function bestMatch(it, list) { let best = null, bs = 0; (list || []).forEach(x => { if (x.sup == it.sup || dropped(it, x)) return; const s = codeMatch(it.code || it.part, x.code); if (s > bs) { bs = s; best = x; } }); return best; }
  function pairUp(A, B) { A.forEach(a => { const b = bestMatch(a, B); if (b) a.other = slimO(b); }); B.forEach(b => { const a = bestMatch(b, A); if (a) b.other = slimO(a); }); }
  // look the item up at the other supplier by its code (and the code with the brand letters dropped)
  async function findOther(it) {
    const os = it.sup == 'CNW' ? 'Tradezone' : 'CNW', c = it.code || it.part || '';
    const terms = [...new Set([c, c.replace(/^[A-Za-z]{2,4}(?=[A-Za-z]?\d)/, '')].filter(t => normCode(t).length >= 4))];
    for (const t of terms) {
      let l = [];
      try { l = os == 'CNW' ? await searchCnw(t) : await searchTz(t, { pick: top => { const b = bestMatch(it, top); return b ? [b] : []; } }); } catch (e) { return null; }
      const b = bestMatch(it, l); if (b) return slimO(b);
    }
    return null;
  }
  // ---------- stock at the nearest branches ----------
  const dist = (a, b) => { const k = Math.cos((a[0] + b[0]) / 2 * Math.PI / 180); return Math.hypot(a[0] - b[0], (a[1] - b[1]) * k); };
  // Tradezone only gives branch names, so their towns are looked up here
  const TZ_PLACES = { 'gold coast': [-27.98, 153.38], molendinar: [-27.97, 153.36], southport: [-27.97, 153.4], nerang: [-28.0, 153.33], burleigh: [-28.09, 153.43], 'varsity': [-28.08, 153.41], currumbin: [-28.15, 153.47], coomera: [-27.86, 153.32], yatala: [-27.74, 153.22], beenleigh: [-27.71, 153.2], logan: [-27.64, 153.11], 'slacks creek': [-27.64, 153.13], springwood: [-27.61, 153.13], capalaba: [-27.53, 153.2], cleveland: [-27.53, 153.27], brisbane: [-27.47, 153.03], rocklea: [-27.54, 153.0], archerfield: [-27.57, 153.02], 'acacia ridge': [-27.58, 153.03], 'eagle farm': [-27.43, 153.09], virginia: [-27.38, 153.06], geebung: [-27.37, 153.05], brendale: [-27.32, 152.98], ipswich: [-27.61, 152.76], wacol: [-27.59, 152.93], 'carole park': [-27.62, 152.93], moreton: [-27.24, 153.07], redcliffe: [-27.23, 153.1], 'kippa': [-27.22, 153.09], narangba: [-27.2, 152.96], caboolture: [-27.08, 152.95], 'sunshine coast': [-26.65, 153.07], kunda: [-26.68, 153.03], noosa: [-26.4, 153.05], toowoomba: [-27.56, 151.95], tweed: [-28.18, 153.54], ballina: [-28.86, 153.56], lismore: [-28.81, 153.28], byron: [-28.64, 153.61], 'coffs': [-30.3, 153.11], 'port macquarie': [-31.43, 152.9], newcastle: [-32.93, 151.78], 'central coast': [-33.42, 151.34], sydney: [-33.87, 151.21], wollongong: [-34.42, 150.89], canberra: [-35.28, 149.13], melbourne: [-37.81, 144.96], geelong: [-38.15, 144.36], adelaide: [-34.93, 138.6], perth: [-31.95, 115.86], hobart: [-42.88, 147.33], darwin: [-12.46, 130.84], cairns: [-16.92, 145.77], townsville: [-19.26, 146.82], mackay: [-21.14, 149.19], rockhampton: [-23.38, 150.51], gladstone: [-23.84, 151.25], bundaberg: [-24.87, 152.35], 'hervey bay': [-25.29, 152.84], maryborough: [-25.54, 152.7], gympie: [-26.19, 152.66] };
  const placeOf = n => { const t = String(n || '').toLowerCase(); const k = Object.keys(TZ_PLACES).filter(x => t.includes(x)).sort((a, b) => b.length - a.length)[0]; return k ? TZ_PLACES[k] : null; };
  const myBranch = sup => sup == 'CNW' ? cnwBranch() : tzBranch();
  async function cnwNear(items) {
    const need = items.filter(i => i.sup == 'CNW' && i.id && i.branch === 0 && !i.near); if (!need.length) return;
    const list = await cnwStores(), want = cnwBranch().toLowerCase();
    const me = list.find(s => s.name.toLowerCase() == want) || list.find(s => s.name.toLowerCase().includes(want));
    if (!me || me.lat == null) return;
    const near = list.filter(s => s !== me && s.lat != null).sort((a, b) => dist([me.lat, me.lon], [a.lat, a.lon]) - dist([me.lat, me.lon], [b.lat, b.lon])).slice(0, 3);
    for (const st of near) {
      const left = need.filter(i => !i.near); if (!left.length) break;
      try {
        const r = await get(CNW + '/search/product/' + [...new Set(left.map(i => i.id))].join(',') + '?stock_location=' + st.id, true);
        const by = {}; (JSON.parse(r.responseText) || []).forEach(p => { by[String(p.code)] = p; });
        left.forEach(i => { const p = by[i.id]; if (p && p.stockLevel > 0) i.near = { name: st.name, qty: p.stockLevel }; });
      } catch (e) {}
    }
    need.forEach(i => { if (!i.near) i.nearChecked = near.length; });
  }
  function tzNear(it) {
    if (it.sup != 'Tradezone' || it.branch !== 0 || it.near || !it.branches || !it.branches.length) return;
    const mine = tzBranch().toLowerCase(), me = placeOf(mine);
    const others = it.branches.filter(b => b.name.toLowerCase() != mine).map(b => Object.assign({}, b, { d: me && placeOf(b.name) ? dist(me, placeOf(b.name)) : 1e9 })).sort((a, b) => a.d - b.d).slice(0, 3);
    const hit = others.find(b => b.qty > 0); if (hit) it.near = { name: hit.name, qty: hit.qty }; else it.nearChecked = others.length;
  }
  async function stockCheck(items) { try { await cnwNear(items); } catch (e) {} items.forEach(tzNear); }

  // ---------- AroFlo: add the line ----------
  const $ = () => W.jQuery;
  function setv(el, v) {
    el.focus(); el.value = v;
    ['input', 'keyup', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
    if ($()) $()(el).trigger('change');
    el.blur();
  }
  // the input in a line's column, by the column's class, or by lining it up with the header
  function colInput(row, key) {
    let td = row.querySelector('td.q-col-' + key);
    if (!td) {
      const th = document.querySelector('th.q-col-' + key);
      if (th) { const i = [...th.parentElement.children].indexOf(th); td = row.children[i]; }
    }
    return td ? td.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea') : null;
  }
  const itemInputs = () => [...document.querySelectorAll('td.q-col-item input:not([type=hidden]), td.q-col-item textarea')];

  let target = null;
  async function addLine(it, qty) {
    const btns = [...document.querySelectorAll('button')].filter(b => /^\s*Add Line Item\s*$/i.test(b.textContent) && b.offsetParent);
    if (!btns.length) throw new Error('can\'t find Add Line Item on this page');
    // the Add Line Item you opened the window from (inside a folder), else the last one, which is the top level
    const btn = target && document.contains(target) && target.offsetParent ? target : btns[btns.length - 1];
    const before = new Set(itemInputs());
    if ($()) $()(btn).trigger('click'); else btn.click();
    let inp = null;
    for (let i = 0; i < 40 && !inp; i++) { await sleep(150); inp = itemInputs().find(x => !before.has(x)); }
    if (!inp) throw new Error('Add Line Item didn\'t give a new line');
    const row = inp.closest('tr');
    const part = colInput(row, 'partNo'), q = colInput(row, 'qty'), val = colInput(row, 'value');
    setv(inp, it.name); await sleep(150);
    if (part) { setv(part, it.code); await sleep(100); }
    if (q) { setv(q, String(qty)); await sleep(150); }
    if (val && it.price) { setv(val, it.price.toFixed(2)); await sleep(150); }
    const miss = [!part && 'Part No', !q && 'Qty', !val && 'Value'].filter(Boolean);
    const ok = inp.value == it.name && (!part || part.value == it.code) && (!q || Number(q.value) == Number(qty)) && (!val || !it.price || Math.abs(Number(val.value) - it.price) < 0.005);
    inp.scrollIntoView({ block: 'center' });
    return { ok, miss };
  }

  // ---------- order from the quote ----------
  // Reads every line with a Part No, works out the supplier (from when it was added through the window, else an exact
  // code match on CNW then Tradezone), rounds part quantities up (0.5 of a roll is 1 roll) and merges doubles.
  // Adding puts them in that supplier's cart with your sign in, then reads the cart back. It never checks out.
  function quoteParts() {
    const cell = (row, k) => { let td = row.querySelector('td.q-col-' + k); if (!td) { const th = document.querySelector('th.q-col-' + k); if (th) td = row.children[[...th.parentElement.children].indexOf(th)]; } if (!td) return ''; const x = td.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea'); return clean(x ? x.value : td.textContent); };
    const rows = [...document.querySelectorAll('tr')].filter(r => r.querySelector('td.q-col-partNo, td.q-col-item'));
    const by = {};
    rows.forEach(r => {
      const part = cell(r, 'partNo').toUpperCase(); if (!part) return;
      const q = Number(cell(r, 'qty')) || 0; if (q <= 0) return;
      const b = by[part] || (by[part] = { part, item: cell(r, 'item'), qty: 0, value: Number(cell(r, 'value')) || 0 });
      b.qty += q;
    });
    return Object.values(by).map(b => Object.assign(b, { order: Math.ceil(b.qty - 1e-9) }));
  }
  async function resolvePart(p) {
    const m = partMap()[p.part];
    const exact = (list, sup) => list.find(x => String(x.code).toUpperCase() == p.part || String(x.full || '').toUpperCase() == p.part);
    const tryCnw = async () => { const l = await searchCnw(p.part); const x = exact(l, 'CNW'); return x ? Object.assign(p, { sup: 'CNW', code: x.code, min: x.min, step: x.step, full: x.full, id: x.id, name: x.name, price: x.price, branch: x.branch, national: x.national, href: x.href, img: x.img, uom: x.uom }) : null; };
    const tryTz = async () => { const l = await searchTz(p.part, { pick: top => { const x = exact(top); return x ? [x] : []; } }); const x = exact(l, 'Tradezone'); return x ? Object.assign(p, { sup: 'Tradezone', code: x.code, min: x.min, step: x.step, id: x.id, name: x.name, price: x.price, branch: x.branch, bname: x.bname, branches: x.branches, href: x.href, img: x.img }) : null; };
    try {
      if (m && m.sup == 'Tradezone') return (await tryTz()) || Object.assign(p, { sup: 'Tradezone', code: p.part, id: m.id, name: m.name, href: m.href, min: m.min, step: m.step });
      if (m && m.sup == 'CNW') return (await tryCnw()) || Object.assign(p, { sup: 'CNW', code: p.part, full: m.full, id: m.id, name: m.name, href: m.href, min: m.min, step: m.step });
      return (await tryCnw()) || (await tryTz()) || Object.assign(p, { sup: '' });
    } catch (e) { return Object.assign(p, { sup: e.signedOut || '', err: e.signedOut ? 'signed out' : String(e.message || e), signedOut: e.signedOut }); }
  }
  async function cnwCart(parts) {
    const page = await get(CNW + '/cart');
    if (/\/login\b/.test(page.finalUrl || '') || cnwOut(page.responseText)) throw out_('CNW');
    const t = page.responseText || '';
    const tok = (t.match(/CSRFToken["']?\s*[:=]\s*["']([^"']+)/) || [])[1] || (html(t).querySelector('input[name=CSRFToken]') || {}).value;
    if (!tok) throw new Error('couldn\'t get CNW\'s cart ready (no token)');
    for (const p of parts) {
      if (!p.full) { p.res = 'no CNW product code'; continue; }
      const r = await post(CNW + '/cart/add', form({ productCodePost: p.full, qty: p.order, CSRFToken: tok }));
      debug.cnwAdd = { status: r.status, sample: (r.responseText || '').replace(/\s+/g, ' ').slice(0, 1500) };
      p.res = r.status >= 400 ? 'CNW said no (' + r.status + ')' : 'sent';
    }
    const after = (await get(CNW + '/cart')).responseText || '';
    parts.forEach(p => { if (p.res == 'sent') p.res = after.includes(p.full) ? 'in cart' : 'didn\'t show in the cart'; });
  }
  async function tzCart(parts) {
    for (const p of parts) {
      if (!p.id || !p.href) { p.res = 'no Tradezone product'; continue; }
      const pg = await get(p.href);
      if (/customer\/account\/login/.test(pg.finalUrl || '')) throw out_('Tradezone');
      const d = html(pg.responseText);
      const key = (d.querySelector('input[name=form_key]') || {}).value || ((pg.responseText || '').match(/form_key["']?\s*[:=]\s*["']([^"']+)/) || [])[1];
      const f = d.querySelector('form#product_addtocart_form, form[action*="checkout/cart/add"]');
      const url = f ? new URL(f.getAttribute('action'), TZ).href : TZ + '/checkout/cart/add/product/' + p.id + '/';
      const r = await post(url, form({ product: p.id, qty: p.order, form_key: key || '' }));
      debug.tzAdd = { status: r.status, url: url.replace(/\?.*/, ''), sample: (r.responseText || '').replace(/\s+/g, ' ').slice(0, 1500) };
      p.res = r.status >= 400 ? 'Tradezone said no (' + r.status + ')' : 'sent';
    }
    const after = (await get(TZ + '/checkout/cart/')).responseText || '';
    parts.forEach(p => { if (p.res == 'sent') p.res = (after.includes('-' + p.id + '.html') || (p.name && after.includes(p.name))) ? 'in cart' : 'didn\'t show in the cart'; });
  }
  let orderParts = [];
  async function orderView() {
    if (!box) build(); showBox(); lastView = 'order';
    const parts = quoteParts();
    if (!parts.length) { msg.textContent = ''; list.innerHTML = '<div class="mt">No lines with a Part No on this quote. Lines added through the Supplier window carry one, the rest you\'d order by hand.</div>'; return; }
    msg.textContent = 'Working out ' + parts.length + ' parts…'; list.innerHTML = '';
    await pool(parts, 3, resolvePart);
    await stockCheck(parts.filter(p => p.sup && !p.signedOut));
    parts.forEach(p => { p.order = fitQty(p.qty, p); });
    orderParts = parts; drawOrder();
  }
  function drawOrder() {
    const parts = orderParts; let h = '';
    const outs = [...new Set(parts.filter(p => p.signedOut).map(p => p.signedOut))];
    outs.forEach(sp => { h += `<div class="out"><b>Signed out of ${sp}</b>Sign in, come back, then tap Order again.<div class="btns"><button class="btn" data-login="${sp}">Sign in to ${sp}</button></div></div>`; });
    ['CNW', 'Tradezone'].forEach(sp => {
      const ps = parts.filter(p => p.sup == sp && !p.signedOut); if (!ps.length) return;
      const br = sp == 'CNW' ? cnwBranch() : tzBranch();
      h += `<div class="grp"><span>${sp}</span><span class="ct">${ps.length} parts</span></div><div class="gb">`;
      ps.forEach(p => {
        const n = parts.indexOf(p);
        const moved = p.price && p.value && Math.abs(p.price - p.value) >= 0.01 ? ` <span class="warn">(quoted ${money(p.value)})</span>` : '';
        h += `<div class="it"><label class="row" style="align-items:flex-start"><input type="checkbox" data-o="${n}" ${p.res == 'in cart' ? '' : 'checked'} style="margin-top:4px"><div class="bd"><div class="nm">${esc(p.name || p.item)}</div>
<div class="mt">${esc(p.part)}${p.branch != null ? ' · ' + esc(br) + ' ' + p.branch : ''}${p.price ? ' · ' + money(p.price) + ' ex' + moved : ''}${p.qty != p.order ? ' · quote has ' + p.qty + ', rounded up' + (lotText(p) ? ' (' + lotText(p) + ')' : '') : lotText(p) ? ' · ' + lotText(p) : ''}</div>
${nearLine(p, null)}${p.res ? `<div class="mt ${p.res == 'in cart' ? '' : 'warn'}"><b>${esc(p.res)}</b></div>` : ''}</div></label>
<div class="ad"><span style="flex:1"></span>Order <input type="number" min="1" step="1" value="${p.order}" data-q="${n}" inputmode="numeric"></div></div>`;
      });
      h += `<div class="ad"><button class="btn" data-cart="${sp}" style="flex:1">Add ticked to ${sp} cart</button><button class="btn grey" data-open="${sp}">Open cart</button></div></div>`;
    });
    const none = parts.filter(p => !p.sup && !p.signedOut);
    if (none.length) { h += `<div class="grp"><span>Not matched</span><span class="ct">${none.length}</span></div><div class="gb">` + none.map(p => `<div class="it"><div class="nm">${esc(p.item)}</div><div class="mt">${esc(p.part)} · qty ${p.order}${p.err ? ' · ' + esc(p.err) : ' · not found as an exact code on CNW or Tradezone'}</div></div>`).join('') + '</div>'; }
    list.innerHTML = h;
    msg.textContent = 'Tick what you want, check the qty, then add to the cart. It never checks out, you order on their site.';
    list.querySelectorAll('input[data-q]').forEach(i => { i.onchange = () => { const pp = parts[+i.dataset.q]; const v = fitQty(Math.max(1, Number(i.value) || 1), pp); if (v != Number(i.value)) msg.textContent = pp.sup + ' ' + lotText(pp) + ', so that one goes to ' + v + '.'; i.value = v; pp.order = v; }; });
    list.querySelectorAll('button[data-login]').forEach(b => { b.onclick = () => startLogin(b.dataset.login); });
    list.querySelectorAll('button[data-open]').forEach(b => { b.onclick = () => W.open(b.dataset.open == 'CNW' ? CNW + '/cart' : TZ + '/checkout/cart/', '_blank'); });
    list.querySelectorAll('button[data-cart]').forEach(b => { b.onclick = async () => {
      const sp = b.dataset.cart;
      const pick = [...list.querySelectorAll('input[data-o]')].filter(c => c.checked).map(c => parts[+c.dataset.o]).filter(p => p.sup == sp);
      if (!pick.length) { msg.textContent = 'Nothing ticked for ' + sp + '.'; return; }
      b.disabled = true; b.textContent = 'Adding…';
      try { await (sp == 'CNW' ? cnwCart : tzCart)(pick); }
      catch (e) { pick.forEach(p => { if (!p.res || p.res == 'sent') p.res = e.signedOut ? 'signed out' : String(e.message || e); if (e.signedOut) p.signedOut = sp; }); }
      drawOrder();
      const ok = pick.filter(p => p.res == 'in cart').length;
      msg.textContent = ok + ' of ' + pick.length + ' in your ' + sp + ' cart.' + (ok < pick.length ? ' Anything red didn\'t make it, tap Copy debug and send it to Claude.' : ' Open cart to check it and order.');
    }; });
  }

  // ---------- cards (search, favourites and in stock picks all look the same) ----------
  function stockLine(it, n) {
    if (it.sup == 'CNW') return it.branch == null ? '' : esc(cnwBranch()) + ' ' + it.branch + (it.national != null ? ', national ' + it.national : '');
    if (it.bname) return esc(it.bname) + ' ' + (it.branch || 'none');
    return esc(it.stock || '') + (n != null && it.href ? `${it.stock ? ' · ' : ''}<a href="#" data-chk="${n}">check ${esc(tzBranch())}</a>` : '');
  }
  function nearLine(it, n) {
    if (it.branch !== 0) return '';
    if (it.near) return `<div class="mt amb">None at ${esc(myBranch(it.sup))}, <b>${esc(it.near.name)} has ${it.near.qty}</b></div>`;
    if (it.nearChecked != null) return `<div class="mt warn">None at ${esc(myBranch(it.sup))} or the next ${it.nearChecked || 3} closest.${n != null ? ` <a href="#" data-alt="${n}">Find in stock</a>` : ''}</div>${n != null ? `<div class="alt" data-alt-for="${n}"></div>` : ''}`;
    return '';
  }
  function histLine(it) {
    const h = histOf(it); if (!h.length || !it.price) return '';
    const prev = [...h].reverse().find(e => Math.abs(e[1] - it.price) >= 0.005); if (!prev) return '';
    const up = it.price > prev[1];
    return `<div class="hs ${up ? 'up' : 'down'}" data-h="${esc(keyOf(it))}">${up ? '▲' : '▼'} was ${money(prev[1])} on ${dmy(prev[0])}</div><div class="hl" style="display:none"></div>`;
  }
  function cmpLine(it, n, dropAttr) {
    const o = it.other; if (!o) return '';
    const cheaper = o.price && it.price && o.price < it.price - 0.005;
    // Show it jumps to the other one in the list (or pops it in here if it's not on this page), Use it adds that one instead
    const btns = dropAttr ? '' : `<div class="cb"><button class="btn grey sm" data-jump="${n}">Show it</button><button class="btn sm${cheaper ? '' : ' grey'}" data-inst="${n}">Use ${esc(o.sup)} instead</button></div><div class="alt" data-jump-for="${n}"></div>`;
    return `<div class="cmp">Same item? <b>${esc(o.sup)}</b> ${esc(o.code)} · ${o.price ? money(o.price) + ' ex' : 'no price'}${cheaper ? ' <span class="cheap">cheaper</span>' : ''} <a href="#" ${dropAttr || 'data-drop'}="${n}" title="Not the same item">✕</a><div class="mt">${esc(o.name)}</div>${btns}</div>`;
  }
  function cardHtml(it, n) {
    const cheap = it.other && it.other.price && it.price && it.price < it.other.price - 0.005;
    const stock = stockLine(it, n);
    return `<div class="it" data-card="${n}"><div class="row">${it.img ? `<img class="th" src="${esc(it.img)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<div class="th none">no pic</div>'}<div class="bd"><div class="nm"><span>${esc(it.name)}</span><button class="star" data-f="${n}" title="Favourite">${favOn(it) ? '★' : '☆'}</button></div>
<div class="mt">${esc(it.code)}${it.uom ? ' · ' + esc(it.uom) : ''}${lotText(it) ? ' · <b class="warn">' + esc(lotText(it)) + '</b>' : ''}${stock ? ' · ' + stock : ''}${it.href ? ` · <a href="${esc(it.href)}" target="_blank">view</a>` : ''}</div>
${nearLine(it, n)}${cmpLine(it, n)}
<div class="ad"><span class="pr">${it.price ? money(it.price) + ' ex' + (it.stale ? ' <span class="mt">(last seen)</span>' : '') : '<span class="warn">no price</span>'}${cheap ? ' <span class="cheap">cheaper</span>' : ''}</span><span style="flex:1"></span>Qty <input type="number" min="0" step="any" value="1" inputmode="decimal"><button class="btn" data-n="${n}">Add</button></div>
${histLine(it)}${it.note ? `<div class="mt warn">${esc(it.note)}</div>` : ''}</div></div></div>`;
  }
  const redraw = () => lastView == 'fav' ? favDraw() : lastView == 'search' ? drawResults() : null;
  function wire(root) {
    const once = (sel, f) => root.querySelectorAll(sel).forEach(x => { if (x.dataset.w) return; x.dataset.w = '1'; f(x); });
    once('button[data-n]', b => { b.onclick = () => add(b); });
    once('button[data-f]', b => { b.onclick = e => { e.preventDefault(); e.stopPropagation(); const it = results[+b.dataset.f]; toggleFav(it); const on = favOn(it); list.querySelectorAll('button[data-f]').forEach(x => { const y = results[+x.dataset.f]; if (y && keyOf(y) == keyOf(it)) x.textContent = on ? '★' : '☆'; }); msg.textContent = on ? 'Starred. It shows up top when you open the window.' : 'Unstarred.'; }; });
    once('a[data-drop]', a => { a.onclick = e => { e.preventDefault(); const it = results[+a.dataset.drop]; if (!it || !it.other) return; D.drop[pk(it, it.other)] = { at: Date.now() }; changed(); results.forEach(x => { if (x.other && dropped(x, x.other)) delete x.other; }); msg.textContent = 'Dropped that match, it won\'t pair those two again.'; redraw(); }; });
    once('.hs', d => { d.onclick = () => { const b = d.nextElementSibling; if (b.style.display == 'none') { b.innerHTML = histOf(d.dataset.h).slice(-6).reverse().map(e => dmy(e[0]) + ': ' + money(e[1])).join('<br>'); b.style.display = 'block'; } else b.style.display = 'none'; }; });
    const otherOf = it => results.find(x => keyOf(x) == keyOf(it.other)) || Object.assign({}, it.other);
    once('button[data-jump]', b => { b.onclick = () => {
      const it = results[+b.dataset.jump]; if (!it || !it.other) return;
      const full = otherOf(it), j = results.indexOf(full), el = j >= 0 && list.querySelector('[data-card="' + j + '"]:not(.alt [data-card])');
      if (el) {
        const gb = el.closest('.gb'); if (gb && gb.classList.contains('shut')) { gb.classList.remove('shut'); const g = list.querySelector('.grp[data-g="' + gb.dataset.g + '"] .ar'); if (g) g.textContent = '▾'; GM_setValue('shut' + gb.dataset.g, false); }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
        return;
      }
      // not on this page of results: pop it in right here
      const div = list.querySelector('.alt[data-jump-for="' + b.dataset.jump + '"]'); if (!div) return;
      if (div.innerHTML) { div.innerHTML = ''; b.textContent = 'Show it'; return; }
      div.innerHTML = cardHtml(full, results.push(full) - 1); wire(div); b.textContent = 'Hide it';
    }; });
    once('button[data-inst]', b => { b.onclick = () => {
      const it = results[+b.dataset.inst]; if (!it || !it.other) return;
      const q = b.closest('.it').querySelector(':scope > .row > .bd > .ad input');
      add(b, otherOf(it), Number(q && q.value) || 1, it);
    }; });
    once('a[data-chk]', a => { a.onclick = async e => { e.preventDefault(); const it = results[+a.dataset.chk]; a.textContent = 'checking…'; try { await tzDetail(it); await stockCheck([it]); } catch (x) {} redraw(); }; });
    once('button[data-pg]', b => { b.onclick = () => pageTo(b.dataset.pg, +b.dataset.d); });
    once('a[data-alt]', a => { a.onclick = e => { e.preventDefault(); findInStock(+a.dataset.alt, a); }; });
    once('button[data-login]', b => { b.onclick = () => startLogin(b.dataset.login); });
    once('button[data-retry]', b => { b.onclick = () => run(); });
    once('.grp[data-g]', g => { g.onclick = () => { const b = list.querySelector('.gb[data-g="' + g.dataset.g + '"]'); if (!b) return; const shut = !b.classList.contains('shut'); b.classList.toggle('shut', shut); const ar = g.querySelector('.ar'); if (ar) ar.textContent = shut ? '▸' : '▾'; GM_setValue('shut' + g.dataset.g, shut); }; });
  }
  async function findInStock(n, a) {
    const it = results[n]; const div = list.querySelector('.alt[data-alt-for="' + n + '"]');
    const words = clean(it.name).split(' ').slice(0, 4).join(' ');
    a.textContent = 'Looking…';
    let l = [];
    try { l = it.sup == 'CNW' ? await searchCnw(words) : await searchTz(words); } catch (e) { a.textContent = 'Couldn\'t search: ' + (e.message || e); return; }
    const ok = l.filter(x => normCode(x.code) != normCode(it.code) && x.branch > 0).slice(0, 3);
    if (!ok.length) { a.textContent = 'Nothing like it in stock at ' + myBranch(it.sup); return; }
    a.textContent = 'In stock at ' + myBranch(it.sup) + ' instead:';
    if (div) { div.innerHTML = ok.map(x => cardHtml(x, results.push(x) - 1)).join(''); wire(div); }
  }

  // ---------- favourites and recents (what shows before you search) ----------
  let favItems = [], recItems = [];
  function favDraw() {
    results = []; let h = '';
    const grp = (name, key, items) => {
      if (!items.length) return;
      const shut = GM_getValue('shut' + key, false);
      h += `<div class="grp" data-g="${key}"><span>${name}</span><span class="ct">${items.length}</span><span class="ar">${shut ? '▸' : '▾'}</span></div><div class="gb${shut ? ' shut' : ''}" data-g="${key}">`;
      ['CNW', 'Tradezone'].forEach(sp => { const s = items.filter(i => i.sup == sp); if (!s.length) return; h += `<div class="sub">${sp}</div>` + s.map(it => cardHtml(it, results.push(it) - 1)).join(''); });
      h += '</div>';
    };
    grp('★ Favourites', 'FAV', favItems); grp('Recent', 'REC', recItems);
    list.innerHTML = h || '<div class="mt">Search for something. Tap ☆ on a result to keep it up here, and your last 10 adds show here too.</div>';
    wire(list);
  }
  async function favView() {
    if (!box) build(); lastView = 'fav';
    const mk = it => { const x = Object.assign({}, it); const hh = histOf(x); if (hh.length) { x.price = hh[hh.length - 1][1]; x.stale = true; } return x; };
    favItems = Object.values(D.fav).filter(f => f && !f.del && f.it).map(f => mk(f.it));
    const fk = new Set(favItems.map(keyOf));
    recItems = D.rec.map(r => mk(r.it)).filter(it => !fk.has(keyOf(it)));
    favDraw();
    const all = [...favItems, ...recItems]; if (!all.length) { msg.textContent = ''; return; }
    msg.textContent = 'Checking today\'s prices…';
    await refreshItems(all);
    if (lastView == 'fav') { favDraw(); msg.textContent = 'Search above, or add from your favourites and recents.'; }
  }
  async function refreshItems(items) {
    const cnw = items.filter(i => i.sup == 'CNW' && i.id);
    if (cnw.length) {
      try {
        const pr = await get(CNW + '/search/product/' + [...new Set(cnw.map(i => i.id))].join(',') + '?stock_location=' + await cnwLoc(), true);
        const by = {}; (JSON.parse(pr.responseText) || []).forEach(p => { by[String(p.code)] = p; });
        cnw.forEach(i => { const p = by[i.id]; if (p && Number(p.price)) { i.price = Number(p.price); i.branch = p.stockLevel; i.national = p.warehouseStockLevel; i.stale = false; } });
      } catch (e) {}
    }
    await pool(items.filter(i => i.sup == 'Tradezone' && i.href).slice(0, 12), 3, async i => { await tzDetail(i, true); if (i.price) i.stale = false; });
    await stockCheck(items);
  }

  // ---------- reprice the quote ----------
  // Every line with a Part No checked against today's price at its supplier. Anything that's moved comes up ticked.
  // If the other supplier has the same item cheaper there's a swap tick, off by default. Nothing changes till Update,
  // and it never saves the quote.
  let rp = [];
  async function repriceView() {
    if (!box) build(); showBox(); lastView = 'reprice';
    const rows = lineRows().filter(r => clean(r.part));
    if (!rows.length) { msg.textContent = ''; list.innerHTML = '<div class="mt">No lines with a Part No to reprice. Lines added through the Supplier window carry one.</div>'; return; }
    const by = {}; rows.forEach(r => { const k = clean(r.part).toUpperCase(); (by[k] || (by[k] = { part: k, item: r.item, value: Number(r.value) || 0, rows: [] })).rows.push(r); });
    const parts = Object.values(by);
    msg.textContent = 'Checking ' + parts.length + ' parts against today\'s prices…'; list.innerHTML = '';
    await pool(parts, 3, resolvePart);
    msg.textContent = 'Checking the other supplier and stock…';
    await pool(parts.filter(p => p.sup && !p.signedOut), 2, async p => { p.other = await findOther(p); });
    await stockCheck(parts.filter(p => p.sup && !p.signedOut));
    rp = parts; drawReprice();
  }
  function drawReprice() {
    const parts = rp; let h = '';
    [...new Set(parts.filter(p => p.signedOut).map(p => p.signedOut))].forEach(sp => { h += `<div class="out"><b>Signed out of ${sp}</b>Sign in, then tap Reprice again.<div class="btns"><button class="btn" data-login="${sp}">Sign in to ${sp}</button></div></div>`; });
    const ok = parts.filter(p => p.sup && !p.signedOut && p.price), none = parts.filter(p => !p.signedOut && (!p.sup || !p.price));
    if (ok.length) {
      h += `<div class="grp"><span>Reprice</span><span class="ct">${ok.length} parts</span></div><div class="gb">`;
      ok.forEach(p => {
        const n = parts.indexOf(p), moved = Math.abs(p.price - p.value) >= 0.005, pc = p.value ? Math.round((p.price - p.value) / p.value * 100) : 0;
        const sw = p.other && p.other.price && p.other.price < p.price - 0.005;
        h += `<div class="it"><div class="nm"><span>${esc(p.item || p.name)}</span></div>
<div class="mt">${esc(p.part)} · ${esc(p.sup)}${stockLine(p) ? ' · ' + stockLine(p) : ''}${p.rows.length > 1 ? ' · on ' + p.rows.length + ' lines' : ''}</div>${nearLine(p, null)}
<div class="mt">Quoted ${p.value ? money(p.value) : 'no price'} · now <b>${money(p.price)}</b>${moved && p.value ? ` <span class="${p.price > p.value ? 'warn' : 'grn'}">${pc > 0 ? '+' : ''}${pc}%</span>` : moved ? '' : ' · no change'}</div>${histLine(p)}
<label class="tk"><input type="checkbox" data-up="${n}" ${moved ? 'checked' : ''}> Update to ${money(p.price)}</label>
${sw ? `<label class="tk"><input type="checkbox" data-sw="${n}"> Swap to ${esc(p.other.sup)} ${esc(p.other.code)} at ${money(p.other.price)} <span class="cheap">cheaper</span></label>` : ''}${cmpLine(p, n, 'data-rdrop')}</div>`;
      });
      h += `<div class="ad"><button class="btn rpgo" style="flex:1">Update ticked</button></div></div>`;
    }
    if (none.length) h += `<div class="grp"><span>Couldn't check</span><span class="ct">${none.length}</span></div><div class="gb">` + none.map(p => `<div class="it"><div class="nm"><span>${esc(p.item)}</span></div><div class="mt">${esc(p.part)}${p.err ? ' · ' + esc(p.err) : ' · not found as an exact code on CNW or Tradezone'}</div></div>`).join('') + '</div>';
    list.innerHTML = h;
    msg.textContent = 'Tick what to change, then Update ticked. It never saves the quote, you press Save Quote.';
    wire(list);
    list.querySelectorAll('input[data-sw]').forEach(c => { c.onchange = () => { const u = list.querySelector('input[data-up="' + c.dataset.sw + '"]'); if (c.checked && u) u.checked = false; }; });
    list.querySelectorAll('a[data-rdrop]').forEach(a => { a.onclick = e => { e.preventDefault(); const p = parts[+a.dataset.rdrop]; if (p && p.other) { D.drop[pk(p, p.other)] = { at: Date.now() }; changed(); delete p.other; drawReprice(); msg.textContent = 'Dropped that match.'; } }; });
    const go = list.querySelector('.rpgo'); if (go) go.onclick = () => {
      let parts_ = 0, lines = 0;
      parts.forEach((p, n) => {
        const up = list.querySelector('input[data-up="' + n + '"]'), sw = list.querySelector('input[data-sw="' + n + '"]');
        const doSw = sw && sw.checked, doUp = up && up.checked; if (!doSw && !doUp) return;
        const price = doSw ? p.other.price : p.price;
        p.rows.forEach(r => { if (!document.contains(r.row)) return; const val = colInput(r.row, 'value'); if (val) { setv(val, price.toFixed(2)); lines++; } if (doSw) { const pt = colInput(r.row, 'partNo'); if (pt) setv(pt, p.other.code); } });
        if (doSw) { remember(p.other); recordPrice(p.other, p.other.price); } else recordPrice(p, p.price);
        parts_++;
      });
      msg.textContent = parts_ ? 'Updated ' + parts_ + ' parts on ' + lines + ' lines. Check them, then press Save Quote.' : 'Nothing ticked.';
    };
  }

  // ---------- the window ----------
  let box, list, msg, termIn;
  // On a phone the window fills the screen like an app page, sized to what's actually on screen (so it's the right
  // size even with AroFlo on Request Desktop Website, pinched in or with the keyboard up).
  const MOBILE = (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 700) || /iPhone|iPod|Android.+Mobile/.test(navigator.userAgent);
  function fit() {
    if (!MOBILE || !box || box.style.display == 'none') return;
    const vv = W.visualViewport || { width: innerWidth, height: innerHeight, offsetLeft: 0, offsetTop: 0 };
    const sw = vv.width > vv.height ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    const k = vv.width / sw;
    Object.assign(box.style, { left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', width: sw + 'px', height: (vv.height / k) + 'px', transform: 'scale(' + k + ')' });
  }
  // iPhone Safari ignores overflow:hidden for finger scrolling, so the page gets pinned in place while the window's
  // open (and put back where it was on close), and a drag that isn't on the list itself goes nowhere.
  let locked = null;
  function lockPage() {
    if (locked) return;
    const b = document.body, h = document.documentElement;
    locked = { y: W.scrollY || h.scrollTop || 0, x: W.scrollX || 0, b: b.getAttribute('style'), h: h.getAttribute('style') };
    h.style.overflow = 'hidden';
    Object.assign(b.style, { position: 'fixed', top: -locked.y + 'px', left: -locked.x + 'px', width: '100%', overflow: 'hidden' });
  }
  function unlockPage() {
    if (!locked) return;
    const b = document.body, h = document.documentElement, l = locked; locked = null;
    if (l.b == null) b.removeAttribute('style'); else b.setAttribute('style', l.b);
    if (l.h == null) h.removeAttribute('style'); else h.setAttribute('style', l.h);
    W.scrollTo(l.x, l.y);
  }
  let touchY = 0;
  function guardTouch(bx) {
    bx.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
    bx.addEventListener('touchmove', e => {
      const sc = [list, bx.querySelector('.sug')].find(el => el && el.contains(e.target) && el.scrollHeight > el.clientHeight + 1);
      if (!sc) { e.preventDefault(); return; }                       // not on a scrolling part: stop the page moving
      const dy = e.touches[0].clientY - touchY;
      if ((dy > 0 && sc.scrollTop <= 0) || (dy < 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1)) e.preventDefault();   // at the end: don't hand the scroll on
    }, { passive: false });
  }
  function showBox() {
    box.style.display = 'flex';
    if (MOBILE) { box.classList.add('mob'); if (!box.dataset.guard) { box.dataset.guard = '1'; guardTouch(box); } lockPage(); fit(); }
  }
  function hideBox() {
    box.style.display = 'none';
    unlockPage();
  }
  if (MOBILE) { const vv = W.visualViewport; if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); } addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300)); }
  function css() {
    const s = document.createElement('style');
    s.textContent = `
#wre-sup{position:fixed;right:10px;bottom:10px;z-index:2147483646;width:min(440px,94vw);max-height:82vh;display:none;flex-direction:column;background:#fff;border:1px solid #ccc;border-radius:12px;box-shadow:0 6px 24px #0004;font:14px -apple-system,Segoe UI,sans-serif;color:#222}
#wre-sup .hd{display:flex;align-items:center;gap:6px;padding:10px;background:${GREY};color:#fff;border-radius:12px 12px 0 0}
#wre-sup .hd b{flex:1}
#wre-sup .hd button{background:none;border:0;color:#fff;font-size:20px;line-height:1}
#wre-sup .sr{display:flex;gap:6px;padding:10px 10px 4px}
#wre-sup .sr input{flex:1;font-size:16px;padding:8px;border:1px solid #bbb;border-radius:8px}
#wre-sup .btn{background:${ORANGE};color:#fff;border:0;border-radius:8px;padding:8px 12px;font:600 14px inherit}
#wre-sup .opt{padding:0 10px 6px;font-size:13px;color:#555;display:flex;gap:12px;align-items:center}
#wre-sup .br label{display:flex;align-items:center;gap:4px;flex:1;min-width:0}
#wre-sup .br input{flex:1;min-width:0;font-size:16px;padding:5px 6px;border:1px solid #bbb;border-radius:6px}
#wre-sup .sug{display:none;margin:-2px 10px 6px;border:1px solid #ccc;border-radius:8px;max-height:220px;overflow:auto;background:#fff}
#wre-sup .sug div{padding:9px 10px;border-bottom:1px solid #eee}
#wre-sup .sug div span{color:#888;font-size:12px}
#wre-sup .sug .none{color:#888;font-size:13px}
#wre-sup .lg{margin:0 10px 8px;padding:10px;border:1px solid #e3e0dd;border-radius:8px;background:#faf9f8}
#wre-sup .lgrow{display:flex;gap:6px;align-items:center;margin-bottom:6px}
#wre-sup .lgrow b{width:78px;flex:none;font-size:13px}
#wre-sup .lgrow input{flex:1;min-width:0;font-size:16px;padding:6px;border:1px solid #bbb;border-radius:6px}
#wre-sup .opt .dbg{margin-left:10px}
#wre-sup .msg{padding:0 10px 6px;font-size:13px;color:#555}
#wre-sup .ls{overflow:auto;padding:0 10px 10px;flex:1;min-height:0;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#wre-sup.mob{right:auto;bottom:auto;max-height:none;border:0;border-radius:0;box-shadow:none;font-size:15px;transform-origin:0 0}
#wre-sup.mob .hd{border-radius:0;padding:12px 10px}
#wre-sup.mob .hd b{font-size:17px}
#wre-sup.mob .hd .pill{font-size:14px;padding:7px 12px}
#wre-sup.mob .hd .x{font-size:28px;padding:0 6px}
#wre-sup.mob .btn{padding:10px 14px;font-size:15px}
#wre-sup.mob .sr input{font-size:17px;padding:10px}
#wre-sup.mob .opt{flex-wrap:wrap;row-gap:6px;font-size:14px}
#wre-sup.mob .opt input[type=checkbox]{width:20px;height:20px}
#wre-sup.mob .ad input{width:80px;padding:9px}
#wre-sup.mob .star{font-size:26px}
#wre-sup.mob .th{width:64px;height:64px}
#wre-sup.mob .mt{font-size:13px}
#wre-sup.mob .tk{font-size:15px;padding:4px 0}
#wre-sup.mob .tk input{width:22px;height:22px}
#wre-sup.mob .grp{padding:11px 12px}
#wre-sup.mob .ls{padding-bottom:40px}
#wre-sup .grp{display:flex;align-items:center;gap:8px;margin:12px 0 6px;padding:8px 10px;background:#f3f1ef;border-left:4px solid ${ORANGE};border-radius:6px;font:700 16px inherit;color:#222;cursor:pointer;user-select:none}
#wre-sup .grp .ct{font:600 12px inherit;color:#666;flex:1}
#wre-sup .grp .ar{font-size:14px;color:${GREY}}
#wre-sup .gb.shut{display:none}
#wre-sup .row{display:flex;gap:8px}
#wre-sup .th{width:52px;height:52px;flex:none;border:1px solid #e3e0dd;border-radius:6px;object-fit:contain;background:#fff}
#wre-sup .th.none{display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa}
#wre-sup .bd{flex:1;min-width:0}
#wre-sup .it{border:1px solid #e3e0dd;border-radius:8px;padding:8px;margin-bottom:6px}
#wre-sup .nm{font-weight:600}
#wre-sup .mt{font-size:12px;color:#666;margin-top:2px}
#wre-sup .pr{font-weight:700;color:#222}
#wre-sup .ad{display:flex;gap:6px;align-items:center;margin-top:6px}
#wre-sup .ad input{width:70px;font-size:16px;padding:6px;border:1px solid #bbb;border-radius:6px}
#wre-sup .warn{color:#b3261e}
#wre-sup .grn,#wre-sup .hs.down{color:#1e7b34}
#wre-sup .hs{font-size:12px;margin-top:4px;cursor:pointer}
#wre-sup .hs.up{color:#b3261e}
#wre-sup .hl{font-size:12px;color:#555;margin:2px 0 0 14px}
#wre-sup .amb{color:#a35a00}
#wre-sup .cheap{background:#1e7b34;color:#fff;border-radius:8px;padding:1px 6px;font:700 11px inherit}
#wre-sup .cmp{font-size:12px;margin-top:4px;padding:6px 8px;background:#f6f4f2;border-radius:6px}
#wre-sup .cmp a{margin-left:6px;text-decoration:none;font-weight:700}
#wre-sup .nm{display:flex;gap:6px;align-items:flex-start}
#wre-sup .nm span{flex:1}
#wre-sup .star{background:none;border:0;font-size:20px;line-height:1;color:${ORANGE};padding:0 2px}
#wre-sup .sub{font:700 12px inherit;color:#666;margin:8px 0 4px;text-transform:uppercase}
#wre-sup .tk{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px}
#wre-sup .tk input{width:18px;height:18px}
#wre-sup .alt{margin-top:6px}
#wre-sup .cb{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
#wre-sup .btn.sm{padding:6px 10px;font-size:13px}
#wre-sup .it{transition:box-shadow .3s}
#wre-sup .it.flash{box-shadow:0 0 0 3px ${ORANGE}}
#wre-sup .pg{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0 10px}
#wre-sup .pg span{font-weight:600;color:#555}
#wre-sup .pg .btn[disabled]{opacity:.35}
#wre-sup .tgt{padding:0 10px 4px}
#wre-sup .hd .pill{font-size:13px;font-weight:600;border:1px solid #fff8;border-radius:14px;padding:5px 10px}
#wre-sup .out{border:1px solid #f0c9a6;background:#fff6ee;border-radius:8px;padding:10px;margin-bottom:6px}
#wre-sup .out b{display:block;margin-bottom:4px}
#wre-sup .out .btns{display:flex;gap:6px;margin-top:8px}
#wre-sup .btn.grey{background:${GREY}}
#wre-sup a{color:${ORANGE}}
.wre-sup-open{margin-left:4px}`;
    document.head.appendChild(s);
  }
  function build() {
    css();
    box = document.createElement('div'); box.id = 'wre-sup';
    box.innerHTML = `<div class="hd"><b>Supplier</b><button class="pill fv" title="Favourites and recents">★</button><button class="pill rpc" title="Reprice this quote">Reprice</button><button class="pill ord" title="Order this quote">Order</button><button class="x" title="Close">×</button></div>
<div class="sr"><input type="search" placeholder="Search CNW and Tradezone" enterkeyhint="search"><button class="btn">Search</button></div>
<div class="opt"><label><input type="checkbox" data-s="CNW" checked> CNW</label><label><input type="checkbox" data-s="Tradezone" checked> Tradezone</label><a href="#" class="lgn" style="margin-left:auto">Logins</a><a href="#" class="dbg">Copy debug</a></div>
<div class="lg" style="display:none"><div class="mt" style="margin-bottom:6px">Saved logins sign you in by themselves when a supplier signs you out. They stay in Tampermonkey on this device only, never in the repo, and Claude never sees them. Leave one blank to tap your saved password instead.</div>
<div class="lgrow"><b>CNW</b><input data-c="CNW" data-k="u" type="email" placeholder="email" autocomplete="off"><input data-c="CNW" data-k="p" type="password" placeholder="password" autocomplete="new-password"></div>
<div class="lgrow"><b>Tradezone</b><input data-c="Tradezone" data-k="u" type="email" placeholder="email" autocomplete="off"><input data-c="Tradezone" data-k="p" type="password" placeholder="password" autocomplete="new-password"></div>
<div class="lgrow"><b>Todoist</b><input data-t="1" type="password" placeholder="token, for phone and PC sync" autocomplete="new-password"></div>
<div class="mt sy" style="margin-bottom:6px"></div>
<div class="ad"><button class="btn lgsave" style="flex:1">Save</button><button class="btn grey lgclear">Clear logins</button></div></div>
<div class="opt br"><label>CNW <input data-b="cnwBranch" placeholder="branch" autocomplete="off"></label><label>TZ <input data-b="tzBranch" placeholder="branch" autocomplete="off"></label></div><div class="sug"></div>
<div class="tgt mt"></div><div class="msg"></div><div class="ls"></div>`;
    document.body.appendChild(box);
    termIn = box.querySelector('.sr input'); list = box.querySelector('.ls'); msg = box.querySelector('.msg');
    box.querySelector('.hd .x').onclick = () => hideBox();
    box.querySelector('.hd .ord').onclick = () => orderView();
    box.querySelector('.hd .rpc').onclick = () => repriceView();
    box.querySelector('.hd .fv').onclick = () => { termIn.value = ''; favView(); };
    box.querySelector('.sr .btn').onclick = run;
    termIn.addEventListener('keydown', e => { if (e.key == 'Enter') { e.preventDefault(); run(); } });
    // branch pickers: type and the matching branches show under it, tap one to pick it. Saved straight away.
    const sug = box.querySelector('.sug');
    const names = async key => key == 'cnwBranch' ? (await cnwStores()).map(st => ({ n: st.name, s: st.state })) : GM_getValue('tzBranches', ['Gold Coast']).map(n => ({ n, s: '' }));
    const cur = key => key == 'cnwBranch' ? cnwBranch() : tzBranch();
    const pick = (inp, v) => {
      v = clean(v); if (!v) { inp.value = cur(inp.dataset.b); return; }
      const changed = v != cur(inp.dataset.b);
      GM_setValue(inp.dataset.b, v); inp.value = v; sug.style.display = 'none';
      msg.textContent = (inp.dataset.b == 'cnwBranch' ? 'CNW' : 'Tradezone') + ' branch set to ' + v + '.';
      if (changed && clean(termIn.value) && results.length) run();
    };
    box.querySelectorAll('.br input').forEach(inp => {
      inp.value = cur(inp.dataset.b);
      const show = async () => {
        const q = clean(inp.value).toLowerCase(), all = await names(inp.dataset.b);
        const hits = all.filter(x => !q || x.n.toLowerCase().includes(q) || x.s.toLowerCase() == q).slice(0, 8);
        sug.innerHTML = hits.map(x => `<div data-v="${esc(x.n)}">${esc(x.n)}${x.s ? ' <span>' + esc(x.s) + '</span>' : ''}</div>`).join('') || '<div class="none">No branch by that name' + (inp.dataset.b == 'tzBranch' ? ' yet (Tradezone branches show up here once a search has seen them)' : '') + '</div>';
        sug.style.display = 'block'; sug.dataset.for = inp.dataset.b;
        sug.querySelectorAll('div[data-v]').forEach(d => { d.onpointerdown = e => { e.preventDefault(); pick(inp, d.dataset.v); inp.blur(); }; });
      };
      inp.onfocus = () => { inp.select(); show(); };
      inp.oninput = show;
      inp.onkeydown = e => { if (e.key == 'Enter') { e.preventDefault(); const first = sug.querySelector('div[data-v]'); pick(inp, first ? first.dataset.v : inp.value); inp.blur(); } };
      // leaving the box keeps an exact match, otherwise puts the saved branch back
      inp.onblur = () => setTimeout(async () => { if (sug.dataset.for == inp.dataset.b) sug.style.display = 'none'; const v = clean(inp.value).toLowerCase(); const hit = (await names(inp.dataset.b)).find(x => x.n.toLowerCase() == v); if (hit) pick(inp, hit.n); else inp.value = cur(inp.dataset.b); }, 150);
    });
    box.querySelectorAll('.opt input[type=checkbox]').forEach(c => { c.checked = GM_getValue('use' + c.dataset.s, true); c.onchange = () => GM_setValue('use' + c.dataset.s, c.checked); });
    box.querySelector('.dbg').onclick = e => { e.preventDefault(); copyDebug(e.target); };
    const lg = box.querySelector('.lg');
    const fillLg = () => { lg.querySelectorAll('input[data-c]').forEach(i => { const c = GM_getValue('cred_' + i.dataset.c, null); i.value = c && c[i.dataset.k] || ''; }); lg.querySelector('input[data-t]').value = tdToken(); lg.querySelector('.sy').textContent = tdToken() ? (syncMsg || 'Sync on.') : 'No Todoist token, so favourites, recents and price history stay on this device.'; };
    box.querySelector('.lgn').onclick = e => { e.preventDefault(); const show = lg.style.display == 'none'; lg.style.display = show ? 'block' : 'none'; if (show) fillLg(); };
    box.querySelector('.lgsave').onclick = () => {
      ['CNW', 'Tradezone'].forEach(sp => { const u = clean(lg.querySelector(`input[data-c="${sp}"][data-k=u]`).value), pw = lg.querySelector(`input[data-c="${sp}"][data-k=p]`).value; GM_setValue('cred_' + sp, u && pw ? { u, p: pw } : null); });
      const tv = clean(lg.querySelector('input[data-t]').value), had = tdToken(); GM_setValue('todoistToken', tv);
      lg.style.display = 'none'; msg.textContent = 'Saved on this device.';
      if (tv && tv != had) { msg.textContent = 'Saved. Syncing with Todoist…'; push().then(() => { msg.textContent = 'Saved and synced with Todoist.'; if (lastView == 'fav') favView(); }, e => { msg.textContent = 'Saved, but sync didn\'t work: ' + (e.message || e); }); }
    };
    box.querySelector('.lgclear').onclick = () => { GM_setValue('cred_CNW', null); GM_setValue('cred_Tradezone', null); fillLg(); msg.textContent = 'Saved logins cleared.'; };
  }
  function open(b) {
    if (!box) build(); showBox();
    target = b || null;
    const btns = [...document.querySelectorAll('button')].filter(x => /^\s*Add Line Item\s*$/i.test(x.textContent) && x.offsetParent);
    const top = !b || b === btns[btns.length - 1];
    const li = b && b.closest('li'); const f = li && li.querySelector('td.q-col-item input:not([type=hidden]), td.q-col-item textarea');
    box.querySelector('.tgt').textContent = top ? 'Adding at the top level' : 'Adding into: ' + (f && clean(f.value) || 'this folder');
    if (!pulled && tdToken()) pull().then(() => { if (lastView == 'fav') favView(); }, e => { syncMsg = 'Sync didn\'t go through: ' + (e.message || e); });
    if (!results.length || lastView == 'fav') favView();
    if (!MOBILE) termIn.focus();   // on the phone, don't throw the keyboard up straight away
  }

  let results = [], waitingLogin = false, lastView = 'search', loginPoll = null;
  // with a saved login, sign in in the background: read the supplier's own sign in form (its hidden token and all),
  // fill the email and password, send it, then check you're really in. No tab to open or close.
  async function bgLogin(sup) {
    const cred = GM_getValue('cred_' + sup, null); if (!cred || !cred.u || !cred.p) return false;
    const pg = await get(LOGIN[sup]); const doc = html(pg.responseText);
    const pw = doc.querySelector('input[type=password]'); const f = pw && pw.closest('form'); if (!f) { debug.login = sup + ': no sign in form'; return false; }
    const fields = {};
    let user = null;
    [...f.querySelectorAll('input,select,textarea')].forEach(i => {
      if (!i.name) return;
      const t = (i.type || '').toLowerCase();
      if (t == 'password') { fields[i.name] = cred.p; return; }
      if (!user && /^(email|text)$/.test(t)) { user = i; fields[i.name] = cred.u; return; }
      if (t == 'checkbox' || t == 'radio') { if (i.checked || /remember|keep|stay/i.test(i.name)) fields[i.name] = i.value || 'on'; return; }
      if (/^(submit|button|image|file)$/.test(t)) return;
      fields[i.name] = i.value || '';
    });
    if (!user) { debug.login = sup + ': no email box'; return false; }
    const action = new URL(f.getAttribute('action') || LOGIN[sup], pg.finalUrl || LOGIN[sup]).href;
    const r = await post(action, form(fields));
    debug.login = sup + ': sent ' + r.status + ' to ' + action.replace(/\?.*/, '') + ', landed ' + (r.finalUrl || '').replace(/\?.*/, '');
    // really in?
    if (sup == 'CNW') { const c = await get(CNW + '/cart'); return !/\/login\b/.test(c.finalUrl || '') && !cnwOut(c.responseText); }
    const a = await get(TZ + '/customer/account/'); return !/customer\/account\/login/.test(a.finalUrl || '') && signedIn(a.responseText);
  }
  async function startLogin(sup) {
    if (GM_getValue('cred_' + sup, null)) {
      msg.textContent = 'Signing in to ' + sup + '…';
      let ok = false; try { ok = await bgLogin(sup); } catch (e) { debug.login = sup + ': ' + (e.message || e); }
      if (ok) { msg.textContent = 'Signed in to ' + sup + ', searching again…'; lastView == 'order' ? orderView() : run(); return; }
      msg.textContent = 'Couldn\'t sign in to ' + sup + ' in the background, opening their page instead.';
    }
    openLogin(sup);
  }
  function openLogin(sup) {
    const at = Date.now();
    GM_setValue('loginReq', { sup, at }); GM_setValue('loginDone', null);
    waitingLogin = true; W.open(LOGIN[sup], '_blank');
    msg.textContent = 'Signing in to ' + sup + ' in the other tab. This searches again once you\'re in.';
    clearInterval(loginPoll);
    loginPoll = setInterval(() => {
      const d = GM_getValue('loginDone', null);
      if (d && d.sup == sup && d.at >= at) { clearInterval(loginPoll); waitingLogin = false; msg.textContent = 'Signed in to ' + sup + ', searching again…'; lastView == 'order' ? orderView() : run(); }
    }, 1500);
    setTimeout(() => clearInterval(loginPoll), 10 * 60e3);
  }
  // back from signing in: search again by itself
  document.addEventListener('visibilitychange', () => { if (document.visibilityState == 'visible' && waitingLogin && !loginPoll && box && box.style.display != 'none' && clean(termIn.value)) setTimeout(run, 600); });
  let lastOut = [];
  async function run() {
    const term = clean(termIn.value); if (!term) return favView(); lastView = 'search';
    const use = s => box.querySelector('.opt input[data-s="' + s + '"]').checked;
    msg.textContent = 'Searching…'; list.innerHTML = '';
    const jobs = [];
    if (use('CNW')) jobs.push(searchCnw(term).then(r => ({ s: 'CNW', r }), e => ({ s: 'CNW', e })));
    if (use('Tradezone')) jobs.push(searchTz(term).then(r => ({ s: 'Tradezone', r }), e => ({ s: 'Tradezone', e })));
    const out = await Promise.all(jobs);
    out.forEach(o => { o.term = term; if (o.r) { o.page = o.r.page; o.base = o.r.base; o.next = o.r.next; } });
    const C_ = (out.find(o => o.s == 'CNW' && o.r) || {}).r || [], T_ = (out.find(o => o.s == 'Tradezone' && o.r) || {}).r || [];
    pairUp(C_, T_);
    msg.textContent = 'Checking stock…';
    await stockCheck([...C_, ...T_]);
    lastOut = out; drawResults();
    if (!out.some(o => o.e && o.e.signedOut)) waitingLogin = false;
  }
  // flick one supplier to its next or previous page, the other stays where it is
  async function pageTo(sp, d) {
    const o = lastOut.find(x => x.s == sp && x.r); if (!o) return;
    const first = sp == 'CNW' ? 0 : 1, np = Math.max(first, (o.page || first) + d);
    msg.textContent = 'Loading ' + sp + ' page ' + (np - first + 1) + '…';
    let r;
    try { r = sp == 'CNW' ? await searchCnw(o.term, np, o.base) : await searchTz(o.term, null, np, o.base); }
    catch (e) { msg.textContent = 'Couldn\'t load that page: ' + (e.message || e); return; }
    if (!r.length) { o.next = false; drawResults(); msg.textContent = 'That\'s the last page for ' + sp + '.'; return; }
    o.r = r; o.page = np; o.next = r.next; if (r.base) o.base = r.base;
    const C_ = (lastOut.find(x => x.s == 'CNW' && x.r) || {}).r || [], T_ = (lastOut.find(x => x.s == 'Tradezone' && x.r) || {}).r || [];
    [...C_, ...T_].forEach(x => delete x.other); pairUp(C_, T_);
    await stockCheck(r);
    drawResults();
    const g = list.querySelector('.grp[data-g="' + sp + '"]'); if (g) g.scrollIntoView({ block: 'start' });
  }
  function drawResults() {
    const out = lastOut; results = []; let h = '';
    out.forEach(o => {
      const shut = GM_getValue('shut' + o.s, false);
      const first = o.s == 'CNW' ? 0 : 1, pgNo = (o.page || first) - first + 1;
      const ct = o.e ? (o.e.signedOut ? 'signed out' : 'error') : o.r.length + (pgNo > 1 || o.next ? ' on page ' + pgNo : ' found');
      h += `<div class="grp" data-g="${o.s}"><span>${o.s}</span><span class="ct">${ct}</span><span class="ar">${shut ? '▸' : '▾'}</span></div><div class="gb${shut ? ' shut' : ''}" data-g="${o.s}">`;
      if (o.e && o.e.signedOut) { h += `<div class="out"><b>Signed out of ${o.s}</b>Tap Sign in. With your login saved it signs in by itself and searches again.<div class="btns"><button class="btn" data-login="${o.s}">Sign in to ${o.s}</button><button class="btn grey" data-retry="1">Try again</button></div></div></div>`; return; }
      if (o.e) { h += `<div class="warn">${esc(o.e.message || o.e)}</div><div class="btns" style="margin-top:6px"><button class="btn grey" data-retry="1">Try again</button></div></div>`; return; }
      if (!o.r.length) { h += `<div class="mt">Nothing found. If you're sure it's there, tap Copy debug and send it to Claude.</div></div>`; return; }
      o.r.forEach(it => { h += cardHtml(it, results.push(it) - 1); });
      if (pgNo > 1 || o.next) h += `<div class="pg"><button class="btn grey" data-pg="${o.s}" data-d="-1" ${pgNo > 1 ? '' : 'disabled'}>‹ Prev</button><span>Page ${pgNo}</span><button class="btn" data-pg="${o.s}" data-d="1" ${o.next ? '' : 'disabled'}>Next ›</button></div>`;
      h += '</div>';
    });
    list.innerHTML = h;
    msg.textContent = results.length + ' found. Add drops a line on the quote, then press Save Quote yourself.';
    wire(list);
  }
  async function add(b, it_, qty_, instead) {
    const it = it_ || results[+b.dataset.n]; const qty = qty_ || Number(b.parentElement.querySelector('input').value) || 1;
    const label = b.textContent;
    const lot = fitQty(qty, it) != Math.ceil(qty - 1e-9) ? ` Heads up, ${it.sup} ${lotText(it)}, so you'd have to order ${fitQty(qty, it)}.` : '';
    b.disabled = true; b.textContent = '…';
    try {
      const r = await addLine(it, qty);
      remember(it); recordPrice(it, it.price); addRecent(it);
      b.textContent = r.ok ? 'Added' : 'Check it';
      msg.textContent = r.ok ? `Added ${qty} x ${it.sup} ${it.code}${instead ? ' instead of ' + instead.sup + ' ' + instead.code : ''}${r.miss.length ? ' (couldn\'t find ' + r.miss.join(', ') + ', fill that by hand)' : ''}. Save Quote when you're done.${lot}` : 'Added, but the line didn\'t read back right. Check it before saving.';
    } catch (e) { b.textContent = label; msg.textContent = 'Didn\'t add: ' + (e.message || e); }
    setTimeout(() => { b.disabled = false; if (b.textContent != label) b.textContent = it_ ? label : 'Add again'; }, 1500);
  }
  function copyDebug(a) {
    const head = document.querySelector('th.q-col-item'); const row = itemInputs()[0] && itemInputs()[0].closest('tr');
    const t = 'AroFlo supplier items ' + (GM_info && GM_info.script.version) + ' debug\n' + JSON.stringify(debug).slice(0, 18000) + '\nAROFLO header cols: ' + (head ? [...head.parentElement.children].map(x => x.className.replace(/ui-state-default\s*/, '')).join(' | ') : 'none') + '\nAROFLO first line: ' + (row ? [...row.children].map(td => td.className + ':' + [...td.querySelectorAll('input,textarea,select')].map(i => (i.name || i.id || '?') + '/' + i.type).join(',')).join(' | ') : 'none');
    const done = ok => { a.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => { a.textContent = 'Copy debug'; }, 2000); };
    try { navigator.clipboard.writeText(t).then(() => done(true), () => fallback()); } catch (e) { fallback(); }
    function fallback() { const x = document.createElement('textarea'); x.value = t; x.style.cssText = 'position:fixed;top:0;opacity:0;font-size:16px'; document.body.appendChild(x); x.select(); x.setSelectionRange(0, t.length); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} x.remove(); done(ok); }
  }

  // ---------- the Supplier button next to Add Line Item ----------
  function place() {
    document.querySelectorAll('button').forEach(b => {
      if (!/^\s*Add Line Item\s*$/i.test(b.textContent) || b.dataset.wreSup) return;
      b.dataset.wreSup = '1';
      const s = document.createElement('button');
      s.type = 'button'; s.textContent = 'Supplier'; s.className = (b.className || '') + ' wre-sup-open';
      s.style.background = ORANGE; s.style.borderColor = ORANGE;
      s.onclick = e => { e.preventDefault(); e.stopPropagation(); open(b); };
      b.after(s);
    });
  }
  // ---------- bridge for Claude's quote skill (stage 3 pricing) ----------
  // The skill runs plain page scripts, which can't reach this script's supplier requests, so they talk by events:
  //   document.dispatchEvent(new CustomEvent('wre-sup-call', {detail: JSON.stringify({id, fn, args})}))
  // and the answer comes back as a 'wre-sup-reply' event with detail JSON {id, r} or {id, err}.
  //   ping()                      -> {v} the script's version
  //   search(term, ['CNW'])       -> [{sup, code, name, uom, price, branch, national, stock, note}] or {signedOut:'CNW'}
  //   lines()                     -> [{i, item, part, qty, value, depth}] every line on the quote, in order
  //   setValue(i, 12.34)          -> {ok, value} puts a cost in that line's Value only, reads it back. Never saves.
  const lineRows = () => itemInputs().map((inp, i) => { const row = inp.closest('tr'); const g = k => { const x = colInput(row, k); return x ? x.value : null; }; let depth = 0; for (let e = row.parentElement; e; e = e.parentElement) if (e.tagName == 'UL') depth++; return { i, inp, row, item: inp.value, part: g('partNo'), qty: g('qty'), value: g('value'), depth }; });
  const API = {
    ping: async () => ({ v: GM_info.script.version }),
    search: async (term, sups) => {
      const use = sups && sups.length ? sups : ['CNW', 'Tradezone'];
      const out = [];
      for (const sp of use) {
        try { const l = await (sp == 'CNW' ? searchCnw : searchTz)(term); await stockCheck(l); l.forEach(it => { const hh = histOf(it), last = hh[hh.length - 1]; out.push({ sup: it.sup, code: it.code, name: it.name, uom: it.uom || '', price: it.price || 0, branch: it.branch, bname: it.sup == 'CNW' ? cnwBranch() : (it.bname || ''), national: it.national, near: it.near || null, stock: it.stock || '', min: it.min || 0, step: it.step || 0, was: last && Math.abs(last[1] - (it.price || 0)) >= 0.005 ? { price: last[1], on: dmy(last[0]) } : null, note: it.note || '', _it: it }); }); }
        catch (e) { out.push(e.signedOut ? { sup: sp, signedOut: true } : { sup: sp, error: String(e.message || e) }); }
      }
      // same item at the other supplier, when both were searched
      const A = out.filter(x => x._it && x.sup == 'CNW'), B = out.filter(x => x._it && x.sup == 'Tradezone');
      if (A.length && B.length) { pairUp(A.map(x => x._it), B.map(x => x._it)); out.forEach(x => { if (x._it && x._it.other) x.other = { sup: x._it.other.sup, code: x._it.other.code, name: x._it.other.name, price: x._it.other.price }; }); }
      out.forEach(x => delete x._it);
      return out;
    },
    other: async (code, sup) => { const o = await findOther({ sup, code, part: code }); return o ? { sup: o.sup, code: o.code, name: o.name, price: o.price, branch: o.branch } : null; },
    lines: async () => lineRows().map(({ i, item, part, qty, value, depth }) => ({ i, item, part, qty, value, depth })),
    setValue: async (i, v) => {
      const L = lineRows()[i]; if (!L) throw new Error('no line ' + i);
      const val = colInput(L.row, 'value'); if (!val) throw new Error('no Value box on line ' + i);
      setv(val, Number(v).toFixed(2)); await sleep(200);
      return { ok: Math.abs(Number(val.value) - Number(v)) < 0.005, value: val.value, item: L.inp.value };
    },
  };
  document.addEventListener('wre-sup-call', async e => {
    let d; try { d = JSON.parse(e.detail); } catch (x) { return; }
    let rep_;
    try { rep_ = { id: d.id, r: await API[d.fn](...(d.args || [])) }; } catch (x) { rep_ = { id: d.id, err: String(x.message || x) }; }
    document.dispatchEvent(new CustomEvent('wre-sup-reply', { detail: JSON.stringify(rep_) }));
  });

  if (!/viewexist=1/.test(location.search) && !document.querySelector('#newQuoteContainer')) return;
  place();
  new MutationObserver(() => place()).observe(document.body, { childList: true, subtree: true });
  // an accepted quote has no Add Line Item, so give it its own Order button
  setTimeout(() => {
    if (document.querySelector('.wre-sup-open') || !document.querySelector('th.q-col-partNo')) return;
    const o = document.createElement('button'); o.type = 'button'; o.textContent = 'Order parts';
    o.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483645;background:' + ORANGE + ';color:#fff;border:0;border-radius:18px;padding:9px 14px;font:600 14px -apple-system,Segoe UI,sans-serif;box-shadow:0 2px 8px #0004';
    o.onclick = () => orderView(); document.body.appendChild(o);
  }, 2500);
})();
})();
