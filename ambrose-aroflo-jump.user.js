// ==UserScript==
// @name         Ambrose <-> AroFlo jump
// @namespace    wre
// @version      3.12
// @description  "Open in AroFlo" on Ambrose PO and Tradies Web pages, "Open in Ambrose" on AroFlo tasks, and AroFlo labour hours, job profit and an invoiced-vs-PO-value log on the Ambrose PO list and PO pages
// @match        https://office.aroflo.com/*
// @match        https://tradiesadmin.ambroseconstruct.com.au/*
// @match        https://tradies.ambrosebuilding.com.au/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      office.aroflo.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/ambrose-aroflo-jump.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/ambrose-aroflo-jump.user.js
// ==/UserScript==

(function () {
  'use strict';

  const AF = 'https://office.aroflo.com';
  const AMB = 'https://tradiesadmin.ambroseconstruct.com.au';
  const ORANGE = '#e8731a';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const host = location.hostname;
  const rowText = r => [...r.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()).join('\t');

  // Where our UI lives. Ambrose is a Blazor app whose root component owns <html>, <head> and <body>: any extra node
  // we drop in there can make its next render die with "insertBefore null" and the yellow "An error has occurred"
  // bar. So on Ambrose everything of ours goes in a shadow root on <body> (the page itself is slotted through,
  // untouched) which Blazor's DOM diffing never looks inside. Elsewhere it's just <html>.
  function ui() {
    if (host !== 'tradiesadmin.ambroseconstruct.com.au' || !document.body) return document.documentElement;
    let r = document.body.shadowRoot;
    if (!r) { try { r = document.body.attachShadow({ mode: 'open' }); } catch (e) { return document.documentElement; } }
    if (!r.querySelector('slot')) r.prepend(document.createElement('slot'));
    return r;
  }
  const byId = id => ui().querySelector('#' + id);

  function toast(m, bad) {
    let t = byId('wre-jump-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'wre-jump-toast';
      t.style.cssText = 'position:fixed;bottom:64px;right:18px;max-width:420px;z-index:2147483647;padding:10px 14px;border-radius:6px;font:14px/1.4 sans-serif;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3)';
      ui().append(t);
    }
    t.style.background = bad ? '#b3261e' : ORANGE;
    t.textContent = m;
    clearTimeout(t._h);
    t._h = setTimeout(() => t.remove(), bad ? 8000 : 4000);
  }

  function makeBtn(id, text, bottom, fn) {
    const b = document.createElement('button');
    b.id = id;
    b.textContent = text;
    b.style.cssText = 'position:fixed;right:18px;bottom:' + bottom + 'px;z-index:2147483646;background:' + ORANGE + ';color:#fff;border:0;border-radius:6px;padding:9px 13px;font:600 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer';
    b.addEventListener('click', async () => { b.disabled = true; try { await fn(b); } catch (e) { toast('Stopped: ' + e.message, true); } b.disabled = false; });
    return b;
  }

  // PC: jumps open a new tab. iPhone: same tab, so you don't end up with a pile of Safari tabs.
  const PHONE = matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const open = url => PHONE ? location.assign(url) : GM_openInTab(url, { active: true, insert: true });

  // ======================= Ambrose side: Open in AroFlo =======================
  function gm(opts) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({ ...opts, timeout: 30000, onload: resolve, onerror: () => reject(new Error('couldn\'t reach AroFlo')), ontimeout: () => reject(new Error('AroFlo took too long')) }));
  }

  async function searchTasks(term, field) {
    const body = new URLSearchParams({ taskString: term, SearchParam: field, searchtasks: 'Search', searchtasks_btn: 'Search' }).toString();
    const r = await gm({ method: 'POST', url: AF + '/ims/Site/Home/index.cfm?tid=IMS.STK.CUR', data: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (/name=["']?password|loginForm/i.test(r.responseText) && !/workrequest/i.test(r.responseText)) throw new Error('AroFlo is signed out. Open AroFlo, sign in, then try again');
    const d = new DOMParser().parseFromString(r.responseText, 'text/html');
    return [...d.querySelectorAll('tr')].filter(tr => tr.querySelectorAll('td').length >= 6).map(tr => {
      const c = [...tr.querySelectorAll('td')].map(x => clean(x.textContent)).filter(Boolean);
      const a = [...tr.querySelectorAll('a')].find(a => /workrequest/.test(a.getAttribute('href') || '') && !/printview/.test(a.getAttribute('href')));
      return { jn: c[1], task: c[4] || '', status: c[c.length - 1] || '', href: a ? a.getAttribute('href') : '' };
    }).filter(t => t.href && /^\d+$/.test(t.jn || ''));
  }

  function ambroseInfo() {
    const t = document.body.innerText;
    const po = (t.match(/\b(\d{8}-\d{2,3})\b/) || [])[1] || '';
    const m = t.match(/\b\d+[A-Za-z]?\/?\d*\s+([A-Z][A-Za-z']+(?:\s[A-Z][A-Za-z']+)*)\s+(?:Street|St|Road|Rd|Drive|Dr|Avenue|Ave|Court|Ct|Place|Pl|Crescent|Cres|Terrace|Tce|Close|Cl|Parade|Pde|Way|Lane|Ln|Circuit|Cct|Boulevard|Blvd|Highway|Hwy|Grove|Gr|Esplanade)\b/);
    return { po, street: m ? m[1] : '' };
  }

  function chooser(tasks) {
    byId('wre-jump-pick')?.remove();
    const box = document.createElement('div');
    box.id = 'wre-jump-pick';
    box.style.cssText = 'position:fixed;right:18px;bottom:110px;z-index:2147483647;background:#fff;color:#222;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.4);font:13px sans-serif;max-width:420px;overflow:hidden';
    tasks.forEach(t => {
      const row = document.createElement('div');
      row.textContent = 'JN ' + t.jn + '  ' + String(t.task || t.name || '').slice(0, 50) + '  (' + t.status + ')';
      row.style.cssText = 'padding:8px 12px;cursor:pointer;border-bottom:1px solid #eee';
      row.onmouseenter = () => (row.style.background = '#f7f1ec');
      row.onmouseleave = () => (row.style.background = '');
      row.onclick = () => { box.remove(); open(AF + t.href); };
      box.append(row);
    });
    const x = document.createElement('div');
    x.textContent = 'Close';
    x.style.cssText = 'padding:6px 12px;text-align:right;color:#777;cursor:pointer';
    x.onclick = () => box.remove();
    box.append(x);
    ui().append(box);
  }

  async function openInAroFlo() {
    const { po, street } = ambroseInfo();
    if (!po && !street) return toast('Couldn\'t see a PO number or address on this page.', true);
    toast('Finding it in AroFlo...');
    let tasks = [], near = [];
    try {
      await ensureIndex();
      let m = await matchFull(po, street);
      // not found: the task might be newer than our saved list, or its description changed since we last read it.
      // Get a fresh list and re-read the descriptions before giving up.
      if (!m.tasks.length) { await freshIndex(); m = await matchFull(po, street, 0); }
      tasks = m.tasks; near = m.near || [];
    } catch (e) { /* fall back to a live search */ }
    if (tasks.length === 1) return open(AF + tasks[0].href);
    if (tasks.length > 1) { chooser(tasks); return toast(tasks.length + ' tasks have PO ' + po + ' in the description. Pick one.'); }
    // nothing has the full PO: show what shares the base number, but say so
    if (!near.length && po) near = await searchTasks(po.slice(0, 8), 'CustOn');
    if (!near.length && street) near = await searchTasks(street, 'Location');
    if (!near.length) return toast('Couldn\'t find ' + (po ? 'PO ' + po : street) + ' in AroFlo.', true);
    chooser(near);
    toast('No task has PO ' + po + ' in its description. These share the number or street, check before using one.', true);
  }

  // ======================= Ambrose side: finish an "Open in Ambrose" jump =======================
  async function finishJump(po) {
    const base = po.slice(0, 8);
    toast('Finding PO ' + po + ' in Ambrose...');
    let search;
    for (let i = 0; i < 400 && !(search = document.querySelector('input[type=search]')); i++) await sleep(150);
    if (!search) return toast('Couldn\'t get to the PO search. Are you logged in to Ambrose?', true);
    await sleep(600); // a beat for Blazor to wire the page up before we click anything on it
    const all = [...document.querySelectorAll('div.widget')].find(e => /Show All PO/i.test(e.textContent));
    const rowCount = () => document.querySelectorAll('tbody tr').length;
    if (all) { const n0 = rowCount(); all.click(); for (let i = 0; i < 20 && rowCount() === n0; i++) await sleep(150); await sleep(150); }
    search.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, base);
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.dispatchEvent(new Event('change', { bubbles: true }));
    search.dispatchEvent(new KeyboardEvent('keyup', { key: base.slice(-1), bubbles: true }));
    let rows = [];
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      rows = [...document.querySelectorAll('tbody tr')].filter(r => rowText(r).startsWith(base));
      if (rows.length) break;
    }
    const exact = rows.filter(r => po.length > 8 && rowText(r).startsWith(po));
    const pick = exact.length === 1 ? exact[0] : rows.length === 1 ? rows[0] : null;
    sessionStorage.removeItem('wrePendingPo'); // we got as far as the list, so don't redo this after a reload
    if (pick) { (pick.querySelector('.pointer-enabled') || pick.querySelector('td')).click(); return; }
    if (rows.length > 1) return toast(rows.length + ' POs start with ' + base + '. Pick the one you want.');
    toast('PO ' + po + ' isn\'t in the Purchase Orders list. It might be under Invoices or Paid Invoices.', true);
  }

  // ======================= AroFlo side: Open in Ambrose =======================
  function arofloPo() {
    const t = document.body.innerText;
    if (!/Ambrose/i.test(t)) return '';
    const full = t.match(/P\.?\s?O\.?\s*(?:No|Number|#)?\s*[:\-]?\s*(\d{8}-\d{2,3})\b/i) || t.match(/\b(\d{8}-\d{2,3})\b/);
    if (full) return full[1];
    const title = clean(document.title).match(/^JN \d+ - (\d{8})\b/) || clean(document.title).match(/\b(\d{8})\b/);
    return title ? title[1] : '';
  }

  // ======================= wiring =======================
  if (host === 'office.aroflo.com') {
    // task pages only; read the page once it's loaded (a few tries, no ongoing watching)
    if (!/workrequest\/index\.cfm/i.test(location.pathname) || !/wrCoded=/i.test(location.search)) return;
    (async () => {
      for (let i = 0; i < 6; i++) {
        const po = arofloPo();
        if (po) {
          ui().append(makeBtn('wre-jump-amb', 'Open in Ambrose', 18, async () => open(AMB + '/PurchaseOrders#wre-po=' + po)));
          // Ambrose task names should start with the PO number ("20334628 - address"). Warn only, never rename.
          const name = (clean(document.title).match(/^JN \d+ - (.+)$/) || [])[1];
          if (name && !name.startsWith(po.slice(0, 8))) {
            const w = document.createElement('div');
            w.id = 'wre-jump-name';
            w.textContent = 'Task name should start with ' + po.slice(0, 8);
            w.title = 'Ambrose task names go "' + po.slice(0, 8) + ' - full address". The jump still works, this is just to keep things tidy.';
            w.style.cssText = 'position:fixed;right:18px;bottom:62px;z-index:2147483646;background:#b3261e;color:#fff;border-radius:6px;padding:6px 10px;font:600 12px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35)';
            ui().append(w);
          }
          return;
        }
        await sleep(1500);
      }
    })();
    return;
  }

  if (host === 'tradiesadmin.ambroseconstruct.com.au') {
    // "Open in Ambrose" lands here with the PO in the hash. Keep it in sessionStorage so that if Ambrose has to be
    // reloaded (see below) the jump still happens on the page that comes back.
    const m = location.hash.match(/wre-po=(\d{8}(?:-\d{2,3})?)/);
    if (m) { history.replaceState(null, '', location.pathname); sessionStorage.setItem('wrePendingPo', m[1] + '|' + Date.now()); }
    const pend = (sessionStorage.getItem('wrePendingPo') || '').split('|');
    if (pend[0] && Date.now() - +pend[1] < 3 * 60000 && /^\/PurchaseOrders\/?$/i.test(location.pathname)) finishJump(pend[0]);
    else if (pend[0]) sessionStorage.removeItem('wrePendingPo');

    // Ambrose often doesn't come up: spinner forever, or the yellow "An error has occurred" bar. Reload for you
    // until it does. Gives up after 6 goes in a row so a real outage doesn't loop forever.
    const t0 = Date.now();
    let reloadAt = 0;
    const loaded = () => { const mn = document.querySelector('main'); return !!(mn && (mn.querySelector('div.widget, table, form, input, h3, h4') || clean(mn.textContent).length > 60)); };
    const stuck = () => {
      const err = document.getElementById('blazor-error-ui');
      if (err && getComputedStyle(err).display !== 'none') return 'Ambrose crashed';
      const rc = document.getElementById('components-reconnect-modal');
      if (rc && getComputedStyle(rc).display !== 'none' && Date.now() - t0 > 8000) return 'Ambrose lost its connection';
      if (!loaded() && Date.now() - t0 > 6000) return 'Ambrose never finished loading';
      return '';
    };
    setInterval(() => {
      if (document.hidden) return;
      const why = stuck();
      let n = +(sessionStorage.getItem('wreReloads') || 0);
      if (!why) { if (loaded() && n) sessionStorage.setItem('wreReloads', '0'); reloadAt = 0; return; }
      if (n >= 8) { if (!byId('wre-jump-toast')) toast(why + ' and 8 reloads haven\'t fixed it. Leaving it alone now, try again later.', true); return; }
      if (!reloadAt) { reloadAt = Date.now() + 600; toast(why + ', reloading (' + (n + 1) + ' of 8)...', true); return; }
      if (Date.now() >= reloadAt) { sessionStorage.setItem('wreReloads', String(n + 1)); location.reload(); }
    }, 700);
  }


  // ======================= Ambrose PO list: AroFlo labour beside each line =======================
  // Fast path: one call fetches every Ambrose task in AroFlo (about 0.5s for 500 tasks), so matching a PO
  // to a task is instant and needs no search. Labour comes from AroFlo's small per-task JSON (5KB, ~0.2s).
  const IDX_FRESH = 5 * 60000, IDX_MAX = 3 * 36e5, HRS_FRESH = 15 * 60000, MISS_FRESH = 5 * 60000, PAR = 4;
  const gmGet = (k, d) => { try { return JSON.parse(GM_getValue(k, 'null')) ?? d; } catch (e) { return d; } };
  const gmSet = (k, v) => { try { GM_setValue(k, JSON.stringify(v)); } catch (e) {} };
  const STREET_RE = /\b\d+[A-Za-z]?\/?\d*\s+([A-Z][A-Za-z']+(?:\s[A-Z][A-Za-z']+)*)\s+(?:Street|St|Road|Rd|Drive|Dr|Avenue|Ave|Court|Ct|Place|Pl|Crescent|Cres|Terrace|Tce|Close|Cl|Parade|Pde|Way|Lane|Ln|Circuit|Cct|Boulevard|Blvd|Highway|Hwy|Grove|Gr|Esplanade)\b/;
  const isLive = st => !/invoic|archiv|cancel/i.test(st);

  // task rows off AroFlo's task list page (the index and the description search both come back as this page)
  function taskRows(html) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    return [...d.querySelectorAll('tr.rowPreview[data-preview-id]')].map(tr => {
      const c = [...tr.querySelectorAll('td')].map(x => clean(x.textContent)).filter(Boolean);
      const links = [...tr.querySelectorAll('a')].map(a => a.getAttribute('href') || '');
      const a = links.find(h => /workrequest/.test(h) && !/printview/.test(h));
      const inv = links.find(h => /invoicing\/index\.cfm/.test(h) && /viewexist=1/.test(h)); // only there once a task has an invoice
      return { id: tr.getAttribute('data-preview-id'), jn: c[1], name: c[4] || '', status: c[c.length - 1] || '', href: a || '', inv: inv || '' };
    }).filter(t => t.id && /^\d+$/.test(t.jn || ''));
  }

  // ---------- phone mode ----------
  // On the iPhone, Safari won't hand AroFlo's newer sign-in (the /cf-api one) to Tampermonkey, so every cf-api
  // call comes back 401 even while you're logged in. The older AroFlo pages still work there, so when cf-api
  // says no we read the same things off those instead:
  //   full PO check: AroFlo's own task search on the description (one search per PO)
  //   labour hours and materials: the task page's costing table (same figures cf-api gives, checked on 3 jobs)
  //   invoices: the task's invoice page, which only exists once the task has an invoice
  // The invoice log needs the cf-api invoice feed, so it stays on the PC. Phone mode also skips the background
  // warm-up and only reads rows near the screen, since each task page is a big download on mobile data.
  let classic = null, classicT = 0, classicProbe = null;
  function isClassic() {
    if (classic !== null && !(classic && Date.now() - classicT > 5 * 60000)) return Promise.resolve(classic);
    if (!classicProbe) classicProbe = gm({ method: 'GET', url: AF + '/cf-api/businessunits/', headers: { accept: 'application/json' } })
      .then(r => { let j = null; try { j = JSON.parse(r.responseText); } catch (e) {} classic = !(j && j.items && j.items.length); classicT = Date.now(); return classic; })
      .catch(() => { if (classic === null) classic = false; return classic; }) // AroFlo unreachable: leave it to the normal errors
      .finally(() => { classicProbe = null; });
    return classicProbe;
  }
  const signedOut = html => /name=["']?password|loginForm/i.test(html) && !/rowPreview|afDataTable/.test(html);
  const descCache = {}; // full PO -> { t, rows }
  async function descSearch(po) {
    const c = descCache[po];
    if (c && Date.now() - c.t < HRS_FRESH) return c.rows;
    const body = new URLSearchParams({ gsfilter: '', tid: 'IMS.STK.CUR', client_id: '0', searchString: po, SearchParam: 'Desc', search: 'Search', search_btn: 'Search', searchallBU_home: 'on', selpage: '1', startrow: '1', maxrows: '50', changeview: '-3' }).toString();
    const r = await gm({ method: 'POST', url: AF + '/ims/Site/Service/managetasks/index.cfm', data: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (signedOut(r.responseText)) throw new Error('AroFlo is signed out. Open AroFlo, sign in, then try again');
    const rows = taskRows(r.responseText);
    descCache[po] = { t: Date.now(), rows };
    return rows;
  }
  const money = v => +String(v).replace(/[^0-9.\-]/g, '') || 0;
  async function fetchLabourClassic(id) {
    const t = idx && idx.tasks.find(x => x.id === id);
    if (!t || !t.href) throw new Error('no AroFlo link for that task');
    const r = await gm({ method: 'GET', url: AF + t.href });
    if (signedOut(r.responseText)) throw new Error('AroFlo is signed out. Open AroFlo, sign in, then try again');
    const d = new DOMParser().parseFromString(r.responseText, 'text/html');
    let hrs = 0, mat = 0, exp = 0, got = false;
    // open jobs: the Progress box ("Labour 4.00 hrs", "Material $110.00", "Expense $0.00"). cf-api's cost figure is
    // materials plus expenses, so the same here.
    const lines = d.body.innerText.split(/\n+/).map(clean).filter(Boolean);
    const pi = lines.indexOf('Progress');
    if (pi >= 0) {
      const box = lines.slice(pi + 1, pi + 8);
      const lab = box.find(l => /^Labour\s+[\d.]+\s*hrs?$/i.test(l)), m = box.find(l => /^Material\s+\$/i.test(l)), e = box.find(l => /^Expense\s+\$/i.test(l));
      if (lab) { got = true; hrs = +lab.match(/[\d.]+/)[0]; mat = (m ? money(m.replace(/^Material/i, '')) : 0) + (e ? money(e.replace(/^Expense/i, '')) : 0); }
    }
    // finished jobs: the costing table, one row per timesheet line and material
    if (!got) {
      const th = [...d.querySelectorAll('th,td')].find(x => /^Total Ex\(Cost\)$/.test(clean(x.textContent)));
      if (!th) throw new Error('couldn\'t read the costs on JN ' + t.jn);
      const heads = [...th.parentElement.children].map(x => clean(x.textContent));
      const iCost = heads.indexOf('Total Ex(Cost)');
      let sec = '';
      for (const tr of th.closest('table').querySelectorAll('tr')) {
        const cells = [...tr.children].map(x => clean(x.textContent));
        if (cells.length <= 2) { const h = cells.join(''); if (/^(Labour|Material|Expense|Totals)/.test(h)) sec = h.split(' ')[0]; continue; }
        if (cells.length !== heads.length) continue; // subtotal and total rows
        if (sec === 'Labour') { const hm = cells.join(' ').match(/\b([\d.]+)\s*Hrs?\s*@/i); if (hm) hrs += +hm[1]; }
        else if (sec === 'Material' || sec === 'Expense') mat += money(cells[iCost]);
      }
    }
    // open jobs link their invoice list as "Invoices (2)"; finished ones only have the invoice link on the task list
    const il = [...d.querySelectorAll('a')].find(a => /^Invoices \(\d+\)$/.test(clean(a.textContent)));
    const invList = il && +clean(il.textContent).replace(/\D/g, '') > 0 ? il.getAttribute('href') : '';
    hrs = Math.round(hrs * 100) / 100;
    hrsCache[id] = { t: Date.now(), v: hrs, mat: Math.round(mat * 100) / 100, invN: invList || t.inv ? 1 : 0, exp, pos: (hrsCache[id] && hrsCache[id].pos) || [], classic: true, invList };
    saveHrs();
    return hrs;
  }
  // a task's invoices, as [{ n, st, ex }]. Open jobs: the "Invoices (2)" list (a table: Inv. No, Description,
  // Inv. Date, Status, Total Ex.). Finished jobs: the invoice page off the task list, which shows each invoice as
  // "Status <st> Invoice <n> Date <d> Total Ex. $ <amount>" and then the task totals.
  async function invoicesClassic(t, h) {
    const url = (h && h.invList) || t.inv;
    if (!url) return [];
    const r = await gm({ method: 'GET', url: AF + url });
    if (signedOut(r.responseText)) throw new Error('AroFlo is signed out. Open AroFlo, sign in, then try again');
    const d = new DOMParser().parseFromString(r.responseText, 'text/html');
    const th = [...d.querySelectorAll('th,td')].find(x => clean(x.textContent) === 'Inv. No');
    if (th) {
      const heads = [...th.parentElement.children].map(x => clean(x.textContent));
      const iSt = heads.indexOf('Status'), iEx = heads.indexOf('Total Ex.');
      return [...th.closest('table').rows].map(row => [...row.cells].map(c => clean(c.textContent)))
        .filter(c => /^\d+$/.test(c[0]) && c.length === heads.length).map(c => ({ n: c[0], st: c[iSt], ex: money(c[iEx]) }));
    }
    const lines = d.body.innerText.split(/\n+/).map(clean).filter(Boolean);
    const out = []; let cur = null;
    for (let i = 0; i < lines.length - 1; i++) {
      const l = lines[i], nx = lines[i + 1];
      if (l === 'Status') cur = { st: nx };
      else if (cur && l === 'Invoice' && /^\d+$/.test(nx)) cur.n = nx;
      else if (cur && cur.n && l === 'Total Ex.' && cur.ex == null) { cur.ex = money(nx); out.push(cur); cur = null; }
    }
    return out;
  }

  // --- the task index ---
  let idx = gmGet('wreIdx', null); // { t, tasks: [{id, jn, name, status, href}] }
  let idxLoading = null, idxGen = 0;
  async function fetchIndex() {
    const body = new URLSearchParams({ gsfilter: '', tid: 'IMS.STK.CUR', client_id: '0', searchString: 'Ambrose', SearchParam: 'Client', search: 'Search', search_btn: 'Search', searchallBU_home: 'on', selpage: '1', startrow: '1', maxrows: '2000', changeview: '-3' }).toString();
    const r = await gm({ method: 'POST', url: AF + '/ims/Site/Service/managetasks/index.cfm', data: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (/name=["']?password|loginForm/i.test(r.responseText) && !/rowPreview/.test(r.responseText)) throw new Error('AroFlo is signed out. Open AroFlo, sign in, then try again');
    const tasks = taskRows(r.responseText);
    if (!tasks.length) throw new Error('AroFlo sent back an empty task list');
    idx = { t: Date.now(), tasks };
    gmSet('wreIdx', idx);
    idxGen++;
    live.forEach(e => { e.checked = 0; }); // every line gets re-matched against the new index
    return idx;
  }
  function freshIndex() {
    if (idx && Date.now() - idx.t < 30000) return Promise.resolve(idx);
    if (!idxLoading) idxLoading = fetchIndex().finally(() => { idxLoading = null; });
    return idxLoading;
  }
  function ensureIndex() {
    if (idx && classic && idx.tasks.length && !('inv' in idx.tasks[0])) idx.t = 0; // pre-3.7 index, no invoice links
    if (idx && Date.now() - idx.t < IDX_FRESH) return Promise.resolve(idx);
    if (!idxLoading) idxLoading = fetchIndex().finally(() => { idxLoading = null; });
    return idx && Date.now() - idx.t < IDX_MAX ? Promise.resolve(idx) : idxLoading; // stale index is fine to start with
  }

  // the PO base anywhere in the task name: usually "20334628 - address", but some are "P.O. No: 20334628-04 ..."
  const hasBase = (name, base) => new RegExp('(^|\\D)' + base + '(\\D|$)').test(name);
  function matchTasks(base, street) {
    if (!idx) return null;
    let tasks = base ? idx.tasks.filter(t => hasBase(t.name, base)) : [], how = 'po'; // a Quote task with the PO in its name is still the job
    if (!tasks.length && street) { const re = new RegExp('\\b' + street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); tasks = idx.tasks.filter(t => re.test(t.name) && !/^quote$/i.test(t.status)); how = 'street'; }
    const live = tasks.filter(t => isLive(t.status));
    let note = '', noteFull = '';
    if (live.length) tasks = live;
    else if (tasks.length > 1) { const n = tasks.length; tasks = [tasks.slice().sort((a, b) => +b.jn - +a.jn)[0]]; note = 'old'; noteFull = 'newest of ' + n + ' old tasks for this PO, none live'; }
    return { how, tasks, note, noteFull };
  }

  // Full PO matching (3.6): a task only counts for a PO when that exact PO, suffix and all, is in its description.
  // Tasks sharing the 8 digit base (a BIBB quote, a return visit) are kept as "near" for the chooser only.
  // PC only (the phone searches descriptions instead). Re-read after 15 minutes, or sooner (missAge) when the
  // saved description doesn't have the PO, so a PO added to a task shows up within a few minutes.
  async function taskPos(t, po, missAge) {
    const h = hrsCache[t.id], age = h && h.pos ? Date.now() - h.t : Infinity;
    if (age < HRS_FRESH && !(po && !h.pos.includes(po) && age >= missAge)) return h.pos;
    await enqueue(() => fetchLabour(t.id), true).catch(() => {});
    return (hrsCache[t.id] && hrsCache[t.id].pos) || [];
  }
  async function matchFull(po, street, missAge = MISS_FRESH) {
    await ensureIndex();
    if (!po || po.length <= 8) return matchTasks(po, street); // no suffix to check against
    const base = po.slice(0, 8);
    let near = idx.tasks.filter(t => hasBase(t.name, base)), how = 'po';
    if (!near.length && street) { const re = new RegExp('\\b' + street.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); near = idx.tasks.filter(t => re.test(t.name)).slice(0, 8); how = 'street'; }
    const hits = [];
    if (await isClassic()) { // phone: let AroFlo search the descriptions for the full PO
      const rows = await enqueue(() => descSearch(po), true);
      rows.forEach(r => hits.push(idx.tasks.find(t => t.id === r.id) || r));
      if (hits.length) how = 'po';
    } else for (const t of near) if ((await taskPos(t, po, missAge)).includes(po)) hits.push(t);
    let tasks = hits, note = '', noteFull = '';
    const live = hits.filter(t => isLive(t.status));
    if (live.length) tasks = live;
    else if (hits.length > 1) { tasks = [hits.slice().sort((a, b) => +b.jn - +a.jn)[0]]; note = 'old'; noteFull = 'newest of ' + hits.length + ' old tasks with this PO, none live'; }
    return { how, tasks, note, noteFull, near: tasks.length ? [] : near, full: true };
  }
  function matchFullCached(po) { // no fetching: only what's already been read
    if (!idx || !po) return [];
    return idx.tasks.filter(t => hasBase(t.name, po.slice(0, 8)) && hrsCache[t.id] && (hrsCache[t.id].pos || []).includes(po));
  }

  // --- labour per task ---
  const hrsCache = gmGet('wreHrs', {}); // id -> { t, v }
  let hrsDirty = 0;
  const saveHrs = () => { clearTimeout(hrsDirty); hrsDirty = setTimeout(() => gmSet('wreHrs', hrsCache), 800); };
  async function fetchLabour(id) {
    if (await isClassic()) return fetchLabourClassic(id);
    const r = await gm({ method: 'GET', url: AF + '/cf-api/tasks/' + id, headers: { accept: 'application/json' } });
    let j; try { j = JSON.parse(r.responseText); } catch (e) { throw new Error('AroFlo task lookup failed (' + r.status + ')'); }
    const v = j && j.counts && j.counts.labour;
    if (typeof v !== 'number') throw new Error('no labour figure on that task');
    const pos = [...new Set((((j.description || '') + ' ' + (j.customerOrderNumber || '')).replace(/&nbsp;/g, ' ').match(/\b\d{8}-\d{2,3}\b/g) || []))];
    hrsCache[id] = { t: Date.now(), v, mat: +(j.counts.totalCostEx || 0), invN: +(j.counts.invoices || 0), exp: +(j.counts.expenses || 0), pos };
    saveHrs();
    return v;
  }


  // --- job profit: invoiced ex GST minus cost. Labour at the cost rate AroFlo has on every timesheet line
  // (checked across Pearce, Ethan and Lachie on NTT, Travel and NTA: all $80/hr), plus materials at cost.
  const COST_RATE = 80;
  const profFresh = () => classic === false ? 15 * 60000 : 30 * 60000; // phone pages are big, so it checks less often
  const profCache = gmGet('wreProf', {}); // id -> { t, cost, inv, invN, exp }
  let profDirty = 0;
  const saveProf = () => { clearTimeout(profDirty); profDirty = setTimeout(() => gmSet('wreProf', profCache), 2500); };
  let buId = gmGet('wreBu', '');
  async function businessUnit() {
    if (buId) return buId;
    const r = await gm({ method: 'GET', url: AF + '/cf-api/businessunits/', headers: { accept: 'application/json' } });
    const j = JSON.parse(r.responseText);
    buId = j.items && j.items[0] && j.items[0].id;
    if (!buId) throw new Error('couldn\'t read the business unit');
    gmSet('wreBu', buId);
    return buId;
  }
  async function fetchProfit(t) {
    let h = hrsCache[t.id];
    if (!h || Date.now() - h.t > HRS_FRESH) { await fetchLabour(t.id); h = hrsCache[t.id]; }
    let inv = 0, invN = 0;
    if (h.classic) { // phone: invoices off the older AroFlo pages (links are only good for this session, so keep them fresh)
      if (Date.now() - h.t > 60000) { await fetchLabourClassic(t.id); h = hrsCache[t.id]; }
      (await invoicesClassic(t, h)).forEach(i => { if (!/void|cancel|delet/i.test(i.st || '')) { inv += i.ex; invN++; } });
    } else if (h.invN > 0) {
      const u = AF + '/cf-api/internal/invoices?' + new URLSearchParams({ businessUnitId: await businessUnit(), taskId: t.id, zoneName: 'TASK', allStatus: '1', userBuAccessType: 'thisbu' });
      const r = await gm({ method: 'GET', url: u, headers: { accept: 'application/json' } });
      const j = JSON.parse(r.responseText);
      (j.items || []).forEach(i => { if (!/void|cancel|delet/i.test(i.status || '')) { inv += +(i.totalAmountEx || 0); invN++; } });
    }
    const r = { t: Date.now(), cost: Math.round((h.v * COST_RATE + h.mat) * 100) / 100, inv, invN, exp: h.exp || 0, hrs: h.v, mat: h.mat, phone: !!h.classic };
    profCache[t.id] = r;
    saveProf();
    return r;
  }
  const fmt$ = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-AU');
  function profitText(pr) {
    if (!pr) return null;
    const how = 'cost ' + fmt$(pr.cost) + ' ex (' + pr.hrs + ' hrs at $' + COST_RATE + ' plus ' + fmt$(pr.mat) + ' materials)' + (pr.exp ? '. ' + pr.exp + ' expense' + (pr.exp > 1 ? 's' : '') + ' on the task not counted' : '');
    if (!pr.invN) return { kind: 'none', text: fmt$(pr.cost) + ' cost', title: (pr.phone ? 'No invoice AroFlo shows the phone (part invoices on open jobs only show on the PC). ' : 'Nothing invoiced on this task yet. ') + how };
    const p = pr.inv - pr.cost, pct = pr.inv ? Math.round(p / pr.inv * 100) : 0;
    return { kind: p >= 0 ? 'good' : 'bad', text: (p >= 0 ? '+' : '') + fmt$(p) + ' (' + pct + '%)', title: 'Invoiced ' + fmt$(pr.inv) + ' ex across ' + pr.invN + ' invoice' + (pr.invN > 1 ? 's' : '') + ', ' + how + '. Whole task, not just this PO.' };
  }

  // 8 lookups at a time, visible rows before background warming
  const q = { hi: [], lo: [] }; let active = 0;
  function enqueue(fn, pri) { return new Promise((res, rej) => { q[pri ? 'hi' : 'lo'].push({ fn, res, rej }); pump(); }); }
  function pump() {
    while (active < PAR && (q.hi.length || q.lo.length)) {
      const { fn, res, rej } = (q.hi.length ? q.hi : q.lo).shift(); active++;
      fn().then(res, rej).finally(() => { active--; pump(); });
    }
  }

  function resultFrom(base, street, m, hrs) {
    const tasks = m.tasks, label = m.how === 'street' ? street : 'PO ' + base;
    if (!tasks.length && m.near && m.near.length) return { kind: 'err', text: 'PO not on a task', title: 'No AroFlo task has PO ' + base + ' in its description. Same number on: ' + m.near.map(t => 'JN ' + t.jn + ' (' + t.status + ')').join(', ') + '. Add the PO to the right task.' };
    if (!tasks.length) return { kind: 'none', text: 'not in AroFlo', title: 'No AroFlo task found for PO ' + base + (street ? ' or ' + street : '') };
    if (tasks.length > 1) return { kind: 'err', text: tasks.length + ' tasks, check', title: 'More than one AroFlo task matches ' + label + ': ' + tasks.map(t => 'JN ' + t.jn + ' (' + t.status + ')').join(', ') + '. Not adding them up, check which is right.' };
    const t = tasks[0], pr = profitText(profCache[t.id]);
    const nameNote = m.how === 'po' && t.name && !t.name.startsWith(base.slice(0, 8)) ? '. JN ' + t.jn + '\'s name doesn\'t start with the PO' : '';
    if (hrs == null) return { kind: 'wait', text: 'JN ' + t.jn + ' ...', title: 'Reading labour on JN ' + t.jn + nameNote, href: t.href, jn: t.jn, pr };
    return { kind: 'ok', text: (Math.round(hrs * 100) / 100) + ' hrs' + (m.note ? ' (' + m.note + ')' : ''), title: 'JN ' + t.jn + ' (' + t.status + '): labour logged in AroFlo' + (m.how === 'street' ? '. Matched by street, not PO' : '') + (m.noteFull ? '. ' + m.noteFull : '') + nameNote, href: t.href, jn: t.jn, pr };
  }

  const live = new Map(); // base -> { res, subs }
  function labourFor(base, street, onUpdate) {
    let e = live.get(base);
    if (!e) { e = { res: null, subs: new Set(), busy: false, checked: 0 }; live.set(base, e); }
    e.subs.add(onUpdate);
    const push = res => { e.res = res; e.subs.forEach(f => f(res)); };
    if (e.res) { onUpdate(e.res); if (e.busy || Date.now() - e.checked < HRS_FRESH) return; }
    else if (e.busy) return;
    e.busy = true;
    (async () => {
      await ensureIndex();
      let m = await matchFull(base, street);
      const t = m.tasks.length === 1 ? m.tasks[0] : null;
      const cached = t && hrsCache[t.id];
      push(resultFrom(base, street, m, cached ? cached.v : null)); // instant, from what we already know
      if (t && !(cached && Date.now() - cached.t < HRS_FRESH)) push(resultFrom(base, street, m, await enqueue(() => fetchLabour(t.id), true)));
      if (t) { const pc = profCache[t.id]; if (!(pc && Date.now() - pc.t < profFresh())) { await enqueue(() => fetchProfit(t), true).catch(() => {}); push(resultFrom(base, street, m, (hrsCache[t.id] || {}).v)); } }
      if ((m.tasks.length === 0 || m.note) && idx && Date.now() - idx.t > 2 * 60000) {
        await (idxLoading || fetchIndex()).catch(() => {});
        const m2 = await matchFull(base, street);
        if (m2.tasks.length && (m2.tasks.length !== m.tasks.length || m2.note !== m.note || m2.tasks[0].id !== m.tasks[0].id)) {
          m = m2;
          const t2 = m.tasks.length === 1 ? m.tasks[0] : null;
          push(resultFrom(base, street, m, t2 && hrsCache[t2.id] ? hrsCache[t2.id].v : null));
          if (t2) { await enqueue(() => fetchProfit(t2), true).catch(() => {}); push(resultFrom(base, street, m, (hrsCache[t2.id] || {}).v)); }
        }
      }
      warmAll();
    })().catch(err => {
      if (!e.res || e.res.kind === 'wait') push({ kind: 'err', text: /signed out/i.test(err.message) ? 'AroFlo signed out' : 'lookup failed', title: err.message });
    }).finally(() => { e.busy = false; e.checked = Date.now(); });
  }

  // after the rows on screen are done, quietly warm every live Ambrose task so the next pages are instant
  let warmed = 0;
  function warmAll() {
    if (!idx || classic !== false || Date.now() - warmed < profFresh()) return;
    warmed = Date.now();
    idx.tasks.filter(t => isLive(t.status) && !(profCache[t.id] && Date.now() - profCache[t.id].t < profFresh()))
      .forEach(t => enqueue(() => fetchProfit(t), false).catch(() => {}));
  }


  // ======================= Invoice log: what's been invoiced against each PO =======================
  // Source of truth is AroFlo's invoice feed (every Ambrose invoice, with the full PO number in its description).
  // PO values come from the Ambrose PO list lines as you see them, and Ambrose's own received/paid status from its
  // Invoices and Paid Invoices tabs as you open them. Everything is kept in Tampermonkey so it survives the PO
  // dropping off Ambrose.
  const FEED_FRESH = 90 * 1000, FEED_PAGE = 100; // newest invoices re-read every 90s while you're on the list
  const log = Object.assign({ pos: {}, inv: {}, amb: {}, feedT: 0, full: false }, gmGet('wreLog', {}));
  let logDirty = 0, logVer = 1, byPoVer = 0, byPo = {};
  const saveLog = () => { logVer++; clearTimeout(logDirty); logDirty = setTimeout(() => gmSet('wreLog', log), 600); };
  // 2.0 read its own drawer rows as PO lines and saved made-up PO values; throw those out once
  if (!log.v) { Object.keys(log.pos).forEach(po => { const a = log.pos[po].addr || ''; if (!a || /^\d{8}\b/.test(a) || /#\d{4,6}/.test(a)) delete log.pos[po]; }); log.v = 2; saveLog(); }
  function poIndex() { // invoices grouped by full PO, rebuilt only when the log changes
    if (byPoVer === logVer) return byPo;
    byPo = {};
    Object.entries(log.inv).forEach(([n, i]) => { if (i.po) (byPo[i.po] = byPo[i.po] || []).push({ n, ...i }); });
    byPoVer = logVer;
    return byPo;
  }
  const PO_FULL = /\b(\d{8}-\d{2,3})\b/;
  const invoiced = st => /APPROVED|PROCESSED|PAID|SENT/i.test(st || '');
  let ambClient = gmGet('wreAmbClient', '');
  async function ambroseClientId() {
    if (ambClient) return ambClient;
    await ensureIndex();
    const r = await gm({ method: 'GET', url: AF + '/cf-api/tasks/' + idx.tasks[0].id, headers: { accept: 'application/json' } });
    const j = JSON.parse(r.responseText);
    ambClient = j.client && j.client.id;
    if (!ambClient) throw new Error('couldn\'t read the Ambrose client id');
    gmSet('wreAmbClient', ambClient);
    return ambClient;
  }
  async function feedPage(page) {
    const u = AF + '/cf-api/internal/invoices?' + new URLSearchParams({ businessUnitId: await businessUnit(), clientId: await ambroseClientId(), zoneName: 'BU', allStatus: '1', userBuAccessType: 'thisbu', limit: String(FEED_PAGE), page: String(page) });
    const r = await gm({ method: 'GET', url: u, headers: { accept: 'application/json' } });
    const j = JSON.parse(r.responseText);
    (j.items || []).forEach(i => {
      const po = ((i.description || '').match(PO_FULL) || [])[1] || '';
      log.inv[i.invoiceNumber] = { po, ex: +(i.totalAmountEx || 0), ty: i.type === 'PART_INVOICE' ? 'P' : 'F', st: i.status, d: (i.invoicedDateTime || '').slice(0, 10), jn: i.task && i.task.jobNumber, tn: i.task && i.task.name };
    });
    logVer++;
    return j.page || { number: page, count: page };
  }
  let feedBusy = null;
  function refreshFeed(onStatus) {
    if (classic) return Promise.reject(new Error('the invoice log only works on the PC'));
    if (feedBusy) return feedBusy;
    if (log.full && Date.now() - log.feedT < FEED_FRESH) return ensureIndex().then(() => {}, () => {});
    feedBusy = (async () => {
      await ensureIndex().catch(() => {});
      const first = await feedPage(1);
      const pages = first.count || 1;
      if (!log.full) { // first time: the lot, oldest to newest
        for (let p = 2; p <= pages; p++) { onStatus && onStatus('building invoice log, page ' + p + ' of ' + pages); await feedPage(p); }
        log.full = true;
      } else { // after that: just the newest couple of pages
        for (let p = Math.max(2, pages - 1); p <= pages; p++) await feedPage(p);
      }
      log.feedT = Date.now();
      saveLog();
    })().finally(() => { feedBusy = null; });
    return feedBusy;
  }

  // PO values seen on Ambrose's PO list, and Ambrose's status for invoices seen on its Invoices / Paid Invoices tabs
  function capturePoLine(text) {
    const po = (text.match(/^(\d{8}-\d{2,3})/) || [])[1];
    const ex = (text.match(/\$\s?([\d,]+\.\d\d)\s*$/) || text.match(/\$\s?([\d,]+(?:\.\d\d)?)/) || [])[1];
    if (!po || !ex) return;
    const addr = (text.split('\t')[1] || text.replace(/^\S+\s+/, '').replace(/\s+(Standard|Provisional)\b.*$/, '')).trim();
    if (!addr || /^\d{8}\b/.test(addr) || /#\d{4,6}/.test(text)) return; // not an Ambrose PO line
    const v = parseFloat(ex.replace(/,/g, ''));
    const cur = log.pos[po];
    if (!cur || cur.ex !== v || cur.addr !== addr) { log.pos[po] = { ex: v, addr, seen: Date.now() }; if (log.val) delete log.val[po]; saveLog(); } // Ambrose's own value beats a typed one
  }
  let pageT = 0, pagePo = null, pagePath = '';
  function capturePoPage() { // the single PO page: "Purchase Order #20307919-13", "PO Value Ex Gst: 856.84", address under the home icon
    if (location.pathname === pagePath && pagePo && Date.now() - pageT < 4000) return pagePo;
    if (location.pathname !== pagePath) { pagePath = location.pathname; pagePo = null; }
    pageT = Date.now();
    const t = document.body.innerText;
    const po = (t.match(/Purchase Order #\s*(\d{8}-\d{2,3})/) || [])[1];
    const ex = (t.match(/PO Value Ex\.? ?Gst:?\s*\$?\s?([\d,]+(?:\.\d\d)?)/i) || [])[1];
    if (!po || !ex) return null;
    const addr = clean((t.match(/\n\s*home\s*\n\s*([^\n]+)/) || [])[1] || '');
    const v = parseFloat(ex.replace(/,/g, ''));
    const cur = log.pos[po];
    if (!cur || cur.ex !== v || (addr && cur.addr !== addr)) { log.pos[po] = { ex: v, addr: addr || (cur && cur.addr) || '', seen: Date.now() }; if (log.val) delete log.val[po]; saveLog(); }
    pagePo = po;
    return po;
  }
  function captureAmbroseInvoices() {
    const paid = /PaidInvoices/i.test(location.pathname);
    if (!paid && !/^\/Invoices\/?$/i.test(location.pathname)) return;
    let st = paid ? 'paid' : '';
    if (!st) {
      const tile = [...document.querySelectorAll('div.widget')].find(w => /active|selected/i.test(w.className) || w.querySelector('.active, .selected'));
      const txt = clean((tile || {}).innerText || '');
      st = /Ready For Payment/i.test(txt) ? 'approved' : /Accounts Review/i.test(txt) ? 'accounts review' : /Supervisor/i.test(txt) ? 'supervisor review' : /Hold/i.test(txt) ? 'on hold' : /Declined/i.test(txt) ? 'declined' : 'received';
    }
    let changed = false;
    [...document.querySelectorAll('tbody tr')].forEach(r => {
      const c = [...r.querySelectorAll('td')].map(td => clean(td.textContent));
      const po = c.find(x => PO_FULL.test(x)), n = c.find(x => /^\d{4,6}$/.test(x));
      if (!po || !n) return;
      const run = c.find(x => /^\d{1,2} \w{3} \d\d$/.test(x)) || '';
      const cur = log.amb[n];
      if (!cur || cur.st !== st) { log.amb[n] = { st, po, run, seen: Date.now() }; changed = true; }
    });
    if (changed) saveLog();
  }

  // position of one PO: invoiced so far vs its value
  // task status by JN, from the index (Not Started / In Progress / Completed are "live": still money to come)
  const LIVE_STATUS = /^(Not Started|In Progress|Completed|Quote)$/i; // Quote gets used on real jobs too
  const taskByJn = jn => idx && idx.tasks.find(t => +t.jn === +jn);
  function poPosition(po) {
    const all = poIndex()[po] || [];
    const invs = all.filter(i => invoiced(i.st)).sort((a, b) => a.d < b.d ? -1 : 1);
    const drafts = all.filter(i => !invoiced(i.st) && !/void|cancel/i.test(i.st || '')).length;
    const sum = invs.reduce((a, i) => a + i.ex, 0);
    const p = log.pos[po], typed = (log.val || {})[po];
    const val = typed != null ? typed : p ? p.ex : null;
    const left = val != null ? Math.round((val - sum) * 100) / 100 : null;
    const partOnly = invs.length > 0 && invs.every(i => i.ty === 'P');
    const finalSent = invs.some(i => i.ty === 'F');
    // the job is the task the invoice is actually on (3.6). Only with no invoice at all do we look for a task with this exact PO.
    const own = invs.length ? invs[invs.length - 1] : all.slice().sort((a, b) => a.d < b.d ? -1 : 1).pop();
    let task = own ? taskByJn(own.jn) : null;
    if (!task && !own) { const fm = matchFullCached(po); task = fm.length === 1 ? fm[0] : null; }
    const jn = task ? task.jn : (own ? own.jn : '');
    const tstat = task ? task.status : '';
    const live = task ? LIVE_STATUS.test(tstat) : false; // every live Ambrose task is in the index, so a task that isn't there is an old closed one
    let kind, text;
    if (!invs.length) { kind = 'none'; text = drafts ? 'draft only' : 'nothing invoiced'; }
    else if (finalSent) { kind = 'done'; text = 'final sent, ' + fmt$(sum); }
    else if (!live) { kind = 'done'; text = (task ? 'task closed, ' : 'old task, ') + fmt$(sum); }
    else if (left != null && left > 0.5) { kind = 'open'; text = fmt$(sum) + ' of ' + fmt$(val) + ', ' + fmt$(left) + ' left'; }
    else if (left != null && left < -0.5) { kind = 'over'; text = fmt$(sum) + ' of ' + fmt$(val) + ', over'; }
    else if (left != null) { kind = 'done'; text = 'fully invoiced, ' + fmt$(sum); }
    else { kind = 'open'; text = 'part ' + fmt$(sum) + ', PO value?'; }
    const amb = invs.map(i => log.amb[i.n] && log.amb[i.n].st).filter(Boolean);
    return { po, val, typed, sum, left, invs, drafts, kind, text, partOnly, finalSent, live, tstat, addr: (p && p.addr) || (task && task.name.replace(/^\d{8}\s*-\s*/, '')) || '', last: invs.length ? invs[invs.length - 1].d : '', jn, href: task ? task.href : '', amb: amb.length ? amb[amb.length - 1] : '' };
  }
  const posTitle = x => {
    const lines = x.invs.map(i => '#' + i.n + ' ' + (i.ty === 'P' ? 'part' : 'final') + ' ' + fmt$(i.ex) + ' ex, ' + i.d + ' (' + (i.st || '').toLowerCase() + (log.amb[i.n] ? ', Ambrose: ' + log.amb[i.n].st : '') + ')');
    return (x.val != null ? 'PO value ' + fmt$(x.val) + ' ex' + (x.typed != null ? ' (typed in)' : '') + '. ' : 'PO value not seen on Ambrose yet, type it in the Invoice log. ') + (x.tstat ? 'Task ' + x.tstat + '. ' : '') + (lines.length ? 'Invoiced:\n' + lines.join('\n') : 'No approved invoice names this PO.') + (x.drafts ? '\n' + x.drafts + ' draft invoice still in progress in AroFlo' : '');
  };

  // --- the drawer ---
  let drawer = null, drawerOpen = false, showAll = false, filter = '';
  function renderDrawer() {
    if (!drawer) return;
    const body = drawer.querySelector('.wre-log-body'), head = drawer.querySelector('.wre-log-head');
    const pos = new Set([...Object.values(log.inv).map(i => i.po).filter(Boolean), ...Object.keys(log.pos)]);
    let rows = [...pos].map(poPosition).filter(x => x.invs.length || x.drafts);
    const open = rows.filter(x => x.kind === 'open' || x.kind === 'over');
    const noVal = open.filter(x => x.val == null).length;
    const list = (showAll ? rows : open).filter(x => !filter || (x.po + ' ' + (x.addr || '') + ' ' + (x.jn || '') + ' ' + x.invs.map(i => i.n).join(' ')).toLowerCase().includes(filter.toLowerCase()));
    list.sort((a, b) => (b.last || '') < (a.last || '') ? -1 : 1);
    head.textContent = 'Invoice log: ' + open.length + ' PO' + (open.length === 1 ? '' : 's') + ' part invoiced with more to come' + (noVal ? ' (' + noVal + ' need a PO value typed in)' : '') + (showAll ? ', showing all ' + rows.length + ' with invoices' : '') + (log.full ? '' : ' (still building, first time)') + (idx ? '' : ' (task statuses still loading)');
    const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    body.innerHTML = '<table><thead><tr><th>PO</th><th>Address</th><th>JN</th><th>Task</th><th>PO value ex</th><th>Invoiced</th><th>Left</th><th>Invoices</th><th>Ambrose</th><th>Last</th></tr></thead><tbody>' +
      list.map(x => '<tr class="k-' + x.kind + '" data-po="' + esc(x.po) + '"><td>' + esc(x.po) + '</td><td>' + esc(x.addr) + '</td><td>' + (x.href ? '<a href="' + esc(AF + x.href) + '" target="_blank">' + esc(x.jn) + '</a>' : esc(x.jn)) + '</td><td>' + esc(x.tstat) + '</td><td><input class="wre-val" value="' + (x.val != null ? x.val : '') + '" placeholder="type it" size="8" title="' + (x.typed != null ? 'Typed in. Clear it to go back to what Ambrose showed.' : x.val != null ? 'Seen on Ambrose. Type over it to correct.' : 'Not seen on Ambrose yet. Type the PO value ex GST.') + '"></td><td>' + fmt$(x.sum) + '</td><td>' + (x.left != null ? fmt$(x.left) : '?') + '</td><td title="' + esc(posTitle(x)) + '">' + x.invs.map(i => '#' + i.n + (i.ty === 'P' ? ' P' : ' F') + ' ' + fmt$(i.ex)).join(', ') + (x.drafts ? ' +' + x.drafts + ' draft' : '') + '</td><td>' + esc(x.amb) + '</td><td>' + esc(x.last) + '</td></tr>').join('') +
      '</tbody></table>' + (list.length ? '' : '<div style="padding:14px;color:#777">Nothing to show' + (log.full ? '' : ' yet, the log is still building') + '</div>');
    body.querySelectorAll('input.wre-val').forEach(inp => inp.addEventListener('change', () => {
      const po = inp.closest('tr').getAttribute('data-po'), v = parseFloat(String(inp.value).replace(/[^\d.]/g, ''));
      log.val = log.val || {};
      if (isNaN(v)) delete log.val[po]; else log.val[po] = Math.round(v * 100) / 100;
      saveLog(); renderDrawer();
    }));
  }
  function exportCsv() {
    const pos = new Set([...Object.values(log.inv).map(i => i.po).filter(Boolean), ...Object.keys(log.pos)]);
    const rows = [...pos].map(poPosition).filter(x => x.invs.length).sort((a, b) => (b.last || '') < (a.last || '') ? -1 : 1);
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [['PO', 'Address', 'JN', 'Task status', 'Position', 'PO value ex', 'Invoiced ex', 'Left ex', 'Invoices', 'Ambrose status', 'Last invoice'].map(q).join(',')]
      .concat(rows.map(x => [x.po, x.addr || '', x.jn, x.tstat, x.text, x.val, x.sum, x.left, x.invs.map(i => '#' + i.n + ' ' + (i.ty === 'P' ? 'part' : 'final') + ' $' + i.ex + ' ' + i.d).join('; '), x.amb, x.last].map(q).join(','))).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'ambrose-invoice-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function buildDrawer() {
    const st = document.createElement('style');
    st.textContent = '#wre-log{position:fixed;left:0;right:0;bottom:0;z-index:2147483645;background:#fff;color:#222;font:13px sans-serif;box-shadow:0 -3px 14px rgba(0,0,0,.35);max-height:62vh;display:flex;flex-direction:column}' +
      '#wre-log .bar{display:flex;gap:10px;align-items:center;padding:8px 14px;background:#4b4540;color:#fff;flex-wrap:wrap}#wre-log .bar b{margin-right:auto}' +
      '#wre-log .bar button,#wre-log .bar input{font:13px sans-serif;padding:4px 9px;border-radius:4px;border:1px solid #888}#wre-log .bar button{background:#f4f4f4;cursor:pointer}' +
      '#wre-log .wre-log-body{overflow:auto}#wre-log table{border-collapse:collapse;width:100%}#wre-log th{position:sticky;top:0;background:#eee;text-align:left;padding:6px 8px;font-weight:600}#wre-log td{padding:5px 8px;border-top:1px solid #eee;white-space:nowrap}' +
      '#wre-log tr.k-open td:nth-child(7){color:#b3261e;font-weight:600}#wre-log tr.k-over td:nth-child(7){color:#b3261e;font-weight:700}#wre-log tr.k-done td:nth-child(7){color:#2e7d32}#wre-log input.wre-val{font:13px sans-serif;padding:2px 6px;border:1px solid #bbb;border-radius:4px;width:80px}#wre-log a{color:#1a5fb4}' +
      '#wre-log-btn{position:fixed;left:18px;bottom:18px;z-index:2147483644;background:#4b4540;color:#fff;border:0;border-radius:6px;padding:9px 13px;font:600 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer}';
    ui().append(st);
    drawer = document.createElement('div');
    drawer.id = 'wre-log';
    drawer.style.display = 'none';
    const bar = document.createElement('div'); bar.className = 'bar';
    const head = document.createElement('b'); head.className = 'wre-log-head';
    const search = document.createElement('input'); search.placeholder = 'Find PO, street, JN or invoice #'; search.size = 28;
    search.addEventListener('input', () => { filter = search.value; renderDrawer(); });
    const all = document.createElement('button'); all.textContent = 'Show all'; all.addEventListener('click', () => { showAll = !showAll; all.textContent = showAll ? 'Open POs only' : 'Show all'; renderDrawer(); });
    const refresh = document.createElement('button'); refresh.textContent = 'Refresh'; refresh.addEventListener('click', () => { log.feedT = 0; refreshFeed(m => { head.textContent = m; }).then(renderDrawer).catch(e => toast('Stopped: ' + e.message, true)); });
    const csv = document.createElement('button'); csv.textContent = 'Export CSV'; csv.addEventListener('click', exportCsv);
    const close = document.createElement('button'); close.textContent = 'Close'; close.addEventListener('click', () => { drawerOpen = false; drawer.style.display = 'none'; });
    bar.append(head, search, all, refresh, csv, close);
    const body = document.createElement('div'); body.className = 'wre-log-body';
    drawer.append(bar, body);
    ui().append(drawer);
  }
  const logBtn = (() => { const b = document.createElement('button'); b.id = 'wre-log-btn'; b.textContent = 'Invoice log'; b.addEventListener('click', () => { if (!drawer) buildDrawer(); drawerOpen = !drawerOpen; drawer.style.display = drawerOpen ? 'flex' : 'none'; if (drawerOpen) { renderDrawer(); refreshFeed(m => { const h = drawer.querySelector('.wre-log-head'); if (h) h.textContent = m; }).then(renderDrawer).catch(() => {}); } }); return b; })();

  // badges sit in their own layer, outside Ambrose's page, lined up with each row
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483640';
  const badges = new Map();
  const COL = { ok: '#4b4540', err: '#b3261e', none: '#777', wait: '#999', good: '#2e7d32', bad: '#b3261e' };

  const INV_COL = { none: '#777', open: '#e8731a', over: '#b3261e', done: '#2e7d32' };
  function paintInvoice(b, po) {
    const c3 = b._c3; if (!c3 || !po) return;
    if (classic !== false) { c3.style.display = 'none'; c3._k = ''; return; } // phone (or not known yet): no log
    if (!log.full || !idx) { if (c3._k !== 'b') { c3._k = 'b'; c3.style.display = ''; c3.style.background = INV_COL.none; c3.textContent = 'log building...'; c3.title = 'First run: reading every Ambrose invoice out of AroFlo. About 20 seconds, once.'; } return; }
    const x = poPosition(po), k = x.kind + '|' + x.text + '|' + logVer + '|' + idxGen;
    if (c3._k === k) return;
    c3._k = k;
    c3.style.display = '';
    c3.style.background = INV_COL[x.kind] || '#777';
    c3.textContent = x.text;
    c3.title = posTitle(x);
  }
  function makeBadge(base, street) {
    const b = document.createElement('div');
    b._base = base;
    b.style.cssText = 'position:absolute;white-space:nowrap;font:600 12px/20px sans-serif;color:#fff;border-radius:10px;padding:0 9px;background:' + COL.wait + ';cursor:default;box-shadow:0 1px 4px rgba(0,0,0,.3)';
    b.style.background = 'none'; b.style.boxShadow = 'none'; b.style.padding = '0';
    if (PHONE) b.style.cssText += ';display:flex;flex-direction:column;align-items:flex-start;gap:3px;font-size:13px';
    const chip = (bg) => { const c = document.createElement('span'); c.style.cssText = 'display:inline-block;border-radius:10px;padding:0 9px;margin-left:' + (PHONE ? 0 : 4) + 'px;background:' + bg + ';box-shadow:0 1px 4px rgba(0,0,0,.3)'; return c; };
    const c1 = chip(COL.wait), c2 = chip(COL.none), c3 = chip(COL.none); c2.style.display = 'none'; c3.style.display = 'none';
    b.append(c1, c2, c3); b._c3 = c3;
    c1.textContent = '...'; b._c1 = c1;
    b._update = r => {
      if (!b.isConnected && b._gone) return;
      b._res = r;
      c1.style.background = COL[r.kind] || COL.none;
      c1.title = r.title || '';
      c1.style.cursor = r.href ? 'pointer' : 'default';
      c1.onclick = r.href ? () => open(AF + r.href) : null;
      c1.textContent = r.text;
      if (r.pr) { c2.style.display = ''; c2.style.background = COL[r.pr.kind] || COL.none; c2.textContent = r.pr.text; c2.title = r.pr.title; }
      else c2.style.display = 'none';
    };
    b._gen = -1; // started by paintLabour once we know the mode (and, on the phone, once it's near the screen)
    b._street = street;
    return b;
  }

  // On the PO list, slide Ambrose's centred content to the left so the chips have room on the right. Done with an
  // adopted stylesheet (no node added to the page, so Blazor never sees it) and only on wide screens.
  // On a phone: zoom the page out a bit (lay it out 520px wide via the existing viewport tag, an attribute change
  // only) and narrow the list so the chips get their own strip down the right.
  const PHONE_W = 520, PHONE_STRIP = 150;
  let shiftSheet = null, vpOrig = null;
  function shiftLayout(on) {
    if (on && !shiftSheet) { try { shiftSheet = new CSSStyleSheet(); shiftSheet.replaceSync(PHONE
      ? 'main > section.container { margin-left: 4px !important; margin-right: 0 !important; max-width: calc(100% - ' + PHONE_STRIP + 'px) !important; padding-left: 6px !important; padding-right: 6px !important; }'
      : '@media (min-width: 1500px){ main > section.container { margin-left: 24px !important; margin-right: auto !important; } }'); } catch (e) { return; } }
    if (PHONE) {
      const vp = document.querySelector('meta[name=viewport]');
      if (vp) {
        if (vpOrig === null) vpOrig = vp.getAttribute('content') || '';
        const want = on ? 'width=' + PHONE_W : vpOrig;
        if (vp.getAttribute('content') !== want) vp.setAttribute('content', want);
      }
    }
    if (!shiftSheet) return;
    const has = document.adoptedStyleSheets.includes(shiftSheet);
    if (on && !has) document.adoptedStyleSheets = [...document.adoptedStyleSheets, shiftSheet];
    if (!on && has) document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== shiftSheet);
  }
  function paintLabour() {
    if (host !== 'tradiesadmin.ambroseconstruct.com.au' || !/^\/PurchaseOrders\/?$/i.test(location.pathname)) {
      shiftLayout(false);
      if (layer.isConnected) { layer.remove(); badges.forEach(b => { b._gone = true; const e = live.get(b._base); if (e) e.subs.delete(b._update); b.remove(); }); badges.clear(); }
      if (logBtn.isConnected) { logBtn.remove(); if (drawer) { drawerOpen = false; drawer.style.display = 'none'; } }
      if (!paintLabour.t || Date.now() - paintLabour.t > 4000) { paintLabour.t = Date.now(); captureAmbroseInvoices(); }
      return;
    }
    shiftLayout(true);
    if (classic === null) isClassic();
    if (layer.isConnected && log.full && Date.now() - log.feedT > FEED_FRESH && !feedBusy) refreshFeed().then(() => badges.forEach((b, r) => paintInvoice(b, (rowText(r).match(/^(\d{8}-\d{2,3})/) || [])[1]))).catch(() => {});
    if (!layer.isConnected) { ui().append(layer); refreshFeed().then(() => badges.forEach((b, r) => paintInvoice(b, (rowText(r).match(/^(\d{8}-\d{2,3})/) || [])[1]))).catch(() => {}); }
    if (classic === false && !logBtn.isConnected) ui().append(logBtn);
    if (classic && logBtn.isConnected) logBtn.remove();
    const rows = [...document.querySelectorAll('tbody tr')].filter(r => !r.closest('#wre-log') && /^\d{8}\b/.test(rowText(r)));
    const seen = new Set();
    const table = rows[0] && rows[0].closest('table');
    const tr = table && table.getBoundingClientRect();
    const roomRight = tr && innerWidth - tr.right > (PHONE ? PHONE_STRIP - 10 : 190);
    rows.forEach(r => {
      const t = rowText(r);
      const full = (t.match(/^(\d{8}-\d{2,3})/) || [])[1];
      const base = full || t.match(/^(\d{8})/)[1]; // chips are per full PO now, not per base number
      capturePoLine(t);
      const sm = t.match(STREET_RE);
      let b = badges.get(r);
      if (!b || b._base !== base) { if (b) { b._gone = true; const e = live.get(b._base); if (e) e.subs.delete(b._update); b.remove(); } b = makeBadge(base, sm ? sm[1] : ''); badges.set(r, b); layer.append(b); }
      seen.add(r);
      const rr = r.getBoundingClientRect();
      const near = classic === false || (classic && rr.bottom > -innerHeight && rr.top < 2 * innerHeight);
      if (b._gen !== idxGen && near) { b._gen = idxGen; labourFor(base, sm ? sm[1] : '', b._update); }
      paintInvoice(b, full);
      b.style.top = Math.round(rr.top + scrollY + rr.height / 2 - (PHONE ? b.offsetHeight / 2 : 10)) + 'px';
      b.style.left = Math.round((roomRight ? tr.right + 8 : rr.right - b.offsetWidth - 6) + scrollX) + 'px';
    });
    badges.forEach((b, r) => { if (!seen.has(r) || !r.isConnected) { b._gone = true; const e = live.get(b._base); if (e) e.subs.delete(b._update); b.remove(); badges.delete(r); } });
    // several POs at one address on the same task: say it's the task total
    const perJn = {};
    badges.forEach(b => { if (b._res && b._res.jn) perJn[b._res.jn] = (perJn[b._res.jn] || 0) + 1; });
    badges.forEach(b => { if (b._res && b._res.kind === 'ok') b._c1.textContent = b._res.text + (perJn[b._res.jn] > 1 ? ' (task total)' : ''); });
  }
  if (host === 'tradiesadmin.ambroseconstruct.com.au') setInterval(() => { if (!document.hidden) paintLabour(); }, 1000);

  // Ambrose admin PO pages and Tradies Web booking pages get "Open in AroFlo". Light check once a second.
  const btn = makeBtn('wre-jump-af', 'Open in AroFlo', 18, openInAroFlo);
  const onAmb = host === 'tradiesadmin.ambroseconstruct.com.au';
  const wanted = () => onAmb
    ? /^\/PurchaseOrders\/[a-f0-9]{20,}/i.test(location.pathname)
    : /^\/booking\//i.test(location.pathname);

  // the invoice panel on a single Ambrose PO page: this PO's value, what's been invoiced against it, what's left
  const panel = document.createElement('div');
  panel.id = 'wre-po-panel';
  panel.style.cssText = 'position:fixed;right:18px;bottom:60px;z-index:2147483645;max-width:360px;background:#fff;color:#222;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.35);font:13px/1.45 sans-serif;overflow:hidden';
  function paintPanel() {
    const po = capturePoPage();
    if (!po || classic !== false) { if (panel.isConnected) panel.remove(); return; }
    if (!panel.isConnected || (log.full && Date.now() - log.feedT > FEED_FRESH && !feedBusy)) { if (!panel.isConnected) ui().append(panel); refreshFeed().then(() => { panel._k = ''; paintPanel(); }).catch(() => {}); }
    if (!log.full || !idx) { if (panel._k !== 'b') { panel._k = 'b'; panel.textContent = ''; const h = document.createElement('div'); h.style.cssText = 'padding:8px 12px;background:#4b4540;color:#fff;font-weight:600'; h.textContent = 'Invoice log: building, about 20 seconds'; panel.append(h); } return; }
    const x = poPosition(po), k = po + '|' + x.kind + '|' + x.text + '|' + logVer + '|' + idxGen;
    if (panel._k === k) return;
    panel._k = k;
    panel.textContent = '';
    const h = document.createElement('div');
    h.style.cssText = 'padding:8px 12px;color:#fff;font-weight:600;background:' + (INV_COL[x.kind] || '#777');
    h.textContent = 'PO ' + po + ': ' + x.text;
    panel.append(h);
    const body = document.createElement('div');
    body.style.cssText = 'padding:8px 12px';
    if (x.invs.length) x.invs.forEach(i => {
      const row = document.createElement('div');
      row.textContent = '#' + i.n + '  ' + (i.ty === 'P' ? 'part' : 'final') + '  ' + fmt$(i.ex) + ' ex  ' + i.d + (log.amb[i.n] ? '  (Ambrose: ' + log.amb[i.n].st + ')' : '');
      body.append(row);
    });
    else { const row = document.createElement('div'); row.style.color = '#777'; row.textContent = 'No approved invoice in AroFlo names this PO yet.'; body.append(row); }
    if (x.drafts) { const row = document.createElement('div'); row.style.color = '#777'; row.textContent = x.drafts + ' draft invoice still in progress in AroFlo'; body.append(row); }
    if (x.kind === 'open' && x.left != null && x.left > 0.5) { const row = document.createElement('div'); row.style.cssText = 'margin-top:6px;font-weight:600'; row.textContent = 'Next invoice: PO ' + po + ' for ' + fmt$(x.left) + ' ex'; body.append(row); }
    if (x.kind === 'open' && x.val == null) { const row = document.createElement('div'); row.style.color = '#777'; row.textContent = 'PO value not seen yet: type it in the Invoice log on the PO list.'; body.append(row); }
    if (x.kind === 'over') { const row = document.createElement('div'); row.style.cssText = 'margin-top:6px;font-weight:600;color:#b3261e'; row.textContent = 'Invoiced ' + fmt$(-x.left) + ' more than the PO value'; body.append(row); }
    panel.append(body);
  }

  setInterval(() => {
    if (document.hidden) return;
    if (classic === null) isClassic(); // PC or phone mode, worked out once per page
    const w = wanted();
    if (w && !btn.isConnected) ui().append(btn);
    if (!w && btn.isConnected) { btn.remove(); byId('wre-jump-pick')?.remove(); }
    if (onAmb) { if (w) { try { paintPanel(); } catch (e) {} } else if (panel.isConnected) panel.remove(); }
  }, 1000);
})();