// ==UserScript==
// @name         AroFlo supplier items
// @namespace    wre
// @version      0.1
// @description  Supplier button on AroFlo quotes: search CNW and Tradezone with your own sign ins, pick an item, set the qty and it adds the line (item, part no, qty, cost in Value). Markup left alone, you press Save Quote.
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
  const __wreName = "aroflo-supplier-items", __wreVer = "0.1", __wreHave = new Set(["// @connect api.github.com", "// @connect raw.githubusercontent.com", "// @connect shop.cnw.com.au", "// @connect www.tradezone.com.au", "// @grant GM_getValue", "// @grant GM_setValue", "// @grant GM_xmlhttpRequest", "// @grant unsafeWindow", "// @match https://office.aroflo.com/ims/Site/Service/Quotes/*", "// @run-at document-idle"]);
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
  // ---------- the built in copy (src/aroflo-supplier-items.js at 0.1) ----------

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

  // ---------- CNW ----------
  async function searchCnw(term) {
    const r = await get(CNW + '/search?text=' + encodeURIComponent(term));
    const t = r.responseText || '';
    debug.CNW = { url: r.finalUrl || '', status: r.status, sample: '' };
    if (/\/login\b/.test(r.finalUrl || '')) throw new Error('signed out of CNW');
    const doc = html(t);
    const loc = (t.match(/stock_location=(\d+)/) || [])[1] || GM_getValue('cnwLoc', '119');
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
      items.push({ sup: 'CNW', id, code, full, name: clean(a && (a.getAttribute('data-short-name') || a.getAttribute('title') || a.textContent)), uom: clean((c.querySelector('.priceUOM span') || {}).textContent), href: a ? CNW + a.getAttribute('href') : '' });
    });
    // searched an exact code and CNW jumped straight to the product page
    if (!items.length && doc.querySelector('.scaffoldProductDisplayData')) {
      const p = doc.querySelector('.supplierCost span.price[id], span.price[id]');
      items.push({ sup: 'CNW', id: p ? p.id : '', code: clean((doc.querySelector('.scaffoldProductDisplayDataCode .product-code') || {}).textContent).replace(/^Code:\s*/i, ''), name: clean((doc.querySelector('h1') || {}).textContent), uom: clean((doc.querySelector('.scaffoldUnitOfMesureCode') || {}).textContent), href: r.finalUrl || '' });
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
    if (items.every(i => !i.price)) items.forEach(i => { i.note = 'no price, check you\'re signed in to CNW'; });
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
    if (/customer\/account\/login/.test(r && r.finalUrl || '')) throw new Error('signed out of Tradezone');
    const doc = html(t);
    const items = [], seen = new Set();
    doc.querySelectorAll('.product_item[data-product-id]').forEach(c => {
      if (c.closest('.itemslider-wrapper, .owl-wrapper')) return;  // skip sliders
      const id = c.getAttribute('data-product-id'); if (seen.has(id)) return; seen.add(id);
      const a = c.querySelector('.name a, a.hover_link, a.product-image');
      const txt = clean(c.textContent);
      const m = txt.match(/\$\s*([\d,]+\.\d{2})\s*ex/i);
      const st = c.querySelector('.stock_wrapper');
      items.push({ sup: 'Tradezone', id, code: clean((c.querySelector('h6.part') || {}).textContent), sku: (c.querySelector('h5.sku input') || {}).value || '', name: clean(a && (a.getAttribute('title') || a.textContent)), href: a ? new URL(a.getAttribute('href'), TZ).href : '', price: m ? Number(m[1].replace(/,/g, '')) : null, stock: st ? clean(st.textContent) || (/in_stock/.test(st.className) ? 'In stock' : '') : '' });
    });
    if (!items.length) debug.Tradezone.sample = t.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/\s+/g, ' ').slice(0, 8000);
    if (items.length && items.every(i => !i.price)) items.forEach(i => { i.note = 'no price, check you\'re signed in to Tradezone'; });
    return items.slice(0, 12);
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
#wre-sup .msg{padding:0 10px 6px;font-size:13px;color:#555}
#wre-sup .ls{overflow:auto;padding:0 10px 10px}
#wre-sup .grp{font:700 12px inherit;color:${GREY};text-transform:uppercase;margin:10px 0 4px}
#wre-sup .it{border:1px solid #e3e0dd;border-radius:8px;padding:8px;margin-bottom:6px}
#wre-sup .nm{font-weight:600}
#wre-sup .mt{font-size:12px;color:#666;margin-top:2px}
#wre-sup .pr{font-weight:700;color:#222}
#wre-sup .ad{display:flex;gap:6px;align-items:center;margin-top:6px}
#wre-sup .ad input{width:70px;font-size:16px;padding:6px;border:1px solid #bbb;border-radius:6px}
#wre-sup .warn{color:#b3261e}
#wre-sup a{color:${ORANGE}}
.wre-sup-open{margin-left:4px}`;
    document.head.appendChild(s);
  }
  function build() {
    css();
    box = document.createElement('div'); box.id = 'wre-sup';
    box.innerHTML = `<div class="hd"><b>Supplier items</b><button title="Close">×</button></div>
