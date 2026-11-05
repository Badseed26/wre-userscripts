// ==UserScript==
// @name         AroFlo supplier items
// @namespace    wre
// @version      0.14
// @description  Supplier button on AroFlo quotes: search CNW and Tradezone with your own sign ins, pick an item, set the qty and it adds the line (item, part no, qty, cost in Value). Markup left alone, you press Save Quote. Order puts the quote's parts in your CNW or Tradezone cart (never checks out).
// @match        https://office.aroflo.com/ims/Site/Service/Quotes/*
// @match        https://shop.cnw.com.au/*
// @match        https://www.tradezone.com.au/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      shop.cnw.com.au
// @connect      www.tradezone.com.au
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-supplier-items.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-supplier-items.user.js
// ==/UserScript==

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
  async function searchCnw(term) {
    // 1. the normal search. Some words (like GPO) jump to a category page instead, which loads its products later
    let r = await get(CNW + '/search?text=' + encodeURIComponent(term));
    let t = r.responseText || '';
    debug.CNW = { term, tried: [], url: r.finalUrl || '', status: r.status, sample: '' }; delete debug.cnwCard; delete debug.cnwPage;
    if (/\/login\b/.test(r.finalUrl || '') || cnwOut(t)) throw out_('CNW');
    let doc = html(t);
    const loc = await cnwLoc();
    let items = cnwCards(doc);
    debug.CNW.tried.push('search ' + items.length);
    if (!items.length) { const one = cnwProduct(doc, r.finalUrl); if (one) items.push(one); }
    // 2. the same search without the jump
    if (!items.length) {
      const r2 = await get(CNW + '/search?q=' + encodeURIComponent(term + ':relevance'));
      const d2 = html(r2.responseText); items = cnwCards(d2);
      debug.CNW.tried.push('q ' + items.length + ' ' + (r2.finalUrl || '').replace(CNW, '').slice(0, 80));
      if (items.length) { t = r2.responseText; doc = d2; }
    }
    // 3. the search box's own suggestions, then each product's page for its number and photo
    if (!items.length) {
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
    items = items.slice(0, 12);
    const ids = items.map(i => i.id).filter(Boolean);
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
      items.push({ sup: 'Tradezone', id, code: clean((c.querySelector('h6.part') || {}).textContent), sku: (c.querySelector('h5.sku input') || {}).value || '', name: clean(a && (a.getAttribute('title') || a.textContent)), href: a ? new URL(a.getAttribute('href'), TZ).href : '', price: m ? Number(m[1].replace(/,/g, '')) : null, stock: st ? clean(st.textContent) || (/in_stock/.test(st.className) ? 'In stock' : '') : '', img: imgOf(c, TZ, 'a.product-image img'), ...minStep(c) });
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
      if (!it.min && !it.step) Object.assign(it, minStep(d.querySelector('.product_wrapper, .product_view') || d.body));
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
    const tryCnw = async () => { const l = await searchCnw(p.part); const x = exact(l, 'CNW'); return x ? Object.assign(p, { sup: 'CNW', min: x.min, step: x.step, full: x.full, id: x.id, name: x.name, price: x.price, branch: x.branch, href: x.href }) : null; };
    const tryTz = async () => { const l = await searchTz(p.part); const x = exact(l, 'Tradezone'); return x ? Object.assign(p, { sup: 'Tradezone', min: x.min, step: x.step, id: x.id, name: x.name, price: x.price, branch: x.branch, href: x.href }) : null; };
    try {
      if (m && m.sup == 'Tradezone') return (await tryTz()) || Object.assign(p, { sup: 'Tradezone', id: m.id, name: m.name, href: m.href, min: m.min, step: m.step });
      if (m && m.sup == 'CNW') return (await tryCnw()) || Object.assign(p, { sup: 'CNW', full: m.full, id: m.id, name: m.name, href: m.href, min: m.min, step: m.step });
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
    if (!box) build(); box.style.display = 'flex'; lastView = 'order';
    const parts = quoteParts();
    if (!parts.length) { msg.textContent = ''; list.innerHTML = '<div class="mt">No lines with a Part No on this quote. Lines added through the Supplier window carry one, the rest you\'d order by hand.</div>'; return; }
    msg.textContent = 'Working out ' + parts.length + ' parts…'; list.innerHTML = '';
    await pool(parts, 3, resolvePart);
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
${p.res ? `<div class="mt ${p.res == 'in cart' ? '' : 'warn'}"><b>${esc(p.res)}</b></div>` : ''}</div></label>
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
<div class="opt"><label><input type="checkbox" data-s="CNW" checked> CNW</label><label><input type="checkbox" data-s="Tradezone" checked> Tradezone</label><a href="#" class="lgn" style="margin-left:auto">Logins</a><a href="#" class="dbg">Copy debug</a></div>
<div class="lg" style="display:none"><div class="mt" style="margin-bottom:6px">Saved logins sign you in by themselves when a supplier signs you out. They stay in Tampermonkey on this device only, never in the repo, and Claude never sees them. Leave one blank to tap your saved password instead.</div>
<div class="lgrow"><b>CNW</b><input data-c="CNW" data-k="u" type="email" placeholder="email" autocomplete="off"><input data-c="CNW" data-k="p" type="password" placeholder="password" autocomplete="new-password"></div>
<div class="lgrow"><b>Tradezone</b><input data-c="Tradezone" data-k="u" type="email" placeholder="email" autocomplete="off"><input data-c="Tradezone" data-k="p" type="password" placeholder="password" autocomplete="new-password"></div>
<div class="ad"><button class="btn lgsave" style="flex:1">Save logins</button><button class="btn grey lgclear">Clear both</button></div></div>
<div class="opt br"><label>CNW <input data-b="cnwBranch" placeholder="branch" autocomplete="off"></label><label>TZ <input data-b="tzBranch" placeholder="branch" autocomplete="off"></label></div><div class="sug"></div>
<div class="msg"></div><div class="ls"></div>`;
    document.body.appendChild(box);
    termIn = box.querySelector('.sr input'); list = box.querySelector('.ls'); msg = box.querySelector('.msg');
    box.querySelector('.hd .x').onclick = () => { box.style.display = 'none'; };
    box.querySelector('.hd .ord').onclick = () => orderView();
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
    const fillLg = () => lg.querySelectorAll('input').forEach(i => { const c = GM_getValue('cred_' + i.dataset.c, null); i.value = c && c[i.dataset.k] || ''; });
    box.querySelector('.lgn').onclick = e => { e.preventDefault(); const show = lg.style.display == 'none'; lg.style.display = show ? 'block' : 'none'; if (show) fillLg(); };
    box.querySelector('.lgsave').onclick = () => {
      ['CNW', 'Tradezone'].forEach(sp => { const u = clean(lg.querySelector(`input[data-c="${sp}"][data-k=u]`).value), pw = lg.querySelector(`input[data-c="${sp}"][data-k=p]`).value; GM_setValue('cred_' + sp, u && pw ? { u, p: pw } : null); });
      lg.style.display = 'none'; msg.textContent = 'Logins saved on this device.';
    };
    box.querySelector('.lgclear').onclick = () => { GM_setValue('cred_CNW', null); GM_setValue('cred_Tradezone', null); fillLg(); msg.textContent = 'Saved logins cleared.'; };
  }
  function open() { if (!box) build(); box.style.display = 'flex'; termIn.focus(); }

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
  async function run() {
    const term = clean(termIn.value); if (!term) return; lastView = 'search';
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
<div class="mt">${esc(it.code)}${it.uom ? ' · ' + esc(it.uom) : ''}${lotText(it) ? ' · <b class="warn">' + esc(lotText(it)) + '</b>' : ''}${stock ? ' · ' + esc(stock) : ''}${it.href ? ` · <a href="${esc(it.href)}" target="_blank">view</a>` : ''}</div>
<div class="ad"><span class="pr">${it.price ? money(it.price) + ' ex' : '<span class="warn">no price</span>'}</span><span style="flex:1"></span>Qty <input type="number" min="0" step="any" value="1" inputmode="decimal"><button class="btn" data-n="${n}">Add</button></div>
${it.note ? `<div class="mt warn">${esc(it.note)}</div>` : ''}</div></div></div>`;
      });
      h += '</div>';
    });
    list.innerHTML = h;
    msg.textContent = results.length + ' found. Add drops a new line on the quote, then press Save Quote yourself.';
    list.querySelectorAll('button[data-n]').forEach(b => { b.onclick = () => add(b); });
    list.querySelectorAll('button[data-login]').forEach(b => { b.onclick = () => startLogin(b.dataset.login); });
    list.querySelectorAll('button[data-retry]').forEach(b => { b.onclick = () => run(); });
    if (!out.some(o => o.e && o.e.signedOut)) waitingLogin = false;
    // tap a supplier's heading to fold it away (remembered for next time)
    list.querySelectorAll('.grp').forEach(g => { g.onclick = () => { const b = list.querySelector('.gb[data-g="' + g.dataset.g + '"]'); const shut = !b.classList.contains('shut'); b.classList.toggle('shut', shut); g.querySelector('.ar').textContent = shut ? '▸' : '▾'; GM_setValue('shut' + g.dataset.g, shut); }; });
  }
  async function add(b) {
    const it = results[+b.dataset.n]; const qty = Number(b.parentElement.querySelector('input').value) || 1;
    const lot = fitQty(qty, it) != Math.ceil(qty - 1e-9) ? ` Heads up, ${it.sup} ${lotText(it)}, so you'd have to order ${fitQty(qty, it)}.` : '';
    b.disabled = true; b.textContent = '…';
    try {
      const r = await addLine(it, qty);
      remember(it);
      b.textContent = r.ok ? 'Added' : 'Check it';
      msg.textContent = r.ok ? `Added ${qty} x ${it.code}${r.miss.length ? ' (couldn\'t find ' + r.miss.join(', ') + ', fill that by hand)' : ''}. Save Quote when you're done.${lot}` : 'Added, but the line didn\'t read back right. Check it before saving.';
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
        try { (await (sp == 'CNW' ? searchCnw : searchTz)(term)).forEach(it => out.push({ sup: it.sup, code: it.code, name: it.name, uom: it.uom || '', price: it.price || 0, branch: it.branch, bname: it.sup == 'CNW' ? cnwBranch() : (it.bname || ''), national: it.national, stock: it.stock || '', min: it.min || 0, step: it.step || 0, note: it.note || '' })); }
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
