/* NodeMG Studio — password gate
 *
 * पासवर्ड कहीं लिखा नहीं है — न सादे रूप में, न hash के रूप में।
 * js/vault.js में आपकी निजी सेटिंग (Apps Script URL, key, डेमो डेटा) AES-256-GCM से लॉक है;
 * लॉक की चाबी पासवर्ड से PBKDF2 (SHA-256, 310,000 चक्कर) द्वारा बनती है।
 * सही पासवर्ड डालने पर ही वह खुलता है, ग़लत पासवर्ड से कुछ भी पढ़ा नहीं जा सकता।
 */
(function () {
  'use strict';

  var V = window.NODEMG_VAULT;
  var CFG = window.NODEMG_CONFIG || {};
  var I = window.NODEMG_I18N || { hi: {}, en: {} };
  var KEY = 'nodemg.k';
  var lang = 'hi';
  try { lang = localStorage.getItem('nodemg.lang') || CFG.defaultLang || 'hi'; } catch (e) { lang = CFG.defaultLang || 'hi'; }
  if (lang !== 'hi' && lang !== 'en') lang = 'hi';

  function T(k, v) {
    var s = (I[lang] && I[lang][k]) || (I.en && I.en[k]) || k;
    if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] != null ? v[n] : m; });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var subtle = window.crypto && window.crypto.subtle;
  function b64d(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function b64e(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }

  function openWith(key) {
    return subtle.decrypt({ name: 'AES-GCM', iv: b64d(V.iv) }, key, b64d(V.data))
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }
  function derive(pw) {
    return subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (km) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: b64d(V.salt), iterations: V.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    });
  }

  function unlock(payload) {
    window.NODEMG_SECRETS = payload;
    document.body.classList.remove('locked');
    var g = document.getElementById('gate');
    if (g) { g.classList.add('out'); setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 350); }
    document.dispatchEvent(new CustomEvent('nodemg:unlocked'));
  }

  function buildGate() {
    var name = CFG.channelName || 'Channel';
    var img = CFG.images && CFG.images.profile ? '<img src="' + esc(CFG.images.profile) + '" alt="" onerror="this.remove()">' : '';
    var g = document.createElement('div');
    g.className = 'gate'; g.id = 'gate';
    g.innerHTML =
      '<form class="gate-card" id="gateForm" autocomplete="on">' +
      '<div class="avatar gate-av">' + esc(name.charAt(0).toUpperCase()) + img + '</div>' +
      '<h2>' + esc(name) + '</h2><p class="gate-tag">' + esc(CFG.tagline || '') + '</p>' +
      '<label class="sr" for="gatePw">' + esc(T('gate_pw')) + '</label>' +
      '<div class="gate-field"><input id="gatePw" name="password" type="password" placeholder="' + esc(T('gate_pw')) + '" autocomplete="current-password" autocapitalize="off" spellcheck="false" required>' +
      '<button type="button" class="gate-eye" id="gateEye" aria-label="' + esc(T('gate_show')) + '">' + esc(T('gate_show')) + '</button></div>' +
      '<div class="gate-msg" id="gateMsg" role="alert" aria-live="polite"></div>' +
      '<button class="btn primary gate-btn" id="gateBtn" type="submit">' + esc(T('gate_unlock')) + '</button>' +
      '<p class="gate-hint">' + esc(T('gate_hint')) + '</p></form>';
    document.body.appendChild(g);
    return g;
  }

  function init() {
    document.body.classList.add('locked');
    var g = buildGate(), form = document.getElementById('gateForm'), pw = document.getElementById('gatePw'),
      msg = document.getElementById('gateMsg'), btn = document.getElementById('gateBtn'), fails = 0, until = 0, timer = null;

    function say(text, bad) { msg.textContent = text || ''; msg.className = 'gate-msg' + (bad ? ' bad' : ''); }

    if (!V || !V.data) { say(T('gate_novault'), true); btn.disabled = true; pw.disabled = true; return; }
    if (!subtle) { say(T('gate_nocrypto'), true); btn.disabled = true; pw.disabled = true; return; }

    // एक ही टैब में दोबारा खोलने पर पासवर्ड नहीं पूछता (टैब बंद होते ही चाबी हट जाती है)
    var saved = null;
    try { saved = sessionStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (saved) {
      g.classList.add('busy');
      subtle.importKey('raw', b64d(saved), { name: 'AES-GCM' }, false, ['decrypt']).then(openWith).then(unlock).catch(function () {
        try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
        g.classList.remove('busy'); pw.focus();
      });
    } else setTimeout(function () { pw.focus(); }, 50);

    document.getElementById('gateEye').addEventListener('click', function () {
      var show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
      this.textContent = show ? T('gate_hide') : T('gate_show'); pw.focus();
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var now = Date.now();
      if (now < until) return;
      var val = pw.value;
      if (!val) return;
      btn.disabled = true; g.classList.add('busy'); say(T('gate_checking'), false);
      derive(val).then(function (key) {
        return openWith(key).then(function (payload) {
          return subtle.exportKey('raw', key).then(function (raw) {
            try { sessionStorage.setItem(KEY, b64e(raw)); } catch (e) { /* ignore */ }
            pw.value = ''; unlock(payload);
          });
        });
      }).catch(function () {
        fails++; pw.value = ''; pw.focus();
        g.classList.remove('busy'); btn.disabled = false;
        g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
        if (fails >= 3) {
          var secs = Math.min(60, (fails - 2) * 5); until = Date.now() + secs * 1000;
          btn.disabled = true;
          clearInterval(timer);
          timer = setInterval(function () {
            var left = Math.ceil((until - Date.now()) / 1000);
            if (left <= 0) { clearInterval(timer); btn.disabled = false; say(T('gate_wrong'), true); }
            else say(T('gate_wait', { s: left }), true);
          }, 250);
          say(T('gate_wait', { s: secs }), true);
        } else say(T('gate_wrong'), true);
      });
    });
  }

  window.NodeMGGate = {
    lock: function () { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } location.reload(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
