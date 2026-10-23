// ==UserScript==
// @name         Tradies Web quick fill (Ambrose)
// @namespace    wre
// @version      1.9
// @description  One-click site sign-in (PSEA NA first 4, Yes rest, confirm, Done, your saved signature, Sign In) and electrical report defaults (Met With Insured, Electrician, licence 76530). Never touches report Save or Submit.
// @match        https://tradies.ambrosebuilding.com.au/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/tradies-quick-fill.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/tradies-quick-fill.user.js
// ==/UserScript==

// Built from src/tradies-quick-fill.js by build.py. Change src/tradies-quick-fill.js, not this file.
(function () {
  // Live updates (23/10): Tampermonkey only checks for a new version every few hours. This checks the repo's latest commit every
  // 2 min (free when nothing's changed) and keeps the newest code here, so a push runs on the next page load. If the new code needs
  // a permission this install hasn't got, or this browser won't run it, the built in copy below runs like before.
  const __wreName = "tradies-quick-fill", __wreVer = "1.9", __wreHave = new Set(["// @connect api.github.com", "// @connect raw.githubusercontent.com", "// @grant GM_getValue", "// @grant GM_setValue", "// @grant GM_xmlhttpRequest", "// @match https://tradies.ambrosebuilding.com.au/*", "// @run-at document-idle"]);
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
  // ---------- the built in copy (src/tradies-quick-fill.js at 1.9) ----------

(function () {
  'use strict';

  const ORANGE = '#e8731a';
  const LICENCE_NO = '76530';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const vis = e => !!(e && (e.offsetParent || e.getClientRects().length));
  const PHONE = matchMedia('(pointer:coarse) and (max-width:820px)').matches;

  function toast(m, bad) {
    let t = document.getElementById('wre-qf-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'wre-qf-toast';
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;max-width:min(420px,calc(100vw - 40px));z-index:2147483647;padding:10px 14px;border-radius:6px;font:14px/1.4 sans-serif;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:pre-line';
      document.documentElement.append(t);
    }
    t.style.background = bad ? '#b3261e' : ORANGE;
    t.textContent = m;
    clearTimeout(t._h);
    t._h = setTimeout(() => t.remove(), 9000);
  }

  // ---------- PSEA ----------
  function pseaGroups() {
    return [...document.querySelectorAll('ab-radio')].filter(g => {
      const labs = [...g.querySelectorAll('.fake-label')].map(l => clean(l.textContent));
      return labs.includes('Yes') && labs.includes('NA') && vis(g);
    });
  }
  const picked = g => { const it = [...g.querySelectorAll('ab-radio-item')].find(i => i.querySelector('.fake-radio.true')); return it ? clean(it.querySelector('.fake-label').textContent) : ''; };

  async function fillPsea() {
    const groups = pseaGroups();
    if (groups.length < 5) return toast('Can\'t see the PSEA questions on this page.', true);
    const wrong = [];
    for (let i = 0; i < groups.length; i++) {
      const want = i < 4 ? 'NA' : 'Yes';
      if (picked(groups[i]) === want) continue;
      const item = [...groups[i].querySelectorAll('ab-radio-item')].find(it => clean(it.querySelector('.fake-label').textContent) === want);
      if (!item) { wrong.push(i + 1); continue; }
      (item.querySelector('.radio-item-wrap') || item).click();
      await sleep(60);
      if (picked(groups[i]) !== want) { item.querySelector('.fake-radio') && item.querySelector('.fake-radio').click(); await sleep(60); }
      if (picked(groups[i]) !== want) wrong.push(i + 1);
    }
    const na = groups.filter((g, i) => i < 4 && picked(g) === 'NA').length;
    const yes = groups.filter((g, i) => i >= 4 && picked(g) === 'Yes').length;
    if (wrong.length) { toast('Didn\'t take on question ' + wrong.join(', ') + '. Check those by hand.', true); return false; }
    return { na, yes };
  }


  // ---------- Signature (yours, saved once) ----------
  const pad = () => [...document.querySelectorAll('ab-signature-pad canvas, .signature-control canvas')].find(vis);
  const btnByText = re => [...document.querySelectorAll('button')].find(b => vis(b) && re.test(clean(b.innerText)));
  // pixels that differ from the pad's background (the pad is filled white, so plain alpha counts are useless)
  const ink = c => {
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const bg = [d[0], d[1], d[2], d[3]];
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) + Math.abs(d[i + 3] - bg[3]) > 80) n++;
      return n;
    } catch (e) { return -1; }
  };
  const loadSig = () => { try { return JSON.parse(GM_getValue('wreSignature', 'null')); } catch (e) { return null; } };

  // record what you draw on the pad, so "Save my signature" can keep it
  let rec = [], cur = null, replaying = false;
  document.addEventListener('pointerdown', e => {
    const c = pad(); if (replaying || !c || e.target !== c) return;
    const r = c.getBoundingClientRect(); cur = [[(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]]; rec.push(cur);
  }, true);
  document.addEventListener('pointermove', e => {
    const c = pad(); if (replaying || !cur || !c) return;
    const r = c.getBoundingClientRect(); cur.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
  }, true);
  document.addEventListener('pointerup', () => { cur = null; }, true);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (!replaying && b && /^CLEAR$/i.test(clean(b.innerText))) rec = []; }, true);

  function saveSig() {
    const strokes = rec.filter(s => s.length > 1);
    if (!strokes.length) return toast('Sign the box first, then hit Save my signature.', true);
    GM_setValue('wreSignature', JSON.stringify(strokes));
    toast('Saved. Sign in to site will use this signature from now on.');
  }

  // Ambrose's pad (signature_pad) drops moves that come faster than every 16ms, so replay at a human pace
  const thin = (s, max) => { if (s.length <= max) return s; const k = Math.ceil(s.length / max); const o = s.filter((p, i) => i % k === 0); o.push(s[s.length - 1]); return o; };
  async function drawSig(strokes) {
    const c = pad();
    if (!c) return { ok: false, why: 'no signature box' };
    const before = ink(c);
    const fire = (Ctor, type, x, y, extra) => {
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new Ctor(type, Object.assign({ bubbles: true, cancelable: true, composed: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, button: 0, buttons: /up$/.test(type) ? 0 : 1 }, extra)));
    };
    const run = async (Ctor, d, m, u, extra) => {
      for (const s of strokes) {
        const pts = thin(s, 60);
        fire(Ctor, d, pts[0][0], pts[0][1], extra); await sleep(25);
        for (const p of pts.slice(1)) { fire(Ctor, m, p[0], p[1], extra); await sleep(20); }
        const l = pts[pts.length - 1]; fire(Ctor, u, l[0], l[1], extra); await sleep(60);
      }
      await sleep(250);
    };
    replaying = true;
    try {
      await run(PointerEvent, 'pointerdown', 'pointermove', 'pointerup', { pointerId: 1, pointerType: 'mouse', isPrimary: true, pressure: 0.5 });
      if (ink(pad() || c) < before + 30) await run(MouseEvent, 'mousedown', 'mousemove', 'mouseup', {});
      // last go on phones: real touch events, in case the pad only listens for those
      if (ink(pad() || c) < before + 30 && typeof Touch === 'function' && typeof TouchEvent === 'function') {
        const tfire = (type, x, y) => {
          const r = c.getBoundingClientRect();
          const t = new Touch({ identifier: 1, target: c, clientX: r.left + x * r.width, clientY: r.top + y * r.height });
          c.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }));
        };
        try {
          for (const st of strokes) {
            const pts = thin(st, 60);
            tfire('touchstart', pts[0][0], pts[0][1]); await sleep(25);
            for (const pt of pts.slice(1)) { tfire('touchmove', pt[0], pt[1]); await sleep(20); }
            const l = pts[pts.length - 1]; tfire('touchend', l[0], l[1]); await sleep(60);
          }
          await sleep(250);
        } catch (e) {}
      }
      const after = ink(pad() || c);
      return { ok: after >= before + 30, why: 'ink ' + before + ' to ' + after };
    } finally { replaying = false; }
  }

  // ---------- Sign in to site: PSEA, confirm, Done, signature, Sign In ----------
  async function waitFor(fn, ms) { for (let t = 0; t < ms; t += 150) { const v = fn(); if (v) return v; await sleep(150); } return null; }

  async function signIn() {
    const strokes = loadSig();
    if (!strokes) return toast('No saved signature yet. Sign the box yourself once, hit Save my signature, then try again.', true);

    // 1. PSEA, if it's waiting
    let groups = pseaGroups();
    if (groups.length < 5) {
      const read = btnByText(/READ PSEA/i);
      if (read && /not signed in|sign in again|read the PSEA/i.test(document.body.innerText)) {
        read.click();
        groups = await waitFor(() => { const g = pseaGroups(); return g.length >= 5 ? g : null; }, 8000) || [];
      }
    }
    let psea = null;
    if (groups.length >= 5) {
      // trade first, in case the questions change with it
      const act = find(/activity/i);
      if (act && act.sel && !/^electrical labour$/i.test(valueOf(act))) {
        const r = await setSelect(act, 'Electrical Labour');
        if (r !== true) return toast('Couldn\'t set the activity to Electrical Labour (' + r + '). Pick it by hand, then hit Sign in to site again.', true);
        await sleep(800);
        await waitFor(() => pseaGroups().length >= 5, 5000);
      }
      psea = await fillPsea();
      if (!psea) return;
      const boxes = [...document.querySelectorAll('input[type=checkbox]')].filter(i => vis(i) || vis(i.closest('mat-checkbox, .mat-mdc-checkbox')));
      const near = i => { let e = i; for (let k = 0; k < 4 && e; k++) { e = e.parentElement; if (e && /read and understood/i.test(e.innerText || '')) return true; } return false; };
      const cb = boxes.find(near) || (boxes.length === 1 ? boxes[0] : null);
      if (!cb) return toast('PSEA answered but couldn\'t find the confirm box. Tick it, hit Done and sign by hand.', true);
      if (!cb.checked) { cb.click(); await sleep(250); }
      if (!cb.checked) return toast('PSEA answered but the confirm box didn\'t tick. Tick it, hit Done and sign by hand.', true);
      const done = btnByText(/^DONE$/i);
      if (!done) return toast('PSEA answered and confirmed, but no Done button showing. Hit it by hand, then sign.', true);
      done.click();
    }

    // 2. Signature: wait for the sign-in screen to come back properly after Done
    const ready = await waitFor(() => pseaGroups().length === 0 && pad() && btnByText(/^SIGN IN$/i), 15000);
    if (!ready) return toast((psea ? 'PSEA done, but the' : 'The') + ' signature box didn\'t show. Sign by hand.', true);
    pad().scrollIntoView({ block: 'center' });
    await sleep(900);
    if (ink(pad()) < 30) {
      const r = await drawSig(strokes);
      if (!r.ok) return toast((psea ? 'PSEA done. ' : '') + 'Couldn\'t draw the signature (' + r.why + '), so I didn\'t sign in. Sign by hand and hit Sign In.', true);
    }
    await sleep(400);

    // 3. Sign In
    const go = btnByText(/^SIGN IN$/i);
    if (!go || go.disabled) return toast('Signed the box but Sign In isn\'t ready. Check it and hit Sign In by hand.', true);
    go.click();
    const res = await waitFor(() => !/currently not signed in|sign in again/i.test(document.body.innerText) ? 'in' : null, 10000);
    toast(res ? 'Signed in to site' + (psea ? ' (PSEA: NA x' + psea.na + ', Yes x' + psea.yes + ')' : '') + '.' : 'Hit Sign In but the page still says not signed in. Have a look.', !res);
  }

  // ---------- Electrical report ----------
  // Some reports (Electrical) put the label inside the field; others (Make Safe) put it as a heading above the
  // field, sometimes with an "Eg: ..." hint line in between. Take whichever is there.
  function labelFor(f) {
    const inside = clean((f.querySelector('mat-label, label') || {}).textContent);
    if (inside) return inside;
    let x = f, parts = [];
    for (let k = 0; k < 4 && x; k++) {
      let ps = x.previousElementSibling, hops = 0;
      while (ps && hops < 3) {
        const t = clean(ps.textContent);
        if (t && t.length < 90) { parts.unshift(t); if (!/^eg[:.]/i.test(t)) return parts.join(' '); }
        ps = ps.previousElementSibling; hops++;
      }
      x = x.parentElement;
      if (x && x.matches('form, section, mat-expansion-panel, mat-accordion')) break;
    }
    return parts.join(' ');
  }
  function fields() {
    return [...document.querySelectorAll('mat-form-field, .mat-mdc-form-field')].filter(vis).map(f => ({
      f,
      label: labelFor(f).replace(/\*$/, '').trim(),
      sel: f.querySelector('mat-select'),
      inp: f.querySelector('input:not([type=hidden]), textarea'),
    }));
  }
  const find = re => fields().find(x => re.test(x.label));
  const MET_RE = /\bmet\b.*\bwith\b/i;
  const isReport = () => /\/reports?\//i.test(location.pathname) || !!find(MET_RE);
  // the Make Safe report starts with every section folded up; open "Site Details" so the fields exist
  async function openSiteDetails() {
    if (find(MET_RE)) return true;
    const hdr = [...document.querySelectorAll('qna-expandable-section-header, .expandable-header, mat-expansion-panel-header')].find(e => vis(e) && /^Site Details/i.test(clean(e.textContent)));
    if (!hdr) return false;
    (hdr.querySelector('.expandable-header') || hdr).click();
    for (let i = 0; i < 20 && !find(MET_RE); i++) await sleep(150);
    return !!find(MET_RE);
  }

  function valueOf(x) {
    if (x.sel) return clean((x.sel.querySelector('.mat-mdc-select-value-text, .mat-select-value-text') || {}).textContent);
    return x.inp ? x.inp.value.trim() : '';
  }

  async function setText(x, v) {
    const el = x.inp;
    el.focus();
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    ['input', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.blur();
    await sleep(120);
    return el.value === v;
  }

  async function setSelect(x, want) {
    (x.sel.querySelector('.mat-mdc-select-trigger, .mat-select-trigger') || x.sel).click();
    let opt;
    for (let i = 0; i < 20 && !opt; i++) {
      await sleep(100);
      opt = [...document.querySelectorAll('mat-option, .mat-mdc-option')].find(o => clean(o.textContent).toLowerCase() === want.toLowerCase());
    }
    if (!opt) {
      const seen = [...document.querySelectorAll('mat-option, .mat-mdc-option')].map(o => clean(o.textContent)).join(', ');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const bd = document.querySelector('.cdk-overlay-backdrop'); bd && bd.click();
      await sleep(200);
      return 'no "' + want + '" option' + (seen ? ' (has: ' + seen.slice(0, 80) + ')' : '');
    }
    opt.click();
    await sleep(250);
    return valueOf(x).toLowerCase() === want.toLowerCase() ? true : 'didn\'t take';
  }

  async function fillReport() {
    await openSiteDetails();
    const plan = [
      { name: 'Met With', re: MET_RE, val: 'Insured' },
      { name: 'Trade Licence Type', re: /licen[cs]e\s*type/i, val: 'Electrician' },
      { name: 'Licence number', re: /licen[cs]e\s*(no\b|no\.|number|#)/i, val: LICENCE_NO },
    ];
    const done = [], kept = [], bad = [], none = [];
    for (const p of plan) {
      const x = find(p.re);
      if (!x) { none.push(p.name); continue; }
      const cur = valueOf(x);
      if (cur) { kept.push(p.name + ' (already ' + cur + ')'); continue; }
      const r = x.sel ? await setSelect(x, p.val) : x.inp ? (await setText(x, p.val) || 'didn\'t take') : 'unknown field type';
      r === true ? done.push(p.name + ': ' + p.val) : bad.push(p.name + ': ' + r);
    }
    const lines = [];
    if (done.length) lines.push('Filled ' + done.join(', '));
    if (kept.length) lines.push('Left alone ' + kept.join(', '));
    if (bad.length) lines.push('Check by hand: ' + bad.join('; '));
    if (none.length) lines.push('Not on this report: ' + none.join(', '));
    if (!done.length && !kept.length && !bad.length) lines.push('Couldn\'t find the report fields. Open the Site Details section and try again.');
    lines.push('Emergency Work is up to you.');
    toast(lines.join('\n'), bad.length > 0 || (!done.length && !kept.length));
  }

  // ---------- buttons ----------
  const style = 'position:fixed;left:' + (PHONE ? 12 : 18) + 'px;z-index:2147483646;background:' + ORANGE + ';color:#fff;border:0;border-radius:6px;padding:' + (PHONE ? '12px 16px' : '10px 14px') + ';font:600 ' + (PHONE ? 15 : 14) + 'px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;touch-action:manipulation';
  const mk = (id, text, fn, bottom) => {
    const b = document.createElement('button');
    // on a phone the buttons are taller and sit clear of the home bar
    const bot = PHONE ? Math.round(bottom * 60 / 52) - 4 : bottom;
    b.id = id; b.textContent = text; b.style.cssText = style + ';bottom:' + (PHONE ? 'calc(' + bot + 'px + env(safe-area-inset-bottom))' : bot + 'px');
    b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } catch (e) { toast('Stopped: ' + e.message, true); } b.disabled = false; });
    return b;
  };
  // sits above the "Grab from AroFlo" button when both are showing
  const signBtn = mk('wre-qf-sign', 'Sign in to site', signIn, 70);
  const saveBtn = mk('wre-qf-savesig', 'Save my signature', async () => saveSig(), 122);
  const repBtn = mk('wre-qf-report', 'Report defaults', fillReport, 70);
  saveBtn.style.background = '#6b625b';

  const sync = () => {
    const onSafety = pseaGroups().length >= 5 || !!btnByText(/^SIGN IN$/i) || (!!btnByText(/READ PSEA/i) && /not signed in|sign in again/i.test(document.body.textContent));
    const showRep = !onSafety && isReport();
    const showSave = !!pad();
    if (onSafety !== signBtn.isConnected) onSafety ? document.documentElement.append(signBtn) : signBtn.remove();
    if (showSave !== saveBtn.isConnected) showSave ? document.documentElement.append(saveBtn) : saveBtn.remove();
    if (showRep !== repBtn.isConnected) showRep ? document.documentElement.append(repBtn) : repBtn.remove();
    if (onSafety) signBtn.textContent = loadSig() ? 'Sign in to site' : 'Sign in to site (save signature first)';
  };
  setInterval(() => { if (!document.hidden) sync(); }, 1000);
  sync();
})();
})();
