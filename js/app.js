/* NodeMG Studio — dashboard app
 * Sections: utils · data · selectors · components · pages · drawer · date popover · boot
 */
(function () {
  'use strict';

  var CFG = window.NODEMG_CONFIG || {};
  var P = window.NodeMGParser;
  var I18N = window.NODEMG_I18N || { en: {}, hi: {} };

  /* ============================================================
   * utils
   * ============================================================ */
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function dateObj(s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function addDays(s, n) { var d = dateObj(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((dateObj(b) - dateObj(a)) / 864e5); }
  function todayStr() { return ymd(new Date()); }

  function fmt(n) {
    if (n == null || !isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e6) return +(n / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return +(n / 1e3).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('en-IN');
  }
  function fmtFull(n) { return n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-IN'); }
  function pct(n, d) { return n == null || !isFinite(n) ? '—' : (+n.toFixed(d == null ? 1 : d)) + '%'; }
  function times(n) { return n == null || !isFinite(n) ? '—' : (+n.toFixed(2)) + '×'; }
  function dur(sec) {
    if (sec == null || !isFinite(sec)) return '—';
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + p2(s);
  }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function alpha(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').slice(0, 40); }

  /* ============================================================
   * state
   * ============================================================ */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  var qs = new URLSearchParams(location.search);
  var S = {
    records: [],
    lang: qs.get('lang') || LS.get('nodemg.lang', CFG.defaultLang || 'hi'),
    page: 'overview',
    range: { mode: 'day', from: null, to: null, preset: 'latest' },
    source: { kind: 'sample', updated: null, error: null },
    sort: { key: 'date', dir: -1 },
    filters: { q: '', platform: 'all', status: 'all' },
    chartMetric: 'views',
    insAll: false,
    cal: { y: 0, m: 0 },
    popMode: 'day',
    popFrom: null,
    bannerOff: false,
    done: {}
  };
  try { S.done = JSON.parse(LS.get('nodemg.done', '{}')) || {}; } catch (e) { S.done = {}; }
  if (S.lang !== 'hi' && S.lang !== 'en') S.lang = 'hi';

  function t(k, v) {
    var s = (I18N[S.lang] && I18N[S.lang][k]);
    if (s == null) s = I18N.en[k];
    if (s == null) s = k;
    if (v) s = s.replace(/\{(\w+)\}/g, function (m, n) { return v[n] != null ? v[n] : m; });
    return s;
  }
  function loc() { return S.lang === 'hi' ? 'hi-IN' : 'en-IN'; }
  function fmtDate(s, style) {
    if (!s) return '—';
    var o = style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'mid' ? { day: 'numeric', month: 'short', year: 'numeric' }
      : style === 'wd' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short' };
    return new Intl.DateTimeFormat(loc(), o).format(dateObj(s));
  }

  /* ============================================================
   * icons & small components
   * ============================================================ */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/>',
    content: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
    comments: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
    insights: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    pipeline: '<rect x="3" y="4" width="5" height="16" rx="1.6"/><rect x="10" y="4" width="5" height="11" rx="1.6"/><rect x="17" y="4" width="4" height="7" rx="1.6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
    inbox: '<path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'
  };
  function ico(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  var PLAT = {
    yt: { name: 'YouTube', img: 'youtube', letters: 'YT' },
    ig: { name: 'Instagram', img: 'instagram', letters: 'IG' },
    fb: { name: 'Facebook', img: 'facebook', letters: 'FB' }
  };
  function plogo(p, size) {
    var letters = p === 'all' ? '∑' : PLAT[p].letters;
    var file = p !== 'all' && CFG.images && CFG.images[PLAT[p].img];
    return '<span class="plogo ' + p + ' ' + (size || '') + '">' + letters +
      (file ? '<img src="' + esc(file) + '" alt="" onerror="this.remove()">' : '') + '</span>';
  }

  function thumb(r, cls) {
    var label = r.scriptNo != null ? 'S' + p2(r.scriptNo) : '▶';
    var img = r.link.ytId
      ? '<img src="https://i.ytimg.com/vi/' + esc(r.link.ytId) + '/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
    return '<div class="thumb ' + (cls || '') + '">' + label + img + '</div>';
  }
  function scriptBadge(r) { return r.scriptNo != null ? '<span class="badge info">S' + p2(r.scriptNo) + '</span>' : ''; }
  function statusBadge(r) {
    return r.status === 'pending'
      ? '<span class="badge warn">' + t('st_ready') + '</span>'
      : '<span class="badge good">' + t('st_published') + '</span>';
  }

  function deltaChip(cur, prev, label) {
    if (cur == null || prev == null || prev === 0) return '';
    var ratio = cur / prev;
    var cls = ratio > 1.0049 ? 'up' : ratio < 0.9951 ? 'down' : 'flat';
    var txt = ratio >= 2 ? (+ratio.toFixed(1)) + '×' : Math.abs(Math.round((ratio - 1) * 100)) + '%';
    return '<span class="delta ' + cls + '" title="' + esc(t('vsPrev', { d: label || '' })) + '">' +
      (cls !== 'flat' ? '<i class="tri"></i>' : '') + txt + '</span>';
  }
  function deltaPP(cur, prev, label) {
    if (cur == null || prev == null) return '';
    var d = cur - prev, cls = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat';
    return '<span class="delta ' + cls + '" title="' + esc(t('vsPrev', { d: label || '' })) + '">' +
      (cls !== 'flat' ? '<i class="tri"></i>' : '') + Math.abs(d).toFixed(1) + ' pp</span>';
  }

  function spark(vals, color) {
    if (!vals || vals.length < 2 || Math.max.apply(null, vals) <= 0) return '';
    var w = 72, h = 24, max = Math.max.apply(null, vals);
    var pts = vals.map(function (v, i) { return [2 + i * (w - 4) / (vals.length - 1), h - 3 - v / max * (h - 6)]; });
    var last = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline points="' +
      pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') +
      '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' +
      last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="' + color + '"/></svg>';
  }

  function kpi(o) {
    return '<div class="kpi ' + (o.cls || '') + '"><div class="lbl">' + (o.plat ? plogo(o.plat, 'sm') : '') +
      '<span>' + esc(o.label) + '</span></div><div class="val">' + o.value + '</div>' +
      '<div class="foot"><span>' + (o.foot || '') + '</span>' + (o.spark || '') + '</div></div>';
  }

  function ring(v, color, label, cap) {
    var r = 46, c = 2 * Math.PI * r, f = v == null ? 0 : Math.max(0, Math.min(100, v)) / 100;
    return '<div class="ring-wrap"><div class="ring"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="' + r +
      '" fill="none" stroke="var(--panel-3)" stroke-width="10"/><circle cx="56" cy="56" r="' + r + '" fill="none" stroke="' + color +
      '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" opacity="' + (f ? 1 : 0) +
      '"/></svg><div class="c"><b>' + (v == null ? '—' : pct(v)) + '</b></div></div><div class="t"><b>' + esc(label) + '</b>' + esc(cap) + '</div></div>';
  }

  function nVid(n) { return n === 1 ? t('nVideos1') : t('nVideos', { n: n }); }

  function emptyState(icon, title, body, btn) {
    return '<div class="empty"><div class="em-ic">' + ico(icon) + '</div><b>' + esc(title) + '</b><p>' + esc(body) + '</p>' + (btn || '') + '</div>';
  }

  /* ============================================================
   * data loading
   * ============================================================ */
  function sampleCsv() { return (window.NODEMG_SECRETS && window.NODEMG_SECRETS.sampleCsv) || ''; }

  function readCache() {
    try { var c = JSON.parse(LS.get('nodemg.cache', 'null')); return c && c.rows ? c : null; } catch (e) { return null; }
  }

  function loadData() {
    var src = qs.get('src') || CFG.dataSource || 'sample';
    var job;
    if (src === 'appsscript') {
      if (!CFG.appsScriptUrl) job = Promise.reject(new Error(t('err_noUrl')));
      else {
        var u = new URL(CFG.appsScriptUrl);
        if (CFG.accessKey) u.searchParams.set('key', CFG.accessKey);
        u.searchParams.set('_', Date.now());
        job = fetch(u.toString(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.ok) throw new Error((j && j.error) || 'Apps Script error');
          return { rows: j.rows, kind: 'live', updated: new Date() };
        });
      }
    } else if (src === 'csv') {
      if (!CFG.csvUrl) job = Promise.reject(new Error(t('err_noUrl')));
      else job = fetch(CFG.csvUrl + (CFG.csvUrl.indexOf('?') > -1 ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (txt) { return { rows: P.parseCSV(txt), kind: 'live', updated: new Date() }; });
    } else {
      job = Promise.resolve({ rows: P.parseCSV(sampleCsv()), kind: 'sample', updated: new Date() });
    }

    return job.then(function (res) {
      if (res.kind === 'live') LS.set('nodemg.cache', JSON.stringify({ rows: res.rows, updated: res.updated.toISOString() }));
      return { rows: res.rows, kind: res.kind, updated: res.updated, error: null };
    }).catch(function (err) {
      var c = readCache();
      if (c) return { rows: c.rows, kind: 'cache', updated: new Date(c.updated), error: String(err.message || err) };
      return { rows: P.parseCSV(sampleCsv()), kind: 'sample', updated: new Date(), error: String(err.message || err) };
    }).then(function (res) {
      S.records = P.buildRecords(res.rows);
      S.source = { kind: res.kind, updated: res.updated, error: res.error, configured: src };
    });
  }

  /* ============================================================
   * selectors
   * ============================================================ */
  function allDates() {
    var m = {}; S.records.forEach(function (r) { if (r.date) m[r.date] = 1; });
    return Object.keys(m).sort();
  }
  function pubDates() {
    var m = {}; S.records.forEach(function (r) { if (r.date && r.status === 'published') m[r.date] = 1; });
    return Object.keys(m).sort();
  }
  function firstDate() { var d = allDates(); return d.length ? d[0] : null; }
  function latestDate() {
    var p = pubDates(); if (p.length) return p[p.length - 1];
    var a = allDates(); return a.length ? a[a.length - 1] : todayStr();
  }

  function applyPreset(name) {
    var last = latestDate();
    if (name === 'all') S.range = { mode: 'all', from: null, to: null, preset: 'all' };
    else if (name === 'last7') S.range = { mode: 'range', from: addDays(last, -6), to: last, preset: 'last7' };
    else if (name === 'last28') S.range = { mode: 'range', from: addDays(last, -27), to: last, preset: 'last28' };
    else S.range = { mode: 'day', from: last, to: last, preset: 'latest' };
  }
  function setDay(d) { S.range = { mode: 'day', from: d, to: d, preset: null }; }
  function setRange(a, b) {
    if (a > b) { var x = a; a = b; b = x; }
    S.range = a === b ? { mode: 'day', from: a, to: a, preset: null } : { mode: 'range', from: a, to: b, preset: null };
  }

  function effRange() {
    if (S.range.mode === 'all') {
      var f = firstDate(), l = latestDate();
      var all = allDates(); if (all.length && all[all.length - 1] > l) l = all[all.length - 1];
      return { from: f || l, to: l };
    }
    return { from: S.range.from, to: S.range.to };
  }
  function inRange(r) { var e = effRange(); return r.date && r.date >= e.from && r.date <= e.to; }
  function recsInRange() { return S.records.filter(inRange); }
  function pubIn(recs) { return recs.filter(function (r) { return r.status === 'published'; }); }
  function agg(recs) { return P.aggregate(recs); }

  function prevInfo() {
    var e = effRange();
    if (S.range.mode === 'all') return null;
    var recs, label;
    if (S.range.mode === 'day') {
      var pd = pubDates().filter(function (d) { return d < e.from; }).pop();
      if (!pd) return null;
      recs = S.records.filter(function (r) { return r.date === pd; });
      label = fmtDate(pd);
    } else {
      var n = diffDays(e.from, e.to) + 1, pf = addDays(e.from, -n), pt = addDays(e.from, -1);
      recs = S.records.filter(function (r) { return r.date && r.date >= pf && r.date <= pt; });
      label = t('prevPeriod');
    }
    if (!pubIn(recs).length) return null;
    return { recs: recs, A: agg(recs), label: label };
  }

  function trendDays() {
    var e = effRange(), from, to, first = firstDate(), last = latestDate();
    if (S.range.mode === 'day') {
      to = addDays(e.to, 6); if (to > last) to = last; if (to < e.to) to = e.to;
      from = addDays(to, -13); if (first && from < first) from = first; if (from > e.from) from = e.from;
    } else { from = e.from; to = e.to; }
    if (diffDays(from, to) > 119) from = addDays(to, -119);
    var days = [], span = diffDays(from, to);
    if (span <= 62) { for (var i = 0; i <= span; i++) days.push(addDays(from, i)); }
    else days = allDates().filter(function (d) { return d >= from && d <= to; });
    return days;
  }
  function seriesFor(days) {
    return days.map(function (d) { return { date: d, A: agg(S.records.filter(function (r) { return r.date === d; })) }; });
  }
  function recEng(r) {
    return (r.yt.likes || 0) + (r.ig.likes || 0) + (r.ig.saves || 0) + (r.ig.shares || 0) + (r.fb.reactions || 0) + (r.comments.count || 0);
  }
  function recRate(r) { return r.total ? recEng(r) / r.total * 100 : null; }

  /* ============================================================
   * auto insights (rule based, computed from the selected period)
   * ============================================================ */
  function autoInsights(A, PA) {
    var out = [];
    if (!A.videos) return out;
    var top = ['yt', 'ig', 'fb'].sort(function (a, b) { return A[b].views - A[a].views; })[0];
    if (A.total > 0) out.push({ tone: 'info', title: t('ai_top', { p: PLAT[top].name, pct: pct(A.share[top], 0) }), body: t('ai_top_b', { n: fmtFull(A[top].views) }) });
    if (PA && PA.total > 0 && A.total > 0) {
      var ratio = A.total / PA.total;
      if (ratio >= 1.5) out.push({ tone: 'good', title: t('ai_up', { x: +ratio.toFixed(1) }), body: t('ai_up_b') });
      else if (ratio <= 0.67) out.push({ tone: 'warn', title: t('ai_down', { pct: Math.round((1 - ratio) * 100) }), body: t('ai_down_b') });
    }
    if (A.ig.nonFollowersPct != null) {
      if (A.ig.nonFollowersPct >= 80) out.push({ tone: 'good', title: t('ai_igNew', { pct: pct(A.ig.nonFollowersPct) }), body: t('ai_igNew_b') });
      else if (A.ig.nonFollowersPct < 50) out.push({ tone: 'warn', title: t('ai_igOld', { pct: pct(A.ig.nonFollowersPct) }), body: t('ai_igOld_b') });
    }
    if (A.yt.stayedPct != null) {
      if (A.yt.stayedPct < 60) out.push({ tone: 'warn', title: t('ai_stayLow', { pct: pct(A.yt.stayedPct) }), body: t('ai_stayLow_b') });
      else if (A.yt.stayedPct >= 70) out.push({ tone: 'good', title: t('ai_stayHigh', { pct: pct(A.yt.stayedPct) }), body: t('ai_stayHigh_b') });
    }
    if (A.ig.replay != null && A.ig.replay >= 2.5) out.push({ tone: 'good', title: t('ai_replay', { x: +A.ig.replay.toFixed(1) }), body: t('ai_replay_b') });
    if (A.yt.nonSubsPct != null && A.yt.nonSubsPct >= 90) out.push({ tone: 'info', title: t('ai_nonSubs', { pct: pct(A.yt.nonSubsPct) }), body: t('ai_nonSubs_b') });
    if (A.comments === 0 && A.total >= 500) out.push({ tone: 'warn', title: t('ai_noCom', { n: fmtFull(A.total) }), body: t('ai_noCom_b') });
    if (A.ig.saves === 0 && A.ig.views >= 300) out.push({ tone: 'warn', title: t('ai_noSave'), body: t('ai_noSave_b') });
    return out.slice(0, 7);
  }
  function insightCards(list) {
    if (!list.length) return emptyState('bulb', t('ai_none'), t('ai_none_b'));
    return '<div class="insight-list">' + list.map(function (i) {
      return '<div class="insight ' + i.tone + '"><div class="ic">' + ico(i.tone === 'good' ? 'star' : i.tone === 'warn' ? 'alert' : 'bulb', 'xs') +
        '</div><div><b>' + esc(i.title) + '</b><p>' + esc(i.body) + '</p></div></div>';
    }).join('') + '</div>';
  }

  /* ============================================================
   * charts
   * ============================================================ */
  var charts = [], queued = [];
  function queueChart(id, builder) { queued.push({ id: id, builder: builder }); }
  function flushCharts() {
    charts.forEach(function (c) { try { c.destroy(); } catch (e) { /* ignore */ } });
    charts = [];
    queued.splice(0).forEach(function (q) {
      var cv = document.getElementById(q.id);
      if (!cv) return;
      if (typeof Chart === 'undefined') { cv.parentElement.innerHTML = '<div class="chart-note">' + esc(t('chartOffline')) + '</div>'; return; }
      charts.push(new Chart(cv, q.builder()));
    });
  }

  /* datasets: [{label, color:'--yt', data:[], faint:boolean}] */
  function barConfig(days, datasets, opts) {
    opts = opts || {};
    var line = cssv('--line'), muted = cssv('--muted'), text = cssv('--text'), panel = cssv('--panel');
    var e = effRange(), inSel = days.map(function (d) { return d >= e.from && d <= e.to; });
    var dim = S.range.mode === 'day';
    Chart.defaults.font.family = cssv('--font');
    Chart.defaults.color = muted;
    return {
      type: 'bar',
      data: {
        labels: days.map(function (d) { return fmtDate(d); }),
        datasets: datasets.map(function (ds) {
          var base = cssv(ds.color);
          return {
            label: ds.label, data: ds.data,
            backgroundColor: function (c) {
              var a = ds.faint ? 0.45 : 1;
              return alpha(base, dim && !inSel[c.dataIndex] ? a * 0.35 : a);
            },
            borderColor: panel, borderWidth: opts.stacked ? 2 : 0,
            borderRadius: 4, borderSkipped: false, maxBarThickness: 34
          };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: datasets.length > 1, position: 'top', align: 'start',
            labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 9, boxHeight: 9, padding: 16, color: muted, font: { weight: 600 } }
          },
          tooltip: {
            backgroundColor: panel, titleColor: text, bodyColor: muted, footerColor: text, borderColor: cssv('--line-2'), borderWidth: 1,
            padding: 11, cornerRadius: 10, boxPadding: 5, usePointStyle: true,
            callbacks: {
              title: function (items) { return fmtDate(days[items[0].dataIndex], 'wd'); },
              label: function (c) { return ' ' + c.dataset.label + ': ' + fmtFull(c.parsed.y); },
              footer: function (items) {
                if (!opts.stacked || items.length < 2) return '';
                return t('total') + ': ' + fmtFull(items.reduce(function (s, i) { return s + i.parsed.y; }, 0));
              }
            }
          }
        },
        scales: {
          x: { stacked: !!opts.stacked, grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12, color: muted } },
          y: { stacked: !!opts.stacked, beginAtZero: true, grid: { color: line }, border: { display: false }, ticks: { maxTicksLimit: 5, color: muted, callback: function (v) { return fmt(v); } } }
        }
      }
    };
  }

  /* ============================================================
   * pages
   * ============================================================ */
  function periodEmpty() {
    var e = effRange();
    var pend = recsInRange().filter(function (r) { return r.status === 'pending'; }).length;
    var body = S.range.mode === 'day' ? t('empty_day_b', { d: fmtDate(e.from, 'long') }) : t('empty_range_b');
    return '<div class="card">' + emptyState('calendar', t('empty_t'), body +
      (pend ? ' ' + t('empty_pending', { n: pend }) : ''),
      '<button class="btn primary" data-act="preset" data-p="latest">' + t('goLatest') + '</button>') + '</div>';
  }

  function chartCard(id, title, right, sub) {
    return '<section class="card"><div class="card-h"><h3>' + esc(title) + '</h3>' + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') +
      (right ? '<div class="right">' + right + '</div>' : '') + '</div><div class="chart-box"><canvas id="' + id + '"></canvas></div></section>';
  }

  function topVideosCard(pub, n) {
    var list = pub.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); }).slice(0, n || 5);
    return '<section class="card"><div class="card-h"><h3>' + t('topVideos') + '</h3><span class="sub">' + t('byViews') + '</span></div><div class="vlist">' +
      list.map(function (r) {
        var tot = r.total || 0, seg = function (v, c) { return tot ? '<i style="width:' + Math.max(2, (v || 0) / tot * 100).toFixed(1) + '%;background:var(' + c + ')"></i>' : ''; };
        return '<div class="vitem" data-act="openRec" data-id="' + r.id + '" tabindex="0">' + thumb(r) +
          '<div class="meta"><div class="ttl">' + esc(r.title) + '</div><div class="sub">' + fmtDate(r.date) + ' ' + scriptBadge(r) + '</div>' +
          '<div class="stack">' + seg(r.yt.views, '--yt') + seg(r.ig.views, '--ig') + seg(r.fb.views, '--fb') + '</div></div>' +
          '<div class="num">' + fmt(r.total) + '<small>' + t('views') + '</small></div></div>';
      }).join('') + '</div></section>';
  }

  function todoHTML(r, withTitle) {
    var acts = r.insight.actions;
    if (!acts.length) return '';
    return (withTitle ? '<div class="muted" style="font-size:12px;margin-bottom:2px">' + esc(r.title) + '</div>' : '') +
      acts.map(function (a, i) {
        var k = doneKey(r, i), on = !!S.done[k];
        return '<div class="todo ' + (on ? 'done' : '') + '" data-act="toggleDone" data-k="' + esc(k) + '" role="checkbox" aria-checked="' + on + '" tabindex="0">' +
          '<span class="box">' + ico('check', 'xs') + '</span><span class="tx">' + esc(a) + '</span></div>';
      }).join('');
  }
  function doneKey(r, i) { return r.date + '|' + slug(r.title) + '|' + i; }

  /* ---------- overview ---------- */
  function pgOverview() {
    var recs = recsInRange(), pub = pubIn(recs), A = agg(recs), pv = prevInfo(), PA = pv && pv.A;
    if (!pub.length) return periodEmpty();
    var days = trendDays(), ser = seriesFor(days), pl = pv && pv.label;
    var sp = function (fn, c) { return spark(ser.map(function (s) { return fn(s.A) || 0; }), c); };

    var k = '<div class="kpis">' +
      kpi({ cls: 'is-total', plat: 'all', label: t('totalViews'), value: fmt(A.total), foot: deltaChip(A.total, PA && PA.total, pl) + ' <span>' + nVid(A.videos) + '</span>', spark: sp(function (a) { return a.total; }, 'var(--accent)') }) +
      kpi({ plat: 'yt', label: 'YouTube', value: fmt(A.yt.views), foot: deltaChip(A.yt.views, PA && PA.yt.views, pl) + ' <span>' + pct(A.share.yt, 0) + '</span>', spark: sp(function (a) { return a.yt.views; }, 'var(--yt)') }) +
      kpi({ plat: 'ig', label: 'Instagram', value: fmt(A.ig.views), foot: deltaChip(A.ig.views, PA && PA.ig.views, pl) + ' <span>' + pct(A.share.ig, 0) + '</span>', spark: sp(function (a) { return a.ig.views; }, 'var(--ig)') }) +
      kpi({ plat: 'fb', label: 'Facebook', value: fmt(A.fb.views), foot: deltaChip(A.fb.views, PA && PA.fb.views, pl) + ' <span>' + pct(A.share.fb, 0) + '</span>', spark: sp(function (a) { return a.fb.views; }, 'var(--fb)') }) +
      kpi({ label: t('engagement'), value: fmt(A.engagement), foot: '<span>' + t('engRate', { p: pct(A.engagementRate, 2) }) + '</span>' + deltaChip(A.engagement, PA && PA.engagement, pl) }) +
      '</div>';

    var m = S.chartMetric;
    var seg = '<div class="seg"><button class="' + (m === 'views' ? 'on' : '') + '" data-act="metric" data-m="views">' + t('views') + '</button><button class="' +
      (m === 'eng' ? 'on' : '') + '" data-act="metric" data-m="eng">' + t('engagement') + '</button></div>';
    queueChart('cTrend', function () {
      var ds = m === 'views'
        ? [{ label: 'YouTube', color: '--yt', data: ser.map(function (s) { return s.A.yt.views; }) }, { label: 'Instagram', color: '--ig', data: ser.map(function (s) { return s.A.ig.views; }) }, { label: 'Facebook', color: '--fb', data: ser.map(function (s) { return s.A.fb.views; }) }]
        : [{ label: 'YouTube', color: '--yt', data: ser.map(function (s) { return s.A.yt.likes; }) }, { label: 'Instagram', color: '--ig', data: ser.map(function (s) { return s.A.ig.reactions; }) }, { label: 'Facebook', color: '--fb', data: ser.map(function (s) { return s.A.fb.reactions; }) }];
      return barConfig(days, ds, { stacked: true });
    });

    var split = '<section class="card"><div class="card-h"><h3>' + t('platformSplit') + '</h3></div>' +
      '<div class="hbar" style="height:12px">' + ['yt', 'ig', 'fb'].map(function (p) { return '<i style="width:' + A.share[p].toFixed(2) + '%;background:var(--' + p + ')"></i>'; }).join('') + '</div><div style="height:10px"></div>' +
      ['yt', 'ig', 'fb'].map(function (p) {
        return '<div class="rowbar"><div class="nm">' + plogo(p, 'sm') + PLAT[p].name + '</div><div class="hbar"><i style="width:' + Math.max(2, A.share[p]).toFixed(1) + '%;background:var(--' + p + ')"></i></div><div class="v">' + fmt(A[p].views) + ' <span class="muted" style="font-weight:600">· ' + pct(A.share[p], 0) + '</span></div></div>';
      }).join('') +
      '<div class="muted" style="font-size:12.5px;margin-top:10px">' + t('avgPerVideo') + ': ' + fmt(A.total / A.videos) + ' ' + t('views') + '</div></section>';

    var quality = '<section class="card"><div class="card-h"><h3>' + t('audienceQuality') + '</h3></div><div class="rings">' +
      ring(A.yt.stayedPct, 'var(--yt)', t('r_stayed'), t('r_stayed_c')) +
      ring(A.ig.nonFollowersPct, 'var(--ig)', t('r_igNew'), t('r_igNew_c')) +
      ring(A.yt.nonSubsPct, 'var(--accent)', t('r_ytNew'), t('r_ytNew_c')) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
      '<span class="badge">' + plogo('ig', 'sm') + ' ' + t('replay') + ' ' + times(A.ig.replay) + '</span>' +
      '<span class="badge">' + plogo('yt', 'sm') + ' ' + t('avd') + ' ' + dur(A.yt.avd) + '</span></div></section>';

    var latest = pub.slice().filter(function (r) { return r.insight.analysis || r.insight.actions.length; })
      .sort(function (a, b) { return a.date === b.date ? b.row - a.row : (a.date < b.date ? 1 : -1); })[0];
    var nextCard = '<section class="card"><div class="card-h"><h3>' + t('nextActions') + '</h3><div class="right"><button class="btn sm" data-act="nav" data-page="insights">' + t('seeAll') + '</button></div></div>' +
      (latest ? (latest.insight.analysis ? '<p class="muted" style="font-size:13px;margin-bottom:8px">' + esc(latest.insight.analysis) + '</p>' : '') + todoHTML(latest, false) : emptyState('bulb', t('noActions'), t('noActions_b'))) + '</section>';

    var auto = '<section class="card"><div class="card-h"><h3>' + t('autoInsights') + '</h3><span class="sub">' + t('fromData') + '</span></div>' + insightCards(autoInsights(A, PA)) + '</section>';

    return '<div class="page">' + k +
      '<div class="grid g-main">' + chartCard('cTrend', m === 'views' ? t('viewsByDay') : t('engByDay'), seg) + split + '</div>' +
      '<div class="grid g-2">' + topVideosCard(pub, 5) + quality + '</div>' +
      '<div class="grid g-2">' + nextCard + auto + '</div></div>';
  }

  /* ---------- content ---------- */
  function sortVal(r, key) {
    switch (key) {
      case 'title': return r.title.toLowerCase();
      case 'date': return r.date + p2(r.row % 100);
      case 'yt': return r.yt.views; case 'ig': return r.ig.views; case 'fb': return r.fb.views;
      case 'total': return r.total; case 'rate': return r.status === 'pending' ? null : recRate(r);
      case 'stay': return r.yt.stayedPct;
    }
    return null;
  }
  function pgContent() {
    var f = S.filters, recs = recsInRange();
    var rows = recs.filter(function (r) {
      if (f.status !== 'all' && r.status !== f.status) return false;
      if (f.platform !== 'all' && !(r[f.platform].views > 0)) return false;
      if (f.q) { var q = f.q.toLowerCase(); if ((r.fullTitle + ' ' + (r.tag || '')).toLowerCase().indexOf(q) < 0) return false; }
      return true;
    });
    var key = S.sort.key, dir = S.sort.dir;
    rows.sort(function (a, b) {
      var x = sortVal(a, key), y = sortVal(b, key);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
    var th = function (k, label, l) {
      var on = key === k;
      return '<th class="sortable ' + (l ? 'l' : '') + (on ? ' sorted' : '') + '" data-act="sort" data-k="' + k + '">' + esc(label) + (on ? (dir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
    };
    var na = '<span class="na">—</span>';
    var v = function (r, x) { return r.status === 'pending' || x == null ? na : fmtFull(x); };
    var pubRows = pubIn(rows), A = agg(pubRows);
    var seg = function (name, items, cur) {
      return '<div class="seg">' + items.map(function (it) { return '<button class="' + (cur === it[0] ? 'on' : '') + '" data-act="filter" data-f="' + name + '" data-v="' + it[0] + '">' + it[1] + '</button>'; }).join('') + '</div>';
    };
    var body = rows.length ? rows.map(function (r) {
      return '<tr data-act="openRec" data-id="' + r.id + '" tabindex="0"><td class="l"><div class="vcell">' + thumb(r) + '<div><div class="ttl">' + esc(r.title) + '</div><div class="sub">' + scriptBadge(r) + ' ' + esc(r.tag || '') + '</div></div></div></td>' +
        '<td class="l nowrap">' + fmtDate(r.date) + '</td><td>' + v(r, r.yt.views) + '</td><td>' + v(r, r.ig.views) + '</td><td>' + v(r, r.fb.views) + '</td>' +
        '<td class="tot">' + v(r, r.total) + '</td><td>' + (r.status === 'pending' ? na : pct(recRate(r), 2)) + '</td><td>' + (r.yt.stayedPct != null ? pct(r.yt.stayedPct) : na) + '</td><td class="l">' + statusBadge(r) + '</td></tr>';
    }).join('') : '<tr><td colspan="9" class="l">' + emptyState('search', t('noMatch'), t('noMatch_b')) + '</td></tr>';
    var foot = pubRows.length > 1 ? '<tfoot><tr><td class="l">' + t('total') + ' (' + pubRows.length + ')</td><td></td><td>' + fmtFull(A.yt.views) + '</td><td>' + fmtFull(A.ig.views) + '</td><td>' + fmtFull(A.fb.views) + '</td><td>' + fmtFull(A.total) + '</td><td>' + pct(A.engagementRate, 2) + '</td><td>' + pct(A.yt.stayedPct) + '</td><td></td></tr></tfoot>' : '';

    return '<div class="page"><section class="card"><div class="toolbar"><div class="search">' + ico('search', 'sm') + '<input id="q" type="search" placeholder="' + esc(t('searchPh')) + '" value="' + esc(f.q) + '" autocomplete="off"></div>' +
      seg('status', [['all', t('f_all')], ['published', t('st_published')], ['pending', t('st_ready')]], f.status) +
      seg('platform', [['all', t('f_allPlat')], ['yt', 'YouTube'], ['ig', 'Instagram'], ['fb', 'Facebook']], f.platform) + '</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + th('title', t('col_video'), true) + th('date', t('col_date'), true) + th('yt', 'YouTube') + th('ig', 'Instagram') + th('fb', 'Facebook') + th('total', t('total')) + th('rate', t('col_rate')) + th('stay', t('col_stay')) + '<th class="l">' + t('col_status') + '</th></tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div></section></div>';
  }

  /* ---------- platform pages ---------- */
  function simpleTable(cols, recs) {
    if (!recs.length) return emptyState('inbox', t('noVideos'), t('noVideos_b'));
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">' + t('col_video') + '</th><th class="l">' + t('col_date') + '</th>' +
      cols.map(function (c) { return '<th>' + esc(c.h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      recs.map(function (r) {
        return '<tr data-act="openRec" data-id="' + r.id + '" tabindex="0"><td class="l"><div class="vcell">' + thumb(r) + '<div><div class="ttl">' + esc(r.title) + '</div><div class="sub">' + scriptBadge(r) + ' ' + esc(r.tag || '') + '</div></div></div></td><td class="l nowrap">' + fmtDate(r.date) + '</td>' +
          cols.map(function (c) { var x = c.f(r); return '<td>' + (x == null || x === '—' ? '<span class="na">—</span>' : x) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function sortedPub(pub) { return pub.slice().sort(function (a, b) { return a.date === b.date ? b.row - a.row : (a.date < b.date ? 1 : -1); }); }

  function pgPlatform(p) {
    var recs = recsInRange(), pub = pubIn(recs), A = agg(recs), pv = prevInfo(), PA = pv && pv.A, pl = pv && pv.label;
    if (!pub.length) return periodEmpty();
    var days = trendDays(), ser = seriesFor(days), col = 'var(--' + p + ')';
    var sp = function (fn) { return spark(ser.map(function (s) { return fn(s.A) || 0; }), col); };
    var V = A[p], PV = PA && PA[p], tiles, side, cols, chartDs, chartTitle;

    if (p === 'yt') {
      tiles = [
        kpi({ plat: 'yt', label: t('views'), value: fmt(V.views), foot: deltaChip(V.views, PV && PV.views, pl), spark: sp(function (a) { return a.yt.views; }) }),
        kpi({ plat: 'yt', label: t('engagedViews'), value: fmt(V.engaged), foot: '<span>' + pct(V.engagedRate, 0) + ' ' + t('ofViews') + '</span>', spark: sp(function (a) { return a.yt.engaged; }) }),
        kpi({ plat: 'yt', label: 'Likes', value: fmt(V.likes), foot: deltaChip(V.likes, PV && PV.likes, pl) }),
        kpi({ plat: 'yt', label: t('stayed'), value: pct(V.stayedPct), foot: deltaPP(V.stayedPct, PV && PV.stayedPct, pl) }),
        kpi({ plat: 'yt', label: t('avd'), value: dur(V.avd), foot: '<span>' + (V.avdPct != null ? pct(V.avdPct, 0) + ' ' + t('ofVideo') : '') + '</span>' }),
        kpi({ plat: 'yt', label: t('nonSubs'), value: pct(V.nonSubsPct), foot: '<span>TV ' + pct(V.tvPct) + '</span>' })
      ];
      chartTitle = t('ytByDay');
      chartDs = [{ label: t('views'), color: '--yt', data: ser.map(function (s) { return s.A.yt.views; }) }, { label: t('engagedViews'), color: '--yt', faint: true, data: ser.map(function (s) { return s.A.yt.engaged; }) }];
      side = '<section class="card"><div class="card-h"><h3>' + t('retention') + '</h3></div><div class="rings">' +
        ring(V.stayedPct, 'var(--yt)', t('r_stayed'), t('r_stayed_c')) + ring(V.nonSubsPct, 'var(--accent)', t('r_ytNew'), t('r_ytNew_c')) + ring(V.tvPct, 'var(--faint)', t('r_tv'), t('r_tv_c')) + '</div>' +
        '<div style="margin-top:18px">' + pub.filter(function (r) { return r.yt.avd != null; }).map(function (r) {
          return '<div class="retention" style="margin-top:12px"><div style="font-size:13px;font-weight:700">' + esc(r.title) + '</div><div class="track"><i style="width:' + Math.min(100, r.yt.avdPct || 0).toFixed(1) + '%"></i></div><div class="lab"><span>' + t('avd') + ' ' + dur(r.yt.avd) + '</span><span>' + t('length') + ' ' + dur(r.yt.duration) + '</span></div></div>';
        }).join('') + '</div></section>';
      cols = [{ h: t('views'), f: function (r) { return fmtFull(r.yt.views); } }, { h: t('engagedViews'), f: function (r) { return fmtFull(r.yt.engaged); } }, { h: 'Likes', f: function (r) { return fmtFull(r.yt.likes); } },
        { h: t('stayed'), f: function (r) { return r.yt.stayedPct != null ? pct(r.yt.stayedPct) : null; } }, { h: t('avd'), f: function (r) { return r.yt.avd != null ? dur(r.yt.avd) + ' / ' + dur(r.yt.duration) : null; } },
        { h: t('nonSubs'), f: function (r) { return r.yt.nonSubsPct != null ? pct(r.yt.nonSubsPct) : null; } }];
    } else if (p === 'ig') {
      tiles = [
        kpi({ plat: 'ig', label: t('views'), value: fmt(V.views), foot: deltaChip(V.views, PV && PV.views, pl), spark: sp(function (a) { return a.ig.views; }) }),
        kpi({ plat: 'ig', label: t('uniqueViewers'), value: fmt(V.viewers), foot: deltaChip(V.viewers, PV && PV.viewers, pl), spark: sp(function (a) { return a.ig.viewers; }) }),
        kpi({ plat: 'ig', label: t('replay'), value: times(V.replay), foot: '<span>' + t('replay_c') + '</span>' }),
        kpi({ plat: 'ig', label: t('nonFollowers'), value: pct(V.nonFollowersPct), foot: deltaPP(V.nonFollowersPct, PV && PV.nonFollowersPct, pl) }),
        kpi({ plat: 'ig', label: 'Likes', value: fmt(V.likes), foot: '<span>Saves ' + fmt(V.saves) + ' · Shares ' + fmt(V.shares) + '</span>' })
      ];
      chartTitle = t('igByDay');
      chartDs = [{ label: t('views'), color: '--ig', data: ser.map(function (s) { return s.A.ig.views; }) }, { label: t('uniqueViewers'), color: '--ig', faint: true, data: ser.map(function (s) { return s.A.ig.viewers; }) }];
      var nf = V.nonFollowersPct == null ? null : V.nonFollowersPct;
      var mx = Math.max(V.likes, V.saves, V.shares, 1);
      side = '<section class="card"><div class="card-h"><h3>' + t('reachMix') + '</h3></div>' +
        (nf == null ? '<p class="muted">—</p>' : '<div class="hbar" style="height:12px"><i style="width:' + nf.toFixed(1) + '%;background:var(--ig)"></i><i style="width:' + (100 - nf).toFixed(1) + '%;background:var(--faint)"></i></div>' +
          '<div class="legend" style="margin-top:10px"><span><i style="background:var(--ig)"></i>' + t('nonFollowers') + ' ' + pct(nf) + '</span><span><i style="background:var(--faint)"></i>' + t('followers') + ' ' + pct(100 - nf) + '</span></div>') +
        '<div class="card-h" style="margin:22px 0 6px"><h3>' + t('reactions') + '</h3></div>' +
        [['Likes', V.likes], ['Saves', V.saves], ['Shares', V.shares]].map(function (x) {
          return '<div class="rowbar"><div class="nm">' + x[0] + '</div><div class="hbar"><i style="width:' + (x[1] ? Math.max(3, x[1] / mx * 100) : 0) + '%;background:var(--ig)"></i></div><div class="v">' + fmtFull(x[1]) + '</div></div>';
        }).join('') + '</section>';
      cols = [{ h: t('views'), f: function (r) { return fmtFull(r.ig.views); } }, { h: t('uniqueViewers'), f: function (r) { return fmtFull(r.ig.viewers); } }, { h: t('replay'), f: function (r) { return r.ig.replay != null ? times(r.ig.replay) : null; } },
        { h: t('nonFollowers'), f: function (r) { return r.ig.nonFollowersPct != null ? pct(r.ig.nonFollowersPct) : null; } }, { h: 'Likes', f: function (r) { return fmtFull(r.ig.likes); } },
        { h: 'Saves', f: function (r) { return fmtFull(r.ig.saves); } }, { h: 'Shares', f: function (r) { return fmtFull(r.ig.shares); } }];
    } else {
      tiles = [
        kpi({ plat: 'fb', label: t('views'), value: fmt(V.views), foot: deltaChip(V.views, PV && PV.views, pl), spark: sp(function (a) { return a.fb.views; }) }),
        kpi({ plat: 'fb', label: t('reactions'), value: fmt(V.reactions), foot: deltaChip(V.reactions, PV && PV.reactions, pl) }),
        kpi({ plat: 'fb', label: t('reactRate'), value: pct(V.views ? V.reactions / V.views * 100 : null, 2), foot: '<span>' + t('perViews') + '</span>' }),
        kpi({ plat: 'fb', label: t('shareOfTotal'), value: pct(A.share.fb, 0), foot: '<span>' + nVid(A.videos) + '</span>' })
      ];
      chartTitle = t('fbByDay');
      chartDs = [{ label: t('views'), color: '--fb', data: ser.map(function (s) { return s.A.fb.views; }) }];
      side = '<section class="card"><div class="card-h"><h3>' + t('avgPlat') + '</h3><span class="sub">' + t('views') + ' / ' + t('video') + '</span></div>' +
        ['yt', 'ig', 'fb'].map(function (q) {
          var avg = A.videos ? A[q].views / A.videos : 0, mx2 = Math.max(A.yt.views, A.ig.views, A.fb.views) / A.videos || 1;
          return '<div class="rowbar"><div class="nm">' + plogo(q, 'sm') + PLAT[q].name + '</div><div class="hbar"><i style="width:' + Math.max(2, avg / mx2 * 100).toFixed(1) + '%;background:var(--' + q + ')"></i></div><div class="v">' + fmt(avg) + '</div></div>';
        }).join('') + '</section>';
      cols = [{ h: t('views'), f: function (r) { return fmtFull(r.fb.views); } }, { h: t('reactions'), f: function (r) { return fmtFull(r.fb.reactions); } },
        { h: t('reactRate'), f: function (r) { return r.fb.views ? pct((r.fb.reactions || 0) / r.fb.views * 100, 2) : null; } },
        { h: t('shareOfVideo'), f: function (r) { return r.total ? pct(r.fb.views / r.total * 100, 0) : null; } }];
    }

    queueChart('cPlat', function () { return barConfig(days, chartDs, { stacked: false }); });
    return '<div class="page"><div class="kpis">' + tiles.join('') + '</div><div class="grid g-main">' + chartCard('cPlat', chartTitle) + side + '</div>' +
      '<section class="card"><div class="card-h"><h3>' + t('perVideo') + '</h3></div>' + simpleTable(cols, sortedPub(pub)) + '</section></div>';
  }

  /* ---------- comments ---------- */
  function pgComments() {
    var recs = recsInRange(), pub = pubIn(recs), A = agg(recs);
    if (!pub.length) return periodEmpty();
    var by = A.commentsByPlatform, per1k = A.total ? A.comments / A.total * 1000 : null;
    var tiles = '<div class="kpis">' +
      kpi({ cls: 'is-total', plat: 'all', label: t('totalComments'), value: fmtFull(A.comments), foot: '<span>' + t('per1k', { n: per1k == null ? '—' : +per1k.toFixed(2) }) + '</span>' }) +
      kpi({ plat: 'yt', label: 'YouTube', value: fmtFull(by.yt) }) + kpi({ plat: 'ig', label: 'Instagram', value: fmtFull(by.ig) }) + kpi({ plat: 'fb', label: 'Facebook', value: fmtFull(by.fb) }) + '</div>';
    var items = [];
    pub.forEach(function (r) { r.comments.items.forEach(function (c) { items.push({ r: r, c: c }); }); });
    var feed;
    if (items.length) {
      feed = '<div>' + items.map(function (x) {
        return '<div class="comment">' + (x.c.platform ? plogo(x.c.platform) : plogo('all')) + '<div class="bubble"><div class="who"><b style="color:var(--text)">' + (x.c.platform ? PLAT[x.c.platform].name : t('comment')) + '</b><span>·</span><a href="#" data-act="openRec" data-id="' + x.r.id + '" style="text-decoration:underline">' + esc(x.r.title) + '</a><span>·</span><span>' + fmtDate(x.r.date) + '</span></div><div class="tx">' + esc(x.c.text) + '</div></div></div>';
      }).join('') + '</div>';
    } else {
      feed = emptyState('comments', A.comments ? t('com_noText') : t('com_none'), A.comments ? t('com_noText_b') : t('com_none_b'));
    }
    var perVid = '<section class="card"><div class="card-h"><h3>' + t('perVideo') + '</h3></div><div class="vlist">' + sortedPub(pub).map(function (r) {
      var rate = r.total ? r.comments.count / r.total * 1000 : null;
      return '<div class="vitem" data-act="openRec" data-id="' + r.id + '" tabindex="0">' + thumb(r) + '<div class="meta"><div class="ttl">' + esc(r.title) + '</div><div class="sub">' + fmtDate(r.date) + '</div></div><div class="num">' + fmtFull(r.comments.count) + '<small>' + (rate == null ? '' : t('per1k', { n: +rate.toFixed(2) })) + '</small></div></div>';
    }).join('') + '</div></section>';
    return '<div class="page">' + tiles + '<div class="grid g-main"><section class="card"><div class="card-h"><h3>' + t('topComments') + '</h3></div>' + feed + '</section>' + perVid + '</div></div>';
  }

  /* ---------- insights ---------- */
  function pgInsights() {
    var recs = S.insAll ? S.records : recsInRange(), pub = pubIn(recs);
    var withActs = sortedPub(pub).filter(function (r) { return r.insight.actions.length || r.insight.analysis; });
    var total = 0, done = 0;
    withActs.forEach(function (r) { r.insight.actions.forEach(function (a, i) { total++; if (S.done[doneKey(r, i)]) done++; }); });
    var scope = '<div class="seg"><button class="' + (!S.insAll ? 'on' : '') + '" data-act="insScope" data-v="0">' + t('selPeriod') + '</button><button class="' + (S.insAll ? 'on' : '') + '" data-act="insScope" data-v="1">' + t('allDays') + '</button></div>';
    var prog = '<section class="card"><div class="card-h"><h3>' + t('actionBoard') + '</h3><span class="sub">' + t('doneOf', { a: done, b: total }) + '</span><div class="right">' + scope + '</div></div>' +
      '<div class="hbar"><i style="width:' + (total ? Math.max(2, done / total * 100) : 0) + '%;background:var(--good)"></i></div></section>';
    var blocks = withActs.length ? withActs.map(function (r) {
      return '<section class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;cursor:pointer" data-act="openRec" data-id="' + r.id + '">' + thumb(r) + '<div style="min-width:0"><div style="font-weight:800">' + esc(r.title) + '</div><div class="muted" style="font-size:12px">' + fmtDate(r.date, 'mid') + ' ' + scriptBadge(r) + (r.insight.multiplier ? ' <span class="badge good">' + r.insight.multiplier + '× ' + t('jump') + '</span>' : '') + '</div></div></div>' +
        (r.insight.analysis ? '<p class="muted" style="font-size:13px;margin-bottom:8px">' + esc(r.insight.analysis) + '</p>' : '') + todoHTML(r, false) + '</section>';
    }).join('') : '<section class="card">' + emptyState('bulb', t('noActions'), t('noActions_b')) + '</section>';
    var A = agg(recs), pv = prevInfo();
    var auto = '<section class="card"><div class="card-h"><h3>' + t('autoInsights') + '</h3><span class="sub">' + t('fromData') + '</span></div>' + insightCards(autoInsights(A, S.insAll ? null : pv && pv.A)) + '</section>';
    return '<div class="page">' + prog + '<div class="grid g-main"><div class="page">' + blocks + '</div><div>' + auto + '</div></div></div>';
  }

  /* ---------- pipeline ---------- */
  function pgPipeline() {
    var pend = S.records.filter(function (r) { return r.status === 'pending'; }).sort(function (a, b) { return (a.scriptNo == null ? 999 : a.scriptNo) - (b.scriptNo == null ? 999 : b.scriptNo); });
    var pub = sortedPub(pubIn(S.records));
    var left = pend.length ? pend.map(function (r) {
      return '<div class="pcard"><div class="no">' + (r.scriptNo != null ? 'S' + p2(r.scriptNo) : '·') + '</div><div class="b"><div class="ttl">' + esc(r.title) + '</div><div class="sub"><span>' + fmtDate(r.date, 'mid') + '</span>' + (r.tag ? '<span class="badge">' + esc(r.tag) + '</span>' : '') + '</div>' +
        (r.note ? '<div class="muted" style="font-size:12.5px;margin-top:6px">' + esc(r.note) + '</div>' : '') +
        '<div class="acts">' + (r.link.url ? '<a class="btn sm primary" href="' + esc(r.link.url) + '" target="_blank" rel="noopener">' + ico('doc', 'xs') + t('openScript') + '</a>' : '') + '</div></div></div>';
    }).join('') : emptyState('check', t('pipe_none'), t('pipe_none_b'));
    var right = pub.length ? pub.map(function (r) {
      return '<div class="pcard" style="cursor:pointer" data-act="openRec" data-id="' + r.id + '">' + thumb(r) + '<div class="b"><div class="ttl">' + esc(r.title) + '</div><div class="sub"><span>' + fmtDate(r.date, 'mid') + '</span>' + scriptBadge(r) + '<span><b style="color:var(--text)">' + fmt(r.total) + '</b> ' + t('views') + '</span></div></div></div>';
    }).join('') : emptyState('inbox', t('pipe_nopub'), '');
    return '<div class="page"><div class="kanban"><section class="card"><div class="col-h"><h3>' + t('col_ready') + '</h3><span class="badge warn">' + pend.length + '</span></div>' + left + '</section>' +
      '<section class="card"><div class="col-h"><h3>' + t('col_pub') + '</h3><span class="badge good">' + pub.length + '</span></div>' + right + '</section></div>' +
      '<p class="muted" style="font-size:12.5px">' + t('pipe_note') + '</p></div>';
  }

  var PAGES = {
    overview: pgOverview, content: pgContent,
    youtube: function () { return pgPlatform('yt'); }, instagram: function () { return pgPlatform('ig'); }, facebook: function () { return pgPlatform('fb'); },
    comments: pgComments, insights: pgInsights, pipeline: pgPipeline
  };

  /* ============================================================
   * chrome (sidebar, topbar, day strip, banner)
   * ============================================================ */
  function renderBrand() {
    var name = CFG.channelName || 'Channel', links = CFG.profileLinks || {};
    var pl = ['yt', 'ig', 'fb'].map(function (p) {
      var key = { yt: 'youtube', ig: 'instagram', fb: 'facebook' }[p], u = links[key];
      return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener" aria-label="' + PLAT[p].name + '">' + plogo(p, 'lg') + '</a>' : '<span>' + plogo(p, 'lg') + '</span>';
    }).join('');
    var img = CFG.images && CFG.images.profile ? '<img src="' + esc(CFG.images.profile) + '" alt="" onerror="this.remove()">' : '';
    $('#brand').innerHTML = '<div class="avatar">' + esc(name.charAt(0).toUpperCase()) + img + '</div><div><h2>' + esc(name) + '</h2><p>' + esc(CFG.tagline || '') + '</p></div><div class="plinks">' + pl + '</div>';
  }

  function renderNav() {
    var pend = S.records.filter(function (r) { return r.status === 'pending'; }).length;
    var items = [
      ['overview', 'dashboard'], ['content', 'content'], '-', ['youtube', 'yt'], ['instagram', 'ig'], ['facebook', 'fb'], '-',
      ['comments', 'comments'], ['insights', 'insights'], ['pipeline', 'pipeline']
    ];
    $('#nav').innerHTML = items.map(function (it) {
      if (it === '-') return '<div class="nav-sep"></div>';
      var icon = ['yt', 'ig', 'fb'].indexOf(it[1]) > -1 ? plogo(it[1]) : ico(it[1]);
      return '<button class="nav-item ' + (S.page === it[0] ? 'active' : '') + '" data-act="nav" data-page="' + it[0] + '">' + icon + '<span>' + t('nav_' + it[0]) + '</span>' +
        (it[0] === 'pipeline' && pend ? '<span class="count">' + pend + '</span>' : '') + '</button>';
    }).join('');
  }

  function renderFoot() {
    var k = S.source.kind, cls = k === 'live' ? 'live' : k === 'sample' ? 'demo' : 'err';
    var label = k === 'live' ? t('sync_live') : k === 'cache' ? t('sync_cache') : t('sync_demo');
    var tm = S.source.updated ? new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit' }).format(S.source.updated) : '';
    $('#sideFoot').innerHTML = '<div class="row"><span class="dot ' + cls + '"></span><b>' + label + '</b></div><div style="margin:3px 0 0 16px">' + t('updatedAt', { t: tm }) + ' · ' + S.records.length + ' ' + t('rows') + '</div>';
  }

  function rangeLabel() {
    var e = effRange();
    if (S.range.mode === 'all') return t('allTime');
    if (S.range.mode === 'day') {
      var d = fmtDate(e.from, 'mid'), td = todayStr();
      return d + (e.from === td ? ' · ' + t('today') : e.from === addDays(td, -1) ? ' · ' + t('yesterday') : '');
    }
    return fmtDate(e.from) + ' – ' + fmtDate(e.to, 'mid');
  }

  function renderTop() {
    $('#pageTitle').textContent = t('nav_' + S.page);
    $('#dateBtn').innerHTML = ico('calendar', 'sm') + '<span class="lbl">' + esc(rangeLabel()) + '</span>';
    $('#menuBtn').innerHTML = ico('menu');
    $('#lockBtn').innerHTML = ico('lock', 'sm');
    $('#lockBtn').title = t('lockNow');
    $('#refreshBtn').innerHTML = ico('refresh', 'sm');
    $('#refreshBtn').title = t('refresh');
    $('#langBtn').textContent = S.lang === 'hi' ? 'EN' : 'हिं';
    $('#langBtn').title = S.lang === 'hi' ? 'Switch to English' : 'हिन्दी में देखें';
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('#themeBtn').innerHTML = ico(dark ? 'sun' : 'moon', 'sm');
    $('#themeBtn').title = dark ? t('lightMode') : t('darkMode');
    document.documentElement.lang = S.lang === 'hi' ? 'hi' : 'en';
    document.title = (CFG.channelName || 'Studio') + ' Studio · ' + t('nav_' + S.page);
  }

  function renderStrip() {
    var el = $('#dayStrip'), first = firstDate(), last = latestDate(), today = todayStr();
    var end = last > today ? last : today, r = effRange();
    if (S.range.mode !== 'all' && r.to > end) end = r.to;
    var start = first ? (diffDays(first, end) > 44 ? addDays(end, -44) : first) : addDays(end, -6);
    if (S.range.mode !== 'all' && r.from < start) start = r.from;
    var by = {};
    S.records.forEach(function (x) {
      if (!x.date) return; var b = by[x.date] || (by[x.date] = { views: 0, pub: 0, pend: 0 });
      if (x.status === 'published') { b.pub++; b.views += x.total || 0; } else b.pend++;
    });
    var days = []; for (var d = start; d <= end; d = addDays(d, 1)) days.push(d);
    var max = Math.max(1, Math.max.apply(null, days.map(function (x) { return by[x] ? by[x].views : 0; })));
    var pre = [['latest', t('p_latest')], ['last7', t('p_7')], ['last28', t('p_28')], ['all', t('p_all')]].map(function (p) {
      return '<button class="preset ' + (S.range.preset === p[0] ? 'on' : '') + '" data-act="preset" data-p="' + p[0] + '">' + p[1] + '</button>';
    }).join('');
    var chips = days.map(function (d) {
      var b = by[d], cls = '';
      if (!b) cls = 'nodata'; else if (!b.pub) cls = 'queue';
      var sel = S.range.mode === 'day' && d === r.from;
      var inr = S.range.mode !== 'day' && d >= r.from && d <= r.to;
      if (sel) cls += ' sel'; else if (inr) cls += ' in';
      if (d === today) cls += ' today';
      var o = dateObj(d), wd = new Intl.DateTimeFormat(loc(), { weekday: 'short' }).format(o);
      var mo = (o.getDate() === 1 || d === start) ? new Intl.DateTimeFormat(loc(), { month: 'short' }).format(o) : '';
      var h = b && b.pub ? Math.max(3, Math.round(b.views / max * 22)) : 2;
      return '<button class="day ' + cls + '" data-act="day" data-d="' + d + '" role="option" aria-selected="' + sel + '" title="' + esc(fmtDate(d, 'wd') + (b ? ' · ' + fmtFull(b.views) + ' ' + t('views') : '')) + '"><span class="wd">' + wd +
        '</span><span class="dn">' + o.getDate() + '</span><span class="mo">' + mo + '</span><span class="mini"><i style="height:' + h + 'px"></i></span></button>';
    }).join('');
    var prevScroll = el.scrollLeft;
    el.innerHTML = pre + '<div class="strip-sep"></div>' + chips;
    var selEl = el.querySelector('.day.sel') || el.querySelector('.day.in');
    if (selEl && !el.dataset.ready) {
      el.scrollLeft = selEl.offsetLeft - el.clientWidth / 2 + selEl.clientWidth / 2;
    } else el.scrollLeft = prevScroll;
    el.dataset.ready = '1';
  }

  function renderBanner() {
    var el = $('#banner'), s = S.source;
    if (S.bannerOff) { el.innerHTML = ''; return; }
    var msg = '', cls = '';
    if (s.error && s.kind === 'cache') { msg = t('ban_cache', { e: esc(s.error) }); cls = 'err'; }
    else if (s.error) { msg = t('ban_error', { e: esc(s.error) }); cls = 'err'; }
    else if (s.kind === 'sample') msg = t('ban_demo');
    el.innerHTML = msg ? '<div class="banner ' + cls + '"><span>' + msg + '</span><button class="x" data-act="dismissBanner" aria-label="close">' + ico('x', 'sm') + '</button></div>' : '';
  }

  function renderView() {
    var view = $('#view');
    view.innerHTML = (PAGES[S.page] || pgOverview)();
    flushCharts();
  }
  function renderAll() {
    renderBrand(); renderNav(); renderFoot(); renderTop(); renderStrip(); renderBanner(); renderView();
  }

  /* ============================================================
   * drawer
   * ============================================================ */
  function stat(k, v) { return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>'; }
  function openRec(id) {
    var r = S.records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var btn = r.link.url ? '<a class="btn sm" href="' + esc(r.link.url) + '" target="_blank" rel="noopener">' + ico('ext', 'xs') + (r.link.type === 'doc' ? t('openScript') : t('openVideo')) + '</a>' : '';
    var h = '<div class="dr-head"><span class="t">' + t('details') + '</span><button class="iconbtn" style="margin-left:auto" data-act="closeDrawer" aria-label="close">' + ico('x', 'sm') + '</button></div><div class="dr-body">' +
      '<div class="dr-hero">' + thumb(r, 'lg') + '<div style="min-width:0"><h2>' + esc(r.title) + '</h2><div class="chips">' + statusBadge(r) + scriptBadge(r) + '<span class="badge">' + fmtDate(r.date, 'mid') + '</span>' + (r.tag ? '<span class="badge">' + esc(r.tag) + '</span>' : '') +
      (r.insight.multiplier ? '<span class="badge good">' + r.insight.multiplier + '× ' + t('jump') + '</span>' : '') + '</div><div style="margin-top:10px">' + btn + '</div></div></div>';
    if (r.status === 'pending') {
      h += '<div class="dr-sec"><h4>' + ico('doc', 'sm') + t('st_ready') + '</h4><p class="muted" style="font-size:13px">' + esc(r.note || t('pipe_note')) + '</p></div>';
    } else {
      var rate = recRate(r);
      h += '<div class="dr-sec"><div class="stats">' + stat(t('totalViews'), fmtFull(r.total)) + stat(t('engagement'), fmtFull(recEng(r))) + stat(t('col_rate'), pct(rate, 2)) + stat(t('comments'), fmtFull(r.comments.count)) + '</div></div>';
      h += '<div class="dr-sec"><h4>' + plogo('yt', 'sm') + 'YouTube</h4><div class="stats">' + stat(t('views'), fmtFull(r.yt.views)) + stat(t('engagedViews'), fmtFull(r.yt.engaged)) + stat('Likes', fmtFull(r.yt.likes)) + stat(t('stayed'), pct(r.yt.stayedPct)) + stat(t('nonSubs'), pct(r.yt.nonSubsPct)) + stat('TV', pct(r.yt.tvPct)) + '</div>' +
        (r.yt.avd != null ? '<div class="retention"><div class="track"><i style="width:' + Math.min(100, r.yt.avdPct || 0).toFixed(1) + '%"></i></div><div class="lab"><span>' + t('avd') + ' ' + dur(r.yt.avd) + (r.yt.avdPct != null ? ' (' + pct(r.yt.avdPct, 0) + ')' : '') + '</span><span>' + t('length') + ' ' + dur(r.yt.duration) + '</span></div></div>' : '') + '</div>';
      h += '<div class="dr-sec"><h4>' + plogo('ig', 'sm') + 'Instagram</h4><div class="stats">' + stat(t('views'), fmtFull(r.ig.views)) + stat(t('uniqueViewers'), fmtFull(r.ig.viewers)) + stat(t('replay'), times(r.ig.replay)) + stat(t('nonFollowers'), pct(r.ig.nonFollowersPct)) + stat('Likes', fmtFull(r.ig.likes)) + stat('Saves · Shares', fmtFull(r.ig.saves) + ' · ' + fmtFull(r.ig.shares)) + '</div></div>';
      h += '<div class="dr-sec"><h4>' + plogo('fb', 'sm') + 'Facebook</h4><div class="stats">' + stat(t('views'), fmtFull(r.fb.views)) + stat(t('reactions'), fmtFull(r.fb.reactions)) + '</div></div>';
      h += '<div class="dr-sec"><h4>' + ico('comments', 'sm') + t('topComments') + '</h4>' + (r.comments.items.length ? r.comments.items.map(function (c) {
        return '<div class="comment">' + plogo(c.platform || 'all') + '<div class="bubble"><div class="who">' + (c.platform ? PLAT[c.platform].name : t('comment')) + '</div><div class="tx">' + esc(c.text) + '</div></div></div>';
      }).join('') : '<p class="muted" style="font-size:13px">' + (r.comments.count ? t('com_noText_b') : t('com_none')) + '</p>') + '</div>';
      if (r.insight.analysis || r.insight.actions.length) {
        h += '<div class="dr-sec"><h4>' + ico('bulb', 'sm') + t('insightsActions') + '</h4>' + (r.insight.analysis ? '<p class="muted" style="font-size:13px;margin-bottom:6px">' + esc(r.insight.analysis) + '</p>' : '') + '<div id="drTodos">' + todoHTML(r, false) + '</div></div>';
      }
    }
    h += '</div>';
    var d = $('#drawer'); d.innerHTML = h; d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#drawerScrim').classList.add('open'); d.scrollTop = 0;
    d.dataset.rec = id;
  }
  function closeDrawer() { var d = $('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $('#drawerScrim').classList.remove('open'); d.dataset.rec = ''; }

  /* ============================================================
   * date popover (calendar)
   * ============================================================ */
  function openPop() {
    var e = effRange(), base = e.from || latestDate(), o = dateObj(base);
    S.cal = { y: o.getFullYear(), m: o.getMonth() }; S.popMode = S.range.mode === 'range' ? 'range' : 'day'; S.popFrom = null;
    renderPop();
    var b = $('#dateBtn').getBoundingClientRect(), p = $('#datePop');
    p.style.top = (b.bottom + 8) + 'px';
    p.style.left = Math.max(12, Math.min(window.innerWidth - 334, b.right - 322)) + 'px';
    p.classList.add('open'); p.setAttribute('aria-hidden', 'false');
  }
  function closePop() { var p = $('#datePop'); p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); }
  function popOpen() { return $('#datePop').classList.contains('open'); }

  function renderPop() {
    var y = S.cal.y, m = S.cal.m, first = new Date(y, m, 1), startWd = (first.getDay() + 6) % 7; // Monday first
    var dim = new Date(y, m + 1, 0).getDate(), e = effRange(), has = {};
    S.records.forEach(function (r) { if (r.date) has[r.date] = true; });
    var wdFmt = new Intl.DateTimeFormat(loc(), { weekday: 'narrow' }), wds = '';
    for (var i = 0; i < 7; i++) wds += '<div class="wd">' + wdFmt.format(new Date(2024, 0, 1 + i)) + '</div>';
    var cells = ''; for (var b = 0; b < startWd; b++) cells += '<div class="cal-d out"></div>';
    for (var d = 1; d <= dim; d++) {
      var ds = y + '-' + p2(m + 1) + '-' + p2(d), cls = 'cal-d';
      if (has[ds]) cls += ' has';
      if (S.popFrom) { if (ds === S.popFrom) cls += ' sel'; }
      else if (S.range.mode === 'day') { if (ds === e.from) cls += ' sel'; }
      else if (ds >= e.from && ds <= e.to) cls += (ds === e.from || ds === e.to) ? ' sel' : ' in';
      cells += '<button class="' + cls + '" data-act="calDay" data-d="' + ds + '">' + d + '</button>';
    }
    var title = new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(first);
    $('#datePop').innerHTML = '<div class="pop-modes"><div class="seg"><button class="' + (S.popMode === 'day' ? 'on' : '') + '" data-act="popMode" data-v="day">' + t('pop_day') + '</button><button class="' + (S.popMode === 'range' ? 'on' : '') + '" data-act="popMode" data-v="range">' + t('pop_range') + '</button></div></div>' +
      '<div class="cal-h"><button class="iconbtn" data-act="calNav" data-v="-1" aria-label="prev">' + ico('chevL', 'sm') + '</button><span>' + esc(title) + '</span><button class="iconbtn" data-act="calNav" data-v="1" aria-label="next">' + ico('chevR', 'sm') + '</button></div>' +
      '<div class="cal-grid">' + wds + cells + '</div>' +
      '<div class="pop-foot"><span>' + (S.popFrom ? t('pop_pickEnd') : '<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:5px;height:5px;border-radius:50%;background:var(--accent);display:inline-block"></i>' + t('pop_hasData') + '</span>') + '</span><button class="btn sm" data-act="preset" data-p="latest">' + t('p_latest') + '</button></div>';
  }

  /* ============================================================
   * events
   * ============================================================ */
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  function go(page) {
    S.page = PAGES[page] ? page : 'overview';
    if (location.hash !== '#/' + S.page) history.replaceState(null, '', '#/' + S.page);
    document.body.classList.remove('nav-open');
    renderNav(); renderTop(); renderView(); window.scrollTo(0, 0);
  }
  function refreshRange() { renderTop(); renderStrip(); renderView(); }

  var H = {
    nav: function (el) { go(el.dataset.page); },
    day: function (el) { setDay(el.dataset.d); refreshRange(); },
    preset: function (el) { applyPreset(el.dataset.p); closePop(); refreshRange(); },
    openRec: function (el, ev) { if (ev) ev.preventDefault(); openRec(el.dataset.id); },
    closeDrawer: closeDrawer,
    toggleDone: function (el) {
      var k = el.dataset.k; if (S.done[k]) delete S.done[k]; else S.done[k] = 1;
      LS.set('nodemg.done', JSON.stringify(S.done));
      var id = $('#drawer').dataset.rec, scroll = $('#drawer').scrollTop;
      renderView(); if (id) { openRec(id); $('#drawer').scrollTop = scroll; }
    },
    metric: function (el) { S.chartMetric = el.dataset.m; renderView(); },
    sort: function (el) {
      var k = el.dataset.k; S.sort = { key: k, dir: S.sort.key === k ? -S.sort.dir : (k === 'title' ? 1 : -1) }; renderView();
    },
    filter: function (el) { S.filters[el.dataset.f] = el.dataset.v; renderView(); },
    insScope: function (el) { S.insAll = el.dataset.v === '1'; renderView(); },
    dismissBanner: function () { S.bannerOff = true; renderBanner(); },
    calNav: function (el) {
      var m = S.cal.m + (+el.dataset.v), y = S.cal.y;
      if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
      S.cal = { y: y, m: m }; renderPop();
    },
    popMode: function (el) { S.popMode = el.dataset.v; S.popFrom = null; renderPop(); },
    calDay: function (el) {
      var d = el.dataset.d;
      if (S.popMode === 'day') { setDay(d); closePop(); refreshRange(); return; }
      if (!S.popFrom) { S.popFrom = d; renderPop(); return; }
      setRange(S.popFrom, d); S.popFrom = null; closePop(); refreshRange();
    }
  };

  function reload(manual) {
    var btn = $('#refreshBtn'); btn.classList.add('spin');
    return loadData().then(function () {
      if (S.range.preset) applyPreset(S.range.preset);
      else if (!S.range.from && S.range.mode !== 'all') applyPreset('latest');
      renderAll();
      if (manual) toast(S.source.error ? t('toast_fail') : t('toast_ok'));
    }).then(function () { btn.classList.remove('spin'); }, function () { btn.classList.remove('spin'); });
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (el && H[el.dataset.act]) { H[el.dataset.act](el, e); return; }
      if (popOpen() && !e.target.closest('#datePop') && !e.target.closest('#dateBtn')) closePop();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closePop(); closeDrawer(); document.body.classList.remove('nav-open'); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act][tabindex]')) { e.preventDefault(); e.target.click(); }
    });
    document.addEventListener('input', function (e) {
      if (e.target.id === 'q') {
        S.filters.q = e.target.value; var pos = e.target.selectionStart; renderView();
        var q = $('#q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } }
      }
    });
    $('#dateBtn').addEventListener('click', function () { popOpen() ? closePop() : openPop(); });
    $('#refreshBtn').addEventListener('click', function () { reload(true); });
    $('#lockBtn').addEventListener('click', function () { if (window.NodeMGGate) window.NodeMGGate.lock(); });
    $('#menuBtn').addEventListener('click', function () { document.body.classList.add('nav-open'); });
    $('#scrim').addEventListener('click', function () { document.body.classList.remove('nav-open'); });
    $('#drawerScrim').addEventListener('click', closeDrawer);
    $('#langBtn').addEventListener('click', function () { S.lang = S.lang === 'hi' ? 'en' : 'hi'; LS.set('nodemg.lang', S.lang); renderAll(); if (popOpen()) renderPop(); });
    $('#themeBtn').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next); LS.set('nodemg.theme', next);
      var mt = document.querySelector('meta[name=theme-color]'); if (mt) mt.content = next === 'dark' ? '#0c1018' : '#f2f4f9';
      renderTop(); renderView();
    });
    window.addEventListener('hashchange', function () {
      var p = location.hash.replace(/^#\/?/, '').split('?')[0];
      if (PAGES[p] && p !== S.page) go(p);
    });
    window.addEventListener('resize', function () { if (popOpen()) closePop(); });
  }

  /* ============================================================
   * boot
   * ============================================================ */
  function boot() {
    if (boot.started) return;
    boot.started = true;
    var sec = window.NODEMG_SECRETS || {};
    ['dataSource', 'appsScriptUrl', 'accessKey', 'csvUrl'].forEach(function (k) { if (sec[k] != null && sec[k] !== '') CFG[k] = sec[k]; });
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    if (PAGES[h]) S.page = h;
    bind();
    $('#view').innerHTML = '<div class="page"><div class="skeleton" style="height:110px"></div><div class="skeleton" style="height:320px"></div></div>';
    loadData().then(function () {
      applyPreset(qs.get('range') || CFG.defaultRange || 'latest');
      renderAll();
      if (CFG.autoRefreshMinutes > 0) setInterval(function () { reload(false); }, CFG.autoRefreshMinutes * 60000);
    });
  }
  function start() {
    if (window.NODEMG_SECRETS) boot(); else document.addEventListener('nodemg:unlocked', boot);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // exposed for debugging / tests
  window.NodeMGApp = { S: S, t: t, renderAll: renderAll, go: go };
})();
