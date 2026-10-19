// ==UserScript==
// @name         WRE Calendar NPT
// @namespace    wre
// @version      3.0.1
// @description  Notes, photos and timesheet badges on the AroFlo calendar for the days in view, kept in step with the WRE daily check issue list in Todoist, plus an A letter on Ambrose jobs for photos or the report being up on Ambrose
// @match        https://office.aroflo.com/ims/Site/Calendar/*
// @match        https://tradiesadmin.ambroseconstruct.com.au/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// @grant        window.close
// @grant        unsafeWindow
// @sandbox      JavaScript
// @connect      api.todoist.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/wre-calendar-npt.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/wre-calendar-npt.user.js
// ==/UserScript==

(function () {
  'use strict';
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window; // AroFlo's own page (jQuery, the calendar)
  if (W.__wreNPT) return;
  W.__wreNPT = 1;

  // ---------- settings ----------
  const NO_BADGE = /^(Jack|Lisa|Renee)\b/; // never badged
  const NO_CREDIT = /^Lisa\b/;             // Lisa's bookings are placeholders and her notes don't count
  const TTL = 3 * 60 * 1000;               // recheck anything not done after 3 min
  const MAX_JOBS = 3;                      // jobs read at once (3 small requests each)
  const KEY = 'wreNPT1';
  const PHOTO = /\.(jpe?g|png|heic|heif|gif|webp|bmp|tiff?|mov|mp4|m4v|avi)\b/i;
  const DOC_COLS = 'checkboxdownload,dragrow,thumbnail,document,comment,filter,datetimeinserted,uploadedby,datetimeexpires,imgdatetimetaken,imgGpslocation,category,btnpubliclink,btndelete,actions';
  const ISSUES = '6hgGFjPF6mWJGvf6';      // Todoist project: WRE daily check (the issue list)
  const FU = '6hfHcM9Gf74fgcJw';          // Todoist project: WRE follow ups (your own misses go here, due the day they're added)
  const LIST_DAYS = 14;                    // only visits from the last 14 days go on the issue list
  const LIST_HOUR = 17;                    // today's misses go on the list from 5pm
  const NICK = { Lachlan: 'Lachie' };      // names as the issue list uses them
  const OWN = /^Ethan\b/;                 // your own bookings: misses go in your follow ups, not the lads' issue list
  const MON = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

  // ---------- small helpers ----------
  const p2 = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const dmy = s => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3] + '-' + p2(m[2]) + '-' + p2(m[1]) : null; };
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const ini = full => { const p = String(full).trim().split(/\s+/); return p[0][0] + ' ' + p[p.length - 1]; };
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const first = full => String(full || '').split(' ')[0];
  const hm = t => new Date(t).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase();
  const isCancel = ev => /cancel/i.test(JSON.stringify(ev.headers || '') + (ev.title || ''));
  // Page text without scripts, then the parsed document is dropped.
  const textOf = (html, rows) => {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,style').forEach(x => x.remove());
    return rows
      ? [...d.querySelectorAll('tr')].map(r => (r.textContent || '').replace(/\s+/g, ' ').trim())
      : (d.body ? d.body.textContent : '').replace(/\s+/g, ' ');
  };
  const get = async (url, json) => {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok || /login/i.test(r.url)) throw new Error('AroFlo said no (signed out?)');
    return json ? r.json() : r.text();
  };

  // ---------- Tradies Admin (Ambrose): reads each PO's Bookings table for the A letter ----------
  // Any PO page you open gets read and saved. The calendar also opens this site in a background tab
  // ("#wre-sweep") to check the POs it needs: search the PO, open each one, read its bookings, close.
  // Saved in this script's own storage (ambData), which the calendar tab picks up straight away.
  if (location.host === 'tradiesadmin.ambroseconstruct.com.au') { ambrosePage(); return; }

  function ambrosePage() {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const MO = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const day = x => { const m = String(x || '').match(/(\d{1,2}) ([A-Z][a-z]{2}) (\d{2})\b/); return m && MO[m[2]] ? '20' + m[3] + '-' + p2(MO[m[2]]) + '-' + p2(m[1]) : null; };
    let sweep = /wre-sweep/.test(location.hash);
    try { if (sweep) sessionStorage.setItem('wreAmbSweep', '1'); else sweep = sessionStorage.getItem('wreAmbSweep') === '1'; } catch (e) {}
    const isList = () => /^\/PurchaseOrders\/?$/i.test(location.pathname);
    const isPO = () => /^\/PurchaseOrders\/[a-f0-9]{20,}/i.test(location.pathname);
    const loggedIn = () => !!document.body && /LOG OUT/.test(document.body.innerText);
    async function until(f, ms) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { try { const x = f(); if (x) return x; } catch (e) {} await sleep(400); }
      return null;
    }
    // The Bookings table on a PO page (it's in the page even while its accordion is shut):
    // [{t: type, st: status, s/e: dates, img: photo count (null = Ambrose wants none), rep: Reports cell, c: Complete cell}]
    function readBookings() {
      const tbl = [...document.querySelectorAll('table')].find(t => /Booking Type/.test(t.textContent) && /Images/.test(t.textContent));
      if (!tbl) return null;
      const out = [];
      tbl.querySelectorAll('tr').forEach(r => {
        const c = [...r.children];
        if (c.length < 9 || /Booking Type/.test(c[0].textContent)) return; // header and Comments rows
        const tx = i => c[i].textContent.replace(/\s+/g, ' ').trim();
        const btn = c[5].querySelector('button');
        const img = /^N\/?A$/i.test(tx(5)) ? null : btn && /^\d+$/.test(btn.textContent.trim()) ? +btn.textContent.trim() : 0;
        out.push({ t: tx(0), st: tx(1), s: day(tx(2)), e: day(tx(3)), img, rep: tx(6), c: tx(8) });
      });
      return out;
    }
    const poNo = () => (document.title.match(/\((\d{8}-\d{2,3})\)/) || (document.body.innerText.match(/Purchase Order #(\d{8}-\d{2,3})/)) || [])[1];
    function savePO(po, b) {
      const D = GM_getValue('ambData', {}) || {};
      D.bases = D.bases || {};
      const base = po.slice(0, 8), B = (D.bases[base] = D.bases[base] || { pos: {} });
      B.pos = B.pos || {};
      B.pos[po] = { at: Date.now(), hex: location.pathname.split('/')[2], b };
      B.at = Date.now(); delete B.none;
      GM_setValue('ambData', D);
    }
    const readPO = async () => {
      const b = await until(() => (poNo() ? readBookings() : null), 20000);
      const po = poNo();
      if (b && po) savePO(po, b);
      return po;
    };

    if (!sweep) { // you (or Lisa) looking at a PO: save what its bookings say
      let last = '';
      setInterval(() => {
        if (document.hidden || !isPO() || location.pathname === last) return;
        last = location.pathname;
        readPO().catch(() => {});
      }, 1500);
      return;
    }

    // ---- the background check ----
    const finish = () => { try { sessionStorage.removeItem('wreAmbSweep'); } catch (e) {} GM_setValue('ambSweepEnd', Date.now()); setTimeout(() => { try { window.close(); } catch (e) {} }, 300); };
    const job = () => GM_getValue('ambJob', null);
    const setJob = J => GM_setValue('ambJob', J);
    const rowsNow = () => [...document.querySelectorAll('table tbody tr td:first-child')].map(td => td.textContent.trim()).filter(x => /^\d{8}-\d{2,3}$/.test(x));
    function goList() {
      const a = [...document.querySelectorAll('a[href]')].find(x => { try { return /^\/PurchaseOrders\/?$/i.test(new URL(x.href, location.href).pathname); } catch (e) { return false; } });
      if (a) a.click(); else history.back();
    }
    function search(text) {
      const s = document.querySelector('input[type=search]');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.focus(); set.call(s, text);
      s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
      ['keydown', 'keyup'].forEach(t => s.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
    }
    function openRow(po) { // Ambrose's rows only open on a full mouse press, not a plain click()
      const tds = [...document.querySelectorAll('table tbody tr td:first-child')].filter(e => e.textContent.trim() === po);
      const d = tds.length && (tds[0].querySelector('.pointer-enabled, div') || tds[0]); // the click is listened for on the inner div
      if (!d) return false;
      const r = d.getBoundingClientRect(), o = { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5, button: 0, buttons: 1, view: window };
      ['mousedown', 'mouseup', 'click'].forEach(t => d.dispatchEvent(new MouseEvent(t, o)));
      return true;
    }
    (async () => {
      await until(() => document.body && (loggedIn() || /login|account/i.test(location.pathname)), 25000);
      if (!loggedIn()) { GM_setValue('ambErr', { at: Date.now(), msg: 'log into Tradies Admin' }); return finish(); }
      GM_setValue('ambErr', null);
      for (let guard = 0; guard < 80; guard++) {
        const J = job();
        if (!J || J.doneAt || Date.now() - J.started > 8 * 60000) return finish();
        if (!J.cur) {
          const base = (J.queue || []).shift();
          if (!base) { J.doneAt = Date.now(); setJob(J); return finish(); }
          J.cur = { base, rows: null, done: [] }; J.retry = 0; setJob(J);
        }
        const cur = J.cur;
        if (isPO()) { // on a PO: read it, then back to the list
          const po = await readPO();
          cur.done.push(po || cur.target || '?'); setJob(J);
          goList(); await until(isList, 10000); await sleep(1000);
          continue;
        }
        if (!isList()) { goList(); if (!(await until(isList, 10000))) location.href = '/PurchaseOrders'; continue; }
        if (!(await until(() => document.querySelector('input[type=search]') && document.querySelector('div.widget'), 20000))) { location.reload(); return; }
        const all = [...document.querySelectorAll('div.widget')].find(e => /Show All PO/.test(e.textContent)); // search every PO, not just one tab of them
        if (all) all.click();
        await sleep(1500);
        search(cur.base);
        await sleep(2500);
        // wait for the search to land: only this PO's rows, or Ambrose saying there are none
        if (!(await until(() => { const r = rowsNow(); return r.length ? r.every(x => x.startsWith(cur.base)) : /\b0 items\b/.test(document.body.innerText); }, 8000))) {
          J.retry = (J.retry || 0) + 1; setJob(J);
          if (J.retry > 3) { J.cur = null; setJob(J); } // Ambrose won't search it: skip it this round
          continue;
        }
        const rows = rowsNow().filter(r => r.startsWith(cur.base + '-'));
        if (cur.rows === null) { cur.rows = rows; setJob(J); }
        const next = cur.rows.find(r => !cur.done.includes(r));
        if (!next) { // this PO's done: mark it checked, even if Ambrose had nothing under it
          const D = GM_getValue('ambData', {}) || {};
          D.bases = D.bases || {};
          const B = (D.bases[cur.base] = D.bases[cur.base] || { pos: {} });
          B.at = Date.now(); if (!cur.rows.length) B.none = true;
          GM_setValue('ambData', D);
          J.cur = null; setJob(J);
          continue;
        }
        cur.target = next; setJob(J);
        if (!openRow(next) || !(await until(isPO, 10000))) { cur.done.push(next); setJob(J); }
      }
      finish();
    })().catch(() => finish());
  }

  // ---------- cache (localStorage, small) ----------
  // C.wc[wrid] = task code; C.j[wrid] = {u: last used, n/l/p: {t: read at, d: {date: ...}}}
  // Labour is kept as 'L Buckley|travel' and 'L Buckley|site'; anything older (just the name) is read again.
  let C;
  try { C = JSON.parse(W.localStorage.getItem(KEY)) || {}; } catch (e) { C = {}; }
  C.wc = C.wc || {}; C.j = C.j || {}; C.ad = C.ad || {}; // C.ad[wrid] = the job's Location from AroFlo
  (() => { // prune: jobs not looked at in 30 days, dates older than 60 days
    const old = Date.now() - 30 * 864e5, cut = ymd(new Date(Date.now() - 60 * 864e5));
    for (const w in C.j) {
      const J = C.j[w];
      if (!J.u || J.u < old) { delete C.j[w]; delete C.wc[w]; delete C.ad[w]; continue; }
      ['n', 'l', 'p'].forEach(k => { if (J[k] && J[k].d) for (const dt in J[k].d) if (dt < cut) delete J[k].d[dt]; });
      if (J.l && Object.values(J.l.d || {}).some(a => !Array.isArray(a) || a.some(x => !String(x).includes('|')))) delete J.l;
    }
  })();
  let saveT;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { W.localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) {} }, 500); };
  const errs = {}; // wrid -> message, this page load only

  // ---------- reading one job ----------
  async function code(wrid) {
    if (C.wc[wrid]) return C.wc[wrid];
    const h = await get('/ims/Site/Calendar/AJAX/AJAX_HTML_task_details.cfm?wrid=' + wrid);
    // The hidden wrCoded box is on every task, quotes included (the task link isn't). Its value comes URL-encoded.
    const inp = new DOMParser().parseFromString(h, 'text/html').getElementById('wrCoded');
    const m = h.match(/wrCoded=([^&"']+)/);
    const c = inp && inp.value ? decodeURIComponent(inp.value) : m ? decodeURIComponent(m[1].replace(/&amp;/g, '&')) : null;
    if (!c) throw new Error('no task code');
    const loc = (h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/Location:\s*(.*?)\s*(?:Task Description:|Task Type:|Client:|Contact|$)/) || [])[1];
    if (loc) C.ad[wrid] = loc.slice(0, 120);
    return (C.wc[wrid] = c);
  }

  // Notes: {date: [authors]}
  async function readNotes(E) {
    const t = textOf(await get('/ims/Site/Service/Notes/AJAX_HTML_get_notes.cfm?dateorder=0&last3notes=0&isLoaded=1&wrCoded=' + E));
    const d = {}, re = /\b(\d{1,2}) ([A-Z][a-z]+) (20\d\d) \d{1,2}:\d{2}[ap]m ([A-Z][\w'-]+ [A-Z][\w'-]+)/g;
    let m;
    while ((m = re.exec(t))) {
      if (!MON[m[2]]) continue;
      const k = m[3] + '-' + p2(MON[m[2]]) + '-' + p2(m[1]);
      (d[k] = d[k] || []).includes(m[4]) || d[k].push(m[4]);
    }
    return d;
  }

  // Labour: {date: ['L Buckley|travel', 'L Buckley|site']}. Each person needs both on the day: a Travel line and
  // a time on site line (NTT, or NTA for apprentices; any type that isn't Travel counts as on site).
  async function readLabour(E) {
    const rows = textOf(await get('/ims/Site/Resource/Jobsheet/AJAX/view_jobsheet.cfm?wrCoded=' + E), true);
    const d = {};
    rows.forEach(r => {
      if (r.length > 300 || !/Hrs @/.test(r)) return;
      const n = r.match(/^([A-Z]) ([A-Z][\w'-]+) \d{1,2}:\d{2}[ap]m/);
      const ds = r.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
      if (!n || !ds) return;
      const ty = r.match(/Hrs @ (\w+)/);
      const kind = (ty ? /^travel/i.test(ty[1]) : /\bTravel\b/.test(r)) ? 'travel' : 'site';
      const k = dmy(ds[ds.length - 1]), who = n[1] + ' ' + n[2] + '|' + kind;
      (d[k] = d[k] || []).includes(who) || d[k].push(who);
    });
    return d;
  }

  // Photos: {date: {uploader: count}}, newest first, back to `from`.
  // AroFlo sends about 10 KB per file row whatever columns are asked for, so read as few rows as possible:
  // a tiny first page (often enough), then bigger pages, and stop as soon as every visit in view has a crew photo.
  const docUrl = (E, rows, page) => '/ims/Site/Documents/AJAX_JSON_search_documents.cfm?searchdocumenttype=task&idcoded=' + E +
    '&customfield_id=0&columns=' + DOC_COLS + '&category_id=0&searchTaskBUs=childbus&_search=true&rows=' + rows + '&page=' + page +
    '&sidx=datetimeinserted&sord=desc';
  async function readPhotos(E, from, P, force, want) {
    if (P && !force && P.from <= from) { // cheap check: same file count as last time means nothing new
      const j = await get(docUrl(E, 1, 1), true);
      if (+j.records === P.rec) return P;
    }
    const d = {};
    const seen = new Set();
    const allIn = () => Object.keys(want).every(k => d[k] && Object.keys(d[k]).length > 0);
    let rec = 0, reached = null, full = false;
    // (rows, page): 4 newest, then 40 at a time (page 1 of 40 re-reads the first 4, skipped by id)
    const plan = [[4, 1], [40, 1], [40, 2], [40, 3], [40, 4], [40, 5]];
    for (const [rows, page] of plan) {
      const j = await get(docUrl(E, rows, page), true);
      rec = +j.records;
      const list = j.rows || [];
      let older = false;
      for (const x of list) {
        const id = x.id || x.document_id || x.docToken;
        if (id != null) { if (seen.has(id)) continue; seen.add(id); }
        const ins = dmy(strip(x.datetimeinserted));
        if (!ins) continue;
        if (ins < from) { older = true; break; }
        reached = ins;
        if (!PHOTO.test(x.documentname || strip(x.document))) continue;
        const by = strip(x.uploadedby);
        const add = k => { d[k] = d[k] || {}; d[k][by] = (d[k][by] || 0) + 1; };
        add(ins);
        const tk = dmy(strip(x.imgdatetimetaken));
        if (tk && tk !== ins && tk >= from) add(tk);
      }
      if (older || list.length < rows || rec <= seen.size) { full = true; break; }
      if (allIn()) break;
    }
    // `from` = how far back this read really covers, so a later look at an older day reads further back.
    let cov = full ? from : (reached || from);
    // Keep what an earlier read found for older days this read didn't get back to.
    if (P && P.d && !force) {
      for (const k in P.d) if (k < cov && !(k in d)) d[k] = P.d[k];
      if (P.from < cov) cov = P.from;
    }
    return { rec, from: cov, d };
  }

  // ---------- what's on screen ----------
  const R = new Map(); // fc event _id -> {ev, el}, only what's rendered right now
  let cal = null;

  // Visits that need a badge, grouped by job. Today's bookings that haven't started yet are badged orange as
  // pending, but aren't read, counted or put on the issue list until they start.
  function visitsInView() {
    const now = new Date(), today = ymd(now);
    const evs = cal.fullCalendar('clientEvents').filter(e => e.type === 'task' && !isCancel(e));
    const crew = {};
    evs.forEach(e => {
      if (NO_CREDIT.test(e.resourcename || '')) return;
      const k = e.wrid + '|' + ymd(new Date(e.start));
      (crew[k] = crew[k] || []).includes(e.resourcename) || crew[k].push(e.resourcename);
    });
    const jobs = {};
    for (const [id, o] of R) {
      if (!o.el[0] || !o.el[0].isConnected) { R.delete(id); continue; }
      const ev = o.ev, st = new Date(ev.start), date = ymd(st);
      if (isCancel(ev) || NO_BADGE.test(ev.resourcename || '')) continue;
      if (date > today) continue;
      const k = ev.wrid + '|' + date;
      const v = { id, ev, el: o.el, date, today: date === today, pending: date === today && st > now, who: ev.resourcename, crew: crew[k] || [ev.resourcename] };
      (jobs[ev.wrid] = jobs[ev.wrid] || []).push(v);
    }
    return jobs;
  }

  // Straight from AroFlo: true / false / null (not read yet)
  function raw(v) {
    const J = C.j[v.ev.wrid] || {};
    const has = (src, f) => (J[src] ? !!f(J[src].d[v.date]) : null);
    const crewSet = new Set(v.crew);
    return {
      n: has('n', a => a && a.some(x => crewSet.has(x))),
      p: has('p', o => !!o && Object.keys(o).length > 0), // any photo that day counts, whoever put it in (e.g. you uploading for a lad)
      t: has('l', a => a && a.includes(ini(v.who) + '|travel') && a.includes(ini(v.who) + '|site')),
    };
  }
  // You OK'd it by hand (calendar or dashboard): notes and photos count for the whole crew that day, a timesheet only for that person.
  const ITEM = { n: 'notes', p: 'photos', t: 'timesheet' };
  const EMPTY = new Set();
  function manual(v, k) {
    const keys = k === 't' ? [ikey(v.ev.wrid, v.date, v.who)] : v.crew.map(c => ikey(v.ev.wrid, v.date, c));
    return keys.some(x => (OV.get(x) || EMPTY).has(ITEM[k]));
  }
  // What the badge shows: true (in), 'm' (missing but OK'd by you), false (missing), null (not read yet)
  function status(v) {
    const s = raw(v);
    ['n', 'p', 't'].forEach(k => { if (s[k] === false && manual(v, k)) s[k] = 'm'; });
    return s;
  }
  // All three in: nothing more to read for that visit, today or any day.
  const isDone = v => { const s = status(v); return !!(s.n && s.p && s.t); };

  // ---------- badges ----------
  function css() {
    if (document.getElementById('wre-npt-css')) return;
    const s = document.createElement('style');
    s.id = 'wre-npt-css';
    s.textContent = '.wre-npt{position:absolute;top:1px;right:1px;z-index:6;display:flex;gap:1px;font:700 9px/11px Arial,sans-serif;cursor:help}' +
      '.wre-npt i{font-style:normal;width:11px;text-align:center;border-radius:2px;color:#fff;background:#9aa0a6}' +
      '.wre-npt i.g{background:#1e8e3e}.wre-npt i.r{background:#d93025}.wre-npt i.a{background:#e37400}.wre-npt i.m{background:#1a73e8}' +
      '.wre-npt i.r,.wre-npt i.a,.wre-npt i.m{cursor:pointer}.wre-npt i.r:hover,.wre-npt i.a:hover,.wre-npt i.m:hover{outline:1px solid #fff}' +
      '.wre-npt.pend i{cursor:help!important;outline:0!important}' +
      '.wre-npt-h{margin-left:10px;font:600 12px Arial,sans-serif;color:#555;cursor:pointer;white-space:nowrap}.wre-npt-h b,.wre-npt-h small.bad{color:#d93025}.wre-npt-h small{font-weight:400;margin-left:6px}.wre-npt-tok{margin-left:8px;font-weight:600;color:#c9501a;text-decoration:underline}';
    document.head.appendChild(s);
  }
  function paint(v) {
    const el = v.el[0];
    if (!el || !el.isConnected) return;
    let b = el.querySelector(':scope > .wre-npt');
    if (!b) {
      b = document.createElement('span'); b.className = 'wre-npt'; b.innerHTML = '<i>N</i><i>P</i><i>T</i>'; el.appendChild(b);
      // Clicks on the badge are ours: don't open AroFlo's booking popup or start a drag.
      ['mousedown', 'mouseup', 'dblclick'].forEach(t => b.addEventListener(t, e => e.stopPropagation()));
      b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); const i = [...b.children].indexOf(e.target); if (i >= 0 && b.__v) badgeClick(b.__v, 'npta'[i], e.target.className); });
    }
    b.__v = v;
    b.classList.toggle('pend', !!v.pending);
    const t = tipOf(v);
    while (b.children.length < t.cls.length) { const i = document.createElement('i'); i.textContent = 'A'; b.appendChild(i); }
    while (b.children.length > t.cls.length) b.lastChild.remove();
    t.cls.forEach((c, i) => { b.children[i].className = c; });
    b.title = t.text;
  }
  // The badge's colours and its hover text (the booking popup shows the same, PC and phone).
  function tipOf(v) {
    const s = status(v), J = C.j[v.ev.wrid] || {}, err = errs[v.ev.wrid];
    // Not started yet: orange for anything not in, nothing to read or chase until it starts.
    const cls = v.pending ? x => (x === 'm' ? 'm' : x === true ? 'g' : 'a')
      : x => (x === null || err ? '' : x === 'm' ? 'm' : x ? 'g' : v.today ? 'a' : 'r');
    const no = (x, none) => (x === null || (v.pending && x === false) ? (v.pending ? 'not due yet' : 'not read yet') : none);
    const crewTxt = v.crew.map(first).join(', ');
    const nA = J.n && (J.n.d[v.date] || []).filter(x => v.crew.includes(x)).map(first);
    const pO = J.p && J.p.d[v.date] || {};
    const pTxt = 'in (' + Object.keys(pO).map(first).join(', ') + ')';
    const me = ini(v.who), lab = J.l && J.l.d[v.date] || [], tr = lab.includes(me + '|travel'), si = lab.includes(me + '|site');
    const tMiss = (tr ? 'travel in, ' : si ? 'on site in, ' : '') + [!tr && 'travel', !si && 'on site (NTT/NTA)'].filter(Boolean).join(' and ') + ' missing (' + me + ')';
    const t = Math.min(...['n', 'l', 'p'].map(k => (J[k] ? J[k].t : Infinity)));
    const text = (v.pending ? 'Pending: starts ' + hm(v.ev.start) + ', checked once it starts\n' : err ? "Couldn't check: " + err + '\n' : '') +
      'Notes: ' + (s.n === 'm' ? "none, OK'd by you" : s.n === true ? 'in (' + nA.join(', ') + ')' : no(s.n, 'none from the crew')) + '\n' +
      'Photos: ' + (s.p === 'm' ? "none, OK'd by you" : s.p === true ? pTxt : no(s.p, 'none that day')) + '\n' +
      'Timesheet: ' + (s.t === 'm' ? "not all in, OK'd by you" : s.t === true ? 'travel and on site in' : no(s.t, tMiss)) + '\n' +
      'Crew: ' + crewTxt + (isFinite(t) && !v.pending ? '\nChecked ' + hm(t) : '') +
      (!v.pending && [s.n, s.p, s.t].some(x => x === false || x === 'm') ? '\n' + (PHONE ? 'Tap' : 'Click') + ' a red letter to OK it, a blue one to undo' : '');
    const a = aState(v), out = [s.n, s.p, s.t].map(cls);
    if (a && a.s !== undefined) out.push(err && a.s === null ? '' : aCls(v, a, s));
    return { cls: out, text: a ? text + '\n' + a.line : text };
  }
  function header(jobs, busy) {
    const h = document.querySelector('.fc-header-title');
    if (!h) return;
    let s = h.querySelector('.wre-npt-h');
    if (!s) {
      s = document.createElement('span'); s.className = 'wre-npt-h'; s.title = 'Recheck notes, photos and timesheets for the weeks in view, and Ambrose for the A letters';
      s.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target.closest('.wre-npt-tok')) setToken(); // the "set Todoist token" link
        else scan(true);                                  // anywhere else: recheck
      });
      (h.querySelector('h2') || h).appendChild(s);
    }
    let miss = 0, unk = 0, aRed = 0;
    Object.values(jobs).flat().forEach(v => { if (v.pending) return; const x = status(v); if (errs[v.ev.wrid] || [x.n, x.p, x.t].includes(null)) unk++; else if (!(x.n && x.p && x.t)) miss++;
      const a = aState(v); if (a && a.s === false && aCls(v, a, x) === 'r') aRed++; });
    const list = paused() ? 'issue list paused' : sy.msg;
    const tok = !token() || /token not accepted/.test(sy.msg);
    s.innerHTML = 'NPT ' + (busy ? 'checking...' : miss ? '<b>' + miss + ' missing</b>' : 'all in') + (unk && !busy ? ', ' + unk + " couldn't check" : '') + ' &#8635;' +
      (aRed ? ' &middot; A <b>' + aRed + ' to upload</b>' : '') +
      (list && token() ? ' <small class="' + (sy.bad ? 'bad' : '') + '">' + esc(list) + '</small>' : '') +
      (aMsg ? ' <small class="' + (/not updated/.test(aMsg) ? 'bad' : '') + '">' + esc(aMsg) + '</small>' : '') +
      (tok ? ' <a class="wre-npt-tok" href="#" title="Turn on the issue list">' + (token() ? 'Fix Todoist token' : 'Set Todoist token') + '</a>' : '');
  }

  // ---------- the runner ----------
  const queue = new Map(); // wrid -> force
  let running = 0, lastJobs = {};

  let pendT;
  function scan(force) {
    if (!cal) return;
    lastJobs = visitsInView();
    const now = Date.now();
    // Look again when the next pending booking starts, in case AroFlo doesn't redraw by then.
    const next = Math.min(...Object.values(lastJobs).flat().filter(v => v.pending).map(v => +new Date(v.ev.start)));
    clearTimeout(pendT);
    if (isFinite(next)) pendT = setTimeout(() => scan(false), Math.min(next - now + 5000, 36e5));
    for (const w in lastJobs) {
      const vs = lastJobs[w].filter(v => !v.pending);
      const J = C.j[w];
      if (J) J.u = now;
      lastJobs[w].forEach(paint);
      if (!vs.length) continue;
      if (force) { delete errs[w]; queue.set(w, true); continue; }
      if (errs[w]) continue;
      const open = vs.filter(v => !isDone(v));
      if (!open.length) continue;
      const from = open.map(v => v.date).sort()[0];
      const stale = k => !J || !J[k] || now - J[k].t > TTL || (k === 'p' && J.p.from > from);
      if (['n', 'l', 'p'].some(stale)) queue.set(w, queue.get(w) || false);
    }
    header(lastJobs, queue.size + running > 0);
    if (!queue.size && !running) { save(); sync(); } // save keeps "last looked at" fresh; sync covers a view that's all from cache
    pump();
    maybeSweep(!!force);
  }

  function pump() {
    if (document.hidden) return; // nothing runs while you're on another tab
    while (running < MAX_JOBS && queue.size) {
      const [w, force] = queue.entries().next().value;
      queue.delete(w);
      running++;
      readJob(w, force)
        .then(() => { delete errs[w]; })
        .catch(e => { errs[w] = String(e.message || e).slice(0, 60); delete C.wc[w]; })
        .finally(() => {
          running--;
          (lastJobs[w] || []).forEach(paint);
          if (!queue.size && !running) { save(); header(lastJobs, false); sync(); }
          pump();
        });
    }
  }

  async function readJob(w, force) {
    const vs = (lastJobs[w] || []).filter(v => !v.pending);
    if (!vs.length) return;
    const now = Date.now();
    const J = (C.j[w] = C.j[w] || { u: now });
    const open = force ? vs : vs.filter(v => !isDone(v));
    if (!open.length) return;
    const from = open.map(v => v.date).sort()[0];
    // Only read what's still missing for a visit in view (a recheck reads all three).
    const need = k => force || !J[k] || now - J[k].t > TTL || (k === 'p' && J.p.from > from);
    const missing = { n: force, l: force, p: force };
    open.forEach(v => { const s = status(v); if (!s.n) missing.n = true; if (!s.t) missing.l = true; if (!s.p) missing.p = true; });
    const E = encodeURIComponent(await code(w));
    const jobs = [];
    if (missing.n && need('n')) jobs.push(readNotes(E).then(d => { J.n = { t: Date.now(), d }; }));
    if (missing.l && need('l')) jobs.push(readLabour(E).then(d => { J.l = { t: Date.now(), d }; }));
    const want = {};
    open.forEach(v => { if (!status(v).p || force) want[v.date] = new Set(v.crew); });
    if (missing.p && need('p')) jobs.push(readPhotos(E, from, J.p, force, want).then(P => { J.p = Object.assign(P, { t: Date.now() }); }));
    await Promise.all(jobs);
  }

  // ---------- the issue list in Todoist (WRE daily check project) ----------
  // Same task shape the daily check uses, so the two never double up:
  //   title:  Lachie, 98 Trudy Cres (14/10): notes, photos, timesheet
  //   desc:   JN 9251 | wrid 795229 | visit 2026-10-14 | Lachlan Buckley | missing: notes, photos, timesheet
  // Adds an issue for a visit in view that's missing something, updates it as things come in, comments and ticks it off once it's all in.
  // An issue that was ticked off (by you or the daily check) is never added again for that visit.
  const TD = 'https://api.todoist.com/api/v1/';
  const token = () => GM_getValue('todoistToken', '');
  const paused = () => GM_getValue('syncPaused', false);
  const td = (method, path, body) => new Promise((res, rej) => GM_xmlhttpRequest({
    method, url: TD + path, timeout: 20000,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    data: body ? JSON.stringify(body) : undefined,
    onload: r => {
      if (r.status === 401 || r.status === 403) return rej(new Error('token not accepted'));
      if (r.status < 200 || r.status >= 300) return rej(new Error('Todoist said ' + r.status));
      try { res(r.responseText ? JSON.parse(r.responseText) : null); } catch (e) { res(null); }
    },
    onerror: () => rej(new Error("couldn't reach Todoist")),
    ontimeout: () => rej(new Error('Todoist timed out')),
  }));
  const DESC = /^JN (\S*) \| wrid (\d+) \| visit (\d{4}-\d\d-\d\d) \| ([^|]+?) \| missing: (.+)$/m;
  // Second line of the description: what you OK'd by hand, e.g. "ok: photos". The daily check keeps this line too.
  const OKL = /^ok: (.+)$/m;
  const splitL = x => String(x || '').split(',').map(y => y.trim()).filter(Boolean);
  const descOf = (jn, wrid, date, full, missing, ok) => 'JN ' + jn + ' | wrid ' + wrid + ' | visit ' + date + ' | ' + full + ' | missing: ' + missing.join(', ') + (ok.length ? '\nok: ' + ok.join(', ') : '');
  const titleOf = (v, missing) => OWN.test(v.who) ? 'Put in ' + listed(missing) + ' for ' + street(v.ev) + ' (' + dmS(v.date) + ')'
    : nick(v.who) + ', ' + street(v.ev) + ' (' + dmS(v.date) + '): ' + missing.join(', ');
  const projOf = who => (OWN.test(who) ? FU : ISSUES);
  // A new issue: the lads' go on the issue list, yours go in your follow ups due today so they show in Needs me.
  const newIssue = (who, content, description) => td('POST', 'tasks', Object.assign({ project_id: projOf(who), content, description }, OWN.test(who) ? { due_date: ymd(new Date()) } : {}));
  const OV = new Map(); // visit key -> Set of items you OK'd (open issues: the ok line; ticked off issues: everything on them)
  const ikey = (wrid, date, full) => wrid + '|' + date + '|' + full;
  const dmS = d => +d.slice(8) + '/' + +d.slice(5, 7);
  const ST = { street: 'St', road: 'Rd', crescent: 'Cres', place: 'Pl', terrace: 'Tce', drive: 'Dr', court: 'Ct', avenue: 'Ave', parade: 'Pde', close: 'Cl', lane: 'Ln', highway: 'Hwy', boulevard: 'Bvd', circuit: 'Cct', grove: 'Gr' };
  // "Ambrose Construct Group Pty Ltd 20253599 - 98 Trudy Crescent Cornubia QLD 4130" -> "98 Trudy Cres"
  const STYPE = 'Street|St|Road|Rd|Crescent|Cres|Place|Pl|Terrace|Tce|Drive|Dr|Court|Ct|Avenue|Ave|Way|Parade|Pde|Close|Cl|Lane|Ln|Highway|Hwy|Boulevard|Bvd|Circuit|Cct|Grove|Gr|Esplanade|Esp';
  const ADDR = new RegExp("(?:\\d[\\w/-]*\\s*,\\s*)?\\d+[A-Za-z]?(?:/\\d+[A-Za-z]?)?\\s+(?:[A-Z][A-Za-z'-]+\\s+){1,3}?(?:" + STYPE + ")\\b|\\b(?:\\d+\\s+)?The Esplanade\\b");
  function street(ev) {
    const shorten = a => a.replace(/\b(Street|Road|Crescent|Place|Terrace|Drive|Court|Avenue|Parade|Close|Lane|Highway|Boulevard|Circuit|Grove)\b/g, w => ST[w.toLowerCase()]);
    for (const src of [C.ad[ev.wrid], strip(String(ev.title || '').replace(/<br\s*\/?>/gi, ' '))]) {
      const m = String(src || '').match(ADDR);
      if (m) return shorten(m[0].trim());
    }
    const loc = C.ad[ev.wrid] || strip(ev.title);
    return shorten(loc.replace(/,?\s*(QLD|NSW)\b.*$/i, '').trim()).slice(0, 50);
  }
  const jnOf = ev => (String((ev.headers || []).map(h => h.headerText).filter(Boolean)[0] || '').match(/^\d+/) || [''])[0];
  const nick = full => NICK[first(full)] || first(full);
  const listed = s => s.length === 1 ? s[0] : s.slice(0, -1).join(', ') + ' and ' + s[s.length - 1];

  const noMove = new Set(); // issues of yours Todoist wouldn't move to the follow ups, this page load only
  let tdState = null;          // {at, open: Map key -> task, done: Map key -> task}
  let syncing = false, syncAgain = false;
  const sy = { msg: '', bad: false };

  // Your clicks, kept on top of what Todoist sends back for 2 minutes. Todoist can take a moment to
  // show a change it just saved, so without this a read straight after a click could flip the letter back.
  const LOCAL = new Map(); // visit key -> Map(item -> {on, at})
  const LOCAL_MS = 120000;
  function applyLocal() {
    const now = Date.now();
    for (const [k, m] of LOCAL) {
      for (const [it, o] of m) {
        if (now - o.at > LOCAL_MS) { m.delete(it); continue; }
        const s = OV.get(k) || new Set();
        if (o.on) s.add(it); else s.delete(it);
        if (s.size) OV.set(k, s); else OV.delete(k);
      }
      if (!m.size) LOCAL.delete(k);
    }
  }
  let loadSeq = 0, loadApplied = 0;

  async function loadList(fresh) {
    const now = Date.now(), my = ++loadSeq;
    if (!fresh && tdState && now - tdState.at < 60000) return tdState;
    const open = new Map(), done = new Map(), aOpen = new Map(), aDone = new Map();
    let acache = null, acacheId = null, acacheAt = 0;
    const aTake = (t, into) => { const r = aRec(t); if (r) into.set(r.k, r); else if (into === aOpen && String(t.description || '').startsWith(ACACHE + '\n')) {
      try { const o = JSON.parse(t.description.slice(ACACHE.length + 1)); acacheAt = o._at || 0; delete o._at; acache = unpackCache(o); } catch (e) {} acacheId = t.id; } };
    // Issues live on the issue list (the lads') and in your follow ups (yours); only tasks in the issue shape count.
    const rec = t => { const m = (t.description || '').match(DESC); if (!m) return null; const o = (t.description || '').match(OKL);
      return { k: ikey(m[2], m[3], m[4].trim()), id: t.id, pid: t.project_id, missing: m[5].trim(), ok: splitL(o && o[1]), jn: m[1] }; };
    const since = new Date(now - 60 * 864e5).toISOString().slice(0, 19) + 'Z', until = new Date(now + 864e5).toISOString().slice(0, 19) + 'Z';
    for (const P of [ISSUES, FU]) {
      let cur = null, n = 0;
      do {
        const j = await td('GET', 'tasks?project_id=' + P + '&limit=200' + (cur ? '&cursor=' + encodeURIComponent(cur) : ''));
        (j && j.results || []).forEach(t => { const r = rec(t); if (r) open.set(r.k, Object.assign(r, { pid: r.pid || P })); else if (P === ISSUES) aTake(t, aOpen); });
        cur = j && j.next_cursor; n++;
      } while (cur && n < 5);
    }
    // Ticked off in the last ~2 months: never added again, and whatever was still on them counts as OK'd by you.
    for (const P of [ISSUES, FU]) {
      let cur = null, n = 0;
      do {
        const j = await td('GET', 'tasks/completed/by_completion_date?project_id=' + P + '&since=' + since + '&until=' + until + '&limit=200' + (cur ? '&cursor=' + encodeURIComponent(cur) : ''));
        (j && j.items || []).forEach(t => { const r = rec(t); if (r && !open.has(r.k)) done.set(r.k, Object.assign(r, { pid: r.pid || P })); else if (!r && P === ISSUES) { const a = aRec(t); if (a && !aOpen.has(a.k)) aDone.set(a.k, a); } });
        cur = j && j.next_cursor; n++;
      } while (cur && n < 5);
    }
    // A slower, older read finishing after a newer one never overwrites it.
    if (my < loadApplied && tdState) return tdState;
    loadApplied = my;
    OV.clear();
    open.forEach((r, k) => { if (r.ok.length) OV.set(k, new Set(r.ok)); });
    done.forEach((r, k) => OV.set(k, new Set(splitL(r.missing).concat(r.ok))));
    applyLocal();
    AOK.clear();
    aOpen.forEach((r, k) => { if (r.ok) AOK.add(k); });
    aDone.forEach((r, k) => AOK.add(k));
    applyALocal();
    return (tdState = { at: now, open, done, aOpen, aDone, acache, acacheId, acacheAt });
  }

  async function sync() {
    if (!token() || paused()) return;
    if (syncing || busyOk) { syncAgain = true; return; } // never runs alongside an OK being saved
    syncing = true;
    try {
      const now = new Date(), today = ymd(now), oldest = ymd(new Date(now.getTime() - LIST_DAYS * 864e5));
      const want = new Map(); // key -> {v, missing, early}
      const all = Object.values(lastJobs).flat().filter(v => !v.pending);
      // Anything red in view: read the list so OKs you made elsewhere (the dashboard, your phone) show here.
      if (all.some(v => { const r = raw(v); return r.n === false || r.p === false || r.t === false; }) || all.some(v => isAmb(v.ev))) {
        const was = tdState && tdState.at; await loadList(); if (tdState.at !== was) all.forEach(paint);
      }
      all.forEach(v => {
        if (errs[v.ev.wrid] || v.date < oldest) return;
        if (LOCAL.has(ikey(v.ev.wrid, v.date, v.who))) return; // you just clicked this one: the click already saved it, leave it be
        const s = status(v);
        if ([s.n, s.p, s.t].includes(null)) return;
        const missing = [!s.n && 'notes', !s.p && 'photos', !s.t && 'timesheet'].filter(Boolean);
        // Before 5pm today's misses aren't added yet, but an issue that's already there (e.g. from an OK) still updates and ticks off.
        want.set(ikey(v.ev.wrid, v.date, v.who), { v, missing, early: v.today && now.getHours() < LIST_HOUR });
      });
      if (all.some(v => isAmb(v.ev))) setTimeout(ambSync, 0);
      if (!want.size) {
        if (/token saved/.test(sy.msg)) { await loadList(); sy.bad = false; sy.msg = 'list on ' + hm(Date.now()); } // proves the token works
        return;
      }
      const L = await loadList();
      let added = 0, closed = 0, changed = 0;
      for (const [k, { v, missing, early }] of want) {
        const ex = L.open.get(k), m = missing.join(', ');
        if (missing.length) {
          if (ex) {
            if (OWN.test(v.who) && ex.pid !== FU && !noMove.has(ex.id)) { // one of yours still on the lads' list (from before 2.8): move it to your follow ups
              try {
                await td('POST', 'tasks/' + ex.id + '/move', { project_id: FU });
                await td('POST', 'tasks/' + ex.id, { content: titleOf(v, missing), due_date: today });
                ex.pid = FU; changed++;
              } catch (e) { if (/token/.test(e.message)) throw e; noMove.add(ex.id); } // couldn't move it: leave it where it is, it still updates and ticks off
            }
            if (ex.missing === m) continue;
            const was = ex.missing.split(', '), r0 = raw(v), gone = was.filter(x => !missing.includes(x));
            const inNow = gone.filter(x => r0[{ notes: 'n', photos: 'p', timesheet: 't' }[x]] === true), okd = gone.filter(x => !inNow.includes(x));
            await td('POST', 'tasks/' + ex.id, { content: titleOf(v, missing), description: descOf(ex.jn || jnOf(v.ev), v.ev.wrid, v.date, v.who, missing, ex.ok) });
            if (gone.length) await td('POST', 'comments', { task_id: ex.id, content: dmS(today) + ': ' + [inNow.length && listed(inNow) + ' in', okd.length && listed(okd) + " OK'd by Ethan"].filter(Boolean).join(', ') + ', ' + listed(missing) + ' still missing' });
            ex.missing = m; changed++;
          } else if (!L.done.has(k) && !early) {
            const t = await newIssue(v.who, titleOf(v, missing), descOf(jnOf(v.ev), v.ev.wrid, v.date, v.who, missing, []));
            if (t && t.id) L.open.set(k, { id: t.id, pid: projOf(v.who), missing: m, ok: [], jn: jnOf(v.ev) });
            added++;
          }
        } else if (ex) {
          const r0 = raw(v), was = ex.missing.split(', '), inNow = was.filter(x => r0[{ notes: 'n', photos: 'p', timesheet: 't' }[x]] === true), okd = was.filter(x => !inNow.includes(x));
          await td('POST', 'comments', { task_id: ex.id, content: dmS(today) + ': sorted, ' + [inNow.length && listed(inNow) + ' in', okd.length && listed(okd) + " OK'd by Ethan"].filter(Boolean).join(', ') });
          await td('POST', 'tasks/' + ex.id + '/close');
          L.open.delete(k); L.done.set(k, ex); closed++;
        }
      }
      sy.bad = false;
      sy.msg = 'list ' + hm(Date.now()) + (added || changed || closed ? ' (' + [added && added + ' added', changed && changed + ' updated', closed && closed + ' ticked off'].filter(Boolean).join(', ') + ')' : '');
    } catch (e) {
      sy.bad = true; sy.msg = 'list not updated: ' + String(e.message || e).slice(0, 40);
      tdState = null; // read it fresh next time
    } finally {
      syncing = false;
      header(lastJobs, queue.size + running > 0);
      if (syncAgain) { syncAgain = false; sync(); }
    }
  }

  // ---------- A: photos or the report up on Ambrose (you and Lisa do these, not the lads) ----------
  // Ambrose jobs get a 4th letter. Each visit is matched to its Ambrose booking: same PO, a booking whose dates
  // cover the visit day, the schedule note (iso, fit off, report...) breaking a tie or covering moved dates.
  // Green: 2 or more photos on that booking in Tradies Admin, or the report done. Orange: waiting on the lads'
  // photos (and notes, for a report), or it's today. Red: theirs are in but Ambrose isn't. No letter: no booking matches.
  // Red ones from before today go in the "Ambrose uploads" section of WRE daily check (the panel's Ambrose tab).
  const SEC = '6hp9wgvpfRVf5mm6';          // Todoist section: Ambrose uploads, in WRE daily check
  const A_DAYS = 30;                       // visits from the last 30 days get chased
  const A_EVERY = 2 * 36e5;                // a PO is looked at again on Ambrose after 2 hours
  const A_GAP = 30 * 60000;                // the background check runs at most every 30 min (unless you hit recheck)
  const AMB_URL = 'https://tradiesadmin.ambroseconstruct.com.au/PurchaseOrders#wre-sweep';
  const ADESC = /^JN (\S*) \| wrid (\d+) \| visit (\d{4}-\d\d-\d\d) \| PO (\S+) \| ([^|\n]+?) \| ambrose: (\w+)$/m;
  const ACACHE = 'ambrose-cache';          // one task in the section holds what Ambrose said, so your phone sees it too
  const AOK = new Set();                   // wrid|date you OK'd (or ticked off)
  const ALOCAL = new Map();                // your clicks, held 2 min over what Todoist sends back
  let aMsg = '', aSyncing = false, sweepTab = null;

  const isAmb = ev => /\bAmbrose\b/i.test(strip(ev.title) + ' ' + (C.ad[ev.wrid] || ''));
  const poBase = ev => { const t = strip(ev.title); const m = t.match(/Ambrose[^|]*?\b(\d{8})\b/i) || t.match(/\b(20\d{6})\b/); return m ? m[1] : null; };
  const noteOf = ev => strip([ev.note, ev.notes, ev.schedulenote].filter(Boolean).join(' '));
  // Booking words: [in the AroFlo note, in the Ambrose booking type]
  const KW = [[/\biso|isolat/i, /isolat/i], [/fit ?off|reconn|re-?con\b/i, /fit ?off|reconn/i], [/report/i, /report/i],
    [/install/i, /install/i], [/shroud/i, /shroud/i], [/pole|fuse/i, /pole|fuse/i], [/make ?safe/i, /make ?safe/i]];

  // What Ambrose said: this PC's own reads, or the copy in Todoist (newer wins per PO)
  // (worked out once, then again only when either side changes)
  let adMemo = null, adOwn = null, adTd = undefined;
  function ambData() {
    const td0 = tdState && tdState.acache;
    if (adMemo && adOwn && adTd === td0) return adMemo;
    adOwn = adOwn || (GM_getValue('ambData', {}) || {}).bases || {};
    const out = Object.assign({}, td0 || {});
    for (const b in adOwn) if (!out[b] || (adOwn[b].at || 0) >= (out[b].at || 0)) out[b] = adOwn[b];
    adTd = td0;
    return (adMemo = out);
  }
  const flat = B => { const all = []; for (const po in (B.pos || {})) (B.pos[po].b || []).forEach(b => all.push(Object.assign({ po }, b))); return all; };
  function bookingOf(v) {
    const base = poBase(v.ev);
    if (!base) return { nob: 'no PO number on the task' };
    const B = ambData()[base];
    if (!B) return { unk: true, base };
    const all = flat(B), kw = KW.filter(([a]) => a.test(noteOf(v.ev)));
    const pick = list => {
      if (list.length === 1) return list[0];
      const k = list.filter(b => kw.some(([, t]) => t.test(b.t)));
      return k.length === 1 ? k[0] : null;
    };
    const onDay = all.filter(b => b.s && b.s <= v.date && v.date <= (b.e || b.s));
    let b = onDay.length ? pick(onDay) : null;
    if (!b && kw.length) b = pick(all.filter(x => kw.some(([, t]) => t.test(x.t))));
    return b ? { b, base, at: B.at } : { nob: 'no Ambrose booking that day', base, at: B.at };
  }
  const needOf = b => (b.img !== null && b.img !== undefined ? 'photos' : b.rep && !/^N\/?A$/i.test(b.rep) ? 'report' : '');
  const bookingOk = b => { const n = needOf(b); return n === 'photos' ? b.img >= 2 : n === 'report' ? /done|submit/i.test(b.rep) : true; };
  const akey = v => v.ev.wrid + '|' + v.date;

  // null = not an Ambrose job (no letter). s: true in, 'm' OK'd by you, false not done, null not checked yet, undefined no booking (no letter)
  function aState(v) {
    if (!isAmb(v.ev)) return null;
    const k = akey(v), m = bookingOf(v), okd = AOK.has(k);
    if (m.unk) {
      const e = GM_getValue('ambErr', null);
      return { k, s: null, base: m.base, line: 'Ambrose: ' + (e && e.at && Date.now() - e.at < A_EVERY ? e.msg + ' so it can be checked' : PHONE ? 'not checked yet (the PC checks it)' : 'not checked yet') };
    }
    if (!m.b) return { k, s: undefined, base: m.base, line: 'Ambrose: ' + m.nob };
    const b = m.b, need = needOf(b), ok = bookingOk(b);
    const what = need === 'photos' ? (b.img ? b.img + ' photo' + (b.img > 1 ? 's' : '') + ' up' + (ok ? '' : ', needs 2') : 'no photos up')
      : need === 'report' ? (ok ? 'report submitted' : 'report not submitted') : 'nothing needed';
    return { k, s: ok ? true : okd ? 'm' : false, base: m.base, b, need, at: m.at,
      line: 'Ambrose: ' + b.t + ' (' + b.po + '), ' + what + (okd && !ok ? ", OK'd by you" : '') + (m.at ? ', checked ' + agoTxt(m.at) : '') };
  }
  const agoTxt = t => { const d = new Date(t); return ymd(d) === ymd(new Date()) ? hm(t) : dmS(ymd(d)) + ' ' + hm(t); };
  // Colour for the A: orange until the lads' side is in (and never red on the day), red once you're the hold up
  function aCls(v, a, s) {
    const x = a.s;
    if (x === null) return '';
    if (x === true) return 'g';
    if (x === 'm') return 'm';
    const ready = a.need === 'report' ? s.n === true && s.p === true : s.p === true;
    return v.pending || v.today || !ready ? 'a' : 'r';
  }

  const aDesc = (jn, wrid, date, po, type, need, ok) => 'JN ' + jn + ' | wrid ' + wrid + ' | visit ' + date + ' | PO ' + po + ' | ' + String(type).replace(/[|\n]/g, ' ') + ' | ambrose: ' + (need || 'photos') + (ok ? '\nok: ambrose' : '');
  const aTitle = (v, a) => street(v.ev) + ' (' + dmS(v.date) + '): ' + (a.need === 'report' ? 'report' : 'photos') + ' to Ambrose, ' + a.b.t;
  const aRec = t => { const m = (t.description || '').match(ADESC); if (!m) return null;
    return { k: m[2] + '|' + m[3], id: t.id, jn: m[1], wrid: m[2], date: m[3], po: m[4], type: m[5].trim(), need: m[6], ok: /^ok: .*ambrose/m.test(t.description || '') }; };
  // The copy of what Ambrose said, kept small: {base: {at, none, pos: {po: {b: [[type, status, start, end, img, rep]]}}}}
  const packCache = D => { const o = {}; for (const base in D) { const B = D[base], P = {}; for (const po in (B.pos || {})) P[po] = { b: (B.pos[po].b || []).map(b => [b.t, b.st, b.s, b.e, b.img, b.rep]) }; o[base] = { at: B.at, none: B.none ? 1 : undefined, pos: P }; } return o; };
  const unpackCache = o => { const D = {}; for (const base in (o || {})) { const B = o[base], P = {}; for (const po in (B.pos || {})) P[po] = { b: (B.pos[po].b || []).map(x => ({ t: x[0], st: x[1], s: x[2], e: x[3], img: x[4], rep: x[5] })) }; D[base] = { at: B.at, none: !!B.none, pos: P }; } return D; };
  function applyALocal() {
    const now = Date.now();
    for (const [k, o] of ALOCAL) { if (now - o.at > LOCAL_MS) { ALOCAL.delete(k); continue; } if (o.on) AOK.add(k); else AOK.delete(k); }
  }

  // Keep the Ambrose uploads section in step: add red ones from before today, tick off what's now up on Ambrose.
  async function ambSync() {
    if (!token() || paused() || aSyncing || busyOk) return;
    const vis = Object.values(lastJobs).flat().filter(v => !v.pending && isAmb(v.ev));
    aSyncing = true;
    try {
      const L = await loadList();
      const today = ymd(new Date()), oldest = ymd(new Date(Date.now() - A_DAYS * 864e5)), seen = new Set();
      let added = 0, closed = 0;
      for (const v of vis) {
        const a = aState(v);
        if (!a || !a.k || seen.has(a.k)) continue;
        seen.add(a.k);
        if (ALOCAL.has(a.k) || errs[v.ev.wrid] || v.date < oldest) continue;
        const ex = L.aOpen.get(a.k);
        if (!ex && !L.aDone.has(a.k) && v.date < today && a.s === false && aCls(v, a, status(v)) === 'r') {
          const t = await td('POST', 'tasks', { project_id: ISSUES, section_id: SEC, content: aTitle(v, a), description: aDesc(jnOf(v.ev), v.ev.wrid, v.date, a.b.po, a.b.t, a.need, false) });
          if (t && t.id) L.aOpen.set(a.k, aRec(t) || { id: t.id });
          added++;
        } else if (ex && a.s === true) {
          await td('POST', 'comments', { task_id: ex.id, content: dmS(today) + ': sorted, ' + a.line.replace(/^Ambrose: /, '') });
          await td('POST', 'tasks/' + ex.id + '/close');
          L.aOpen.delete(a.k); L.aDone.set(a.k, ex); closed++;
        }
      }
      // Ones on the list that aren't on screen: check them against what Ambrose said
      const D = ambData();
      for (const [k, r] of [...L.aOpen]) {
        if (seen.has(k) || !r.po) continue;
        const B = D[r.po.slice(0, 8)], b = B && flat(B).find(x => x.po === r.po && x.t === r.type);
        if (b && bookingOk(b)) {
          await td('POST', 'comments', { task_id: r.id, content: dmS(today) + ': sorted, up on Ambrose' });
          await td('POST', 'tasks/' + r.id + '/close');
          L.aOpen.delete(k); L.aDone.set(k, r); closed++;
        }
      }
      if (!PHONE) await writeCache(L);
      aMsg = added || closed ? 'Ambrose list: ' + [added && added + ' added', closed && closed + ' ticked off'].filter(Boolean).join(', ') : '';
    } catch (e) {
      aMsg = 'Ambrose list not updated: ' + String(e.message || e).slice(0, 40);
    } finally {
      aSyncing = false;
      header(lastJobs, queue.size + running > 0);
    }
  }
  // This PC's reads go up to Todoist (one task in the section) so the phone shows the same A
  async function writeCache(L) {
    const own = (GM_getValue('ambData', {}) || {}).bases || {};
    const newest = Math.max(0, ...Object.values(own).map(B => B.at || 0));
    if (!newest || newest <= (L.acacheAt || 0)) return;
    const cut = Date.now() - 45 * 864e5, keep = {};
    for (const base in own) if ((own[base].at || 0) > cut) keep[base] = own[base];
    const description = ACACHE + '\n' + JSON.stringify(Object.assign({ _at: newest }, packCache(keep)));
    if (L.acacheId) await td('POST', 'tasks/' + L.acacheId, { description });
    else { const t = await td('POST', 'tasks', { project_id: ISSUES, section_id: SEC, content: 'Ambrose status (calendar script data, leave this one)', description }); L.acacheId = t && t.id; }
    L.acacheAt = newest;
  }

  // OK the A by hand (e.g. Ambrose didn't want photos for this one), or take the OK back
  async function aClick(v, cls) {
    if (!/\b(r|a|m)\b/.test(cls) || busyOk || v.pending) return;
    if (!token()) { W.alert('Set the Todoist token first (link next to the dates up top), so the OK can be saved.'); return; }
    const a = aState(v);
    if (!a || !a.b) return;
    const on = cls !== 'm', where = street(v.ev) + ' (' + dmS(v.date) + ')';
    if (!W.confirm(on ? 'OK the Ambrose ' + (a.need || 'photos') + ' for ' + where + ' without them?' : 'Take the Ambrose OK off ' + where + '?')) return;
    busyOk = true; sy.msg = 'saving...'; sy.bad = false;
    const had = AOK.has(a.k);
    ALOCAL.set(a.k, { on, at: Date.now() }); applyALocal(); repaint();
    try {
      while (syncing || aSyncing) await new Promise(r => setTimeout(r, 150));
      const L = await loadList(true), today = ymd(new Date());
      let rec = L.aOpen.get(a.k), closed = false;
      if (!rec && L.aDone.has(a.k)) { rec = L.aDone.get(a.k); closed = true; }
      if (!rec && on) {
        const t = await td('POST', 'tasks', { project_id: ISSUES, section_id: SEC, content: aTitle(v, a), description: aDesc(jnOf(v.ev), v.ev.wrid, v.date, a.b.po, a.b.t, a.need, false) });
        rec = { id: t.id };
      }
      if (rec) {
        await td('POST', 'comments', { task_id: rec.id, content: dmS(today) + ': ' + (on ? "Ambrose OK'd by Ethan without them (calendar)" : 'Ambrose OK taken back (calendar)') });
        if (on) {
          await td('POST', 'tasks/' + rec.id, { description: aDesc(rec.jn || jnOf(v.ev), v.ev.wrid, v.date, a.b.po, a.b.t, a.need, true) });
          if (!closed) await td('POST', 'tasks/' + rec.id + '/close');
        } else {
          if (closed) await td('POST', 'tasks/' + rec.id + '/reopen');
          await td('POST', 'tasks/' + rec.id, { description: aDesc(rec.jn || jnOf(v.ev), v.ev.wrid, v.date, a.b.po, a.b.t, a.need, false) });
        }
      }
      ALOCAL.get(a.k).at = Date.now();
      sy.msg = (on ? "Ambrose OK'd " : 'Ambrose OK taken off ') + hm(Date.now());
      busyOk = false; tdState = null;
      try { await loadList(true); } catch (e) {}
    } catch (e) {
      ALOCAL.delete(a.k); if (had) AOK.add(a.k); else AOK.delete(a.k);
      sy.bad = true; sy.msg = "didn't save: " + String(e.message || e).slice(0, 40);
      busyOk = false; tdState = null;
    }
    repaint();
  }

  // The background check (PC only): open Tradies Admin in a background tab for the POs that need a look
  let sweepWhy = '';
  function maybeSweep(force) {
    try { sweepGo(force); } catch (e) { sweepWhy = 'error: ' + (e && e.message || e); console.warn('WRE NPT Ambrose check:', e); }
  }
  function sweepGo(force) {
    if (PHONE || !cal) { sweepWhy = PHONE ? 'phone' : 'no calendar'; return; }
    const J = GM_getValue('ambJob', null), now = Date.now();
    if (J && !J.doneAt && now - J.started < 8 * 60000) { sweepWhy = 'one already going'; return; } // one's already going
    if (!force && now - (GM_getValue('ambLast', 0) || 0) < A_GAP) { sweepWhy = 'ran in the last 30 min'; return; }
    const today = ymd(new Date()), oldest = ymd(new Date(now - A_DAYS * 864e5)), D = ambData(), bases = new Set();
    const stale = base => force || !D[base] || now - (D[base].at || 0) > A_EVERY;
    Object.values(lastJobs).flat().forEach(v => {
      if (v.date < oldest || v.date > today) return;
      const a = aState(v);
      if (!a || a.s === true || a.s === 'm' || !a.base) return;
      if (stale(a.base)) bases.add(a.base);
    });
    if (tdState) for (const r of tdState.aOpen.values()) if (r.po && stale(r.po.slice(0, 8))) bases.add(r.po.slice(0, 8));
    if (!bases.size) { sweepWhy = 'nothing to check'; return; }
    sweepWhy = 'opened for ' + [...bases].join(', ');
    GM_setValue('ambLast', now);
    GM_setValue('ambJob', { queue: [...bases], started: now, cur: null });
    try { if (sweepTab && !sweepTab.closed) sweepTab.close(); } catch (e) {}
    sweepTab = GM_openInTab(AMB_URL, { active: false, insert: true, setParent: true });
    const mine = sweepTab;
    setTimeout(() => { try { if (mine && !mine.closed) mine.close(); } catch (e) {} }, 8 * 60000);
    aMsg = 'checking Ambrose (' + bases.size + ' PO' + (bases.size > 1 ? 's' : '') + ')';
    header(lastJobs, queue.size + running > 0);
  }
  GM_addValueChangeListener('ambData', (n, o, val, remote) => { adOwn = null; adMemo = null; if (remote && cal) repaint(); });
  GM_addValueChangeListener('ambErr', (n, o, val, remote) => { if (remote && cal) repaint(); });
  GM_addValueChangeListener('ambSweepEnd', (n, o, val, remote) => {
    if (!remote || !cal) return;
    try { if (sweepTab && !sweepTab.closed) sweepTab.close(); } catch (e) {}
    aMsg = ''; repaint(); ambSync();
  });
  setInterval(() => { if (!document.hidden && cal) maybeSweep(false); }, 10 * 60000);
  // For checking what the Ambrose side is up to (Tampermonkey menu, or from the page)
  const ambStatus = () => {
    const D = (GM_getValue('ambData', {}) || {}).bases || {}, J = GM_getValue('ambJob', null), E = GM_getValue('ambErr', null);
    return { why: sweepWhy, job: J && { queue: J.queue, cur: J.cur && J.cur.base, started: J.started && hm(J.started), done: J.doneAt && hm(J.doneAt) },
      last: GM_getValue('ambLast', 0) && hm(GM_getValue('ambLast', 0)), err: E && E.msg, end: GM_getValue('ambSweepEnd', 0) && hm(GM_getValue('ambSweepEnd', 0)),
      pos: Object.fromEntries(Object.entries(D).map(([b, B]) => [b, Object.keys(B.pos || {}).length + ' POs, ' + (B.at ? hm(B.at) : '?')])) };
  };
  try { W.__wreAmb = () => JSON.stringify(ambStatus()); } catch (e) {}
  GM_registerMenuCommand('Check Ambrose now', () => { GM_setValue('ambJob', null); maybeSweep(true); W.alert('Ambrose check: ' + sweepWhy); });

  // ---------- OK'ing a missing item by hand, from the calendar ----------
  // Click a red letter: it's OK'd (e.g. turned away at site, so no photos). Click a blue one: the OK comes off.
  // It's saved on the visit's issue in Todoist, so the dashboard shows it and an OK made there shows here.
  let busyOk = false;
  async function badgeClick(v, k, cls) {
    if (k === 'a') return aClick(v, cls);
    if (!/\b(r|a|m)\b/.test(cls) || busyOk || v.pending) return;
    if (!token()) { W.alert('Set the Todoist token first (link next to the dates up top), so the OK can be saved.'); return; }
    const item = ITEM[k], where = street(v.ev) + ' (' + dmS(v.date) + ')';
    const on = cls !== 'm';
    if (!W.confirm(on ? 'OK ' + item + ' for ' + first(v.who) + ' at ' + where + ' without them?' : 'Take the OK off ' + item + ' for ' + first(v.who) + ' at ' + where + '?')) return;
    busyOk = true; sy.msg = 'saving...'; sy.bad = false;
    // Show it straight away; Todoist catches up in the background.
    const snap = new Map([...OV].map(([x, s]) => [x, new Set(s)]));
    const keys = on || item === 'timesheet' ? [ikey(v.ev.wrid, v.date, v.who)] : v.crew.map(c => ikey(v.ev.wrid, v.date, c));
    keys.forEach(x => { if (!LOCAL.has(x)) LOCAL.set(x, new Map()); LOCAL.get(x).set(item, { on, at: Date.now() }); });
    applyLocal(); repaint();
    try {
      while (syncing) await new Promise(r => setTimeout(r, 150)); // let a list update that was already going finish first
      await setOk(v, item, on);
      keys.forEach(x => { const m = LOCAL.get(x); if (m && m.has(item)) m.get(item).at = Date.now(); }); // hold it 2 min from the save
      sy.msg = (on ? item + " OK'd " : 'OK taken off ' + item + ' ') + hm(Date.now());
      busyOk = false; tdState = null;
      try { await loadList(true); } catch (e) {}
    } catch (e) {
      // Didn't save: put the letters back how they were.
      keys.forEach(x => { const m = LOCAL.get(x); if (m) { m.delete(item); if (!m.size) LOCAL.delete(x); } });
      OV.clear(); snap.forEach((s, x) => OV.set(x, s));
      sy.bad = true; sy.msg = "didn't save: " + String(e.message || e).slice(0, 40);
      busyOk = false; tdState = null;
    }
    repaint();
    if (syncAgain) { syncAgain = false; sync(); }
  }
  // Redraw every badge in view from what's on screen right now (AroFlo may have redrawn the calendar meanwhile).
  function repaint() {
    if (!cal) return;
    lastJobs = visitsInView();
    Object.values(lastJobs).flat().forEach(paint);
    header(lastJobs, queue.size + running > 0);
  }
  async function setOk(v, item, on) {
    const L = await loadList(true), today = ymd(new Date());
    // Notes and photos are the crew's: an undo looks on every crew member's issue for that day.
    const keys = item === 'timesheet' || on ? [ikey(v.ev.wrid, v.date, v.who)] : v.crew.map(c => ikey(v.ev.wrid, v.date, c));
    const rawMiss = x => { const r = raw(x); return [r.n === false && 'notes', r.p === false && 'photos', r.t === false && 'timesheet'].filter(Boolean); };
    for (const k of keys) {
      let rec = L.open.get(k), closed = false;
      if (!rec && L.done.has(k)) { rec = L.done.get(k); closed = true; }
      if (!on && !(rec && (closed ? splitL(rec.missing).concat(rec.ok) : rec.ok).includes(item))) continue;
      const who = k.split('|')[2], vv = Object.assign({}, v, { who }), rawMissing = rawMiss(vv);
      if (!rec) { // no issue yet for that visit: make one, so the OK is kept
        const t = await newIssue(who, titleOf(vv, rawMissing.length ? rawMissing : [item]), descOf(jnOf(v.ev), v.ev.wrid, v.date, who, rawMissing.length ? rawMissing : [item], []));
        rec = { id: t.id, missing: (rawMissing.length ? rawMissing : [item]).join(', '), ok: [], jn: jnOf(v.ev) };
      }
      if (closed) await td('POST', 'tasks/' + rec.id + '/reopen');
      // A ticked off issue had everything on it OK'd, so that's the starting point once it's reopened.
      const base = closed ? [...new Set(splitL(rec.missing).concat(rec.ok))] : rec.ok;
      const ok = on ? [...new Set(base.concat(item))] : base.filter(x => x !== item);
      const missing = rawMissing.filter(x => !ok.includes(x));
      await td('POST', 'comments', { task_id: rec.id, content: dmS(today) + ': ' + (on ? item + " OK'd by Ethan without them (calendar)" : 'OK on ' + item + ' taken back (calendar)') });
      if (missing.length) {
        await td('POST', 'tasks/' + rec.id, { content: titleOf(vv, missing), description: descOf(rec.jn || jnOf(v.ev), v.ev.wrid, v.date, who, missing, ok) });
      } else { // nothing left: keep what was missing on it, note the OKs, tick it off
        await td('POST', 'tasks/' + rec.id, { description: descOf(rec.jn || jnOf(v.ev), v.ev.wrid, v.date, who, splitL(rec.missing).length ? splitL(rec.missing) : [item], ok) });
        await td('POST', 'tasks/' + rec.id + '/close');
      }
      if (on) break;
    }
  }

  function setToken() {
    const v = W.prompt('Paste your Todoist API token (Todoist Settings > Integrations > Developer). Leave blank to turn the issue list off.', '');
    if (v === null) return;
    GM_setValue('todoistToken', v.trim()); tdState = null; sy.msg = v.trim() ? 'token saved, checking the list...' : ''; sy.bad = false;
    header(lastJobs, false); sync();
  }
  GM_registerMenuCommand('Set Todoist token', setToken);
  GM_registerMenuCommand('Pause or resume the issue list', () => {
    GM_setValue('syncPaused', !paused()); sy.msg = paused() ? 'list paused' : 'list on'; sy.bad = false;
    header(lastJobs, false); if (!paused()) sync();
  });

  // ---------- the booking popup shows its N P T (PC and phone) ----------
  // The badge and its hover text go in a box at the top of AroFlo's booking popup.
  // On PC that's done from the calendar's own booking click (see hook). On a phone, AroFlo's calendar
  // (FullCalendar 1.5) only wires up a booking's click handler on its first mouseover, which a phone fakes
  // unreliably, so taps mostly do nothing: there we take the tap ourselves and call AroFlo's own booking click.
  const PHONE = matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) < 820;
  const eventFor = el => { for (const o of R.values()) if (o.el && o.el[0] === el) return o.ev; return null; };
  const visitOf = (ev, el) => { // the badged visit for a booking, if it has one
    if (!el) for (const o of R.values()) if (o.ev === ev) { el = o.el && o.el[0]; break; }
    const bd = el && el.querySelector && el.querySelector(':scope > .wre-npt');
    return bd && bd.__v && bd.__v.ev._id === ev._id ? bd.__v : null;
  };
  let curBox = null;
  function openVisit(ev, v) {
    W.fullcalEventClick(ev);
    dayBox(v);
  }
  function dayBox(v) {
    curBox = null;
    if (!v) return; // a booking on a later day: no badge, nothing to add
    if (!document.getElementById('wre-day-css')) {
      const st = document.createElement('style'); st.id = 'wre-day-css';
      st.textContent = '.wre-day{display:flex;gap:10px;align-items:flex-start;margin:0 0 8px;padding:8px 10px;background:#f7f4f1;border-left:4px solid #e8731a;border-radius:6px;font:13px/1.4 Arial,sans-serif;color:#222}' +
        '.wre-day .wre-npt{position:static;font:700 15px/24px Arial,sans-serif;gap:3px;flex:0 0 auto}.wre-day .wre-npt i{width:24px;border-radius:4px}.wre-day .tx{white-space:pre-line}';
      document.head.appendChild(st);
    }
    const box = document.createElement('div'); box.className = 'wre-day';
    const draw = () => {
      const t = tipOf(v);
      box.innerHTML = '<span class="wre-npt' + (v.pending ? ' pend' : '') + '">' + 'NPTA'.slice(0, t.cls.length).split('').map((l, i) => '<i class="' + t.cls[i] + '">' + l + '</i>').join('') + '</span><div class="tx">' + esc(t.text) + '</div>';
    };
    draw();
    box.addEventListener('click', e => { // OK / undo straight from the popup, same as the PC badge
      const i = [...box.querySelectorAll('.wre-npt i')].indexOf(e.target);
      if (i >= 0) badgeClick(v, 'npta'[i], e.target.className).then(draw, draw);
    });
    curBox = box;
    let tries = 0;
    const place = () => { // AroFlo fills the popup in after it opens, so keep our box at the top for a few seconds
      if (curBox !== box) return;
      const dlg = [...document.querySelectorAll('.ui-dialog')].find(d => d.offsetParent && d.style.display !== 'none');
      const body = dlg && dlg.querySelector('.ui-dialog-content');
      if (body && body.firstChild !== box) body.prepend(box);
      if (++tries < 40) setTimeout(place, 250);
    };
    place();
  }
  if (PHONE) {
    let t0 = null;
    document.addEventListener('touchstart', e => {
      const el = e.target.closest && e.target.closest('.fc-event');
      t0 = el && e.touches.length === 1 && !e.target.closest('.wre-npt') ? { el, x: e.touches[0].clientX, y: e.touches[0].clientY, at: Date.now() } : null;
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', e => {
      if (t0 && Math.hypot(e.touches[0].clientX - t0.x, e.touches[0].clientY - t0.y) > 10) t0 = null; // a scroll, not a tap
    }, { capture: true, passive: true });
    document.addEventListener('touchend', e => {
      const s = t0; t0 = null;
      if (!s || Date.now() - s.at > 700 || typeof W.fullcalEventClick !== 'function') return;
      let el = s.el, ev = eventFor(el);
      if (!ev) { // AroFlo may have redrawn or rebuilt the calendar (it does after closing a popup): catch up, look again
        hook();
        el = (document.elementFromPoint(s.x, s.y) || { closest: () => null }).closest('.fc-event') || el;
        ev = eventFor(el);
      }
      if (!ev) return; // not a task booking: leave it to AroFlo
      e.preventDefault(); // no fake mouse events after this, so AroFlo doesn't open it twice
      e.stopPropagation();
      try { openVisit(ev, visitOf(ev, el)); } catch (err) {}
    }, { capture: true, passive: false });
  }

  // ---------- hooking into the calendar ----------
  let scanT;
  const soon = () => { clearTimeout(scanT); scanT = setTimeout(() => scan(false), 300); };

  function onRender(ev, el) {
    if (!ev || ev.type !== 'task' || !el) return;
    R.set(ev._id + '|' + ev.schedid, { ev, el });
    soon();
  }

  function hook() {
    const c = W.jQuery && W.jQuery('#calBox');
    const fc = c && c.length && c.data('fullCalendar');
    if (!fc) return false;
    cal = c;
    const o = fc.options;
    // PC: after AroFlo opens a booking's popup, add the N P T box to it (the phone path calls AroFlo directly).
    if (!(o.eventClick && o.eventClick.__wre)) {
      const prevClick = o.eventClick;
      const click = function (ev) {
        const r = prevClick ? prevClick.apply(this, arguments) : undefined;
        try { if (ev && ev.type === 'task') dayBox(visitOf(ev, this && this.nodeType === 1 ? this : null)); else curBox = null; } catch (e) {}
        return r;
      };
      click.__wre = 1;
      o.eventClick = click;
    }
    if (o.eventAfterRender && o.eventAfterRender.__wre) return true;
    const prev = o.eventAfterRender;
    const wrap = function (ev, el) {
      if (prev) { try { prev.apply(this, arguments); } catch (e) {} }
      try { onRender(ev, el); } catch (e) {}
    };
    wrap.__wre = 1;
    o.eventAfterRender = wrap;
    R.clear();
    css();
    fc.rerenderEvents(); // pick up what was drawn before this script ran
    return true;
  }

  // Wait for the calendar without polling: watch the page until it's there, then stop watching.
  function start() {
    if (hook()) return;
    const mo = new MutationObserver(() => { if (hook()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 60000);
  }

  // AroFlo can rebuild the calendar (changing views): re-hook after a click, cheaply.
  document.addEventListener('click', () => setTimeout(() => { if (cal) hook(); }, 0), true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cal) { hook(); scan(false); } });

  start();
})();