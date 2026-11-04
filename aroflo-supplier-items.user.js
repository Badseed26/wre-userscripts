// ==UserScript==
// @name         AroFlo supplier items
// @namespace    wre
// @version      0.7
// @description  Supplier button on AroFlo quotes: search CNW and Tradezone with your own sign ins, pick an item, set the qty and it adds the line (item, part no, qty, cost in Value). Markup left alone, you press Save Quote. Order puts the quote's parts in your CNW or Tradezone cart (never checks out).
// @match        https://office.aroflo.com/ims/Site/Service/Quotes/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      shop.cnw.com.au
// @connect      www.tradezone.com.au
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
  const __wreName = "aroflo-supplier-items", __wreVer = "0.7", __wreHave = new Set(["// @connect api.github.com", "// @connect raw.githubusercontent.com", "// @connect shop.cnw.com.au", "// @connect www.tradezone.com.au", "// @grant GM_getValue", "// @grant GM_setValue", "// @grant GM_xmlhttpRequest", "// @grant unsafeWindow", "// @match https://office.aroflo.com/ims/Site/Service/Quotes/*", "// @run-at document-idle"]);
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
  // ---------- the built in copy (src/aroflo-supplier-items.js at 0.7) ----------

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
  // where to sign back in. The window never sees or keeps a password: it opens the supplier's own sign in page
  // in a new tab (your phone's saved passwords fill it), and searches again when you come back.
  const LOGIN = { CNW: CNW + '/login', Tradezone: TZ + '/customer/account/login/' };
  const out_ = (sup) => { const e = new Error('Signed out of ' + sup); e.signedOut = sup; return e; };
  const signedIn = t => /logout|log out|sign out|signout/i.test(t || '');

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
  // parts added through the window, so Order knows which supplier and product each Part No is
  const partMap = () => GM_getValue('partMap', {});
  const remember = it => { const m = partMap(); m[String(it.code).toUpperCase()] = { sup: it.sup, full: it.full || '', id: it.id || '', name: it.name, href: it.href || '', at: Date.now() }; const k = Object.keys(m); if (k.length > 600) k.sort((a, b) => m[a].at - m[b].at).slice(0, k.length - 600).forEach(x => delete m[x]); GM_setValue('partMap', m); };
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
    const c = GM_getValue('cnwStores', null);
    if (c && c.list && c.list.length && Date.now() - c.at < 7 * 864e5) return c.list;
    try {
      const r = await get(CNW + '/store-finder/storedata', true);
      const list = (JSON.parse(r.responseText).features || []).map(f => f.properties || {}).filter(p => p.storeId).map(p => ({ id: String(p.storeId), name: short_(p.storeName || p.town), state: p.stateCode || '' })).sort((a, b) => a.name.localeCompare(b.name));
      if (list.length) GM_setValue('cnwStores', { at: Date.now(), list });
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
  async function searchCnw(term) {
    const r = await get(CNW + '/search?text=' + encodeURIComponent(term));
    const t = r.responseText || '';
    debug.CNW = { url: r.finalUrl || '', status: r.status, sample: '' };
    if (/\/login\b/.test(r.finalUrl || '')) throw out_('CNW');
    const doc = html(t);
    const loc = await cnwLoc();
    let items = [];
    const seen = new Set();
    doc.querySelectorAll('.scaffoldProductSearchItem').forEach(c => {
      if (c.closest('.productCarousel')) return;                 // skip "you might like" sliders
      const a = c.querySelector('a.product-title');
      const full = (c.querySelector('[data-product-code]') || { getAttribute: () => '' }).getAttribute('data-product-code') || '';
      const idEl = c.querySelector('[id$="-addToCartButton"],[id$="-eligibleForAddToCart"]');
      const id = idEl ? idEl.id.split('-')[0] : '';
      const code = clean((c.querySelector('a.product-code') || {}).textContent).replace(/^Code:\s*/i, '') || full;
      if (!id || seen.has(id)) return; seen.add(id);
      items.push({ sup: 'CNW', id, code, full, name: clean(a && (a.getAttribute('data-short-name') || a.getAttribute('title') || a.textContent)), uom: clean((c.querySelector('.priceUOM span') || {}).textContent), href: a ? CNW + a.getAttribute('href') : '', img: imgOf(c, CNW, 'img.product-thumb') });
    });
    // searched an exact code and CNW jumped straight to the product page
    if (!items.length && doc.querySelector('.scaffoldProductDisplayData')) {
      const p = doc.querySelector('.supplierCost span.price[id], span.price[id]');
      items.push({ sup: 'CNW', id: p ? p.id : '', full: decodeURIComponent(((r.finalUrl || '').match(/\/p\/([^/?#]+)/) || [])[1] || ''), code: clean((doc.querySelector('.scaffoldProductDisplayDataCode .product-code') || {}).textContent).replace(/^Code:\s*/i, ''), name: clean((doc.querySelector('h1') || {}).textContent), uom: clean((doc.querySelector('.scaffoldUnitOfMesureCode') || {}).textContent), href: r.finalUrl || '', img: (doc.querySelector('meta[property="og:image"]') || { getAttribute: () => '' }).getAttribute('content') || imgOf(doc.querySelector('.scaffoldProductDisplayWrapper'), CNW) });
    }
    if (!items.length) {
      debug.CNW.sample = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').slice(0, 8000);
      return [];
    }
    items = items.slice(0, 12);
    const ids = items.map(i => i.id).filter(Boolean);
    if (ids.length) {
      const pr = await get(CNW + '/search/product/' + ids.join(',') + '?stock_location=' + loc, true);
      let list = []; try { list = JSON.parse(pr.responseText); } catch (e) { debug.CNW.prices = (pr.responseText || '').slice(0, 1500); }
      const by = {}; (Array.isArray(list) ? list : []).forEach(p => { by[String(p.code)] = p; });
      items.forEach(i => { const p = by[i.id]; if (p) { i.price = Number(p.price); i.branch = p.stockLevel; i.national = p.warehouseStockLevel; i.status = p.stockStatus; } });
    }
    if (items.every(i => !i.price)) { if (!signedIn(t)) throw out_('CNW'); items.forEach(i => { i.note = 'no price from CNW for this one'; }); }
    return items;
  }

  // ---------- Tradezone ----------
  async function searchTz(term) {
    const tries = ['/catalogsearch/result/?q=', '/search?q='];
    let t = '', r = null;
    for (const p of tries) {
      r = await get(TZ + p + encodeURIComponent(term));
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
      const a = c.querySelector('.name a, a.hover_link, a.product-image');
      const txt = clean(c.textContent);
      const m = txt.match(/\$\s*([\d,]+\.\d{2})\s*ex/i);
      const st = c.querySelector('.stock_wrapper');
      items.push({ sup: 'Tradezone', id, code: clean((c.querySelector('h6.part') || {}).textContent), sku: (c.querySelector('h5.sku input') || {}).value || '', name: clean(a && (a.getAttribute('title') || a.textContent)), href: a ? new URL(a.getAttribute('href'), TZ).href : '', price: m ? Number(m[1].replace(/,/g, '')) : null, stock: st ? clean(st.textContent) || (/in_stock/.test(st.className) ? 'In stock' : '') : '', img: imgOf(c, TZ, 'a.product-image img') });
    });
    if (!items.length) debug.Tradezone.sample = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').slice(0, 8000);
    if (items.length && items.every(i => !i.price)) { if (!signedIn(t)) throw out_('Tradezone'); items.forEach(i => { i.note = 'no price from Tradezone for this one'; }); }
    if (!items.length && !signedIn(t)) throw out_('Tradezone');
    const top = items.slice(0, 12);
    // each product page has stock per branch, the main photo and the price
    const names = [];
    await pool(top.slice(0, 8), 4, async it => {
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
      names.push(...it.branches.map(b => b.name));
      if (!it.img) { const og = d.querySelector('meta[property="og:image"]'); it.img = og ? og.getAttribute('content') : imgOf(d.querySelector('.product_media') || d.body, TZ); }
      if (!it.price) { const m = clean((d.querySelector('.price_and_points') || {}).textContent).match(/\$\s*([\d,]+\.\d{2})\s*ex/i); if (m) { it.price = Number(m[1].replace(/,/g, '')); delete it.note; } }
    });
    if (names.length) tzSeen(names);
    const want = tzBranch().toLowerCase();
    top.forEach(it => { if (!it.branches || !it.branches.length) return; const b = it.branches.find(x => x.name.toLowerCase() == want) || it.branches.find(x => x.name.toLowerCase().includes(want)); it.branch = b ? b.qty : 0; it.bname = tzBranch(); });
    return top;
  }

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

  async function addLine(it, qty) {
    const btns = [...document.querySelectorAll('button')].filter(b => /^\s*Add Line Item\s*$/i.test(b.textContent) && b.offsetParent);
    if (!btns.length) throw new Error('can\'t find Add Line Item on this page');
    const btn = btns[btns.length - 1];                          // the last one is the top level
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
    const tryCnw = async () => { const l = await searchCnw(p.part); const x = exact(l, 'CNW'); return x ? Object.assign(p, { sup: 'CNW', full: x.full, id: x.id, name: x.name, price: x.price, branch: x.branch, href: x.href }) : null; };
    const tryTz = async () => { const l = await searchTz(p.part); const x = exact(l, 'Tradezone'); return x ? Object.assign(p, { sup: 'Tradezone', id: x.id, name: x.name, price: x.price, branch: x.branch, href: x.href }) : null; };
    try {
      if (m && m.sup == 'Tradezone') return (await tryTz()) || Object.assign(p, { sup: 'Tradezone', id: m.id, name: m.name, href: m.href });
      if (m && m.sup == 'CNW') return (await tryCnw()) || Object.assign(p, { sup: 'CNW', full: m.full, id: m.id, name: m.name, href: m.href });
      return (await tryCnw()) || (await tryTz()) || Object.assign(p, { sup: '' });
    } catch (e) { return Object.assign(p, { sup: e.signedOut || '', err: e.signedOut ? 'signed out' : String(e.message || e), signedOut: e.signedOut }); }
  }
  async function cnwCart(parts) {
    const page = await get(CNW + '/cart');
    if (/\/login\b/.test(page.finalUrl || '')) throw out_('CNW');
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
    if (!box) build(); box.style.display = 'flex';
    const parts = quoteParts();
    if (!parts.length) { msg.textContent = ''; list.innerHTML = '<div class="mt">No lines with a Part No on this quote. Lines added through the Supplier window carry one, the rest you\'d order by hand.</div>'; return; }
    msg.textContent = 'Working out ' + parts.length + ' parts…'; list.innerHTML = '';
    await pool(parts, 3, resolvePart);
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
<div class="mt">${esc(p.part)}${p.branch != null ? ' · ' + esc(br) + ' ' + p.branch : ''}${p.price ? ' · ' + money(p.price) + ' ex' + moved : ''}${p.qty != p.order ? ' · quote has ' + p.qty + ', rounded up' : ''}</div>
${p.res ? `<div class="mt ${p.res == 'in cart' ? '' : 'warn'}"><b>${esc(p.res)}</b></div>` : ''}</div></label>
<div class="ad"><span style="flex:1"></span>Order <input type="number" min="1" step="1" value="${p.order}" data-q="${n}" inputmode="numeric"></div></div>`;
      });
      h += `<div class="ad"><button class="btn" data-cart="${sp}" style="flex:1">Add ticked to ${sp} cart</button><button class="btn grey" data-open="${sp}">Open cart</button></div></div>`;
    });
    const none = parts.filter(p => !p.sup && !p.signedOut);
    if (none.length) { h += `<div class="grp"><span>Not matched</span><span class="ct">${none.length}</span></div><div class="gb">` + none.map(p => `<div class="it"><div class="nm">${esc(p.item)}</div><div class="mt">${esc(p.part)} · qty ${p.order}${p.err ? ' · ' + esc(p.err) : ' · not found as an exact code on CNW or Tradezone'}</div></div>`).join('') + '</div>'; }
    list.innerHTML = h;
    msg.textContent = 'Tick what you want, check the qty, then add to the cart. It never checks out, you order on their site.';
    list.querySelectorAll('input[data-q]').forEach(i => { i.onchange = () => { const v = Math.max(1, Math.ceil(Number(i.value) || 1)); i.value = v; parts[+i.dataset.q].order = v; }; });
    list.querySelectorAll('button[data-login]').forEach(b => { b.onclick = () => W.open(LOGIN[b.dataset.login], '_blank'); });
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

  // ---------- the window ----------
  let box, list, msg, termIn;
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
#wre-sup .br label{display:flex;align-items:center;gap:4px;flex:1}
#wre-sup .br input{flex:1;min-width:0;font-size:16px;padding:5px 6px;border:1px solid #bbb;border-radius:6px}
#wre-sup .msg{padding:0 10px 6px;font-size:13px;color:#555}
#wre-sup .ls{overflow:auto;padding:0 10px 10px}
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
    box.innerHTML = `<div class="hd"><b>Supplier items</b><button class="ord" title="Order this quote" style="font:600 13px inherit;border:1px solid #fff8;border-radius:14px;padding:4px 10px">Order</button><button class="x" title="Close">×</button></div>
<div class="sr"><input type="search" placeholder="Search CNW and Tradezone" enterkeyhint="search"><button class="btn">Search</button></div>
<div class="opt"><label><input type="checkbox" data-s="CNW" checked> CNW</label><label><input type="checkbox" data-s="Tradezone" checked> Tradezone</label><a href="#" class="dbg" style="margin-left:auto">Copy debug</a></div>
<div class="opt br"><label>CNW <input list="wre-cnw-br" data-b="cnwBranch" placeholder="branch"></label><label>TZ <input list="wre-tz-br" data-b="tzBranch" placeholder="branch"></label><datalist id="wre-cnw-br"></datalist><datalist id="wre-tz-br"></datalist></div>
<div class="msg"></div><div class="ls"></div>`;
    document.body.appendChild(box);
    termIn = box.querySelector('.sr input'); list = box.querySelector('.ls'); msg = box.querySelector('.msg');
    box.querySelector('.hd .x').onclick = () => { box.style.display = 'none'; };
    box.querySelector('.hd .ord').onclick = () => orderView();
    box.querySelector('.sr .btn').onclick = run;
    termIn.addEventListener('keydown', e => { if (e.key == 'Enter') { e.preventDefault(); run(); } });
    // branch pickers: type to search, the list fills in as you go. Saved, and the search runs again on change.
    const fillLists = async () => {
      box.querySelector('#wre-cnw-br').innerHTML = (await cnwStores()).map(st => `<option value="${esc(st.name)}">${esc(st.state)}</option>`).join('');
      box.querySelector('#wre-tz-br').innerHTML = GM_getValue('tzBranches', ['Gold Coast']).map(n => `<option value="${esc(n)}">`).join('');
    };
    box.querySelectorAll('.br input').forEach(inp => {
      inp.value = inp.dataset.b == 'cnwBranch' ? cnwBranch() : tzBranch();
      inp.onfocus = () => { inp.select(); fillLists(); };
      inp.onchange = () => { const v = clean(inp.value); if (!v) { inp.value = inp.dataset.b == 'cnwBranch' ? cnwBranch() : tzBranch(); return; } GM_setValue(inp.dataset.b, v); if (clean(termIn.value) && results.length) run(); };
    });
    fillLists();
    box.querySelectorAll('.opt input[type=checkbox]').forEach(c => { c.checked = GM_getValue('use' + c.dataset.s, true); c.onchange = () => GM_setValue('use' + c.dataset.s, c.checked); });
    box.querySelector('.dbg').onclick = e => { e.preventDefault(); copyDebug(e.target); };
  }
  function open() { if (!box) build(); box.style.display = 'flex'; termIn.focus(); }

  let results = [], waitingLogin = false;
  // back from signing in: search again by itself
  document.addEventListener('visibilitychange', () => { if (document.visibilityState == 'visible' && waitingLogin && box && box.style.display != 'none' && clean(termIn.value)) setTimeout(run, 600); });
  async function run() {
    const term = clean(termIn.value); if (!term) return;
    const use = s => box.querySelector('.opt input[data-s="' + s + '"]').checked;
    msg.textContent = 'Searching…'; list.innerHTML = '';
    const jobs = [];
    if (use('CNW')) jobs.push(searchCnw(term).then(r => ({ s: 'CNW', r }), e => ({ s: 'CNW', e })));
    if (use('Tradezone')) jobs.push(searchTz(term).then(r => ({ s: 'Tradezone', r }), e => ({ s: 'Tradezone', e })));
    const out = await Promise.all(jobs);
    results = [];
    let h = '';
    out.forEach(o => {
      const shut = GM_getValue('shut' + o.s, false);
      const ct = o.e ? (o.e.signedOut ? 'signed out' : 'error') : o.r.length + ' found';
      h += `<div class="grp" data-g="${o.s}"><span>${o.s}</span><span class="ct">${ct}</span><span class="ar">${shut ? '▸' : '▾'}</span></div><div class="gb${shut ? ' shut' : ''}" data-g="${o.s}">`;
      if (o.e && o.e.signedOut) { h += `<div class="out"><b>Signed out of ${o.s}</b>Sign in on their site (your saved password should fill it), then come back here. It searches again by itself.<div class="btns"><button class="btn" data-login="${o.s}">Sign in to ${o.s}</button><button class="btn grey" data-retry="1">Try again</button></div></div></div>`; return; }
      if (o.e) { h += `<div class="warn">${esc(o.e.message || o.e)}</div><div class="btns" style="margin-top:6px"><button class="btn grey" data-retry="1">Try again</button></div></div>`; return; }
      if (!o.r.length) { h += `<div class="mt">Nothing found. If you're sure it's there, tap Copy debug and send it to Claude.</div></div>`; return; }
      o.r.forEach(it => {
        const n = results.push(it) - 1;
        const stock = it.sup == 'CNW' ? (it.branch != null ? `${cnwBranch()} ${it.branch}, national ${it.national}` : '') : (it.bname ? `${it.bname} ${it.branch || 'none'}` : it.stock);
        h += `<div class="it"><div class="row">${it.img ? `<img class="th" src="${esc(it.img)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : '<div class="th none">no pic</div>'}<div class="bd"><div class="nm">${esc(it.name)}</div>
<div class="mt">${esc(it.code)}${it.uom ? ' · ' + esc(it.uom) : ''}${stock ? ' · ' + esc(stock) : ''}${it.href ? ` · <a href="${esc(it.href)}" target="_blank">view</a>` : ''}</div>
<div class="ad"><span class="pr">${it.price ? money(it.price) + ' ex' : '<span class="warn">no price</span>'}</span><span style="flex:1"></span>Qty <input type="number" min="0" step="any" value="1" inputmode="decimal"><button class="btn" data-n="${n}">Add</button></div>
${it.note ? `<div class="mt warn">${esc(it.note)}</div>` : ''}</div></div></div>`;
      });
      h += '</div>';
    });
    list.innerHTML = h;
    msg.textContent = results.length + ' found. Add drops a new line on the quote, then press Save Quote yourself.';
    list.querySelectorAll('button[data-n]').forEach(b => { b.onclick = () => add(b); });
    list.querySelectorAll('button[data-login]').forEach(b => { b.onclick = () => { waitingLogin = true; W.open(LOGIN[b.dataset.login], '_blank'); }; });
    list.querySelectorAll('button[data-retry]').forEach(b => { b.onclick = () => run(); });
    if (!out.some(o => o.e && o.e.signedOut)) waitingLogin = false;
    // tap a supplier's heading to fold it away (remembered for next time)
    list.querySelectorAll('.grp').forEach(g => { g.onclick = () => { const b = list.querySelector('.gb[data-g="' + g.dataset.g + '"]'); const shut = !b.classList.contains('shut'); b.classList.toggle('shut', shut); g.querySelector('.ar').textContent = shut ? '▸' : '▾'; GM_setValue('shut' + g.dataset.g, shut); }; });
  }
  async function add(b) {
    const it = results[+b.dataset.n]; const qty = Number(b.parentElement.querySelector('input').value) || 1;
    b.disabled = true; b.textContent = '…';
    try {
      const r = await addLine(it, qty);
      remember(it);
      b.textContent = r.ok ? 'Added' : 'Check it';
      msg.textContent = r.ok ? `Added ${qty} x ${it.code}${r.miss.length ? ' (couldn\'t find ' + r.miss.join(', ') + ', fill that by hand)' : ''}. Save Quote when you're done.` : 'Added, but the line didn\'t read back right. Check it before saving.';
    } catch (e) { b.textContent = 'Add'; msg.textContent = 'Didn\'t add: ' + (e.message || e); }
    setTimeout(() => { b.disabled = false; if (b.textContent != 'Add') b.textContent = 'Add again'; }, 1500);
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
      s.onclick = e => { e.preventDefault(); e.stopPropagation(); open(); };
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
        try { (await (sp == 'CNW' ? searchCnw : searchTz)(term)).forEach(it => out.push({ sup: it.sup, code: it.code, name: it.name, uom: it.uom || '', price: it.price || 0, branch: it.branch, bname: it.sup == 'CNW' ? cnwBranch() : (it.bname || ''), national: it.national, stock: it.stock || '', note: it.note || '' })); }
        catch (e) { out.push(e.signedOut ? { sup: sp, signedOut: true } : { sup: sp, error: String(e.message || e) }); }
      }
      return out;
    },
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
