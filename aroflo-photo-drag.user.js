// ==UserScript==
// @name         AroFlo to Ambrose photo drag
// @namespace    wre
// @version      1.5
// @description  Drag photos straight from AroFlo into upload boxes (Ambrose, Tradies Web etc), no downloading
// @match        *://*/*
// @exclude      *://*.aroflo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-photo-drag.user.js
// @downloadURL  https://raw.githubusercontent.com/Badseed26/wre-userscripts/main/aroflo-photo-drag.user.js
// ==/UserScript==

// Built from src/aroflo-photo-drag.js by build.py. Change src/aroflo-photo-drag.js, not this file.
(function () {
  // Live updates (23/10): Tampermonkey only checks for a new version every few hours. This checks the repo's latest commit every
  // 2 min (free when nothing's changed) and keeps the newest code here, so a push runs on the next page load. If the new code needs
  // a permission this install hasn't got, or this browser won't run it, the built in copy below runs like before.
  const __wreName = "aroflo-photo-drag", __wreVer = "1.5", __wreHave = new Set(["// @connect *", "// @exclude *://*.aroflo.com/*", "// @grant GM_getValue", "// @grant GM_setValue", "// @grant GM_xmlhttpRequest", "// @match *://*/*", "// @run-at document-start"]);
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
  // ---------- the built in copy (src/aroflo-photo-drag.js at 1.5) ----------

(function () {
  'use strict';

  // ---------- helpers ----------
  function toast(msg, bad) {
    if (!document.body) return;
    let el = document.getElementById('wre-drag-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wre-drag-toast';
      el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:10px 14px;border-radius:6px;font:14px sans-serif;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:opacity .3s;pointer-events:none';
      document.documentElement.appendChild(el);
    }
    el.style.background = bad ? '#b3261e' : '#e8731a';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.opacity = '0'), bad ? 6000 : 2500);
  }

  const types = dt => Array.from((dt && dt.types) || []);
  const hasUrl = dt => types(dt).some(t => t === 'text/uri-list' || t === 'text/html');

  function isEditable(el) {
    return !!(el && el.closest && el.closest('input:not([type=file]), textarea, [contenteditable=""], [contenteditable="true"]'));
  }

  // Nearest upload box to where the mouse is
  function findInput(el) {
    let n = el && el.nodeType === 1 ? el : el && el.parentElement;
    for (let i = 0; n && i < 10; i++, n = n.parentElement) {
      if (n.matches && n.matches('input[type=file]')) return n;
      const f = n.querySelector && n.querySelector('input[type=file]');
      if (f) return f;
    }
    const all = document.querySelectorAll('input[type=file]');
    return all.length === 1 ? all[0] : null;
  }

  function getUrl(dt) {
    const html = dt.getData('text/html');
    if (html) {
      const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (img) return img[1].replace(/&amp;/g, '&');
    }
    const uri = dt.getData('text/uri-list');
    if (uri) {
      const first = uri.split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith('#'));
      if (first) return first;
    }
    if (html) {
      const a = html.match(/href=["']([^"']+)["']/i);
      if (a) return a[1].replace(/&amp;/g, '&');
    }
    const txt = (dt.getData('text/plain') || '').trim();
    return /^https?:\/\//i.test(txt) ? txt : null;
  }

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };

  function fileName(url, headers, type) {
    const cd = (headers.match(/content-disposition:[^\r\n]*filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)/i) || [])[1];
    let name = cd ? decodeURIComponent(cd) : '';
    if (!name) {
      try { name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || ''); } catch (e) {}
    }
    if (!name || !/\.[a-z0-9]{2,5}$/i.test(name)) name = (name || 'aroflo-photo-' + Date.now()) + '.' + (EXT[type] || 'jpg');
    return name;
  }

  // AroFlo keeps the full-res original at the bare DocStorage link; -large/-medium/-small are cut-down copies
  function fullSize(url) {
    return url.replace(/(\/DocStorage\/[^\/?#]+?)-(large|medium|small|original)(?=$|[?#])/i, '$1');
  }

  function fetchFile(url) {
    url = fullSize(url);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        onload: r => {
          if (r.status < 200 || r.status >= 300) return reject(new Error('AroFlo said ' + r.status + ' (logged in?)'));
          const headers = r.responseHeaders || '';
          const type = ((headers.match(/content-type:\s*([^\s;\r\n]+)/i) || [])[1] || (r.response && r.response.type) || '').toLowerCase();
          if (!type.startsWith('image/') && type !== 'application/pdf') {
            return reject(new Error('that link is a page, not a photo (' + (type || 'unknown') + ')'));
          }
          resolve(new File([r.response], fileName(url, headers, type), { type }));
        },
        onerror: () => reject(new Error('couldn\'t reach the photo')),
      });
    });
  }

  // ---------- take over web-page drags onto upload boxes ----------
  let replaying = false;
  let hinted = false;
  let outlined = null;

  function outline(el) {
    if (outlined === el) return;
    if (outlined) outlined.style.outline = outlined._wreOutline || '';
    outlined = el;
    if (el) { el._wreOutline = el.style.outline; el.style.outline = '3px dashed #e8731a'; }
  }

  // Anything dragged from a web page (it carries a link). Chrome also tags photo drags as "Files",
  // so don't skip those. Plain drags from File Explorer have no link and go through untouched.
  function ours(e) {
    const dt = e.dataTransfer;
    return !replaying && dt && hasUrl(dt) && !isEditable(e.target) && findInput(e.target);
  }

  // Capture phase + stop the page seeing it, so the uploader can't knock it back
  ['dragenter', 'dragover'].forEach(type =>
    window.addEventListener(type, e => {
      if (!ours(e)) { if (type === 'dragover') outline(null); return; }
      e.preventDefault();
      e.stopImmediatePropagation();
      e.dataTransfer.dropEffect = 'copy';
      outline(e.target.closest('[class*="drop" i], [class*="upload" i], [class*="uppy" i]') || e.target);
      if (!hinted) { hinted = true; toast('Drop it on the upload box'); }
    }, true)
  );

  window.addEventListener('dragleave', e => { if (!e.relatedTarget) outline(null); }, true);
  window.addEventListener('dragend', () => { outline(null); hinted = false; }, true);

  window.addEventListener('drop', async e => {
    if (!ours(e)) return;
    const dt = e.dataTransfer;
    const url = getUrl(dt);
    if (!url) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    outline(null);
    hinted = false;
    const target = e.target;
    const x = e.clientX, y = e.clientY;
    toast('Grabbing photo from AroFlo...');

    try {
      const file = await fetchFile(url);

      // 1. Replay the drop on the upload box with a real file in it
      const nd = new DataTransfer();
      nd.items.add(file);
      replaying = true;
      const ev = new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: nd, clientX: x, clientY: y });
      target.dispatchEvent(ev);
      replaying = false;

      // 2. If nothing picked it up, drop it straight into the nearest file input
      if (!ev.defaultPrevented) {
        const input = findInput(target);
        if (!input) throw new Error('no upload box found where you dropped it');
        const one = new DataTransfer();
        one.items.add(file);
        input.files = one.files;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      toast('Added ' + file.name);
    } catch (err) {
      replaying = false;
      toast('Couldn\'t add photo: ' + err.message, true);
    }
  }, true);
})();
})();
