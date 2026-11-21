/* =========================================================
   Syntra — desktop messaging UI (front-end prototype)
   No backend: all state lives in memory; settings persist
   to localStorage. Network activity is simulated.
   ========================================================= */

(function () {
  'use strict';

  var D = window.SyntraData;
  var me = D.me, users = D.users;

  // ---------------------------------------------------------
  // State
  // ---------------------------------------------------------
  var S = window.SyntraSettings;
  var ACCENTS = S.ACCENTS;
  var root = document.documentElement;

  var state = {
    view: 'chats',
    filter: 'all',
    search: '',
    activeId: null,
    replyTo: null,
    prec: 'routine',
    typing: {},               // convId -> userId
    saved: [],                // [{convId, msgId}]
    settings: S.values,       // live, read-only view; write with S.set()
    msgSearch: '',
    fresh: {},                // message ids to animate in on next render
    pop: null,                // reaction to animate: msgId|emoji
    animateList: true         // stagger list items on next render
  };

  // ---------------------------------------------------------
  // Roles & permissions
  // Three roles only. Features of other common roles are folded in:
  //  - Security officer, auditor, service accounts -> Super Admin
  //  - Unit admin, channel moderator, guest access  -> Admin
  //  - Group owner (own groups)                     -> Standard User
  // Check permissions with can('perm'); never with the role name,
  // so roles can be re-mapped later without touching the UI.
  // ---------------------------------------------------------
  var ROLES = {
    superadmin: { label: 'Super Admin', perms: ['console', 'users', 'users.admins', 'groups', 'moderate', 'channels.post', 'audit', 'audit.system', 'policy', 'system'] },
    admin:      { label: 'Admin',       perms: ['console', 'users', 'groups', 'moderate', 'channels.post', 'audit'] },
    user:       { label: 'Standard User', perms: [] }
  };
  var session = null;   // { role, username, remember }
  function can(p) { return !!session && ROLES[session.role].perms.indexOf(p) !== -1; }
  function roleLabel(r) { return ROLES[r || (session && session.role)].label; }

  function loadSession() {
    var raw = null;
    try { raw = sessionStorage.getItem('syntra.session') || localStorage.getItem('syntra.session'); } catch (e) {}
    try { var s = JSON.parse(raw); return s && ROLES[s.role] ? s : null; } catch (e) { return null; }
  }
  function saveSession(s) {
    try {
      (s.remember ? localStorage : sessionStorage).setItem('syntra.session', JSON.stringify(s));
    } catch (e) {}
  }
  function clearSession() {
    try { sessionStorage.removeItem('syntra.session'); localStorage.removeItem('syntra.session'); } catch (e) {}
  }
  function applyPersona() {
    var p = D.personas[session.role];
    ['name', 'rank', 'unit', 'role', 'callsign', 'color'].forEach(function (k) { me[k] = p[k]; });
    me.username = session.username || p.username;
    var ma = $('#meAvatar');
    ma.style.setProperty('--av', me.color);
    ma.textContent = initials(me.name);
    $('#meBtn').title = fullName(me) + ' · ' + roleLabel();
    $('#adminRailBtn').classList.toggle('hidden', !can('console'));
  }

  var EMOJIS = ['👍','👎','✅','❌','🫡','👀','🔥','💯','😂','😅','🙂','😐','😮','😢','🙏','👏',
                '💪','🤝','⚠️','📍','📡','📻','🛰️','🔋','🔒','🔑','📁','📎','🕐','🚚','⛺','🌧️',
                '☕','🍽️','🎯','🚀','❗','❓','➡️','🆗'];
  var QUICK_REACTS = ['👍','✅','🫡','👀','😂','❗'];

  var PREC = {
    routine:   { label: 'Routine',   code: 'R' },
    priority:  { label: 'Priority',  code: 'P' },
    immediate: { label: 'Immediate', code: 'O' },
    flash:     { label: 'Flash',     code: 'Z' }
  };

  var TIMERS = [
    [0, 'Off'], [300, '5 minutes'], [3600, '1 hour'], [28800, '8 hours'],
    [86400, '24 hours'], [604800, '1 week']
  ];

  // ---------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + '><use href="#i-' + name + '"/></svg>'; }
  function uid() { return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function initials(name) {
    var p = String(name).trim().split(/\s+/);
    return ((p[0] || '')[0] + ((p.length > 1 ? p[p.length - 1] : '')[0] || '')).toUpperCase();
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function sameDay(a, b) { var x = new Date(a), y = new Date(b); return x.toDateString() === y.toDateString(); }
  function fmtTime(ts) {
    var d = new Date(ts), h = d.getHours();
    if (state.settings.timeFormat === '12h') return (h % 12 || 12) + ':' + pad(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM');
    return pad(h) + ':' + pad(d.getMinutes());
  }
  // Animation timing that respects the motion setting
  function motionMs(ms) {
    var m = root.dataset.motion;
    return m === 'off' ? 0 : m === 'reduced' ? Math.min(ms, 120) : ms;
  }
  function showEl(el) { clearTimeout(el._hideT); el.classList.remove('closing', 'hidden'); }
  function hideEl(el, ms, cb) {
    if (el.classList.contains('hidden')) { if (cb) cb(); return; }
    el.classList.add('closing');
    clearTimeout(el._hideT);
    el._hideT = setTimeout(function () { el.classList.add('hidden'); el.classList.remove('closing'); if (cb) cb(); }, motionMs(ms));
  }
  function isNarrow() { return window.matchMedia('(max-width: 720px)').matches; }
  function fmtDay(ts) {
    var d = new Date(ts), now = new Date();
    if (sameDay(d, now)) return 'Today';
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (sameDay(d, y)) return 'Yesterday';
    var diff = (now - d) / 86400000;
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtListTime(ts) {
    var d = new Date(ts), now = new Date();
    if (sameDay(d, now)) return fmtTime(ts);
    var diff = (now - d) / 86400000;
    if (diff < 2 && fmtDay(ts) === 'Yesterday') return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }
  function timerLabel(sec) {
    for (var i = 0; i < TIMERS.length; i++) if (TIMERS[i][0] === sec) return TIMERS[i][1];
    return 'Off';
  }
  function user(id) { return id === 'me' ? me : users[id]; }
  function fullName(u) { return u ? (u.rank ? u.rank + ' ' : '') + u.name : 'Unknown'; }
  function shortName(u) {
    if (!u) return 'Unknown';
    if (u.id === 'me') return 'You';
    return (u.rank ? u.rank + ' ' : '') + u.name.split(' ').slice(-1)[0];
  }
  function statusText(s) {
    return { online: 'Online', away: 'Away', dnd: 'Do not disturb', offline: 'Offline' }[s] || 'Offline';
  }


  // ---------------------------------------------------------
  // Conversation helpers
  // ---------------------------------------------------------
  function allConvs() { return D.conversations.concat(D.channels); }
  function getConv(id) { return allConvs().filter(function (c) { return c.id === id; })[0]; }
  function active() { return state.activeId ? getConv(state.activeId) : null; }
  function convTitle(c) { return c.type === 'direct' ? fullName(users[c.userId]) : c.name; }
  function lastMsg(c) { return c.messages[c.messages.length - 1]; }
  function lastTs(c) { var m = lastMsg(c); return m ? m.ts : 0; }
  function findMsg(c, id) { return c.messages.filter(function (m) { return m.id === id; })[0]; }
  function isAdmin(c) { return (c.admins || []).indexOf('me') !== -1 || can('channels.post'); }

  function avatarHTML(c, cls) {
    cls = cls || '';
    if (c.type === 'direct') {
      var u = users[c.userId];
      return '<span class="av-wrap"><span class="avatar ' + cls + '" style="--av:' + u.color + '">' + initials(u.name) +
        '</span><span class="presence ' + u.status + '"></span></span>';
    }
    var ic = c.type === 'channel' ? 'megaphone' : 'group';
    return '<span class="avatar group ' + cls + '" style="--av:' + (c.color || '#55605a') + '">' + icon(ic) + '</span>';
  }
  function userAvatar(u, cls) {
    return '<span class="avatar ' + (cls || '') + '" style="--av:' + u.color + '">' + initials(u.name) + '</span>';
  }

  function previewText(c) {
    var m = lastMsg(c);
    if (!m) return 'No messages yet';
    if (state.typing[c.id]) return '<span class="typing">' + esc(shortName(users[state.typing[c.id]])) + ' is typing…</span>';
    var body;
    if (m.type === 'system') body = m.text;
    else if (m.type === 'file') body = '📎 ' + m.file.name;
    else if (m.type === 'image') body = '📷 Photo' + (m.text ? ' · ' + m.text : '');
    else if (m.type === 'location') body = '📍 Grid ' + m.loc;
    else body = m.text;
    var who = '';
    if (m.type !== 'system') {
      if (m.from === 'me') who = 'You: ';
      else if (c.type === 'group') who = shortName(users[m.from]) + ': ';
    }
    return esc(who + body);
  }

  // ---------------------------------------------------------
  // Theme & appearance
  // ---------------------------------------------------------
  var mql = window.matchMedia('(prefers-color-scheme: dark)');
  var motionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FONTS = {
    system:   "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif",
    classic:  "Tahoma, Verdana, 'Segoe UI', sans-serif",
    humanist: "'Gill Sans', 'Trebuchet MS', Calibri, 'Segoe UI', sans-serif",
    mono:     "'Cascadia Code', 'Cascadia Mono', Consolas, ui-monospace, monospace"
  };
  var lastTheme = null, themeAnimT = null;

  function effectiveTheme() {
    var t = state.settings.theme;
    return t === 'system' ? (mql.matches ? 'dark' : 'light') : t;
  }
  function accentFor(a, theme) {
    if (ACCENTS[a]) return { ui: ACCENTS[a][theme === 'light' ? 'light' : 'dark'], bubble: ACCENTS[a].light };
    return { ui: theme === 'light' ? a : 'color-mix(in srgb, ' + a + ' 78%, #fff)', bubble: a };
  }

  // Single place that turns settings into CSS tokens / data attributes
  function applyAppearance() {
    var s = state.settings;
    var theme = effectiveTheme();

    // smooth color cross-fade when the theme changes (not on first paint)
    if (lastTheme && lastTheme !== theme) {
      root.classList.add('theme-anim');
      clearTimeout(themeAnimT);
      themeAnimT = setTimeout(function () { root.classList.remove('theme-anim'); }, 500);
    }
    lastTheme = theme;
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('syntra.theme', theme); } catch (e) {}

    var props = ['--accent', '--accent-hover', '--accent-soft', '--bubble-out'];
    if (theme === 'night') {
      props.forEach(function (p) { root.style.removeProperty(p); });   // night palette is fixed
    } else {
      var a = accentFor(s.accent, theme);
      root.style.setProperty('--accent', a.ui);
      root.style.setProperty('--accent-hover', 'color-mix(in srgb, ' + a.ui + ' 88%, ' + (theme === 'dark' ? '#fff' : '#000') + ')');
      root.style.setProperty('--accent-soft', 'color-mix(in srgb, ' + a.ui + ' ' + (theme === 'dark' ? '20%' : '13%') + ', var(--surface))');
      root.style.setProperty('--bubble-out', a.bubble);
    }

    root.style.setProperty('--font-size', (14 * s.fontScale / 100).toFixed(2) + 'px');
    root.style.setProperty('--font', FONTS[s.fontFamily] || FONTS.system);
    root.style.setProperty('--radius', s.radius + 'px');
    root.style.setProperty('--sidebar-w', s.sidebarWidth + 'px');

    root.dataset.bubble = s.bubbleStyle;
    root.dataset.density = s.density;
    root.dataset.wallpaper = s.wallpaper;
    root.dataset.layout = s.messageLayout;
    root.dataset.avatars = s.showAvatars ? 'on' : 'off';
    root.dataset.contrast = s.highContrast ? 'high' : 'normal';
    root.dataset.focus = s.focusRings ? 'always' : 'auto';
    root.dataset.motion = s.motion === 'system' ? (motionMql.matches ? 'reduced' : 'full') : s.motion;

    var banner = $('#classBanner');
    var labels = { unclassified: 'UNCLASSIFIED', cui: 'CUI', confidential: 'CONFIDENTIAL', secret: 'SECRET', off: '' };
    banner.dataset.level = s.classification;
    banner.textContent = labels[s.classification] || '';
    document.body.classList.toggle('no-banner', s.classification === 'off');
  }
  mql.addEventListener && mql.addEventListener('change', function () { if (state.settings.theme === 'system') applyAppearance(); });
  motionMql.addEventListener && motionMql.addEventListener('change', applyAppearance);

  function toggleTheme() {
    var next = effectiveTheme() === 'light' ? 'dark' : 'light';
    S.set('theme', next);
    toast(icon(next === 'dark' ? 'moon' : 'sun') + (next === 'dark' ? 'Dark mode on' : 'Light mode on'));
  }

  // ---------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------
  function toast(html, ms) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 220); }, ms || 2400);
  }

  // ---------------------------------------------------------
  // Sidebar list
  // ---------------------------------------------------------
  var VIEW_TITLES = { chats: 'Chats', channels: 'Channels', contacts: 'Directory', calls: 'Calls', saved: 'Saved', admin: 'Admin console' };

  function renderList() {
    $('#listTitle').textContent = VIEW_TITLES[state.view];
    $('#filterChips').classList.toggle('hidden', state.view !== 'chats');
    $('.sidebar .search').classList.toggle('hidden', state.view === 'admin');
    $('#newChatBtn').classList.toggle('hidden', state.view === 'admin');
    $$('.rail-btn[data-view]').forEach(function (b) { b.classList.toggle('active', b.dataset.view === state.view); });

    var q = state.search.toLowerCase();
    var html = '';

    if (state.view === 'chats' || state.view === 'channels') {
      var list = state.view === 'chats' ? D.conversations.slice() : D.channels.slice();
      list = list.filter(function (c) {
        if (state.view === 'chats') {
          var f = state.filter;
          if (f === 'unread' && !c.unread) return false;
          if (f === 'direct' && c.type !== 'direct') return false;
          if (f === 'group' && c.type !== 'group') return false;
          if (f === 'priority' && !c.messages.some(function (m) { return m.prec && m.prec !== 'routine'; })) return false;
        }
        if (!q) return true;
        if (convTitle(c).toLowerCase().indexOf(q) !== -1) return true;
        return c.messages.some(function (m) { return (m.text || '').toLowerCase().indexOf(q) !== -1; });
      });
      list.sort(function (a, b) {
        if (!!b.pinned - !!a.pinned) return !!b.pinned - !!a.pinned;
        return lastTs(b) - lastTs(a);
      });
      var pinned = list.filter(function (c) { return c.pinned; });
      var rest = list.filter(function (c) { return !c.pinned; });
      if (pinned.length && rest.length) {
        html += '<li class="list-section">Pinned</li>' + pinned.map(convItem).join('') +
                '<li class="list-section">All messages</li>' + rest.map(convItem).join('');
      } else {
        html = list.map(convItem).join('');
      }
      if (!list.length) html = '<li class="list-empty">' + (q ? 'No results for “' + esc(state.search) + '”' : 'Nothing here yet') + '</li>';
    }

    else if (state.view === 'contacts') {
      var us = Object.keys(users).map(function (k) { return users[k]; }).filter(function (u) {
        if (!q) return true;
        return (fullName(u) + ' ' + u.unit + ' ' + u.callsign + ' ' + u.role).toLowerCase().indexOf(q) !== -1;
      });
      var groups = {};
      us.forEach(function (u) { var g = u.unit.split(',')[0]; (groups[g] = groups[g] || []).push(u); });
      Object.keys(groups).sort().forEach(function (g) {
        html += '<li class="list-section">' + esc(g) + '</li>';
        groups[g].sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (u) {
          html += '<li class="conv" data-user="' + u.id + '">' +
            '<span class="av-wrap">' + userAvatar(u) + '<span class="presence ' + u.status + '"></span></span>' +
            '<div class="conv-main"><div class="conv-top"><span class="conv-name">' + esc(fullName(u)) +
            (u.verified ? icon('shield', 'verified') : '') + '</span></div>' +
            '<div class="row-sub">' + esc(u.role) + ' · ' + esc(u.callsign) + '</div></div></li>';
        });
      });
      if (!us.length) html = '<li class="list-empty">No personnel match “' + esc(state.search) + '”</li>';
    }

    else if (state.view === 'calls') {
      D.calls.slice().sort(function (a, b) { return b.ts - a.ts; }).forEach(function (cl, i) {
        var u = users[cl.userId];
        if (q && fullName(u).toLowerCase().indexOf(q) === -1) return;
        var dirLabel = cl.dir === 'missed' ? 'Missed' : cl.dir === 'in' ? 'Incoming' : 'Outgoing';
        var arrow = cl.dir === 'out' ? 'forward' : 'reply';
        html += '<li class="conv" data-call="' + i + '" data-user="' + u.id + '" data-kind="' + cl.kind + '">' +
          userAvatar(u) +
          '<div class="conv-main"><div class="conv-top"><span class="conv-name">' + esc(fullName(u)) + '</span>' +
          '<span class="conv-time">' + fmtListTime(cl.ts) + '</span></div>' +
          '<div class="conv-bottom"><span class="row-sub call-dir ' + cl.dir + '">' + icon(arrow) + dirLabel + ' ' + cl.kind +
          (cl.duration ? ' · ' + cl.duration : '') + '</span><span class="conv-icons">' + icon(cl.kind === 'video' ? 'video' : 'phone') + '</span></div></div></li>';
      });
      if (!html) html = '<li class="list-empty">No calls</li>';
    }

    else if (state.view === 'saved') {
      state.saved.slice().reverse().forEach(function (s) {
        var c = getConv(s.convId); if (!c) return;
        var m = findMsg(c, s.msgId); if (!m) return;
        if (q && (m.text || '').toLowerCase().indexOf(q) === -1) return;
        var u = user(m.from);
        html += '<li class="conv" data-saved-conv="' + c.id + '" data-saved-msg="' + m.id + '">' +
          '<span class="avatar" style="--av:' + u.color + '">' + initials(u.name) + '</span>' +
          '<div class="conv-main"><div class="conv-top"><span class="conv-name">' + esc(shortName(u)) +
          ' <span class="rank">in ' + esc(convTitle(c)) + '</span></span><span class="conv-time">' + fmtListTime(m.ts) + '</span></div>' +
          '<div class="conv-bottom"><span class="conv-preview">' + esc(m.text || (m.file ? m.file.name : 'Attachment')) + '</span></div></div></li>';
      });
      if (!html) html = '<li class="list-empty">' + icon('bookmark') + '<br/><br/>Saved messages appear here.<br/>Right-click a message and choose <b>Save</b>.</li>';
    }

    else if (state.view === 'admin' && window.SyntraAdmin) {
      html = window.SyntraAdmin.navHTML();
    }

    var ul = $('#convList');
    if (state.animateList) {
      // view/filter switch: rebuild with a staggered entrance
      ul.innerHTML = html;
      ul.classList.add('stagger');
      Array.prototype.forEach.call(ul.children, function (li, i) { li.style.setProperty('--i', Math.min(i, 14)); remember(li); });
    } else {
      // live update: patch only what changed and slide reordered chats (like Telegram)
      ul.classList.remove('stagger');
      morph(ul, html, { flip: true });
    }
    state.animateList = false;
    updateBadge();
  }

  function convItem(c) {
    var m = lastMsg(c);
    var hasPrec = m && m.prec && m.prec !== 'routine' && c.unread;
    var icons = '';
    if (c.muted) icons += icon('bell-off');
    if (c.disappearing) icons += icon('timer');
    if (c.pinned) icons += icon('pin');
    var name = c.type === 'direct'
      ? '<span class="rank">' + esc(users[c.userId].rank) + '</span>' + esc(users[c.userId].name) + (users[c.userId].verified ? icon('shield', 'verified') : '')
      : esc(c.name);
    return '<li class="conv' + (c.id === state.activeId ? ' active' : '') + (c.unread ? ' unread' : '') + '" data-id="' + c.id + '">' +
      avatarHTML(c) +
      '<div class="conv-main">' +
        '<div class="conv-top"><span class="conv-name">' + name + '</span>' +
        '<span class="conv-time">' + (m ? fmtListTime(m.ts) : '') + '</span></div>' +
        '<div class="conv-bottom">' +
          (hasPrec ? '<span class="prec-tag ' + m.prec + '">' + PREC[m.prec].label.toUpperCase() + '</span>' : '') +
          '<span class="conv-preview">' + (c.draft && c.id !== state.activeId ? '<span style="color:var(--danger)">Draft:</span> ' + esc(c.draft) : previewText(c)) + '</span>' +
          '<span class="conv-icons">' + icons + '</span>' +
          (c.unread ? '<span class="unread-badge' + (c.muted ? ' muted' : '') + '">' + c.unread + '</span>' : '') +
        '</div>' +
      '</div></li>';
  }

  function updateBadge() {
    var n = D.conversations.filter(function (c) { return c.unread && !c.muted; }).length;
    var badge = $('#badgeChats');
    if (String(n || '') !== badge.textContent) {
      badge.textContent = n ? n : '';
      badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');
    }
    document.title = n ? '(' + n + ') Syntra' : 'Syntra';
    if (window.SyntraAdmin && can('console')) {
      var pending = window.SyntraAdmin.pendingCount();
      $('#badgeAdmin').textContent = pending ? pending : '';
    }
  }

  // ---------------------------------------------------------
  // Chat view
  // ---------------------------------------------------------
  function openConv(id, opts) {
    opts = opts || {};
    var prev = active();
    if (prev) prev.draft = $('#msgInput').value;
    state.activeId = id;
    state.replyTo = null;
    state.msgSearch = '';
    $('#msgSearchBar').classList.add('hidden');
    $('#msgSearchInput').value = '';
    var c = active();
    c.unread = 0;
    $('#emptyState').classList.add('hidden');
    $('#adminPane').classList.add('hidden');
    $('#chatInner').classList.remove('hidden');
    $('#app').classList.add('chat-open');
    $('#msgInput').value = c.draft || '';
    c.draft = '';
    autoGrow();
    renderChat(true);
    renderList();
    if (!$('#infoPanel').classList.contains('hidden')) renderInfo();

    var box = $('#messages');
    clearTimeout(box._loadT);
    var finish = function () {
      if (opts.highlight) highlightMsg(opts.highlight);
      else if (!isNarrow()) $('#msgInput').focus();
    };
    if (!c._loaded && root.dataset.motion !== 'off') {
      // first open: show a skeleton while "decrypting" (a real backend would fetch here)
      c._loaded = true;
      box.innerHTML = skeletonHTML();
      box._loadT = setTimeout(function () {
        if (state.activeId !== c.id) return;
        renderMessages(false, true); playSwap(); finish();
      }, 450);
    } else {
      c._loaded = true;
      playSwap(); finish();
    }
  }

  function closeConv() {
    var c = active();
    if (c) c.draft = $('#msgInput').value;
    state.activeId = null;
    toggleInfo(false);
    $('#app').classList.remove('chat-open');
    $('#chatInner').classList.add('hidden');
    $('#adminPane').classList.add('hidden');
    $('#emptyState').classList.remove('hidden');
    if (window.SyntraAdmin) window.SyntraAdmin.close();
    renderList();
  }

  function playSwap() {
    var box = $('#messages');
    box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
  }

  function skeletonHTML() {
    var rows = [['in', 46], ['in', 64], ['out', 38], ['in', 55], ['out', 60], ['out', 30], ['in', 42]];
    return '<div class="skeleton-wrap" aria-label="Loading messages">' + rows.map(function (r) {
      return '<div class="sk-row ' + r[0] + '">' + (r[0] === 'in' ? '<span class="sk sk-av"></span>' : '') +
        '<span class="sk sk-bubble" style="width:' + r[1] + '%"></span></div>';
    }).join('') + '</div>';
  }

  // opening: true when switching to this chat (jump to the newest message)
  function renderChat(opening) {
    var c = active(); if (!c) return;
    $('#chatAvatar').innerHTML = avatarHTML(c);

    var nameHTML = esc(convTitle(c));
    if (c.type === 'direct' && users[c.userId].verified) nameHTML += icon('shield', 'verified');
    if (c.disappearing) nameHTML += '<span title="Disappearing messages: ' + timerLabel(c.disappearing) + '" style="color:var(--text-3);display:inline-flex">' + icon('timer', 'verified') + '</span>';
    $('#chatName').innerHTML = nameHTML;
    renderChatSub();

    var isChannel = c.type === 'channel';
    $('#voiceCallBtn').classList.toggle('hidden', isChannel);
    $('#videoCallBtn').classList.toggle('hidden', isChannel);

    // pinned
    var pm = c.pinnedMsgId && findMsg(c, c.pinnedMsgId);
    $('#pinnedBar').classList.toggle('hidden', !pm);
    if (pm) $('#pinnedText').textContent = (pm.text || (pm.file && pm.file.name) || 'Attachment');

    // read-only channel
    var ro = !!(c.readOnly && !isAdmin(c));
    $('.composer').classList.toggle('hidden', ro);
    var note = $('#readonlyNote');
    if (ro && !note) {
      note = document.createElement('div');
      note.id = 'readonlyNote'; note.className = 'readonly-note';
      note.innerHTML = icon('megaphone') + 'Only channel admins can post here';
      $('.composer-wrap').appendChild(note);
    } else if (!ro && note) note.remove();

    $('#messages').classList.toggle('no-av', c.type === 'direct');
    renderReply();
    renderMessages(!opening, !!opening);
  }

  function renderChatSub() {
    var c = active(); if (!c) return;
    var sub = $('#chatSub');
    sub.classList.remove('typing');
    if (state.typing[c.id] && state.settings.typingIndicators) {
      sub.classList.add('typing');
      sub.textContent = (c.type === 'direct' ? '' : shortName(users[state.typing[c.id]]) + ' is ') + (c.type === 'direct' ? 'typing…' : 'typing…');
      return;
    }
    if (c.type === 'direct') {
      var u = users[c.userId];
      sub.textContent = statusText(u.status) + ' · ' + u.callsign + ' · ' + u.unit;
    } else if (c.type === 'group') {
      var online = c.members.filter(function (id) { return id !== 'me' && users[id] && users[id].status === 'online'; }).length;
      sub.textContent = c.members.length + ' members · ' + (online + 1) + ' online';
    } else {
      sub.textContent = 'Channel · ' + c.members + ' subscribers';
    }
  }

  // ---------------------------------------------------------
  // Keyed DOM patching. Instead of replacing a whole list with
  // innerHTML (which flickers, restarts animations and loses hover
  // state), only nodes whose markup changed are touched. Nodes
  // whose content is unchanged but whose attributes changed (e.g.
  // the "active" class) are patched in place so CSS transitions run.
  // ---------------------------------------------------------
  function keyOf(el) {
    var d = el.dataset;
    return d.key || d.id || d.admin || d.savedMsg || (d.call !== undefined ? 'call' + d.call : '') || d.user ||
      ('t:' + el.className + ':' + el.textContent);   // section headers, empty states
  }
  function remember(el) { el._html = el.outerHTML; el._inner = el.innerHTML; }
  function morph(parent, html, opts) {
    opts = opts || {};
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var next = Array.prototype.slice.call(tpl.content.children);
    var old = {}, tops = {};
    Array.prototype.forEach.call(parent.children, function (el) {
      var k = keyOf(el); if (!k || old[k]) return;
      old[k] = el;
      if (opts.flip) tops[k] = el.getBoundingClientRect().top;
    });
    var finals = next.map(function (n) {
      var k = keyOf(n), cur = k && old[k];
      if (cur) {
        delete old[k];
        var nHtml = n.outerHTML;
        if ((cur._html || cur.outerHTML) === nHtml) return cur;
        if ((cur._inner !== undefined ? cur._inner : cur.innerHTML) === n.innerHTML && cur.tagName === n.tagName) {
          // same content, different attributes: patch in place
          Array.prototype.slice.call(cur.attributes).forEach(function (a) { if (!n.hasAttribute(a.name)) cur.removeAttribute(a.name); });
          Array.prototype.forEach.call(n.attributes, function (a) { if (cur.getAttribute(a.name) !== a.value) cur.setAttribute(a.name, a.value); });
          remember(cur);
          return cur;
        }
      }
      remember(n);
      n._isNew = !cur;
      return n;
    });
    finals.forEach(function (node, i) {
      var at = parent.children[i];
      if (at !== node) parent.insertBefore(node, at || null);
    });
    while (parent.children.length > finals.length) parent.removeChild(parent.lastElementChild);

    // FLIP: slide items that moved to their new position (chat list reordering)
    if (opts.flip && root.dataset.motion !== 'off') {
      var ease = 'cubic-bezier(.2,.8,.2,1)', reduced = root.dataset.motion === 'reduced';
      finals.forEach(function (node) {
        if (!node.animate) return;
        var k = keyOf(node);
        if (!(k in tops)) {
          if (node._isNew) node.animate([{ opacity: 0, transform: reduced ? 'none' : 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: ease });
          return;
        }
        var dy = tops[k] - node.getBoundingClientRect().top;
        if (Math.abs(dy) < 1 || reduced) return;
        node.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 320, easing: ease });
      });
    }
  }

  function scrollToBottom(box, smooth) {
    if (smooth && root.dataset.motion !== 'off') box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    else box.scrollTop = box.scrollHeight;
  }

  var lastSearchQ = '';
  // keepScroll: stay put if the user has scrolled up. instant: jump (used when opening a chat)
  function renderMessages(keepScroll, instant) {
    var c = active(); if (!c) return;
    var box = $('#messages');
    var dist = box.scrollHeight - box.scrollTop - box.clientHeight;
    var html = '<div class="e2e-notice" data-key="e2e">' + icon('lock') + '<span>Messages and calls are end-to-end encrypted. No one outside of this ' +
      (c.type === 'direct' ? 'chat' : c.type) + ', not even Syntra, can read or listen to them.</span></div>';

    var q = state.msgSearch.toLowerCase(), hits = 0;
    var msgs = c.messages;
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i], p = msgs[i - 1], n = msgs[i + 1];
      if (!p || !sameDay(p.ts, m.ts)) html += '<div class="date-sep" data-key="d-' + new Date(m.ts).toDateString() + '">' + fmtDay(m.ts) + '</div>';
      if (m.type === 'system') { html += '<div class="sys-msg" data-key="' + m.id + '">' + icon('timer') + esc(m.text) + '</div>'; continue; }
      var first = !p || p.type === 'system' || p.from !== m.from || !sameDay(p.ts, m.ts) || m.ts - p.ts > 300000;
      var last = !n || n.type === 'system' || n.from !== m.from || !sameDay(n.ts, m.ts) || n.ts - m.ts > 300000;
      if (q && (m.text || '').toLowerCase().indexOf(q) !== -1) hits++;
      html += msgHTML(m, c, first, last, q);
    }
    if (state.typing[c.id] && state.settings.typingIndicators) {
      var tu = users[state.typing[c.id]];
      html += '<div class="typing-row" data-key="typing-' + tu.id + '">' + (c.type !== 'direct' ? userAvatar(tu) : '') + '<div class="typing-bubble"><i></i><i></i><i></i></div></div>';
    }
    morph(box, html);
    state.fresh = {};
    state.pop = null;
    if (q) {
      $('#msgSearchCount').textContent = hits + (hits === 1 ? ' match' : ' matches');
      // only jump to the first match when the search text changes, not on every update
      if (q !== lastSearchQ) {
        var firstHit = box.querySelector('mark');
        if (firstHit) firstHit.scrollIntoView({ block: 'center' });
      }
    } else {
      $('#msgSearchCount').textContent = '';
      if (instant) scrollToBottom(box, false);
      else if (!(keepScroll && dist > 120)) scrollToBottom(box, dist < 1500);
    }
    lastSearchQ = q;
    updateJump();
  }

  function highlightText(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<mark>$1</mark>');
  }

  function msgHTML(m, c, first, last, q) {
    var mine = m.from === 'me';
    var u = user(m.from);
    var listMode = state.settings.messageLayout === 'list';
    var cls = 'msg-row ' + (mine ? 'out' : 'in') + (first ? ' first' : '') + (last ? ' last' : '');
    if (state.fresh[m.id]) cls += ' enter';
    var b = '';

    if (first && (listMode || (!mine && c.type !== 'direct'))) {
      b += '<div class="b-sender" style="--sc:' + u.color + '">' + esc(fullName(u)) + '<small>' + esc(u.callsign) +
        (listMode ? ' · ' + fmtTime(m.ts) : '') + '</small></div>';
    }
    if (m.prec && m.prec !== 'routine') {
      b += '<div class="b-prec ' + m.prec + '">' + (m.prec === 'flash' ? icon('alert') : '') + PREC[m.prec].label.toUpperCase() + '</div>';
    }
    if (m.replyTo) {
      var r = findMsg(c, m.replyTo);
      if (r) b += '<span class="b-reply" data-jump="' + r.id + '"><b>' + esc(shortName(user(r.from))) + '</b><span>' + esc(r.text || (r.file ? r.file.name : 'Attachment')) + '</span></span>';
    }
    if (m.type === 'file') {
      b += '<div class="b-file"><div class="b-file-ico">' + icon('file') + '</div><div><div class="b-file-name">' + esc(m.file.name) + '</div><div class="b-file-size">' + esc(m.file.size) + ' · Encrypted</div></div></div>';
    } else if (m.type === 'image') {
      b += '<div class="b-image"' + (m.src ? ' style="background:url(' + m.src + ') center/cover"' : '') + '>' + (m.src ? '' : icon('image')) + '</div>';
    } else if (m.type === 'location') {
      b += '<div class="b-loc"><div class="b-loc-map">' + icon('map') + '</div><code>MGRS ' + esc(m.loc) + '</code></div>';
    }
    if (m.text) b += '<span class="b-text">' + highlightText(m.text, q) + '</span>';

    var meta = '';
    if (c.disappearing) meta += icon('timer', 'timer');
    meta += fmtTime(m.ts);
    if (mine) {
      var st = m.status || 'sent';
      if (st === 'pending') meta += icon('clock');
      else if (st === 'sent') meta += icon('check');
      else if (st === 'delivered') meta += icon('check2');
      else meta += icon('check2', 'read');
    }
    b += '<span class="b-meta">' + meta + '</span>';

    var reacts = '';
    if (m.reactions) {
      var keys = Object.keys(m.reactions).filter(function (k) { return m.reactions[k].length; });
      if (keys.length) {
        reacts = '<div class="reactions">' + keys.map(function (k) {
          var arr = m.reactions[k];
          var popCls = state.pop === m.id + '|' + k ? ' pop' : '';
          return '<button class="react-pill' + (arr.indexOf('me') !== -1 ? ' mine' : '') + popCls + '" data-react="' + k + '" title="' +
            esc(arr.map(function (id) { return shortName(user(id)); }).join(', ')) + '">' + k + (arr.length > 1 ? '<small>' + arr.length + '</small>' : '') + '</button>';
        }).join('') + '</div>';
      }
    }

    var bubbleCls = 'bubble' + (m.prec === 'flash' ? ' prec-flash' : m.prec === 'immediate' ? ' prec-immediate' : '');
    return '<div class="' + cls + '" data-id="' + m.id + '">' +
      (mine && !listMode ? '' : userAvatar(u)) +
      '<div class="msg-col"><div class="' + bubbleCls + '">' + b + '</div>' + reacts + '</div>' +
      '<div class="msg-hover">' +
        '<button data-hover="react" title="React">' + icon('smile') + '</button>' +
        '<button data-hover="reply" title="Reply">' + icon('reply') + '</button>' +
        '<button data-hover="more" title="More">' + icon('more') + '</button>' +
      '</div></div>';
  }

  function highlightMsg(id) {
    var row = $('#messages [data-id="' + id + '"]');
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    var bub = row.querySelector('.bubble');
    bub.classList.remove('flash-hl'); void bub.offsetWidth; bub.classList.add('flash-hl');
  }

  function updateJump() {
    var box = $('#messages');
    $('#jumpDown').classList.toggle('hidden', box.scrollHeight - box.scrollTop - box.clientHeight < 200);
  }

  // ---------------------------------------------------------
  // Composer
  // ---------------------------------------------------------
  function autoGrow() {
    var ta = $('#msgInput');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    $('#sendBtn').classList.toggle('has-text', ta.value.trim().length > 0);
  }

  function setPrec(p) {
    state.prec = p;
    var b = $('#precBtn');
    b.dataset.prec = p;
    $('.prec-label', b).textContent = PREC[p].label;
    b.title = 'Precedence: ' + PREC[p].label + ' — how urgent this message is. Click to change.';
    $$('#precMenu [data-prec]').forEach(function (x) { x.classList.toggle('active', x.dataset.prec === p); });
    $('.composer').dataset.prec = p;
  }

  // Organisation policy: hide attachment types the Super Admin has disabled
  function applyAttachPolicy() {
    var map = { file: 'allowFiles', image: 'allowPhotos', location: 'allowLocation' };
    var any = false;
    Object.keys(map).forEach(function (k) {
      var ok = S.getPolicy(map[k]) !== false;
      $('#attachMenu [data-attach="' + k + '"]').classList.toggle('hidden', !ok);
      any = any || ok;
    });
    $('#attachBtn').classList.toggle('hidden', !any);
  }

  function renderReply() {
    var c = active(), r = state.replyTo && c && findMsg(c, state.replyTo);
    $('#replyPreview').classList.toggle('hidden', !r);
    if (r) {
      $('#replyName').textContent = 'Replying to ' + (r.from === 'me' ? 'yourself' : shortName(user(r.from)));
      $('#replyText').textContent = r.text || (r.file ? r.file.name : 'Attachment');
    }
  }

  function pushMessage(c, m) {
    c.messages.push(m);
    state.fresh[m.id] = true;
    renderMessages();
    renderList();
    if (m.from === 'me') simulateDelivery(c, m);
  }

  function sendMessage() {
    var c = active(); if (!c) return;
    var ta = $('#msgInput');
    var text = ta.value.trim();
    if (!text) { toast(icon('mic') + 'Voice notes will be available with the backend'); return; }
    if (state.prec === 'flash' && state.settings.flashOverride) {
      askConfirm({
        title: 'Send as FLASH?',
        message: 'Flash is for emergencies only. It alerts recipients even if they set Do Not Disturb.',
        confirmLabel: 'Send Flash', danger: true, icon: 'alert'
      }).then(function (ok) { if (ok) deliverText(c, $('#msgInput').value.trim()); else ta.focus(); });
      return;
    }
    deliverText(c, text);
  }

  function deliverText(c, text) {
    if (!text) return;
    var ta = $('#msgInput');
    var m = { id: uid(), from: 'me', ts: Date.now(), text: text, status: 'pending' };
    if (state.prec !== 'routine') m.prec = state.prec;
    if (state.replyTo) m.replyTo = state.replyTo;
    ta.value = '';
    state.replyTo = null;
    renderReply();
    setPrec('routine');
    autoGrow();
    pushMessage(c, m);
  }

  // ---------------------------------------------------------
  // In-app confirmation dialog. Native confirm() is blocked in
  // some embedded browsers (it returns false instantly), which
  // silently broke sign-out, Flash sending and admin actions.
  // ---------------------------------------------------------
  function askConfirm(o) {
    return new Promise(function (resolve) {
      var host = document.createElement('div');
      host.className = 'confirm-backdrop';
      host.innerHTML = '<div class="confirm" role="alertdialog" aria-modal="true" aria-labelledby="cfTitle">' +
        (o.icon ? '<div class="confirm-ico' + (o.danger ? ' danger' : '') + '">' + icon(o.icon) + '</div>' : '') +
        '<h3 id="cfTitle">' + esc(o.title) + '</h3>' +
        (o.message ? '<p>' + esc(o.message) + '</p>' : '') +
        '<div class="confirm-actions"><button class="btn" data-cf="0">' + esc(o.cancelLabel || 'Cancel') + '</button>' +
        '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-cf="1">' + esc(o.confirmLabel || 'OK') + '</button></div></div>';
      document.body.appendChild(host);
      var prevFocus = document.activeElement;
      var done = function (v) {
        host.classList.add('closing');
        setTimeout(function () { host.remove(); }, motionMs(160));
        if (prevFocus && prevFocus.focus && !v) prevFocus.focus();
        resolve(v);
      };
      host.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cf]');
        if (b) done(b.dataset.cf === '1');
        else if (e.target === host) done(false);
      });
      host.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') done(false);
        if (e.key === 'Tab') {   // keep focus inside the dialog
          var bs = $$('button', host), i = bs.indexOf(document.activeElement);
          e.preventDefault(); bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
        }
      });
      setTimeout(function () { $('[data-cf="1"]', host).focus(); }, 20);
    });
  }

  function simulateDelivery(c, m) {
    setTimeout(function () { m.status = 'sent'; refreshIfActive(c); }, 350);
    setTimeout(function () { m.status = 'delivered'; refreshIfActive(c); }, 1100);
    if (c.type === 'channel') return;
    setTimeout(function () {
      if (state.settings.readReceipts) { m.status = 'read'; refreshIfActive(c); }
    }, 2200);
    // Simulated reply from the other side
    var responders = c.type === 'direct' ? [c.userId] : c.members.filter(function (id) { return id !== 'me'; });
    var who = responders[Math.floor(Math.random() * responders.length)];
    if (!who || (users[who].status === 'offline' && c.type === 'direct' && Math.random() < .6)) return;
    setTimeout(function () {
      state.typing[c.id] = who;
      refreshIfActive(c, true); renderList();
    }, 2600);
    setTimeout(function () {
      delete state.typing[c.id];
      var reply = { id: uid(), from: who, ts: Date.now(), text: D.autoReplies[Math.floor(Math.random() * D.autoReplies.length)] };
      if (Math.random() < .3) reply.replyTo = m.id;
      c.messages.push(reply);
      if (c.id === state.activeId) state.fresh[reply.id] = true;
      if (c.id !== state.activeId) {
        c.unread = (c.unread || 0) + 1;
        if (state.settings.notifications && !c.muted) notify(c, reply);
      }
      refreshIfActive(c); renderList();
    }, 4600 + Math.random() * 1500);
  }

  function refreshIfActive(c, keep) {
    if (c.id === state.activeId) { renderMessages(keep !== false); renderChatSub(); }
  }

  function notify(c, m) {
    var who = shortName(user(m.from));
    var body = state.settings.hidePreviews ? 'New message' : esc(m.text);
    toast(icon('chat') + '<span><b>' + esc(c.type === 'direct' ? who : c.name) + '</b> · ' + body + '</span>', 3200);
    if (state.settings.sounds) beep();
  }

  var audioCtx;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.08, audioCtx.currentTime + .02);
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .25);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + .26);
    } catch (e) {}
  }

  // Attachments
  function pickFile(accept, cb) {
    var inp = document.createElement('input');
    inp.type = 'file'; if (accept) inp.accept = accept;
    inp.onchange = function () { if (inp.files[0]) cb(inp.files[0]); };
    inp.click();
  }
  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function attach(kind) {
    var c = active(); if (!c) return;
    if (kind === 'file') {
      pickFile('', function (f) { pushMessage(c, { id: uid(), from: 'me', ts: Date.now(), type: 'file', file: { name: f.name, size: fmtSize(f.size) }, text: '', status: 'pending' }); });
    } else if (kind === 'image') {
      pickFile('image/*', function (f) { pushMessage(c, { id: uid(), from: 'me', ts: Date.now(), type: 'image', src: URL.createObjectURL(f), text: '', status: 'pending' }); });
    } else if (kind === 'location') {
      var grid = '38S MB ' + (4400 + Math.floor(Math.random() * 200)) + ' ' + (8700 + Math.floor(Math.random() * 200));
      pushMessage(c, { id: uid(), from: 'me', ts: Date.now(), type: 'location', loc: grid, text: '', status: 'pending' });
    }
  }

  // ---------------------------------------------------------
  // Message actions
  // ---------------------------------------------------------
  function toggleReaction(c, m, emoji) {
    m.reactions = m.reactions || {};
    var arr = m.reactions[emoji] = m.reactions[emoji] || [];
    // one reaction per person (Signal-style): remove my other reactions
    Object.keys(m.reactions).forEach(function (k) {
      if (k !== emoji) m.reactions[k] = m.reactions[k].filter(function (id) { return id !== 'me'; });
    });
    var i = arr.indexOf('me');
    if (i === -1) { arr.push('me'); state.pop = m.id + '|' + emoji; } else arr.splice(i, 1);
    renderMessages(true);
  }

  function msgAction(act, msgId, extra) {
    var c = active(); if (!c) return;
    var m = findMsg(c, msgId); if (!m) return;
    switch (act) {
      case 'reply':
        state.replyTo = m.id; renderReply(); $('#msgInput').focus(); break;
      case 'copy':
        var txt = m.text || (m.file ? m.file.name : m.loc || '');
        if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(function () {});
        toast(icon('copy') + 'Copied to clipboard'); break;
      case 'forward':
        forwardModal(m); break;
      case 'pin':
        c.pinnedMsgId = c.pinnedMsgId === m.id ? null : m.id;
        renderChat(); toast(icon('pin') + (c.pinnedMsgId ? 'Message pinned' : 'Message unpinned')); break;
      case 'save':
        var exists = state.saved.some(function (s) { return s.msgId === m.id; });
        if (!exists) state.saved.push({ convId: c.id, msgId: m.id });
        toast(icon('bookmark') + (exists ? 'Already saved' : 'Saved')); if (state.view === 'saved') renderList(); break;
      case 'info':
        msgInfoModal(c, m); break;
      case 'delete':
        var removeMsg = function () {
          c.messages = c.messages.filter(function (x) { return x.id !== m.id; });
          if (c.pinnedMsgId === m.id) c.pinnedMsgId = null;
          state.saved = state.saved.filter(function (s) { return s.msgId !== m.id; });
          renderChat(); renderList(); toast(icon('trash') + 'Message deleted');
        };
        // collapse the bubble away before removing it
        var row = $('#messages [data-id="' + m.id + '"]');
        if (row && root.dataset.motion !== 'off' && row.animate) {
          row.style.overflow = 'hidden';
          var dur = motionMs(220), removed = false;
          var finish = function () { if (!removed) { removed = true; removeMsg(); } };
          row.animate([
            { opacity: 1, transform: 'scale(1)', height: row.offsetHeight + 'px' },
            { opacity: 0, transform: 'scale(.92)', height: '0px', marginTop: '0px' }
          ], { duration: dur, easing: 'ease-in', fill: 'forwards' }).onfinish = finish;
          setTimeout(finish, dur + 80);   // animations pause in background windows
        } else removeMsg();
        break;
      case 'react':
        toggleReaction(c, m, extra); break;
    }
  }

  // Context menu
  var ctxMsgId = null;
  function openCtx(x, y, msgId) {
    ctxMsgId = msgId;
    var c = active(), m = findMsg(c, msgId);
    var menu = $('#ctxMenu');
    $('#ctxReacts').innerHTML = QUICK_REACTS.map(function (e) { return '<button data-ctx-react="' + e + '">' + e + '</button>'; }).join('');
    menu.querySelector('[data-act="pin"]').lastChild.textContent = c.pinnedMsgId === msgId ? 'Unpin' : 'Pin';
    menu.querySelector('[data-act="reply"]').classList.toggle('hidden', !!(c.readOnly && !isAdmin(c)));
    menu.querySelector('[data-act="copy"]').classList.toggle('hidden', !m.text);
    menu.classList.remove('hidden');
    var w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
  }
  function closeCtx() { $('#ctxMenu').classList.add('hidden'); ctxMsgId = null; }

  // ---------------------------------------------------------
  // Info panel
  // ---------------------------------------------------------
  function toggleInfo(force) {
    var p = $('#infoPanel');
    var isOpen = !p.classList.contains('hidden') && !p.classList.contains('closing');
    var show = typeof force === 'boolean' ? force : !isOpen;
    $('#infoBtn').classList.toggle('on', show);
    if (show) { showEl(p); renderInfo(); }
    else hideEl(p, 220);
  }

  function timerSelect(c) {
    return '<select data-info="timer">' + TIMERS.map(function (t) {
      return '<option value="' + t[0] + '"' + (c.disappearing === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('') + '</select>';
  }

  function renderInfo() {
    var c = active(); if (!c) return;
    var h = '';
    if (c.type === 'direct') {
      var u = users[c.userId];
      h += '<div class="info-hero"><span class="av-wrap">' + userAvatar(u, 'lg') + '</span>' +
        '<h2>' + esc(fullName(u)) + (u.verified ? icon('shield', 'verified') : '') + '</h2>' +
        '<p>' + esc(u.role) + '</p><p>' + statusText(u.status) + '</p>' +
        '<div class="info-quick">' +
          '<button data-info="call">' + icon('phone') + 'Voice</button>' +
          '<button data-info="video">' + icon('video') + 'Video</button>' +
          '<button data-info="mute">' + icon(c.muted ? 'bell' : 'bell-off') + (c.muted ? 'Unmute' : 'Mute') + '</button>' +
          '<button data-info="search">' + icon('search') + 'Search</button>' +
        '</div></div>' +
        '<div class="info-section"><h4>Service details</h4>' +
          field('Rank', u.rank) + field('Unit', u.unit) + field('Position', u.role) + field('Callsign', u.callsign) +
        '</div>';
    } else {
      h += '<div class="info-hero">' + avatarHTML(c, 'lg') +
        '<h2>' + esc(c.name) + '</h2>' +
        '<p>' + (c.type === 'channel' ? 'Channel · ' + c.members + ' subscribers' : 'Group · ' + c.members.length + ' members') + '</p>' +
        '<div class="info-quick">' +
          (c.type === 'group' ? '<button data-info="call">' + icon('phone') + 'Voice</button>' : '') +
          '<button data-info="mute">' + icon(c.muted ? 'bell' : 'bell-off') + (c.muted ? 'Unmute' : 'Mute') + '</button>' +
          '<button data-info="search">' + icon('search') + 'Search</button>' +
        '</div></div>';
    }

    h += '<div class="info-section"><h4>Privacy</h4>';
    if (c.type === 'direct') {
      h += '<button class="info-action" data-info="safety">' + icon('key') + 'View safety number<span class="val">' + (users[c.userId].verified ? 'Verified' : 'Not verified') + '</span></button>';
    }
    h += '<div class="info-action" style="cursor:default">' + icon('timer') + 'Disappearing messages<span class="val">' + timerSelect(c) + '</span></div>' +
      '<label class="info-action">' + icon('pin') + 'Pin conversation<span class="switch"><input type="checkbox" data-info="pinconv"' + (c.pinned ? ' checked' : '') + '><span></span></span></label>' +
      '</div>';

    if (c.type === 'group') {
      h += '<div class="info-section"><h4>' + c.members.length + ' members</h4>' + c.members.map(function (id) {
        var u = user(id);
        return '<div class="member">' + userAvatar(u) + '<div><div class="member-name">' + esc(id === 'me' ? fullName(u) + ' (You)' : fullName(u)) +
          '</div><div class="member-sub">' + esc(u.callsign) + ' · ' + statusText(u.status) + '</div></div>' +
          ((c.admins || []).indexOf(id) !== -1 ? '<span class="role">Admin</span>' : '') + '</div>';
      }).join('') + '</div>';
    }

    var mediaCount = c.messages.filter(function (m) { return m.type === 'image' || m.type === 'file'; }).length;
    h += '<div class="info-section"><h4>Shared media &amp; files · ' + mediaCount + '</h4>' +
      (mediaCount ? '<div class="media-grid">' + new Array(Math.min(mediaCount + 2, 6)).join('<div></div>') + '<div></div></div>' : '<p style="color:var(--text-3);font-size:13px">No media shared yet</p>') + '</div>';

    h += '<div class="info-section">' +
      '<button class="info-action" data-info="export">' + icon('file') + 'Export chat (local)</button>' +
      '<button class="info-action danger" data-info="clear">' + icon('trash') + 'Clear chat history</button>' +
      (c.type === 'group' ? '<button class="info-action danger" data-info="leave">' + icon('back') + 'Leave group</button>' : '') +
      '</div>';

    $('#infoBody').innerHTML = h;
  }
  function field(k, v) { return '<div class="info-field"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; }

  function infoAction(act, el) {
    var c = active(); if (!c) return;
    switch (act) {
      case 'call': startCall(c.type === 'direct' ? users[c.userId] : null, 'voice', c); break;
      case 'video': startCall(users[c.userId], 'video', c); break;
      case 'mute': c.muted = !c.muted; renderInfo(); renderList(); toast(icon(c.muted ? 'bell-off' : 'bell') + (c.muted ? 'Notifications muted' : 'Notifications on')); break;
      case 'search': openMsgSearch(); break;
      case 'safety': safetyModal(users[c.userId]); break;
      case 'pinconv': c.pinned = el.checked; renderList(); break;
      case 'timer':
        var v = parseInt(el.value, 10);
        c.disappearing = v;
        c.messages.push({ id: uid(), type: 'system', ts: Date.now(), text: 'You set disappearing messages to ' + timerLabel(v).toLowerCase() });
        renderChat(); renderList(); break;
      case 'export': exportChat(c); break;
      case 'clear':
        askConfirm({ title: 'Clear chat history?', message: 'All messages in “' + convTitle(c) + '” will be removed from this computer. This cannot be undone.', confirmLabel: 'Clear history', danger: true, icon: 'trash' })
          .then(function (ok) { if (ok) { c.messages = []; c.pinnedMsgId = null; renderChat(); renderList(); renderInfo(); } });
        break;
      case 'leave':
        askConfirm({ title: 'Leave “' + c.name + '”?', message: 'You will stop receiving messages from this group.', confirmLabel: 'Leave group', danger: true, icon: 'back' })
          .then(function (ok) {
            if (!ok) return;
            // D.conversations is shared with admin.js, so remove in place
            var i = D.conversations.indexOf(c); if (i !== -1) D.conversations.splice(i, 1);
            closeConv(); toast('You left ' + esc(c.name));
          });
        break;
    }
  }

  function exportChat(c) {
    var lines = c.messages.map(function (m) {
      if (m.type === 'system') return '[' + new Date(m.ts).toISOString() + '] * ' + m.text;
      return '[' + new Date(m.ts).toISOString() + '] ' + fullName(user(m.from)) + (m.prec ? ' (' + m.prec.toUpperCase() + ')' : '') + ': ' +
        (m.text || (m.file ? '[file] ' + m.file.name : m.loc ? '[location] ' + m.loc : '[attachment]'));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'syntra-' + convTitle(c).replace(/\W+/g, '_') + '.txt';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------------------------------------------------------
  // In-conversation search
  // ---------------------------------------------------------
  function openMsgSearch() {
    $('#msgSearchBar').classList.remove('hidden');
    $('#msgSearchInput').focus();
    $('#msgSearchInput').select();
  }
  function closeMsgSearch() {
    $('#msgSearchBar').classList.add('hidden');
    $('#msgSearchInput').value = '';
    state.msgSearch = '';
    renderMessages(true);
  }

  // ---------------------------------------------------------
  // Modals
  // ---------------------------------------------------------
  function openModal(title, body, foot, cls) {
    var m = $('#modal');
    m.className = 'modal' + (cls ? ' ' + cls : '');
    m.innerHTML = '<div class="modal-head"><h3>' + title + '</h3><button class="icon-btn sm" data-close>' + icon('x') + '</button></div>' +
      body + (foot ? '<div class="modal-foot">' + foot + '</div>' : '');
    showEl($('#modalBackdrop'));
    var f = m.querySelector('input:not([type=checkbox]):not([type=range]):not([type=color]), textarea');
    if (f && !isNarrow()) setTimeout(function () { f.focus(); }, 30);
    return m;
  }
  function closeModal() {
    var bd = $('#modalBackdrop');
    if (bd.classList.contains('closing')) return;
    hideEl(bd, 180, function () { $('#modal').innerHTML = ''; });
  }
  function modalOpen() { var bd = $('#modalBackdrop'); return !bd.classList.contains('hidden') && !bd.classList.contains('closing'); }

  // New message / group
  function newChatModal() {
    var list = Object.keys(users).map(function (k) { return users[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var m = openModal('New message',
      '<div class="modal-body">' +
        '<div class="field"><input type="text" id="ncSearch" placeholder="Search name, unit, or callsign"></div>' +
        '<div class="field hidden" id="ncGroupField"><label>Group name</label><input type="text" id="ncGroupName" placeholder="e.g. Retrans Team Hill 402"></div>' +
        '<div class="pick-list" id="ncList">' + list.map(function (u) {
          return '<label class="pick" data-q="' + esc((fullName(u) + ' ' + u.unit + ' ' + u.callsign).toLowerCase()) + '">' + userAvatar(u, 'sm') +
            '<div><div class="member-name">' + esc(fullName(u)) + '</div><div class="member-sub">' + esc(u.callsign) + ' · ' + esc(u.unit) + '</div></div>' +
            '<input type="checkbox" value="' + u.id + '"></label>';
        }).join('') + '</div>' +
      '</div>',
      '<button class="btn" data-close>Cancel</button><button class="btn primary" id="ncGo" disabled>Start chat</button>');

    var update = function () {
      var sel = $$('#ncList input:checked', m);
      $('#ncGroupField', m).classList.toggle('hidden', sel.length < 2);
      var go = $('#ncGo', m);
      go.disabled = !sel.length;
      go.textContent = sel.length > 1 ? 'Create group (' + (sel.length + 1) + ')' : 'Start chat';
    };
    $('#ncSearch', m).addEventListener('input', function () {
      var q = this.value.toLowerCase();
      $$('.pick', m).forEach(function (p) { p.classList.toggle('hidden', p.dataset.q.indexOf(q) === -1); });
    });
    $('#ncList', m).addEventListener('change', update);
    $('#ncGo', m).addEventListener('click', function () {
      var ids = $$('#ncList input:checked', m).map(function (i) { return i.value; });
      if (ids.length === 1) { closeModal(); openDirect(ids[0]); return; }
      var name = $('#ncGroupName', m).value.trim() || ids.map(function (id) { return users[id].name.split(' ').pop(); }).join(', ');
      var c = {
        id: 'c' + Date.now(), type: 'group', name: name, members: ['me'].concat(ids), admins: ['me'],
        unread: 0, pinned: false, muted: false, disappearing: state.settings.defaultTimer, color: '#4a6b5c',
        messages: [{ id: uid(), type: 'system', ts: Date.now(), text: 'You created the group “' + name + '”' }]
      };
      D.conversations.unshift(c);
      closeModal(); setView('chats'); openConv(c.id);
    });
  }

  function openDirect(userId) {
    var c = D.conversations.filter(function (x) { return x.type === 'direct' && x.userId === userId; })[0];
    if (!c) {
      c = { id: 'c' + Date.now(), type: 'direct', userId: userId, unread: 0, pinned: false, muted: false, disappearing: state.settings.defaultTimer, messages: [] };
      D.conversations.unshift(c);
    }
    setView('chats');
    openConv(c.id);
  }

  // Forward
  function forwardModal(msg) {
    var convs = D.conversations.slice().sort(function (a, b) { return lastTs(b) - lastTs(a); });
    var m = openModal('Forward message',
      '<div class="modal-body"><div class="pick-list">' + convs.map(function (c) {
        return '<label class="pick">' + avatarHTML(c, 'sm') + '<div class="member-name">' + esc(convTitle(c)) + '</div><input type="checkbox" value="' + c.id + '"></label>';
      }).join('') + '</div></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn primary" id="fwGo">Forward</button>');
    $('#fwGo', m).addEventListener('click', function () {
      var ids = $$('input:checked', m).map(function (i) { return i.value; });
      if (!ids.length) return;
      ids.forEach(function (id) {
        var c = getConv(id);
        var copy = { id: uid(), from: 'me', ts: Date.now(), text: msg.text, type: msg.type, file: msg.file, loc: msg.loc, src: msg.src, status: 'pending' };
        c.messages.push(copy);
        simulateDelivery(c, copy);
      });
      closeModal(); renderList(); renderMessages(true);
      toast(icon('forward') + 'Forwarded to ' + ids.length + ' chat' + (ids.length > 1 ? 's' : ''));
    });
  }

  // Message info
  function msgInfoModal(c, m) {
    var base = m.ts;
    var rows = field('Sent', new Date(base).toLocaleString()) +
      field('Precedence', PREC[m.prec || 'routine'].label) +
      field('Encryption', 'End-to-end (Double Ratchet)');
    if (m.from === 'me') {
      rows += field('Delivered', m.status === 'delivered' || m.status === 'read' ? new Date(base + 900).toLocaleString() : '—');
      rows += field('Read', m.status === 'read' ? new Date(base + 2000).toLocaleString() : (state.settings.readReceipts ? '—' : 'Read receipts off'));
    } else {
      rows += field('From', fullName(user(m.from)));
    }
    if (c.disappearing) rows += field('Disappears', timerLabel(c.disappearing) + ' after read');
    openModal('Message info', '<div class="modal-body">' + rows + '</div>', '<button class="btn primary" data-close>Done</button>');
  }

  // Safety number
  function safetyModal(u) {
    var seed = 0; for (var i = 0; i < u.id.length; i++) seed += u.id.charCodeAt(i) * 97;
    var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var nums = []; for (var j = 0; j < 12; j++) nums.push(String(Math.floor(rnd() * 90000) + 10000));
    var cells = '';
    for (var y = 0; y < 21; y++) for (var x = 0; x < 21; x++) {
      var finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      var on;
      if (finder) {
        var fx = x > 13 ? x - 14 : x, fy = y > 13 ? y - 14 : y;
        on = fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5);
      } else on = rnd() > .5;
      cells += '<i class="' + (on ? '' : 'w') + '"></i>';
    }
    var m = openModal('Safety number',
      '<div class="modal-body safety">' +
        '<div class="safety-qr">' + cells + '</div>' +
        '<div class="safety-num">' + nums.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div>' +
        '<p>To verify end-to-end encryption with <b>' + esc(fullName(u)) + '</b>, compare the numbers above with their device, or scan the code in person.</p>' +
      '</div>',
      '<button class="btn" data-close>Close</button><button class="btn primary" id="svGo">' + (u.verified ? 'Clear verification' : 'Mark as verified') + '</button>');
    $('#svGo', m).addEventListener('click', function () {
      u.verified = !u.verified;
      closeModal(); renderChat(); renderList(); renderInfo();
      toast(icon('shield') + (u.verified ? fullName(u) + ' verified' : 'Verification cleared'));
    });
  }

  // Profile
  function profileModal() {
    var m = openModal('My profile',
      '<div class="modal-body">' +
        '<div class="info-hero" style="padding-top:4px">' + userAvatar(me, 'lg') + '<h2>' + esc(fullName(me)) + '</h2><p>' + esc(me.role) + ' · ' + esc(me.callsign) + '</p>' +
          '<span class="role-badge role-' + session.role + '">' + roleLabel() + '</span></div>' +
        '<div class="set-row"><div class="set-label"><b>Status</b><small>Visible to your contacts</small></div>' +
          '<select id="pfStatus">' + ['online', 'away', 'dnd', 'offline'].map(function (s) {
            return '<option value="' + s + '"' + (me.status === s ? ' selected' : '') + '>' + statusText(s) + '</option>';
          }).join('') + '</select></div>' +
        field('Unit', me.unit) + field('Callsign', me.callsign) + field('Username', me.username) + field('Account type', roleLabel()) +
      '</div>',
      '<button class="btn danger" id="pfSignOut" style="margin-right:auto">' + icon('logout') + 'Sign out</button><button class="btn primary" data-close>Done</button>');
    $('#pfSignOut', m).addEventListener('click', signOut);
    $('#pfStatus', m).addEventListener('change', function () {
      me.status = this.value;
      $('#mePresence').className = 'presence ' + me.status;
      toast('Status set to ' + statusText(me.status));
    });
  }

  // Settings — generated from the schema in settings.js
  function settingsModal(section) {
    section = section || 'appearance';
    var m = openModal('Settings',
      '<div class="settings"><nav class="settings-nav">' + S.SECTIONS.map(function (s) {
        return '<button data-tab="' + s.id + '">' + icon(s.icon) + '<span>' + s.label + '</span></button>';
      }).join('') + '<button id="setSignOut" class="nav-signout">' + icon('logout') + '<span>Sign out</span></button>' +
      '</nav><div class="settings-pane" id="setPane"></div></div>', '', 'wide settings-modal');
    var current = section;

    function control(e) {
      var v = S.get(e.key), dis = S.isLocked(e.key) ? ' disabled' : '';
      switch (e.type) {
        case 'toggle':
          return '<label class="switch"><input type="checkbox" data-key="' + e.key + '"' + (v ? ' checked' : '') + dis + '><span></span></label>';
        case 'segment':
          return '<div class="seg" data-key="' + e.key + '">' + e.options.map(function (o) {
            return '<button data-v="' + o[0] + '" class="' + (String(v) === String(o[0]) ? 'active' : '') + '"' + dis + '>' + o[1] + '</button>';
          }).join('') + '</div>';
        case 'select':
          return '<select data-key="' + e.key + '"' + dis + '>' + e.options.map(function (o) {
            return '<option value="' + o[0] + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>';
        case 'range':
          return '<div class="range-wrap"><input type="range" class="range" data-key="' + e.key + '" min="' + e.min + '" max="' + e.max +
            '" step="' + e.step + '" value="' + v + '"' + dis + '><output>' + v + (e.unit || '') + '</output></div>';
        case 'accent':
          var custom = !ACCENTS[v];
          return '<div class="accent-swatches">' + Object.keys(ACCENTS).map(function (k) {
            return '<button data-accent="' + k + '" title="' + ACCENTS[k].label + '" class="' + (v === k ? 'active' : '') + '" style="background:' + ACCENTS[k].light + '"></button>';
          }).join('') + '<label class="swatch-custom' + (custom ? ' active' : '') + '" title="Custom color"' + (custom ? ' style="background:' + v + '"' : '') + '>' +
            '<input type="color" data-color="accent" value="' + (custom ? v : ACCENTS[v].light) + '"></label></div>';
        case 'wallpaper':
          return '<div class="wp-tiles">' + e.options.map(function (o) {
            return '<button class="wp-tile wp-' + o[0] + (v === o[0] ? ' active' : '') + '" data-wp="' + o[0] + '" title="' + o[1] + '"><span>' + o[1] + '</span></button>';
          }).join('') + '</div>';
      }
      return '';
    }

    function rowHTML(e) {
      var wide = e.type === 'wallpaper' || e.type === 'accent';
      var locked = S.isLocked(e.key);
      var hint = locked
        ? (can('policy') ? 'Enforced for everyone. Change it in Admin console › Security policy.' : 'Set by your Super Admin for all users.')
        : e.hint;
      return '<div class="set-row' + (wide ? ' wide' : '') + (locked ? ' locked' : '') + '"><div class="set-label"><b>' + e.label + (locked ? ' <span class="lock-tag">' + icon('lock') + 'Managed</span>' : '') + '</b>' +
        (hint ? '<small>' + hint + '</small>' : '') + '</div>' + control(e) + '</div>';
    }

    function previewHTML() {
      var t1 = Date.now() - 120000, t2 = Date.now() - 60000;
      return '<div class="set-preview"><div class="set-preview-chat">' +
        '<div class="msg-row in first last">' + userAvatar(users.u1) + '<div class="msg-col"><div class="bubble">' +
          (state.settings.messageLayout === 'list' ? '<div class="b-sender" style="--sc:' + users.u1.color + '">CPT Jordan Hale<small>' + fmtTime(t1) + '</small></div>' : '') +
          '<span class="b-text">Radio check, how copy?</span><span class="b-meta">' + fmtTime(t1) + '</span></div></div></div>' +
        '<div class="msg-row out first last">' + (state.settings.messageLayout === 'list' ? userAvatar(me) : '') + '<div class="msg-col"><div class="bubble">' +
          (state.settings.messageLayout === 'list' ? '<div class="b-sender" style="--sc:' + me.color + '">SSG Alex Morgan<small>' + fmtTime(t2) + '</small></div>' : '') +
          '<span class="b-text">Loud and clear. Over.</span><span class="b-meta">' + fmtTime(t2) + icon('check2', 'read') + '</span></div></div></div>' +
      '</div></div>';
    }

    function draw(sec) {
      current = sec;
      var h = '';
      if (sec === 'data') {
        h = '<h4>Backup</h4>' +
          '<div class="set-row"><div class="set-label"><b>Export settings</b><small>Save your preferences as a file to move them to another computer</small></div>' +
            '<button class="btn" id="setExport">' + icon('download') + 'Export</button></div>' +
          '<div class="set-row"><div class="set-label"><b>Import settings</b><small>Load a previously exported Syntra settings file</small></div>' +
            '<button class="btn" id="setImport">' + icon('upload') + 'Import</button></div>' +
          '<h4>Reset</h4>' +
          '<div class="set-row"><div class="set-label"><b>Reset all settings</b><small>Restore every preference to its default</small></div>' +
            '<button class="btn danger" id="setResetAll">' + icon('reset') + 'Reset</button></div>' +
          '<p class="set-note">Settings format v' + S.VERSION + ' · stored only on this device. Older settings files are upgraded automatically when imported.</p>';
      } else if (sec === 'about') {
        h = '<div class="info-hero">' + $('.rail-logo').innerHTML.replace('width="30" height="30"', 'width="64" height="64"') +
          '<h2>Syntra</h2><p>Secure messaging · Front-end prototype v0.3.0</p>' +
          '<p>Signed in as ' + esc(fullName(me)) + ' · ' + roleLabel() + '</p>' +
          '<button class="btn" data-guide="start" style="margin-top:10px">' + icon('book') + 'Open user guide</button></div>' +
          '<h4>Keyboard shortcuts</h4>' +
          [['Ctrl K', 'Search'], ['Ctrl N', 'New message'], ['Ctrl F', 'Search in conversation'], ['Ctrl D', 'Toggle dark mode'], ['Ctrl ,', 'Settings'], ['Ctrl L', 'Lock'], ['Ctrl 1–4', 'Switch section'], ['Alt ↑ / ↓', 'Previous / next chat'], ['Esc', 'Close panel / go back']].map(function (k) {
            return '<div class="info-field"><span>' + k[1] + '</span><span>' + k[0].split(' ').map(function (x) { return '<kbd>' + x + '</kbd>'; }).join('') + '</span></div>';
          }).join('');
      } else {
        var meta = S.SECTIONS.filter(function (s) { return s.id === sec; })[0];
        h = '<div class="set-head"><h4>' + meta.label + '</h4><button class="link-btn" id="setResetSec">' + icon('reset') + 'Reset section</button></div>';
        if (sec === 'appearance' || sec === 'layout') h += previewHTML();
        h += S.SCHEMA.filter(function (e) { return e.section === sec; }).map(rowHTML).join('');
        if (sec === 'classification') h += '<p class="set-note">Prototype only. In production this marking is set by the system administrator and locked for users.</p>';
        if (sec === 'privacy') h += '<div class="set-row"><div class="set-label"><b>Lock now</b><small>Shortcut: Ctrl+L</small></div><button class="btn" id="setLockNow">Lock</button></div>';
      }
      var pane = $('#setPane', m);
      pane.innerHTML = h;
      pane.classList.remove('swap'); void pane.offsetWidth; pane.classList.add('swap');
      $$('.settings-nav button', m).forEach(function (b) { b.classList.toggle('active', b.dataset.tab === sec); });
    }

    // Refresh only the preview (keeps focus on sliders while dragging)
    function refreshPreview() {
      var p = $('.set-preview', m);
      if (p) p.outerHTML = previewHTML();
    }

    m.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { draw(t.dataset.tab); return; }
      var sg = e.target.closest('.seg[data-key] button');
      if (sg) {
        S.set(sg.parentNode.dataset.key, sg.dataset.v);
        $$('button', sg.parentNode).forEach(function (b) { b.classList.toggle('active', b === sg); });
        refreshPreview(); return;
      }
      var ac = e.target.closest('[data-accent]');
      if (ac) { S.set('accent', ac.dataset.accent); draw(current); return; }
      var wp = e.target.closest('[data-wp]');
      if (wp) { S.set('wallpaper', wp.dataset.wp); $$('[data-wp]', m).forEach(function (b) { b.classList.toggle('active', b === wp); }); return; }
      var id = e.target.closest('button') && e.target.closest('button').id;
      if (id === 'setResetSec') { S.reset(current); draw(current); toast(icon('reset') + 'Section reset to defaults'); }
      else if (id === 'setResetAll') {
        askConfirm({ title: 'Reset all settings?', message: 'Every preference returns to its default. Settings managed by your Super Admin stay as they are.', confirmLabel: 'Reset', danger: true, icon: 'reset' })
          .then(function (ok) { if (ok) { S.reset(); draw(current); toast(icon('reset') + 'All settings reset'); } });
      }
      else if (id === 'setSignOut') signOut();
      else if (id === 'setExport') {
        var blob = new Blob([S.exportJSON()], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'syntra-settings.json'; a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast(icon('download') + 'Settings exported');
      }
      else if (id === 'setImport') {
        pickFile('application/json,.json', function (f) {
          f.text().then(function (txt) {
            var r = S.importJSON(txt);
            toast(r.ok ? icon('check') + 'Imported ' + r.count + ' settings' : icon('alert') + r.error);
            draw(current);
          });
        });
      }
      else if (id === 'setLockNow') { closeModal(); lock(); }
    });
    m.addEventListener('input', function (e) {
      var el = e.target;
      if (el.type === 'range' && el.dataset.key) {
        S.set(el.dataset.key, el.value);
        var en = S.entry(el.dataset.key);
        el.nextElementSibling.textContent = el.value + (en.unit || '');
      }
      if (el.dataset.color) {
        S.set('accent', el.value);
        var lbl = el.parentNode; lbl.style.background = el.value; lbl.classList.add('active');
        $$('[data-accent]', m).forEach(function (b) { b.classList.remove('active'); });
      }
    });
    m.addEventListener('change', function (e) {
      var el = e.target;
      if (!el.dataset.key || el.type === 'range') return;
      S.set(el.dataset.key, el.type === 'checkbox' ? el.checked : el.value);
      refreshPreview();
    });
    draw(section);
  }

  // ---------------------------------------------------------
  // Calls
  // ---------------------------------------------------------
  var callTimer = null, callStart = 0, callCtx = null;
  function startCall(u, kind, c) {
    var name = u ? fullName(u) : (c ? c.name : 'Call');
    callCtx = { userId: u ? u.id : null, kind: kind };
    var av = $('#callAvatar');
    if (u) { av.className = 'avatar xl'; av.style.setProperty('--av', u.color); av.innerHTML = initials(u.name); }
    else { av.className = 'avatar xl group'; av.style.setProperty('--av', c.color || '#55605a'); av.innerHTML = icon('group'); }
    $('#callName').textContent = name;
    $('#callStatus').textContent = (kind === 'video' ? 'Video calling…' : 'Calling…');
    $('#callMute').classList.remove('off');
    $('#callVideo').classList.toggle('off', kind !== 'video');
    showEl($('#callOverlay'));
    clearInterval(callTimer);
    setTimeout(function () { if (!$('#callOverlay').classList.contains('hidden') && !callStart) $('#callStatus').textContent = 'Ringing…'; }, 1200);
    setTimeout(function () {
      if ($('#callOverlay').classList.contains('hidden')) return;
      callStart = Date.now();
      callTimer = setInterval(function () {
        var s = Math.floor((Date.now() - callStart) / 1000);
        $('#callStatus').textContent = Math.floor(s / 60) + ':' + pad(s % 60);
      }, 500);
    }, 3200);
  }
  function endCall() {
    clearInterval(callTimer);
    var dur = callStart ? Math.floor((Date.now() - callStart) / 1000) : 0;
    if (callCtx && callCtx.userId) {
      D.calls.push({ userId: callCtx.userId, dir: 'out', kind: callCtx.kind, ts: Date.now(), duration: dur ? Math.floor(dur / 60) + ':' + pad(dur % 60) : null });
    }
    callStart = 0; callCtx = null;
    hideEl($('#callOverlay'), 250);
    toast(icon('phone') + 'Call ended');
    if (state.view === 'calls') renderList();
  }

  // ---------------------------------------------------------
  // Screen lock
  // ---------------------------------------------------------
  var idleTimer = null;
  function lock() {
    closeCtx(); closePopovers();
    showEl($('#lockScreen'));
    var inp = $('#pinInput'); inp.value = ''; updatePin();
    setTimeout(function () { inp.focus(); }, 30);
  }
  function updatePin() {
    var n = $('#pinInput').value.length;
    $$('#pinDots i').forEach(function (d, i) { d.classList.toggle('on', i < n); });
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!session) return;
    var mins = state.settings.autoLock;
    if (mins > 0) idleTimer = setTimeout(lock, mins * 60000);
  }

  // ---------------------------------------------------------
  // Views
  // ---------------------------------------------------------
  function setView(v) {
    if (v === 'admin' && !can('console')) return;
    if (state.view !== v) state.animateList = true;
    var wasAdmin = state.view === 'admin';
    state.view = v;
    state.search = '';
    $('#searchInput').value = '';
    renderList();
    if (v === 'admin') {
      if (!isNarrow()) window.SyntraAdmin.open(window.SyntraAdmin.current() || 'overview');
    } else if (wasAdmin) {
      leaveAdminPane();
    }
  }

  // Return the main area to the chat (or empty state) after the admin console
  function leaveAdminPane() {
    if (window.SyntraAdmin) window.SyntraAdmin.close();
    $('#adminPane').classList.add('hidden');
    var hasChat = !!active();
    $('#chatInner').classList.toggle('hidden', !hasChat);
    $('#emptyState').classList.toggle('hidden', hasChat);
    $('#app').classList.toggle('chat-open', hasChat);
  }

  function cycleConv(dir) {
    var items = $$('#convList .conv[data-id]');
    if (!items.length) return;
    var idx = items.findIndex(function (li) { return li.dataset.id === state.activeId; });
    var next = items[(idx + dir + items.length) % items.length];
    if (next) openConv(next.dataset.id);
  }

  // ---------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------
  function closePopovers(except) {
    $$('.popover').forEach(function (p) { if (p !== except) p.classList.add('hidden'); });
  }

  function bind() {
    // Rail
    $$('.rail-btn[data-view]').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#helpBtn').addEventListener('click', function () { openGuide('start'); });

    // Material/Telegram-style ripple on press
    document.addEventListener('pointerdown', function (e) {
      if (root.dataset.motion !== 'full' || e.button !== 0) return;
      var t = e.target.closest('.conv, .btn, .chip, .role-opt, .send-btn, .stat, .settings-nav button, .wp-tile');
      if (!t || t.disabled) return;
      var r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
      var s = document.createElement('span');
      s.className = 'ripple';
      s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
      t.appendChild(s);
      setTimeout(function () { s.remove(); }, 650);
    }, { passive: true });
    // Any element with data-guide="section" opens the user guide there
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-guide]');
      if (g) { e.preventDefault(); closePopovers(); openGuide(g.dataset.guide); }
    });
    bindLogin();
    $('#lockBtn').addEventListener('click', lock);
    $('#settingsBtn').addEventListener('click', function () { settingsModal(); });
    $('#meBtn').addEventListener('click', profileModal);
    $('#newChatBtn').addEventListener('click', newChatModal);

    // Search & filters
    $('#searchInput').addEventListener('input', function () { state.search = this.value; renderList(); });
    $('#searchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { this.value = ''; state.search = ''; renderList(); this.blur(); }
      if (e.key === 'Enter') { var f = $('#convList .conv'); if (f) f.click(); }
    });
    $('#filterChips').addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      state.filter = c.dataset.filter;
      state.animateList = true;
      $$('.chip', this).forEach(function (x) { x.classList.toggle('active', x === c); });
      renderList();
    });

    // List clicks
    $('#convList').addEventListener('click', function (e) {
      var li = e.target.closest('.conv'); if (!li) return;
      if (li.dataset.admin) window.SyntraAdmin.open(li.dataset.admin);
      else if (li.dataset.id) openConv(li.dataset.id);
      else if (li.dataset.call !== undefined) startCall(users[li.dataset.user], li.dataset.kind);
      else if (li.dataset.user) openDirect(li.dataset.user);
      else if (li.dataset.savedConv) {
        var c = getConv(li.dataset.savedConv);
        state.view = c.type === 'channel' ? 'channels' : 'chats';
        openConv(li.dataset.savedConv, { highlight: li.dataset.savedMsg });
      }
    });

    // Header
    $('#backBtn').addEventListener('click', closeConv);
    $('#chatIdBtn').addEventListener('click', function () { toggleInfo(); });
    $('#infoBtn').addEventListener('click', function () { toggleInfo(); });
    $('#infoClose').addEventListener('click', function () { toggleInfo(false); });
    $('#voiceCallBtn').addEventListener('click', function () { var c = active(); startCall(c.type === 'direct' ? users[c.userId] : null, 'voice', c); });
    $('#videoCallBtn').addEventListener('click', function () { var c = active(); startCall(c.type === 'direct' ? users[c.userId] : null, 'video', c); });
    $('#msgSearchBtn').addEventListener('click', openMsgSearch);
    $('#msgSearchClose').addEventListener('click', closeMsgSearch);
    $('#msgSearchInput').addEventListener('input', function () { state.msgSearch = this.value.trim(); renderMessages(); });
    $('#msgSearchInput').addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMsgSearch(); });
    $('#pinnedBar').addEventListener('click', function (e) {
      var c = active();
      if (e.target.closest('#unpinBtn')) { c.pinnedMsgId = null; renderChat(); return; }
      highlightMsg(c.pinnedMsgId);
    });

    // Messages
    var box = $('#messages');
    box.addEventListener('scroll', updateJump);
    $('#jumpDown').addEventListener('click', function () { box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); });
    box.addEventListener('click', function (e) {
      var row = e.target.closest('.msg-row');
      var j = e.target.closest('[data-jump]');
      if (j) { highlightMsg(j.dataset.jump); return; }
      var rp = e.target.closest('[data-react]');
      if (rp && row) { msgAction('react', row.dataset.id, rp.dataset.react); return; }
      var hv = e.target.closest('[data-hover]');
      if (hv && row) {
        var r = hv.getBoundingClientRect();
        if (hv.dataset.hover === 'reply') msgAction('reply', row.dataset.id);
        else openCtx(r.left, r.bottom + 4, row.dataset.id);
        e.stopPropagation();
      }
    });
    box.addEventListener('contextmenu', function (e) {
      var row = e.target.closest('.msg-row'); if (!row) return;
      clearTimeout(longPressT);
      e.preventDefault(); openCtx(e.clientX, e.clientY, row.dataset.id);
    });
    // Touch: long-press a message for the action menu
    var longPressT = null;
    box.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var row = e.target.closest('.msg-row'); if (!row) return;
      var x = e.clientX, y = e.clientY;
      longPressT = setTimeout(function () {
        suppressClick = true;
        openCtx(x, y, row.dataset.id);
        if (navigator.vibrate) navigator.vibrate(12);
      }, 450);
    });
    ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
      box.addEventListener(ev, function () { clearTimeout(longPressT); });
    });

    // Sidebar resize handle
    var rz = $('#sidebarResizer');
    rz.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      rz.setPointerCapture(e.pointerId);
      var startX = e.clientX, startW = $('.sidebar').getBoundingClientRect().width, w = startW;
      document.body.classList.add('resizing');
      var move = function (ev) {
        var en = S.entry('sidebarWidth');
        w = Math.max(en.min, Math.min(en.max, startW + ev.clientX - startX));
        root.style.setProperty('--sidebar-w', w + 'px');
      };
      var up = function () {
        rz.removeEventListener('pointermove', move);
        rz.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing');
        S.set('sidebarWidth', Math.round(w));
      };
      rz.addEventListener('pointermove', move);
      rz.addEventListener('pointerup', up);
    });
    rz.addEventListener('dblclick', function () { S.set('sidebarWidth', S.entry('sidebarWidth').default); });
    // Double-click reacts 👍; stop the browser from selecting a word at the same time
    box.addEventListener('mousedown', function (e) {
      if (e.detail > 1 && e.target.closest('.bubble')) e.preventDefault();
    });
    box.addEventListener('dblclick', function (e) {
      var row = e.target.closest('.msg-row'); if (!row || e.target.closest('.reactions, .msg-hover')) return;
      var sel = window.getSelection(); if (sel) sel.removeAllRanges();
      msgAction('react', row.dataset.id, '👍');
    });

    // Context menu
    $('#ctxMenu').addEventListener('click', function (e) {
      var id = ctxMsgId;
      var r = e.target.closest('[data-ctx-react]');
      var a = e.target.closest('[data-act]');
      closeCtx();
      if (r) msgAction('react', id, r.dataset.ctxReact);
      else if (a) msgAction(a.dataset.act, id);
    });

    // Composer
    var ta = $('#msgInput');
    ta.addEventListener('input', autoGrow);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && state.settings.enterToSend) { e.preventDefault(); sendMessage(); }
      else if (e.key === 'Enter' && e.ctrlKey && !state.settings.enterToSend) { e.preventDefault(); sendMessage(); }
      else if (e.key === 'ArrowUp' && !ta.value) {
        // Reply to the last incoming message
        var c = active(); if (!c) return;
        var lastIn = c.messages.slice().reverse().filter(function (m) { return m.from && m.from !== 'me'; })[0];
        if (lastIn) { e.preventDefault(); state.replyTo = lastIn.id; renderReply(); }
      }
    });
    $('#sendBtn').addEventListener('click', sendMessage);
    $('#replyCancel').addEventListener('click', function () { state.replyTo = null; renderReply(); });

    // Popovers
    var togglePop = function (btnSel, popSel) {
      $(btnSel).addEventListener('click', function (e) {
        e.stopPropagation();
        var p = $(popSel); closePopovers(p); p.classList.toggle('hidden');
      });
    };
    togglePop('#attachBtn', '#attachMenu');
    togglePop('#emojiBtn', '#emojiPicker');
    togglePop('#precBtn', '#precMenu');
    $('#emojiPicker').innerHTML = EMOJIS.map(function (e) { return '<button>' + e + '</button>'; }).join('');
    $('#emojiPicker').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      var s = ta.selectionStart, en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + b.textContent + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + b.textContent.length;
      ta.focus(); autoGrow();
    });
    $('#precMenu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-prec]'); if (!b) return;
      setPrec(b.dataset.prec); closePopovers(); ta.focus();
    });
    $('#attachMenu').addEventListener('click', function (e) {
      var b = e.target.closest('[data-attach]'); if (!b) return;
      closePopovers(); attach(b.dataset.attach);
    });

    // Info panel (delegated)
    $('#infoBody').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-info]'); if (b) infoAction(b.dataset.info, b);
    });
    $('#infoBody').addEventListener('change', function (e) {
      var el = e.target.closest('[data-info]'); if (el) infoAction(el.dataset.info, el);
    });

    // Modal
    $('#modalBackdrop').addEventListener('mousedown', function (e) { if (e.target === this) closeModal(); });
    $('#modal').addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });

    // Call
    $('#callEnd').addEventListener('click', endCall);
    $('#callMute').addEventListener('click', function () { this.classList.toggle('off'); });
    $('#callVideo').addEventListener('click', function () { this.classList.toggle('off'); });

    // Lock
    $('#pinInput').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 4);
      updatePin();
      if (this.value.length === 4) {
        $('#pinInput').blur();
        setTimeout(function () { hideEl($('#lockScreen'), 300); resetIdle(); toast(icon('lock') + 'Unlocked'); }, 180);
      }
    });
    $('#lockScreen').addEventListener('click', function (e) {
      if (e.target.closest('#lockSignOut')) { signOut(); return; }
      $('#pinInput').focus();
    });

    // Global
    var suppressClick = false;
    document.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; return; }
      if (!e.target.closest('.popover')) closePopovers();
      if (!e.target.closest('#ctxMenu')) closeCtx();
    });
    window.addEventListener('resize', closeCtx);
    ['mousemove', 'keydown', 'mousedown'].forEach(function (ev) { document.addEventListener(ev, resetIdle, { passive: true }); });

    window.addEventListener('online', netStatus);
    window.addEventListener('offline', netStatus);

    document.addEventListener('keydown', function (e) {
      var locked = !$('#lockScreen').classList.contains('hidden');
      if (locked) return;
      var mod = e.ctrlKey || e.metaKey;
      var k = e.key.toLowerCase();
      if (e.key === 'F1') { e.preventDefault(); openGuide('start'); return; }
      if (!session) { if (e.key === 'Escape' && modalOpen()) closeModal(); return; }
      if (mod && k === '5' && can('console')) { e.preventDefault(); setView('admin'); }
      else if (mod && k === 'k') { e.preventDefault(); $('#searchInput').focus(); $('#searchInput').select(); }
      else if (mod && k === 'n') { e.preventDefault(); newChatModal(); }
      else if (mod && k === 'l') { e.preventDefault(); lock(); }
      else if (mod && k === 'd') { e.preventDefault(); toggleTheme(); }
      else if (mod && k === ',') { e.preventDefault(); settingsModal(); }
      else if (mod && k === 'f' && active()) { e.preventDefault(); openMsgSearch(); }
      else if (mod && /^[1-4]$/.test(k)) { e.preventDefault(); setView(['chats', 'channels', 'contacts', 'calls'][+k - 1]); }
      else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); cycleConv(e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Escape') {
        if (!$('#ctxMenu').classList.contains('hidden')) closeCtx();
        else if ($$('.popover:not(.hidden)').length) closePopovers();
        else if (modalOpen()) closeModal();
        else if (!$('#callOverlay').classList.contains('hidden')) endCall();
        else if (state.replyTo) { state.replyTo = null; renderReply(); }
        else if (!$('#infoPanel').classList.contains('hidden')) toggleInfo(false);
        else if (isNarrow() && !$('#adminPane').classList.contains('hidden')) leaveAdminPane();
        else if (isNarrow() && state.activeId) closeConv();
      }
    });
  }

  function netStatus() {
    var el = $('#netStatus');
    var on = navigator.onLine;
    el.classList.toggle('offline', !on);
    el.lastChild.textContent = on ? 'Connected' : 'Offline — messages will queue';
  }

  // ---------------------------------------------------------
  // Simulated incoming activity (demo only)
  // ---------------------------------------------------------
  function simulateIncoming() {
    setTimeout(function () {
      var c = getConv('c2'); if (!c) return;
      state.typing[c.id] = 'u4';
      renderList(); refreshIfActive(c, true);
      setTimeout(function () {
        delete state.typing[c.id];
        var m = { id: uid(), from: 'u4', ts: Date.now(), text: 'Retrans site on Hill 402 is up. Southern net restored.' };
        c.messages.push(m);
        if (c.id === state.activeId) state.fresh[m.id] = true;
        if (c.id !== state.activeId) { c.unread++; if (state.settings.notifications && !c.muted) notify(c, m); }
        renderList(); refreshIfActive(c);
      }, 3500);
    }, 12000);
  }

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  // Loading screen. Steps are simulated; with a backend each step maps to a real task
  function runSplash(done) {
    var splash = $('#splash');
    splash.classList.remove('done', 'hidden');
    var steps = ['Verifying credentials…', 'Verifying device keys…', 'Establishing secure channel…', 'Syncing conversations…', 'Ready'];
    var stepMs = motionMs(320), i = 0;
    (function next() {
      $('#splashStatus').textContent = steps[i];
      $('#splashBar').style.width = ((i + 1) / steps.length * 100) + '%';
      i++;
      if (i < steps.length) setTimeout(next, stepMs);
      else setTimeout(function () {
        splash.classList.add('done');
        document.body.classList.remove('loading');
        if (done) done();
        setTimeout(function () { splash.classList.add('hidden'); }, motionMs(600));
      }, stepMs);
    })();
  }

  function onSettingChange(key) {
    applyAppearance();
    applyAttachPolicy();
    var all = key === '*';
    if (active() && (all || ['timeFormat', 'messageLayout', 'showAvatars', 'readReceipts', 'typingIndicators'].indexOf(key) !== -1)) {
      renderMessages(true); renderChatSub();
    }
    if (all || key === 'timeFormat') renderList();
    if (all || key === 'autoLock') resetIdle();
    if (window.SyntraAdmin) window.SyntraAdmin.refresh();
  }

  // ---------------------------------------------------------
  // Sign-in (demo: no real authentication)
  // ---------------------------------------------------------
  var loginRole = 'user';
  function pickRole(r, focus) {
    loginRole = r;
    $$('.role-opt').forEach(function (b) {
      var on = b.dataset.role === r;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    $('#loginUser').value = D.personas[r].username;
    $('#loginPass').value = '';
    $('#loginError').classList.add('hidden');
    if (focus) $('#loginPass').focus();
  }

  function loginError(msg) {
    var el = $('#loginError');
    el.textContent = msg;
    el.classList.remove('hidden');
    var card = $('.login-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }

  function bindLogin() {
    var picker = $('.role-picker');
    picker.addEventListener('click', function (e) {
      var b = e.target.closest('.role-opt'); if (b) pickRole(b.dataset.role, true);
    });
    // Arrow keys move between roles (radio group behaviour)
    picker.addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) === -1) return;
      e.preventDefault();
      var order = ['superadmin', 'admin', 'user'];
      var i = order.indexOf(loginRole) + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
      pickRole(order[(i + 3) % 3]);
      $('.role-opt.active').focus();
    });
    $('#passToggle').addEventListener('click', function () {
      var inp = $('#loginPass'), show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      this.title = show ? 'Hide password' : 'Show password';
      this.classList.toggle('on', show);
    });
    $('#cacBtn').addEventListener('click', function () {
      toast(icon('card') + 'Smart-card sign-in will be available with the backend');
    });
    $('#loginGuide').addEventListener('click', function () { openGuide('start'); });
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = $('#loginUser').value.trim(), p = $('#loginPass').value;
      if (!u) { loginError('Enter your username or DoD ID.'); $('#loginUser').focus(); return; }
      if (!p) { loginError('Enter your password.'); $('#loginPass').focus(); return; }
      $('#loginError').classList.add('hidden');
      var btn = $('#loginSubmit');
      btn.classList.add('loading'); btn.disabled = true;
      setTimeout(function () {
        btn.classList.remove('loading'); btn.disabled = false;
        signIn({ role: loginRole, username: u, remember: $('#loginRemember').checked });
      }, motionMs(700) || 50);
    });
    pickRole('user');
  }

  function showLogin() {
    showEl($('#login'));
    if (!isNarrow()) setTimeout(function () { $('#loginPass').focus(); }, 300);
  }

  function signIn(s) {
    session = s;
    saveSession(s);
    hideEl($('#login'), 300);
    startApp();
  }

  function signOut() {
    askConfirm({ title: 'Sign out of Syntra?', message: 'You will need your credentials to sign in again on this computer.', confirmLabel: 'Sign out', danger: true, icon: 'logout' })
      .then(function (ok) {
        if (!ok) return;
        clearSession();
        document.body.classList.add('signing-out');
        setTimeout(function () { location.reload(); }, motionMs(250));
      });
  }

  function startApp() {
    applyPersona();
    applyAttachPolicy();
    state.view = 'chats';
    renderList();
    runSplash(function () {
      state.animateList = true; renderList();
      toast(icon('shield') + 'Signed in as ' + esc(roleLabel()));
    });
    resetIdle();
    simulateIncoming();
  }

  function openGuide(section) {
    if (window.SyntraGuide) window.SyntraGuide.open(section);
  }

  function init() {
    applyAppearance();
    S.onChange(onSettingChange);
    $('#mePresence').className = 'presence ' + me.status;
    setPrec('routine');
    bind();
    netStatus();
    var s = loadSession();
    if (s) { session = s; startApp(); }
    else {
      var sp = $('#splash');
      sp.classList.add('done');
      setTimeout(function () { sp.classList.add('hidden'); }, motionMs(500));
      showLogin();
    }
  }

  // Shared helpers for the admin console and user guide modules
  window.Syntra = {
    $: $, $$: $$, esc: esc, icon: icon, toast: toast, uid: uid, confirm: askConfirm, morph: morph,
    openModal: openModal, closeModal: closeModal, showEl: showEl, hideEl: hideEl, motionMs: motionMs, isNarrow: isNarrow,
    userAvatar: userAvatar, avatarHTML: avatarHTML, initials: initials, fullName: fullName, shortName: shortName,
    fmtTime: fmtTime, fmtListTime: fmtListTime, fmtDay: fmtDay,
    can: can, roleLabel: roleLabel, getSession: function () { return session; }, ROLES: ROLES, PREC: PREC,
    state: state, S: S, D: D, me: me, users: users, user: user, getConv: getConv, convTitle: convTitle, findMsg: findMsg,
    renderList: renderList, openConv: openConv, setView: setView, leaveAdminPane: leaveAdminPane, pickFile: pickFile
  };

  init();
})();
