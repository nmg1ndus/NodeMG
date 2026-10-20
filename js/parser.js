/* NodeMG Dashboard — sheet parser
 * Converts rows from your Google Sheet (CSV text or Apps Script JSON rows)
 * into clean records, and aggregates them for any date range.
 * Works in the browser (window.NodeMGParser) and in Node (module.exports) for tests.
 */
(function (root) {
  'use strict';

  /* ---------- column mapping (by header name, falls back to position) ---------- */
  var FIELD_DEFS = [
    ['date',        ['date'], 0],
    ['title',       ['videoscripttitle', 'title', 'script'], 1],
    ['link',        ['videodoclink', 'link', 'url'], 2],
    ['ytViews',     ['youtubeviews'], 3],
    ['ytEngaged',   ['youtubeengaged'], 4],
    ['ytLikes',     ['youtubelikes'], 5],
    ['ytStayed',    ['youtubestayed'], 6],
    ['igViews',     ['instagramviews'], 7],
    ['igUnique',    ['instagramunique'], 8],
    ['igReactions', ['instagramreactions'], 9],
    ['fbViews',     ['facebookviews'], 10],
    ['fbReactions', ['facebookreactions'], 11],
    ['total',       ['totalviews'], 12],
    ['comments',    ['topcomments', 'comments'], 13],
    ['insights',    ['keyinsights', 'insights'], 14]
  ];

  function norm(h) { return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function mapColumns(headers) {
    var normed = headers.map(norm);
    var map = {};
    FIELD_DEFS.forEach(function (def) {
      var key = def[0], aliases = def[1], fallback = def[2], found = -1;
      for (var a = 0; a < aliases.length && found < 0; a++) {
        for (var i = 0; i < normed.length; i++) {
          if (normed[i] === aliases[a] || normed[i].indexOf(aliases[a]) === 0) { found = i; break; }
        }
      }
      if (found < 0 && fallback < headers.length) found = fallback;
      map[key] = found;
    });
    return map;
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false, i = 0, c;
    text = String(text || '').replace(/^﻿/, '');
    while (i < text.length) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  /* ---------- small helpers ---------- */
  function str(v) { return v == null ? '' : String(v).trim(); }
  function isPending(v) { return /^pending$/i.test(str(v)); }

  function num(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/,/g, '');
    var m = s.match(/^(-?\d+(?:\.\d+)?)\s*([kKmM])?$/);
    if (!m) return null;
    var n = parseFloat(m[1]);
    if (m[2]) n *= /k/i.test(m[2]) ? 1e3 : 1e6;
    return n;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function normDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]); // DD/MM/YYYY (India)
    var d = new Date(s);
    if (!isNaN(d)) return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    return null;
  }

  function pctMatch(s, re) { var m = s.match(re); return m ? parseFloat(m[1]) : null; }

  /* "50.7% Stayed • 0:17 / 0:44 AVD (97.5% Non-Subs • 17.3% TV)" */
  function parseYtStayed(raw) {
    var s = str(raw), out = { stayedPct: null, avd: null, duration: null, nonSubsPct: null, tvPct: null };
    if (!s || /^n\/?a$/i.test(s) || isPending(s)) return out;
    out.stayedPct = pctMatch(s, /([\d.]+)\s*%\s*Stayed/i);
    var m = s.match(/(\d+):(\d{2})\s*\/\s*(\d+):(\d{2})/);
    if (m) { out.avd = +m[1] * 60 + +m[2]; out.duration = +m[3] * 60 + +m[4]; }
    out.nonSubsPct = pctMatch(s, /([\d.]+)\s*%\s*Non-?\s*Subs/i);
    out.tvPct = pctMatch(s, /([\d.]+)\s*%\s*TV/i);
    return out;
  }

  /* "135 Viewers (8.88x Replay • 91.9% Non-Followers)" */
  function parseIgUnique(raw) {
    var s = str(raw), out = { viewers: null, replay: null, nonFollowersPct: null };
    if (!s || isPending(s) || /^n\/?a$/i.test(s)) return out;
    var m = s.match(/([\d,]+)\s*Viewers?/i);
    if (m) out.viewers = num(m[1]);
    out.replay = pctMatch(s, /([\d.]+)\s*x\s*Replay/i);
    out.nonFollowersPct = pctMatch(s, /([\d.]+)\s*%\s*Non-?\s*Followers?/i);
    return out;
  }

  /* "7 Likes (1 in Insights panel) / 0 Saves / 0 Shares" */
  function parseIgReactions(raw) {
    var s = str(raw), out = { likes: null, saves: null, shares: null };
    if (!s || isPending(s) || /^n\/?a$/i.test(s)) return out;
    var l = s.match(/([\d,]+)\s*Likes?/i), sv = s.match(/([\d,]+)\s*Saves?/i), sh = s.match(/([\d,]+)\s*Shares?/i);
    out.likes = l ? num(l[1]) : null;
    out.saves = sv ? num(sv[1]) : null;
    out.shares = sh ? num(sh[1]) : null;
    return out;
  }

  function parseFbReactions(raw) {
    var s = str(raw);
    if (!s || isPending(s) || /^n\/?a$/i.test(s)) return null;
    var m = s.match(/([\d,]+)/);
    return m ? num(m[1]) : null;
  }

  var PLATFORM_ALIASES = { yt: 'yt', youtube: 'yt', ig: 'ig', instagram: 'ig', fb: 'fb', facebook: 'fb' };

  /* "0 Comments across YT / IG / FB"  or  "YT: Nice trick | IG: 🔥 | FB: thanks" (also one per line) */
  function parseComments(raw) {
    var s = str(raw), out = { count: 0, items: [] };
    if (!s || isPending(s)) return out;
    var rest = s, lead = s.match(/^(\d+)\s*comments?\b[^:\n|]*[:\-–]?\s*/i), declared = null;
    if (lead) { declared = +lead[1]; rest = s.slice(lead[0].length).trim(); }
    if (rest) {
      rest.split(/\n|\s\|\s|;\s*(?=(?:YT|IG|FB|YouTube|Instagram|Facebook)\s*[:\-–])/i).forEach(function (p) {
        var text = p.trim(), pf = null, mm;
        if (!text) return;
        mm = text.match(/^\(?(YT|YouTube|IG|Instagram|FB|Facebook)\)?\s*[:\-–]\s*([\s\S]*)$/i);
        if (mm) { pf = PLATFORM_ALIASES[mm[1].toLowerCase()]; text = mm[2].trim(); }
        if (text) out.items.push({ platform: pf, text: text });
      });
    }
    out.count = Math.max(declared || 0, out.items.length);
    return out;
  }

  /* title: "Script 01: Name (Tag)" / "Name (Script 02 - Tag)" / "Name" */
  function parseTitle(raw) {
    var s = str(raw), scriptNo = null, tag = null, m;
    if ((m = s.match(/^Script\s*0*(\d+)\s*[:\-–]\s*/i))) { scriptNo = +m[1]; s = s.slice(m[0].length); }
    if ((m = s.match(/\s*\(([^()]*)\)\s*$/))) { tag = m[1].trim(); s = s.slice(0, m.index).trim(); }
    if (tag) {
      var sm = tag.match(/^Script\s*0*(\d+)\s*[-–:]\s*(.*)$/i);
      if (sm) { if (scriptNo == null) scriptNo = +sm[1]; tag = sm[2].trim(); }
    }
    return { title: s || str(raw), scriptNo: scriptNo, tag: tag };
  }

  function parseLink(raw) {
    var s = str(raw), out = { url: '', type: 'none', ytId: null, note: '' };
    if (/^https?:\/\//i.test(s)) {
      out.url = s;
      var m = s.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i);
      if (m) { out.type = 'youtube'; out.ytId = m[1]; }
      else if (/docs\.google\.com|drive\.google\.com/i.test(s)) out.type = 'doc';
      else out.type = 'link';
    } else out.note = s;
    return out;
  }

  /* "...4.3x total view jump... Fix for next video: a; b; c" → analysis + actions[] */
  function parseInsight(raw) {
    var s = str(raw), out = { text: s, analysis: s, actions: [], multiplier: null };
    if (!s) return out;
    var m = s.match(/(\d+(?:\.\d+)?)\s*x\s+total\s+view/i);
    if (m) out.multiplier = parseFloat(m[1]);
    var split = s.match(/(?:fix for next (?:video|script)|action for next (?:video|script)|action|next video|to ?do)\s*:\s*([\s\S]*)$/i);
    if (split) {
      out.analysis = s.slice(0, split.index).replace(/[.\s]+$/, '').trim();
      out.actions = split[1].split(/\s*;\s*/).map(function (a) { return a.replace(/[.\s]+$/, '').trim(); }).filter(Boolean);
    } else {
      // "…; added 3 High-CTR Titles + Save/Comment triggers." → keep as analysis only
      out.analysis = s;
    }
    return out;
  }

  /* ---------- build records ---------- */
  function buildRecords(rows) {
    if (!rows || rows.length < 2) return [];
    var headers = rows[0], col = mapColumns(headers), records = [];
    function cell(r, key) { var i = col[key]; return i >= 0 && i < r.length ? r[i] : ''; }

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], date = normDate(cell(r, 'date')), titleRaw = str(cell(r, 'title'));
      if (!date && !titleRaw) continue;
      var t = parseTitle(titleRaw), lk = parseLink(cell(r, 'link'));
      var ytV = cell(r, 'ytViews'), pending = isPending(ytV) || isPending(cell(r, 'igViews')) && isPending(cell(r, 'fbViews'));

      var stay = parseYtStayed(cell(r, 'ytStayed')), igu = parseIgUnique(cell(r, 'igUnique')), igr = parseIgReactions(cell(r, 'igReactions'));
      var yt = {
        views: pending ? null : num(ytV),
        engaged: num(cell(r, 'ytEngaged')),
        likes: num(cell(r, 'ytLikes')),
        stayedPct: stay.stayedPct, avd: stay.avd, duration: stay.duration, nonSubsPct: stay.nonSubsPct, tvPct: stay.tvPct
      };
      yt.avdPct = yt.avd != null && yt.duration ? yt.avd / yt.duration * 100 : null;
      var ig = {
        views: pending ? null : num(cell(r, 'igViews')),
        viewers: igu.viewers, replay: igu.replay, nonFollowersPct: igu.nonFollowersPct,
        likes: igr.likes, saves: igr.saves, shares: igr.shares
      };
      if (ig.replay == null && ig.views != null && ig.viewers) ig.replay = ig.views / ig.viewers;
      var fb = { views: pending ? null : num(cell(r, 'fbViews')), reactions: parseFbReactions(cell(r, 'fbReactions')) };

      var sum = (yt.views || 0) + (ig.views || 0) + (fb.views || 0);
      var total = pending ? null : (num(cell(r, 'total')) != null ? num(cell(r, 'total')) : sum);
      var cm = parseComments(cell(r, 'comments'));
      var insightRaw = str(cell(r, 'insights'));
      var preTracker = /pre-?tracker/i.test(lk.note);

      records.push({
        id: 'r' + i,
        row: i + 1,
        date: date,
        title: t.title, tag: t.tag, scriptNo: t.scriptNo, fullTitle: titleRaw,
        link: lk,
        status: pending ? 'pending' : 'published',
        preTracker: preTracker,
        yt: yt, ig: ig, fb: fb,
        total: total,
        comments: cm,
        insight: pending ? { text: '', analysis: '', actions: [], multiplier: null } : parseInsight(insightRaw),
        note: pending ? insightRaw : ''
      });
    }
    return records;
  }

  /* ---------- aggregation ---------- */
  function wavg(list, valFn, wFn) {
    var s = 0, w = 0;
    list.forEach(function (x) {
      var v = valFn(x), ww = wFn(x);
      if (v != null && ww) { s += v * ww; w += ww; }
    });
    return w ? s / w : null;
  }
  function sumOf(list, fn) {
    var s = 0, any = false;
    list.forEach(function (x) { var v = fn(x); if (v != null) { s += v; any = true; } });
    return any ? s : 0;
  }

  function aggregate(recs) {
    var pub = recs.filter(function (r) { return r.status === 'published'; });
    var A = { videos: pub.length };
    A.yt = {
      views: sumOf(pub, function (r) { return r.yt.views; }),
      engaged: sumOf(pub, function (r) { return r.yt.engaged; }),
      likes: sumOf(pub, function (r) { return r.yt.likes; }),
      stayedPct: wavg(pub, function (r) { return r.yt.stayedPct; }, function (r) { return r.yt.views; }),
      avd: wavg(pub, function (r) { return r.yt.avd; }, function (r) { return r.yt.views; }),
      avdPct: wavg(pub, function (r) { return r.yt.avdPct; }, function (r) { return r.yt.views; }),
      nonSubsPct: wavg(pub, function (r) { return r.yt.nonSubsPct; }, function (r) { return r.yt.views; }),
      tvPct: wavg(pub, function (r) { return r.yt.tvPct; }, function (r) { return r.yt.views; })
    };
    A.yt.engagedRate = A.yt.views ? A.yt.engaged / A.yt.views * 100 : null;
    A.ig = {
      views: sumOf(pub, function (r) { return r.ig.views; }),
      viewers: sumOf(pub, function (r) { return r.ig.viewers; }),
      likes: sumOf(pub, function (r) { return r.ig.likes; }),
      saves: sumOf(pub, function (r) { return r.ig.saves; }),
      shares: sumOf(pub, function (r) { return r.ig.shares; }),
      nonFollowersPct: wavg(pub, function (r) { return r.ig.nonFollowersPct; }, function (r) { return r.ig.viewers; })
    };
    A.ig.replay = A.ig.viewers ? A.ig.views / A.ig.viewers : null;
    A.ig.reactions = A.ig.likes + A.ig.saves + A.ig.shares;
    A.fb = {
      views: sumOf(pub, function (r) { return r.fb.views; }),
      reactions: sumOf(pub, function (r) { return r.fb.reactions; })
    };
    A.total = sumOf(pub, function (r) { return r.total; });
    A.comments = sumOf(pub, function (r) { return r.comments.count; });
    A.commentsByPlatform = { yt: 0, ig: 0, fb: 0, unknown: 0 };
    pub.forEach(function (r) {
      var counted = 0;
      r.comments.items.forEach(function (c) { A.commentsByPlatform[c.platform || 'unknown']++; counted++; });
      if (r.comments.count > counted) A.commentsByPlatform.unknown += r.comments.count - counted;
    });
    A.engagement = A.yt.likes + A.ig.reactions + A.fb.reactions + A.comments;
    A.engagementRate = A.total ? A.engagement / A.total * 100 : null;
    A.share = {
      yt: A.total ? A.yt.views / A.total * 100 : 0,
      ig: A.total ? A.ig.views / A.total * 100 : 0,
      fb: A.total ? A.fb.views / A.total * 100 : 0
    };
    return A;
  }

  /* ---------- public API ---------- */
  var api = {
    parseCSV: parseCSV,
    buildRecords: buildRecords,
    fromCSV: function (text) { return buildRecords(parseCSV(text)); },
    fromRows: buildRecords,
    aggregate: aggregate,
    normDate: normDate,
    _internals: { parseYtStayed: parseYtStayed, parseIgUnique: parseIgUnique, parseIgReactions: parseIgReactions, parseComments: parseComments, parseTitle: parseTitle, parseInsight: parseInsight, num: num, mapColumns: mapColumns }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NodeMGParser = api;
})(typeof window !== 'undefined' ? window : this);
