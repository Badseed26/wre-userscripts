// ==UserScript==
// @name         WRE Calendar NPT
// @namespace    wre
// @version      2.3
// @description  Notes, photos and timesheet badges on the AroFlo calendar for the days in view, kept in step with the WRE daily check issue list in Todoist
// @match        https://office.aroflo.com/ims/Site/Calendar/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
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
  const LIST_DAYS = 14;                    // only visits from the last 14 days go on the issue list
  const LIST_HOUR = 17;                    // today's misses go on the list from 5pm
  const NICK = { Lachlan: 'Lachie' };      // names as the issue list uses them
  const NO_LIST = /^Ethan\b/;             // your own bookings get badges but stay off the lads' issue list
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

  // ---------- cache (localStorage, small) ----------
  // C.wc[wrid] = task code; C.j[wrid] = {u: last used, n/l/p: {t: read at, d: {date: ...}}}
  let C;
  try { C = JSON.parse(W.localStorage.getItem(KEY)) || {}; } catch (e) { C = {}; }
  C.wc = C.wc || {}; C.j = C.j || {}; C.ad = C.ad || {}; // C.ad[wrid] = the job's Location from AroFlo
  (() => { // prune: jobs not looked at in 30 days, dates older than 60 days
    const old = Date.now() - 30 * 864e5, cut = ymd(new Date(Date.now() - 60 * 864e5));
    for (const w in C.j) {
      const J = C.j[w];
      if (!J.u || J.u < old) { delete C.j[w]; delete C.wc[w]; delete C.ad[w]; continue; }
      ['n', 'l', 'p'].forEach(k => { if (J[k] && J[k].d) for (const dt in J[k].d) if (dt < cut) delete J[k].d[dt]; });
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

  // Labour: {date: ['L Buckley']}
  async function readLabour(E) {
    const rows = textOf(await get('/ims/Site/Resource/Jobsheet/AJAX/view_jobsheet.cfm?wrCoded=' + E), true);
    const d = {};
    rows.forEach(r => {
      if (r.length > 300 || !/Hrs @/.test(r)) return;
      const n = r.match(/^([A-Z]) ([A-Z][\w'-]+) \d{1,2}:\d{2}[ap]m/);
      const ds = r.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
      if (!n || !ds) return;
      const k = dmy(ds[ds.length - 1]), who = n[1] + ' ' + n[2];
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

  // Visits that need a badge, grouped by job. Today's bookings that haven't started yet are left alone.
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
      if (date > today || (date === today && st > now)) continue;
      const k = ev.wrid + '|' + date;
      const v = { id, ev, el: o.el, date, today: date === today, who: ev.resourcename, crew: crew[k] || [ev.resourcename] };
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
      t: has('l', a => a && a.includes(ini(v.who))),
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
      b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); const i = [...b.children].indexOf(e.target); if (i >= 0 && b.__v) badgeClick(b.__v, 'npt'[i], e.target.className); });
    }
    b.__v = v;
    const s = status(v), J = C.j[v.ev.wrid] || {}, err = errs[v.ev.wrid];
    const cls = x => (x === null || err ? '' : x === 'm' ? 'm' : x ? 'g' : v.today ? 'a' : 'r');
    [s.n, s.p, s.t].forEach((x, i) => { b.children[i].className = cls(x); });
    const crewTxt = v.crew.map(first).join(', ');
    const nA = J.n && (J.n.d[v.date] || []).filter(x => v.crew.includes(x)).map(first);
    const pO = J.p && J.p.d[v.date] || {};
    const pTxt = 'in (' + Object.keys(pO).map(first).join(', ') + ')';
    const t = Math.min(...['n', 'l', 'p'].map(k => (J[k] ? J[k].t : Infinity)));
    b.title = (err ? "Couldn't check: " + err + '\n' : '') +
      'Notes: ' + (s.n === null ? 'not read yet' : s.n === 'm' ? "none, OK'd by you" : s.n ? 'in (' + nA.join(', ') + ')' : 'none from the crew') + '\n' +
      'Photos: ' + (s.p === null ? 'not read yet' : s.p === 'm' ? "none, OK'd by you" : s.p ? pTxt : 'none that day') + '\n' +
      'Timesheet: ' + (s.t === null ? 'not read yet' : s.t === 'm' ? "none, OK'd by you" : s.t ? 'in' : 'missing (' + ini(v.who) + ')') + '\n' +
      'Crew: ' + crewTxt + (isFinite(t) ? '\nChecked ' + hm(t) : '') +
      ([s.n, s.p, s.t].some(x => x === false || x === 'm') ? '\nClick a red letter to OK it, a blue one to undo' : '');
  }
  function header(jobs, busy) {
    const h = document.querySelector('.fc-header-title');
    if (!h) return;
    let s = h.querySelector('.wre-npt-h');
    if (!s) {
      s = document.createElement('span'); s.className = 'wre-npt-h'; s.title = 'Recheck notes, photos and timesheets for the weeks in view';
      s.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target.closest('.wre-npt-tok')) setToken(); // the "set Todoist token" link
        else scan(true);                                  // anywhere else: recheck
      });
      (h.querySelector('h2') || h).appendChild(s);
    }
    let miss = 0, unk = 0;
    Object.values(jobs).flat().forEach(v => { const x = status(v); if (errs[v.ev.wrid] || [x.n, x.p, x.t].includes(null)) unk++; else if (!(x.n && x.p && x.t)) miss++; });
    const list = paused() ? 'issue list paused' : sy.msg;
    const tok = !token() || /token not accepted/.test(sy.msg);
    s.innerHTML = 'NPT ' + (busy ? 'checking...' : miss ? '<b>' + miss + ' missing</b>' : 'all in') + (unk && !busy ? ', ' + unk + " couldn't check" : '') + ' &#8635;' +
      (list && token() ? ' <small class="' + (sy.bad ? 'bad' : '') + '">' + esc(list) + '</small>' : '') +
      (tok ? ' <a class="wre-npt-tok" href="#" title="Turn on the issue list">' + (token() ? 'Fix Todoist token' : 'Set Todoist token') + '</a>' : '');
  }

  // ---------- the runner ----------
  const queue = new Map(); // wrid -> force
  let running = 0, lastJobs = {};

  function scan(force) {
    if (!cal) return;
    lastJobs = visitsInView();
    const now = Date.now();
    for (const w in lastJobs) {
      const vs = lastJobs[w];
      const J = C.j[w];
      if (J) J.u = now;
      vs.forEach(paint);
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
    const vs = (lastJobs[w] || []);
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
  const titleOf = (v, missing) => nick(v.who) + ', ' + street(v.ev) + ' (' + dmS(v.date) + '): ' + missing.join(', ');
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
    const open = new Map(), done = new Map();
    const rec = t => { const m = (t.description || '').match(DESC); if (!m) return null; const o = (t.description || '').match(OKL);
      return { k: ikey(m[2], m[3], m[4].trim()), id: t.id, missing: m[5].trim(), ok: splitL(o && o[1]), jn: m[1] }; };
    let cur = null, n = 0;
    do {
      const j = await td('GET', 'tasks?project_id=' + ISSUES + '&limit=200' + (cur ? '&cursor=' + encodeURIComponent(cur) : ''));
      (j && j.results || []).forEach(t => { const r = rec(t); if (r) open.set(r.k, r); });
      cur = j && j.next_cursor; n++;
    } while (cur && n < 5);
    // Ticked off in the last ~2 months: never added again, and whatever was still on them counts as OK'd by you.
    const since = new Date(now - 60 * 864e5).toISOString().slice(0, 19) + 'Z', until = new Date(now + 864e5).toISOString().slice(0, 19) + 'Z';
    cur = null; n = 0;
    do {
      const j = await td('GET', 'tasks/completed/by_completion_date?project_id=' + ISSUES + '&since=' + since + '&until=' + until + '&limit=200' + (cur ? '&cursor=' + encodeURIComponent(cur) : ''));
      (j && j.items || []).forEach(t => { const r = rec(t); if (r && !open.has(r.k)) done.set(r.k, r); });
      cur = j && j.next_cursor; n++;
    } while (cur && n < 5);
    // A slower, older read finishing after a newer one never overwrites it.
    if (my < loadApplied && tdState) return tdState;
    loadApplied = my;
    OV.clear();
    open.forEach((r, k) => { if (r.ok.length) OV.set(k, new Set(r.ok)); });
    done.forEach((r, k) => OV.set(k, new Set(splitL(r.missing).concat(r.ok))));
    applyLocal();
    return (tdState = { at: now, open, done });
  }

  async function sync() {
    if (!token() || paused()) return;
    if (syncing || busyOk) { syncAgain = true; return; } // never runs alongside an OK being saved
    syncing = true;
    try {
      const now = new Date(), today = ymd(now), oldest = ymd(new Date(now.getTime() - LIST_DAYS * 864e5));
      const want = new Map(); // key -> {v, missing}
      const all = Object.values(lastJobs).flat();
      // Anything red in view: read the list so OKs you made elsewhere (the dashboard, your phone) show here.
      if (all.some(v => { const r = raw(v); return r.n === false || r.p === false || r.t === false; })) {
        const was = tdState && tdState.at; await loadList(); if (tdState.at !== was) all.forEach(paint);
      }
      all.forEach(v => {
        if (errs[v.ev.wrid] || NO_LIST.test(v.who) || v.date < oldest || (v.today && now.getHours() < LIST_HOUR)) return;
        if (LOCAL.has(ikey(v.ev.wrid, v.date, v.who))) return; // you just clicked this one: the click already saved it, leave it be
        const s = status(v);
        if ([s.n, s.p, s.t].includes(null)) return;
        const missing = [!s.n && 'notes', !s.p && 'photos', !s.t && 'timesheet'].filter(Boolean);
        want.set(ikey(v.ev.wrid, v.date, v.who), { v, missing });
      });
      if (!want.size) {
        if (/token saved/.test(sy.msg)) { await loadList(); sy.bad = false; sy.msg = 'list on ' + hm(Date.now()); } // proves the token works
        return;
      }
      const L = await loadList();
      let added = 0, closed = 0, changed = 0;
      for (const [k, { v, missing }] of want) {
        const ex = L.open.get(k), m = missing.join(', ');
        if (missing.length) {
          if (ex) {
            if (ex.missing === m) continue;
            const was = ex.missing.split(', '), r0 = raw(v), gone = was.filter(x => !missing.includes(x));
            const inNow = gone.filter(x => r0[{ notes: 'n', photos: 'p', timesheet: 't' }[x]] === true), okd = gone.filter(x => !inNow.includes(x));
            await td('POST', 'tasks/' + ex.id, { content: titleOf(v, missing), description: descOf(ex.jn || jnOf(v.ev), v.ev.wrid, v.date, v.who, missing, ex.ok) });
            if (gone.length) await td('POST', 'comments', { task_id: ex.id, content: dmS(today) + ': ' + [inNow.length && listed(inNow) + ' in', okd.length && listed(okd) + " OK'd by Ethan"].filter(Boolean).join(', ') + ', ' + listed(missing) + ' still missing' });
            ex.missing = m; changed++;
          } else if (!L.done.has(k)) {
            const t = await td('POST', 'tasks', { project_id: ISSUES, content: titleOf(v, missing), description: descOf(jnOf(v.ev), v.ev.wrid, v.date, v.who, missing, []) });
            if (t && t.id) L.open.set(k, { id: t.id, missing: m, ok: [], jn: jnOf(v.ev) });
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

  // ---------- OK'ing a missing item by hand, from the calendar ----------
  // Click a red letter: it's OK'd (e.g. turned away at site, so no photos). Click a blue one: the OK comes off.
  // It's saved on the visit's issue in Todoist, so the dashboard shows it and an OK made there shows here.
  let busyOk = false;
  async function badgeClick(v, k, cls) {
    if (!/\b(r|a|m)\b/.test(cls) || busyOk) return;
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
        const t = await td('POST', 'tasks', { project_id: ISSUES, content: titleOf(vv, rawMissing.length ? rawMissing : [item]), description: descOf(jnOf(v.ev), v.ev.wrid, v.date, who, rawMissing.length ? rawMissing : [item], []) });
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