<div class="sr"><input type="search" placeholder="Search CNW and Tradezone" enterkeyhint="search"><button class="btn">Search</button></div>
<div class="opt"><label><input type="checkbox" data-s="CNW" checked> CNW</label><label><input type="checkbox" data-s="Tradezone" checked> Tradezone</label><a href="#" class="dbg" style="margin-left:auto">Copy debug</a></div>
<div class="msg"></div><div class="ls"></div>`;
    document.body.appendChild(box);
    termIn = box.querySelector('.sr input'); list = box.querySelector('.ls'); msg = box.querySelector('.msg');
    box.querySelector('.hd button').onclick = () => { box.style.display = 'none'; };
    box.querySelector('.sr .btn').onclick = run;
    termIn.addEventListener('keydown', e => { if (e.key == 'Enter') { e.preventDefault(); run(); } });
    box.querySelectorAll('.opt input').forEach(c => { c.checked = GM_getValue('use' + c.dataset.s, true); c.onchange = () => GM_setValue('use' + c.dataset.s, c.checked); });
    box.querySelector('.dbg').onclick = e => { e.preventDefault(); copyDebug(e.target); };
  }
  function open() { if (!box) build(); box.style.display = 'flex'; termIn.focus(); }

  let results = [];
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
      h += `<div class="grp">${o.s}</div>`;
      if (o.e) { h += `<div class="warn">${esc(o.e.message || o.e)}</div>`; return; }
      if (!o.r.length) { h += `<div class="mt">Nothing found. If you're sure it's there, tap Copy debug and send it to Claude.</div>`; return; }
      o.r.forEach(it => {
        const n = results.push(it) - 1;
        const stock = it.sup == 'CNW' ? (it.branch != null ? `Branch ${it.branch}, national ${it.national}` : '') : it.stock;
        h += `<div class="it"><div class="nm">${esc(it.name)}</div>
<div class="mt">${esc(it.code)}${it.uom ? ' · ' + esc(it.uom) : ''}${stock ? ' · ' + esc(stock) : ''}${it.href ? ` · <a href="${esc(it.href)}" target="_blank">view</a>` : ''}</div>
<div class="ad"><span class="pr">${it.price ? money(it.price) + ' ex' : '<span class="warn">no price</span>'}</span><span style="flex:1"></span>Qty <input type="number" min="0" step="any" value="1" inputmode="decimal"><button class="btn" data-n="${n}">Add</button></div>
${it.note ? `<div class="mt warn">${esc(it.note)}</div>` : ''}</div>`;
      });
    });
    list.innerHTML = h;
    msg.textContent = results.length + ' found. Add drops a new line on the quote, then press Save Quote yourself.';
    list.querySelectorAll('button[data-n]').forEach(b => { b.onclick = () => add(b); });
  }
  async function add(b) {
    const it = results[+b.dataset.n]; const qty = Number(b.parentElement.querySelector('input').value) || 1;
    b.disabled = true; b.textContent = '…';
    try {
      const r = await addLine(it, qty);
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
  if (!/viewexist=1/.test(location.search) && !document.querySelector('#newQuoteContainer')) return;
  place();
  new MutationObserver(() => place()).observe(document.body, { childList: true, subtree: true });
})();
})();
