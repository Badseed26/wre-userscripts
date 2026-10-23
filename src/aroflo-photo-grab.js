// ==UserScript==
// @name         AroFlo photo grab (Ambrose)
// @namespace    wre
// @version      1.10
// @description  Pick photos from the matching AroFlo task, see each day's site notes, and upload full-res originals to Ambrose in batches of 4 with comments filled in
// @match        https://tradiesadmin.ambroseconstruct.com.au/*
// @match        https://tradies.ambrosebuilding.com.au/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      office.aroflo.com
// @connect      api.anthropic.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-photo-grab.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-photo-grab.user.js
// ==/UserScript==

(function () {
  'use strict';

  const AF = 'https://office.aroflo.com';
  const ORANGE = '#e8731a';
  const IMG_RE = /\.(jpe?g|png|heic|heif|webp|gif)$/i;
  const BATCH = 4;                                        // Ambrose crawls with more than 4 at once
  const OFFICE = ['Lisa Navie', 'Ethan Callaghan'];       // their notes show, but never trigger "notes, no photos"
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // ---------- AroFlo requests (uses your AroFlo login in Chrome) ----------
  function gm(opts) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...opts,
        onload: r => resolve(r),
        onerror: () => reject(new Error('couldn\'t reach AroFlo')),
        ontimeout: () => reject(new Error('AroFlo took too long')),
        timeout: 60000,
      });
    });
  }
  const SIGNED_OUT = 'AroFlo is signed out. Open AroFlo, sign in, then try again.';
  const signedOut = html => /name=["']?password|Login to AroFlo|loginForm/i.test(html) && !/workrequest|noteItem/i.test(html);

  async function searchTasks(term, field) {
    const body = new URLSearchParams({ taskString: term, SearchParam: field, searchtasks: 'Search', searchtasks_btn: 'Search' }).toString();
    const r = await gm({ method: 'POST', url: AF + '/ims/Site/Home/index.cfm?tid=IMS.STK.CUR', data: body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (signedOut(r.responseText)) throw new Error(SIGNED_OUT);
    const d = new DOMParser().parseFromString(r.responseText, 'text/html');
    return [...d.querySelectorAll('tr')].filter(tr => tr.querySelectorAll('td').length >= 6).map(tr => {
      const c = [...tr.querySelectorAll('td')].map(x => clean(x.textContent)).filter(Boolean);
      const a = [...tr.querySelectorAll('a')].find(a => /workrequest/.test(a.getAttribute('href') || '') && !/printview/.test(a.getAttribute('href')));
      const m = a && a.getAttribute('href').match(/wrCoded=([^&]+)/i);
      return { jn: c[1], task: c[4] || '', status: c[c.length - 1] || '', code: m ? m[1] : '' };
    }).filter(t => t.code && /^\d+$/.test(t.jn || ''));
  }

  async function taskPhotos(code) {
    const q = 'searchdocumenttype=task&idcoded=' + code + '&customfield_id=0&columns=document,comment,uploadedby,imgdatetimetaken,datetimeinserted' +
      '&category_id=0&searchTaskBUs=childbus&_search=true&nd=' + Date.now() + '&rows=500&page=1&sidx=sortOrder&sord=asc';
    const r = await gm({ method: 'GET', url: AF + '/ims/Site/Documents/AJAX_JSON_search_documents.cfm?' + q });
    let j;
    try { j = JSON.parse(r.responseText); } catch (e) { throw new Error(signedOut(r.responseText) ? SIGNED_OUT : 'AroFlo didn\'t send the photo list'); }
    const txt = s => clean(String(s == null ? '' : s).replace(/<[^>]+>/g, ' '));
    return (j.rows || []).map(r => ({
      name: txt(r.documentname),
      by: txt(r.uploadedby),
      taken: txt(r.imgdatetimetaken) || txt(r.datetimeinserted),
      caption: clean(new DOMParser().parseFromString(String(r.comment || ''), 'text/html').body.textContent),
      orig: String(r.timedlinkoriginal || ''),
      thumb: String(r.timedlinkthumbnailsmall || r.timedlinkthumbnaillarge || ''),
    })).filter(p => IMG_RE.test(p.name) && p.orig);
  }

  // Keep the note's own layout (paragraphs, line breaks, dot points, bold) but nothing else from AroFlo
  const KEEP = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'DIV', 'SPAN']);
  const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|TR|TABLE)$/;
  const hasTags = src => !!src.querySelector('p,br,div,li');
  function noteFrag(src) {
    const rich = hasTags(src);
    const frag = document.createDocumentFragment();
    const walk = (from, to) => from.childNodes.forEach(n => {
      if (n.nodeType === 3) { to.append(document.createTextNode(rich ? n.textContent.replace(/\s+/g, ' ') : n.textContent)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (/^(SCRIPT|STYLE|IMG|IFRAME|OBJECT|BUTTON|INPUT)$/.test(tag)) return;
      if (KEEP.has(tag)) { const e = document.createElement(tag === 'DIV' ? 'div' : tag.toLowerCase()); walk(n, e); to.append(e); }
      else if (BLOCK.test(tag)) { const e = document.createElement('div'); walk(n, e); to.append(e); }
      else walk(n, to);
    });
    walk(src, frag);
    return frag;
  }
  function notePlain(src) {
    if (!hasTags(src)) return src.textContent.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    let out = '';
    const walk = n => n.childNodes.forEach(c => {
      if (c.nodeType === 3) { out += c.textContent.replace(/\s+/g, ' '); return; }
      if (c.nodeType !== 1) return;
      if (c.tagName === 'BR') { out += '\n'; return; }
      if (c.tagName === 'LI') out += '\n- ';
      const block = BLOCK.test(c.tagName);
      if (block && c.tagName !== 'LI') out += '\n';
      walk(c);
      if (block) out += '\n';
    });
    walk(src);
    return out.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  async function taskNotes(code) {
    const r = await gm({ method: 'GET', url: AF + '/ims/Site/Service/Notes/AJAX_HTML_get_notes.cfm?dateorder=0&last3notes=0&isLoaded=1&wrCoded=' + code + '&_=' + Date.now() });
    if (signedOut(r.responseText)) throw new Error(SIGNED_OUT);
    const d = new DOMParser().parseFromString(r.responseText, 'text/html');
    return [...d.querySelectorAll('.noteItem')].map(n => {
      const hs = [...n.querySelectorAll('.heading3')].map(x => clean(x.textContent));
      const m = (hs[0] || '').match(/(\d{1,2}) (\w+) (\d{4}) (\S+)/);
      const out = n.querySelector('.noteOutput');
      const text = out ? notePlain(out) : '';
      return { body: out, day: m ? m[1] + '/' + (MONTHS[m[2].toLowerCase()] || m[2]) + '/' + m[3] : 'No date', time: m ? m[4] : '', who: hs[1] || '', text };
    }).filter(n => n.text);
  }

  function getBlob(path) {
    return gm({ method: 'GET', url: AF + path, responseType: 'blob' }).then(r => {
      if (r.status < 200 || r.status >= 300) throw new Error('AroFlo said ' + r.status);
      return r.response;
    });
  }

  async function shrink(blob, max) {
    const bm = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bm.width, bm.height));
    if (k === 1) return blob;
    const c = document.createElement('canvas');
    c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  }

  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
  }


  // ---------- AI captions (Claude Haiku 5.5 on your own API key, kept only in Tampermonkey) ----------
  const MODEL = 'claude-haiku-5-5';
  const PRICE_IN = 0.10, PRICE_OUT = 0.50; // USD per million tokens
  const getKey = (force) => {
    let k = force ? '' : GM_getValue('wreAnthropicKey', '');
    if (!k) {
      k = (prompt('Paste your Anthropic API key (from console.anthropic.com). It stays in Tampermonkey on this device.') || '').trim();
      if (k) GM_setValue('wreAnthropicKey', k);
    }
    return k;
  };
  try { GM_registerMenuCommand('Change Anthropic API key', () => getKey(true)); } catch (e) {}

  const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

  async function captionChunk(key, list, notesText) {
    const content = [];
    list.forEach((p, k) => { content.push({ type: 'text', text: 'Photo ' + (k + 1) + ':' }); content.push({ type: 'image', source: { type: 'base64', media_type: p.b64type, data: p.b64 } }); });
    content.push({ type: 'text', text:
      'Site notes from that day:\n' + (notesText || '(none)') + '\n\n' +
      'Write one short caption for each photo above, for an electrical contractor\'s photo log sent to an insurance builder. ' +
      'Rules: 4 to 12 words each. Plain Australian trade wording, like "Light switch removed, cable terminated and made safe" or "Main switchboard, isolated circuits labelled". ' +
      'Describe what the photo shows, using the notes for context (which room, what was done). Use proper trade names for gear you can see: home battery, solar inverter, hot water system (HWS), pressure pump, switchboard, isolator, GPO, light switch, downlight, conduit. Mention the main items, not just one. Don\'t claim tests, readings or compliance unless the notes say so. ' +
      'Don\'t guess brands or ratings you can\'t read. No dashes, no full stop at the end. ' +
      'Reply with only a JSON array of ' + list.length + ' strings, in photo order.' });
    const r = await gm({
      method: 'POST', url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      data: JSON.stringify({ model: MODEL, max_tokens: 1500, thinking: { type: 'disabled' }, messages: [{ role: 'user', content }] }),
    });
    if (!r.responseText) throw new Error('no reply from the AI (status ' + r.status + '). If Tampermonkey opened a tab asking to allow api.anthropic.com, hit Always allow');
    let j; try { j = JSON.parse(r.responseText); } catch (e) { throw new Error('the AI sent back something odd (status ' + r.status + '): ' + r.responseText.slice(0, 120)); }
    if (r.status === 401) { GM_setValue('wreAnthropicKey', ''); throw new Error('API key not accepted. Hit AI captions again to paste a new one'); }
    if (r.status >= 400) throw new Error((j.error && j.error.message) || ('AI error ' + r.status));
    const txt = (j.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('');
    const m = txt.match(/\[[\s\S]*\]/);
    let caps = []; try { caps = JSON.parse(m ? m[0] : '[]'); } catch (e) {}
    if (!Array.isArray(caps)) caps = [];
    caps = caps.map(c => typeof c === 'string' ? c : (c && (c.caption || c.text)) || '');
    // fallback: one caption per line
    if (!caps.filter(Boolean).length) caps = txt.split(/\n+/).map(l => l.replace(/^\s*(photo\s*)?\d+[:.)]\s*/i, '').replace(/^["'\-\s]+|["',\s]+$/g, '')).filter(Boolean);
    if (!caps.filter(Boolean).length) throw new Error('couldn\'t read the captions' + (j.stop_reason ? ' (stopped: ' + j.stop_reason + ')' : '') + '. The AI said: ' + (txt || JSON.stringify(j.content || j)).slice(0, 150));
    const u = j.usage || {};
    return { caps, cost: ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6 };
  }

  // ---------- reading the Ambrose page ----------
  function pageInfo() {
    const t = document.body.innerText;
    const po = (t.match(/\b(\d{8})-\d{2,3}\b/) || [])[1] || '';
    const addr = (t.match(/\b\d+[A-Za-z]?\/?\d*\s+([A-Z][A-Za-z']+(?:\s[A-Z][A-Za-z']+)*)\s+(?:Street|St|Road|Rd|Drive|Dr|Avenue|Ave|Court|Ct|Place|Pl|Crescent|Cres|Terrace|Tce|Close|Cl|Parade|Pde|Way|Lane|Ln|Circuit|Cct|Boulevard|Blvd|Highway|Hwy|Grove|Gr|Esplanade)\b/) || []);
    return { po, street: addr[1] || '' };
  }

  const vis = el => !!(el && (el.offsetParent || el.getClientRects().length));
  function targetInput() {
    const all = [...document.querySelectorAll('input[type=file]')];
    const modal = all.filter(i => i.closest('.blazored-modal, .bm-container, mat-dialog-container, .cdk-overlay-pane, .uppy-Dashboard, [role=dialog]'));
    return modal.find(vis) || modal[0] || all.find(vis) || all[all.length - 1] || null;
  }

  // Tradies Admin "Bookings Images" box: one .image-wrap card per uploaded photo, new ones added at the end in upload order
  const ambroseBox = () => document.querySelector('.blazored-modal');
  const cards = () => { const m = ambroseBox(); return m ? [...m.querySelectorAll('.image-wrap')] : []; };
  const busy = () => { const m = ambroseBox(); return !!m && (/Uploading/i.test(m.textContent) || !!m.querySelector('.spinner-border, .spinner, [role=progressbar]')); };

  // A batch is done once Ambrose has stopped "Uploading" for a couple of seconds.
  // Cards are a bonus check (needed for comments), not a requirement.
  async function waitForBatch(before, n, onTick) {
    const t0 = Date.now();
    let sawBusy = false, idleSince = 0, goneSince = 0;
    while (Date.now() - t0 < 10 * 60000) {
      const secs = Math.round((Date.now() - t0) / 1000);
      if (!ambroseBox()) { goneSince = goneSince || Date.now(); if (Date.now() - goneSince > 8000) return { ok: false, why: 'the Ambrose box closed' }; }
      else goneSince = 0;
      const b = busy(), got = cards().length - before;
      if (b) { sawBusy = true; idleSince = 0; }
      else idleSince = idleSince || Date.now();
      onTick(secs, b, got);
      const settled = idleSince && Date.now() - idleSince > 2500;
      if (settled && (got >= n || sawBusy || secs > 20)) return { ok: true, got };
      await sleep(500);
    }
    return { ok: false, why: 'still uploading after 10 minutes' };
  }

  async function saveComment(card, text) {
    const inp = card.querySelector('input:not([type=file]), textarea');
    const btn = [...card.querySelectorAll('button')].find(b => /save comment/i.test(b.innerText));
    if (!inp || !btn) return false;
    if (clean(inp.value)) return true; // never overwrite a comment that's already there
    const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    inp.focus();
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, text);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.blur();
    await sleep(250);
    btn.click();
    await sleep(700);
    return true;
  }

  // ---------- UI ----------
  const css = `
  #wre-grab-btn{position:fixed;left:18px;bottom:18px;z-index:2147483646;background:${ORANGE};color:#fff;border:0;border-radius:6px;padding:10px 14px;font:600 14px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer}
  #wre-grab{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:14px sans-serif}
  #wre-grab .box{background:#fff;color:#222;width:min(1040px,96vw);max-height:92vh;border-radius:8px;display:flex;flex-direction:column;overflow:hidden}
  #wre-grab .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid #ddd}
  #wre-grab .top b{margin-right:auto}
  #wre-grab select,#wre-grab input[type=text]{padding:6px;border:1px solid #bbb;border-radius:4px;font-size:14px}
  #wre-grab button{padding:7px 12px;border:1px solid #bbb;border-radius:4px;background:#f4f4f4;cursor:pointer;font-size:14px}
  #wre-grab button.go{background:${ORANGE};border-color:${ORANGE};color:#fff;font-weight:600}
  #wre-grab button:disabled{opacity:.5;cursor:default}
  #wre-grab .body{overflow:auto;padding:10px 14px}
  #wre-grab .day{margin:14px 0 6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  #wre-grab .day b{font-size:15px}
  #wre-grab .chev{border:0;background:none;padding:2px 4px;color:#555;font-size:13px}
  #wre-grab .chev:before{content:'\\25B8 ';display:inline-block;transition:transform .15s}
  #wre-grab .chev.open:before{content:'\\25BE '}
  #wre-grab .flag{background:#b3261e;color:#fff;border-radius:10px;padding:2px 8px;font-size:12px;font-weight:600}
  #wre-grab .notes{display:none;background:#f7f4f1;border-left:3px solid ${ORANGE};padding:6px 10px;margin:0 0 8px;border-radius:4px}
  #wre-grab .notes.open{display:block}
  #wre-grab .note{margin:6px 0;line-height:1.4}
  #wre-grab .note small{color:#777}
  #wre-grab .nbody.plain{white-space:pre-line}
  #wre-grab .nbody p,#wre-grab .nbody div{margin:0 0 4px}
  #wre-grab .nbody ul,#wre-grab .nbody ol{margin:2px 0 6px 20px;padding:0}
  #wre-grab .nbody li{margin:1px 0}
  #wre-grab .note.office{opacity:.65}
  #wre-grab .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
  #wre-grab .tile{display:flex;flex-direction:column;gap:4px}
  #wre-grab .ph{position:relative;border:3px solid transparent;border-radius:6px;cursor:pointer;background:#eee;aspect-ratio:3/4;overflow:hidden}
  #wre-grab .ph img{width:100%;height:100%;object-fit:cover;display:block}
  #wre-grab .ph.on{border-color:${ORANGE}}
  #wre-grab .ph .tick{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid #888;font:700 14px/18px sans-serif;text-align:center;color:#fff}
  #wre-grab .ph.on .tick{background:${ORANGE};border-color:${ORANGE}}
  #wre-grab .ph .cap{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #wre-grab textarea.cmt{width:100%;box-sizing:border-box;font:12px/1.3 sans-serif;padding:4px;border:1px solid #ccc;border-radius:4px;resize:vertical;min-height:34px}
  #wre-grab .foot{display:flex;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid #ddd;flex-wrap:wrap}
  #wre-grab .msg{margin-right:auto;color:#444}
  #wre-grab .err{color:#b3261e}
  /* phone: full-screen picker, 16px inputs so iOS doesn't zoom in, bigger tap targets, clear of the home bar */
  @media (pointer:coarse) and (max-width:820px){
    #wre-grab-btn{left:12px;bottom:calc(14px + env(safe-area-inset-bottom));padding:12px 16px;font-size:15px}
    #wre-grab{align-items:stretch}
    #wre-grab .box{width:100vw;max-height:none;height:100vh;height:100dvh;border-radius:0}
    #wre-grab .top{padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top))}
    #wre-grab .top b{width:100%}
    #wre-grab select,#wre-grab input[type=text]{font-size:16px;padding:8px;max-width:100% !important;flex:1 1 140px}
    #wre-grab button{font-size:15px;padding:10px 14px}
    #wre-grab .chev{padding:8px 6px;font-size:14px}
    #wre-grab .body{padding:8px 10px;-webkit-overflow-scrolling:touch}
    #wre-grab .grid{grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
    #wre-grab .ph .tick{width:28px;height:28px;font:700 17px/24px sans-serif}
    #wre-grab textarea.cmt{font-size:16px;min-height:40px}
    #wre-grab .foot{padding:8px 10px;padding-bottom:calc(8px + env(safe-area-inset-bottom))}
    #wre-grab .msg{width:100%;margin-right:0}
  }`;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => k === 'on' ? Object.entries(v).forEach(([ev, f]) => e.addEventListener(ev, f)) : k in e ? (e[k] = v) : e.setAttribute(k, v));
    kids.flat().forEach(k => e.append(k));
    return e;
  }

  const toDate = d => { const m = String(d).match(/(\d+)\/(\d+)\/(\d+)/); return m ? new Date(+m[3], m[2] - 1, +m[1]) : new Date(0); };
  const dayLabel = d => { const dt = toDate(d); return dt.getTime() ? dt.toLocaleDateString('en-AU', { weekday: 'short' }) + ' ' + dt.getDate() + '/' + (dt.getMonth() + 1) + '/' + dt.getFullYear() : d; };
  const first = n => clean(n).split(' ')[0];
  const isOffice = who => OFFICE.some(o => o.toLowerCase() === clean(who).toLowerCase());

  let thumbsCache = new Map();

  async function openPanel() {
    if (document.getElementById('wre-grab')) return;
    if (!targetInput()) return alert('Open the upload box first, then hit Grab from AroFlo.');

    const info = pageInfo();
    const msg = el('span', { className: 'msg' }, 'Finding the AroFlo task...');
    const taskSel = el('select', { style: 'max-width:440px' });
    const jnBox = el('input', { type: 'text', placeholder: 'JN', size: 6 });
    const body = el('div', { className: 'body' });
    const count = el('span', {}, '');
    const small = el('input', { type: 'checkbox' });
    const addBtn = el('button', { className: 'go', disabled: true }, 'Add photos');
    const aiBtn = el('button', { title: 'Writes a caption for each ticked photo that has an empty comment box. Check them before you hit Add.' }, 'AI captions');
    let photos = [], chosen = new Set(), running = false;
    const release = () => { thumbsCache.forEach(u => URL.revokeObjectURL(u)); thumbsCache.clear(); photos.forEach(p => { p.b64 = null; if (p.img) p.img.removeAttribute('src'); }); };
    const close = () => { if (!running) { release(); wrap.remove(); } };

    const refreshCount = () => {
      count.textContent = chosen.size + ' picked';
      addBtn.disabled = running || !chosen.size;
      if (!running) addBtn.textContent = chosen.size ? 'Add ' + chosen.size + ' photo' + (chosen.size > 1 ? 's' : '') : 'Add photos';
    };

    async function loadTask(code) {
      body.textContent = '';
      chosen.clear(); refreshCount();
      msg.className = 'msg'; msg.textContent = 'Loading photos and notes...';
      let notes = [];
      try {
        [photos, notes] = await Promise.all([taskPhotos(code), taskNotes(code).catch(() => [])]);
      } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; return; }
      if (!photos.length && !notes.length) { msg.textContent = 'No photos or notes on that task.'; return; }

      const days = new Map();
      const day = d => { if (!days.has(d)) days.set(d, { photos: [], notes: [] }); return days.get(d); };
      photos.forEach((p, i) => { p.i = i; day(p.taken.split(' ')[0] || 'No date').photos.push(p); });
      notes.forEach(n => day(n.day).notes.push(n));
      days.forEach((v, d) => {
        const site = v.notes.filter(n => !isOffice(n.who));
        const txt = (site.length ? site : v.notes).map(n => first(n.who) + ': ' + n.text).join('\n');
        v.photos.forEach(p => { p.notesText = txt; p.dayKey = d; });
      });
      const order = [...days.keys()].sort((a, b) => toDate(b) - toDate(a));
      let flagged = 0;
      const tiles = [];

      for (const d of order) {
        const { photos: list, notes: dn } = days.get(d);
        const who = [...new Set([...list.map(p => first(p.by)), ...dn.filter(n => !isOffice(n.who)).map(n => first(n.who))])].filter(Boolean).join(', ');
        const siteNotes = dn.filter(n => !isOffice(n.who));
        const head = el('div', { className: 'day' }, el('b', {}, dayLabel(d)), el('span', {}, list.length + ' photo' + (list.length === 1 ? '' : 's') + (who ? ' · ' + who : '')));
        if (!list.length && siteNotes.length) { head.append(el('span', { className: 'flag' }, 'Notes but no photos')); flagged++; }
        let notesBox = null;
        if (dn.length) {
          notesBox = el('div', { className: 'notes' }, dn.map(n => el('div', { className: 'note' + (isOffice(n.who) ? ' office' : '') },
            el('small', {}, n.time + ' · ' + n.who + (isOffice(n.who) ? ' (office)' : '')), el('div', { className: 'nbody' + (n.body && hasTags(n.body) ? '' : ' plain') }, n.body ? noteFrag(n.body) : n.text))));
          const chev = el('button', { className: 'chev' }, 'Notes (' + dn.length + ')');
          chev.addEventListener('click', () => { chev.classList.toggle('open'); notesBox.classList.toggle('open'); });
          head.append(chev);
          if (!list.length) { chev.classList.add('open'); notesBox.classList.add('open'); }
        }
        if (list.length) {
          const allBtn = el('button', {}, 'Pick all');
          allBtn.addEventListener('click', () => { const on = !list.every(p => chosen.has(p.i)); list.forEach(p => { on ? chosen.add(p.i) : chosen.delete(p.i); p.tile.classList.toggle('on', on); }); refreshCount(); });
          head.append(allBtn);
        }
        body.append(head);
        if (notesBox) body.append(notesBox);
        if (!list.length) continue;
        const grid = el('div', { className: 'grid' });
        list.forEach(p => {
          const img = el('img', { alt: '' });
          const tile = el('div', { className: 'ph', title: p.name + '\n' + p.by + '\n' + p.taken },
            img, el('div', { className: 'tick' }, '✓'), el('div', { className: 'cap' }, p.taken.replace(/^\S+\s*/, '') + ' ' + first(p.by)));
          tile.addEventListener('click', () => { chosen.has(p.i) ? chosen.delete(p.i) : chosen.add(p.i); tile.classList.toggle('on', chosen.has(p.i)); refreshCount(); });
          const cmt = el('textarea', { className: 'cmt', placeholder: 'Comment for Ambrose', value: p.caption, rows: 2 });
          cmt.addEventListener('input', () => { p.caption = cmt.value; });
          p.tile = tile; p.img = img; p.cmtEl = cmt; tiles.push(p);
          grid.append(el('div', { className: 'tile' }, tile, cmt));
        });
        body.append(grid);
      }
      msg.className = flagged ? 'msg err' : 'msg';
      msg.textContent = photos.length + ' photos, ' + notes.length + ' notes' + (flagged ? '. ' + flagged + ' day' + (flagged > 1 ? 's have' : ' has') + ' notes but no photos.' : '. Tick the ones you want.');

      pool(tiles, 6, async p => {
        try {
          if (!thumbsCache.has(p.thumb)) thumbsCache.set(p.thumb, URL.createObjectURL(await getBlob(p.thumb)));
          p.img.src = thumbsCache.get(p.thumb);
        } catch (e) { /* leave blank */ }
      });
    }

    async function findTasks(term, field) {
      msg.className = 'msg'; msg.textContent = 'Searching AroFlo...';
      try { return await searchTasks(term, field); } catch (e) { msg.className = 'msg err'; msg.textContent = e.message; return []; }
    }

    function showTasks(tasks, how) {
      taskSel.textContent = '';
      tasks.forEach((t, i) => taskSel.append(el('option', { value: i }, 'JN ' + t.jn + '  ' + t.task.slice(0, 50) + '  (' + t.status + ')')));
      taskSel._tasks = tasks;
      if (!tasks.length) { msg.className = 'msg err'; msg.textContent = 'Couldn\'t find the task ' + how + '. Type the JN and hit Find.'; body.textContent = ''; return; }
      const open = tasks.findIndex(t => !/complete|archiv|cancel|quote/i.test(t.status));
      taskSel.value = String(open >= 0 ? open : 0);
      loadTask(tasks[+taskSel.value].code);
    }

    taskSel.addEventListener('change', () => { const t = taskSel._tasks[+taskSel.value]; t && loadTask(t.code); });
    const findBtn = el('button', { on: { click: async () => { const jn = jnBox.value.trim(); if (!/^\d+$/.test(jn)) return; showTasks((await findTasks(jn, 'JobNo')).filter(t => t.jn === jn), 'for JN ' + jn); } } }, 'Find');
    jnBox.addEventListener('keydown', e => { if (e.key === 'Enter') findBtn.click(); });


    aiBtn.addEventListener('click', async () => {
      const todo = photos.filter(p => chosen.has(p.i) && !clean(p.caption));
      if (!todo.length) { msg.className = 'msg'; msg.textContent = chosen.size ? 'All ticked photos already have a comment.' : 'Tick some photos first.'; return; }
      const key = getKey(false);
      if (!key) return;
      aiBtn.disabled = true; addBtn.disabled = true;
      msg.className = 'msg';
      let done = 0, cost = 0, filled = 0;
      try {
        const groups = new Map();
        todo.forEach(p => { if (!groups.has(p.dayKey)) groups.set(p.dayKey, []); groups.get(p.dayKey).push(p); });
        const chunks = [];
        groups.forEach(list => { for (let i = 0; i < list.length; i += 6) chunks.push(list.slice(i, i + 6)); });
        for (const chunk of chunks) {
          msg.textContent = 'Writing captions ' + done + ' of ' + todo.length + '...';
          await pool(chunk, 3, async p => {
            if (p.b64) return;
            const path = p.orig.replace(/-original$/i, '-medium');
            let b = await getBlob(path).catch(() => null);
            if (!b || !/^image\//.test(b.type)) b = await shrink(await getBlob(p.orig), 800);
            p.b64type = /png/.test(b.type) ? 'image/png' : 'image/jpeg';
            p.b64 = await toB64(b);
          });
          const r = await captionChunk(key, chunk, chunk[0].notesText);
          cost += r.cost;
          chunk.forEach((p, k) => {
            const c = clean(r.caps[k]).replace(/[\u2013\u2014]/g, ',').replace(/\.$/, '');
            if (c && !clean(p.caption)) { p.caption = c; p.cmtEl.value = c; p.cmtEl.dispatchEvent(new Event('input', { bubbles: true })); filled++; }
          });
          done += chunk.length;
        }
        msg.className = filled ? 'msg' : 'msg err';
        msg.textContent = filled ? 'Captions written for ' + filled + ' of ' + done + ' photo' + (done === 1 ? '' : 's') + ' (cost about ' + (cost * 100).toFixed(2) + ' US cents). Check them, then hit Add.' : 'The AI replied but no captions came through. Send Claude a screenshot of this.';
      } catch (e) {
        msg.className = 'msg err'; msg.textContent = 'AI captions stopped: ' + e.message;
      }
      aiBtn.disabled = false; refreshCount();
    });

    addBtn.addEventListener('click', async () => {
      const pick = photos.filter(p => chosen.has(p.i));
      if (!targetInput()) { msg.className = 'msg err'; msg.textContent = 'The upload box has closed. Open it again and retry.'; return; }
      running = true; refreshCount();
      msg.className = 'msg';
      const isAmbroseBox = !!ambroseBox() && !!targetInput().closest('.blazored-modal');
      const batches = [];
      for (let i = 0; i < pick.length; i += isAmbroseBox ? BATCH : pick.length) batches.push(pick.slice(i, i + (isAmbroseBox ? BATCH : pick.length)));
      let sent = 0, commented = 0, skippedComments = 0;
      try {
        for (let b0 = 0; b0 < batches.length; b0++) {
          const batch = batches[b0];
          msg.textContent = 'Batch ' + (b0 + 1) + ' of ' + batches.length + ': grabbing from AroFlo...';
          const files = new Array(batch.length);
          await pool(batch, 3, async (p, k) => {
            let blob = await getBlob(p.orig);
            if (small.checked) blob = await shrink(blob, 2560);
            files[k] = new File([blob], small.checked ? p.name.replace(/\.[^.]+$/, '.jpg') : p.name, { type: blob.type || 'image/jpeg' });
          });
          const inp = targetInput();
          if (!inp) throw new Error('the upload box closed');
          const before = cards().length;
          const dt = new DataTransfer();
          (inp.multiple ? files : files.slice(0, 1)).forEach(f => dt.items.add(f));
          inp.files = dt.files;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          sent += dt.files.length;
          if (!isAmbroseBox) break;
                    const res = await waitForBatch(before, dt.files.length, (secs, b, got) => {
            msg.textContent = 'Batch ' + (b0 + 1) + ' of ' + batches.length + ': ' + (b ? 'Ambrose uploading' : 'waiting on Ambrose') + ' (' + secs + 's, ' + Math.max(0, got) + ' of ' + dt.files.length + ' showing)';
          });
          if (!res.ok) throw new Error('batch ' + (b0 + 1) + ', ' + res.why + ' (' + sent + ' sent so far)');
          // new cards land at the end, in the order they were sent. Only comment when the count lines up exactly.
          if (res.got === dt.files.length) {
            const newCards = cards().slice(-dt.files.length);
            for (let k = 0; k < newCards.length; k++) {
              const text = clean(batch[k].caption);
              if (text && await saveComment(newCards[k], text)) commented++;
            }
          } else if (batch.some(p => clean(p.caption))) skippedComments += batch.filter(p => clean(p.caption)).length;
        }
      } catch (e) {
        running = false; refreshCount();
        msg.className = 'msg err'; msg.textContent = 'Stopped: ' + e.message + '. Check the box before trying again so nothing doubles up.';
        return;
      }
      running = false;
      release();
      wrap.remove();
      toast('Added ' + sent + ' photo' + (sent === 1 ? '' : 's') + (isAmbroseBox ? ' in ' + batches.length + ' batch' + (batches.length > 1 ? 'es' : '') : '') + (commented ? ', ' + commented + ' comment' + (commented > 1 ? 's' : '') + ' saved' : '') + (skippedComments ? '. ' + skippedComments + ' comment' + (skippedComments > 1 ? 's' : '') + ' not added, couldn\'t match the cards' : '') + '.');
    });

    const wrap = el('div', { id: 'wre-grab', on: { click: e => { if (e.target === wrap) close(); } } },
      el('div', { className: 'box' },
        el('div', { className: 'top' },
          el('b', {}, 'Photos from AroFlo'),
          taskSel, jnBox, findBtn,
          el('button', { on: { click: close } }, 'Close')),
        body,
        el('div', { className: 'foot' },
          msg,
          el('label', { title: 'Shrinks each photo to 2560px on the long side. Only tick this if Ambrose knocks back big files.' }, small, ' Smaller files'),
          count,
          aiBtn,
          el('button', { on: { click: () => { photos.forEach(p => { chosen.add(p.i); p.tile && p.tile.classList.add('on'); }); refreshCount(); } } }, 'Pick all'),
          el('button', { on: { click: () => { chosen.clear(); photos.forEach(p => p.tile && p.tile.classList.remove('on')); refreshCount(); } } }, 'Clear'),
          addBtn)));
    document.documentElement.append(wrap);
    refreshCount();

    let tasks = [];
    if (info.po) tasks = await findTasks(info.po, 'CustOn');
    if (!tasks.length && info.street) tasks = await findTasks(info.street, 'Location');
    showTasks(tasks, info.po ? 'for PO ' + info.po : info.street ? 'for ' + info.street : 'from this page');
  }

  function toast(m) {
    const t = el('div', { style: `position:fixed;bottom:20px;right:20px;max-width:calc(100vw - 40px);z-index:2147483647;padding:10px 14px;border-radius:6px;font:14px sans-serif;color:#fff;background:${ORANGE};box-shadow:0 2px 8px rgba(0,0,0,.3)` }, m);
    document.documentElement.append(t);
    setTimeout(() => t.remove(), 6000);
  }

  // ---------- show the button whenever an upload box is on screen ----------
  document.documentElement.append(el('style', {}, css));
  const btn = el('button', { id: 'wre-grab-btn', on: { click: openPanel } }, 'Grab from AroFlo');
  const sync = () => {
    const has = !!targetInput();
    if (has && !btn.isConnected) document.documentElement.append(btn);
    if (!has && btn.isConnected) btn.remove();
  };
  // a light check once a second (skipped when the tab isn't showing) instead of watching every change on the page
  setInterval(() => { if (!document.hidden) sync(); }, 1000);
  sync();
})();