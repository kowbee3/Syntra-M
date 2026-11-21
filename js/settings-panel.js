/* =========================================================
   Syntra — Settings column + main menu (Telegram-style)
   ---------------------------------------------------------
   Settings open as a column over the chat list with pages that
   slide in from the right. Pages are plain functions in PAGES;
   rows are built with the helpers below and all controls write
   through SyntraSettings (S.set), so validation, saving and
   admin-enforced policy all keep working.
   ========================================================= */

(function () {
  'use strict';

  var X = window.Syntra;
  var S = X.S, $ = X.$, $$ = X.$$, esc = X.esc, icon = X.icon;
  var root = document.documentElement;
  var panel = $('#settingsPanel');
  var stack = [];          // [{ id, scroll }]
  var isOpen = false;

  // Demo data that only lives in this panel
  var sessions = [
    { id: 'ss1', name: 'Syntra Desktop 0.4', device: 'Windows 11 · LT-4471', place: 'Bldg 210', last: Date.now() - 2 * 3600000 }
  ];
  var storage = { media: 42.3, files: 18.1, cache: 6.4 };

  // ---------------------------------------------------------
  // Row helpers
  // ---------------------------------------------------------
  function ico(name, color) { return '<span class="sp-ico" style="--c:' + color + '">' + icon(name) + '</span>'; }
  function lockTag(key) { return S.isLocked(key) ? ' <span class="lock-tag">' + icon('lock') + 'Managed</span>' : ''; }
  function label(text, sub) { return '<span class="sp-label">' + text + (sub ? '<small>' + sub + '</small>' : '') + '</span>'; }

  function navRow(page, text, ic, color, value, sub) {
    return '<button class="sp-row" data-nav="' + page + '" data-label="' + esc(text) + '">' + (ic ? ico(ic, color) : '') +
      label(esc(text), sub) + (value != null && value !== '' ? '<span class="sp-value">' + value + '</span>' : '') + '</button>';
  }
  function actRow(act, text, ic, color, o) {
    o = o || {};
    return '<button class="sp-row' + (o.danger ? ' danger' : '') + '" data-act="' + act + '" data-label="' + esc(text) + '"' + (o.id ? ' data-id="' + o.id + '"' : '') + '>' +
      (ic ? ico(ic, color) : '') + label(esc(text), o.sub) + (o.value != null ? '<span class="sp-value">' + o.value + '</span>' : '') + '</button>';
  }
  function infoRow(ic, color, value, sub) {
    return '<div class="sp-row static">' + ico(ic, color) + label(esc(value), sub) + '</div>';
  }
  function toggleRow(key, o) {
    var e = S.entry(key), locked = S.isLocked(key); o = o || {};
    var hint = locked ? 'Set by your Super Admin' : (o.hint !== undefined ? o.hint : e.hint);
    return '<label class="sp-row' + (locked ? ' locked' : '') + '" data-label="' + esc(o.label || e.label) + '">' + (o.icon ? ico(o.icon, o.color) : '') +
      label(esc(o.label || e.label) + lockTag(key), hint) +
      '<span class="switch"><input type="checkbox" data-key="' + key + '"' + (S.get(key) ? ' checked' : '') + (locked ? ' disabled' : '') + '><span></span></span></label>';
  }
  function radioRows(key, o) {
    var e = S.entry(key), v = S.get(key), locked = S.isLocked(key); o = o || {};
    return e.options.map(function (opt) {
      var on = String(opt[0]) === String(v);
      var sub = o.sub ? o.sub(opt[0]) : '';
      return '<button class="sp-row sp-radio' + (on ? ' on' : '') + '" data-radio="' + key + '" data-v="' + esc(opt[0]) + '" data-label="' + esc(opt[1]) + '"' +
        (locked ? ' disabled' : '') + ' role="radio" aria-checked="' + on + '"><span class="radio"></span>' +
        label(o.label ? o.label(opt) : esc(opt[1]), sub) + '</button>';
    }).join('');
  }
  var FMT = {
    fontScale: function (v) { return Math.round(14 * v / 100); },
    radius: function (v) { return v + ' px'; },
    sidebarWidth: function (v) { return v + ' px'; }
  };
  function sliderRow(key, text) {
    var e = S.entry(key), v = S.get(key), locked = S.isLocked(key);
    return '<div class="sp-row sp-slider" data-label="' + esc(text || e.label) + '"><div class="sp-slider-top"><span>' + esc(text || e.label) + '</span>' +
      '<output>' + FMT[key](v) + '</output></div>' +
      '<input type="range" class="range" data-key="' + key + '" min="' + e.min + '" max="' + e.max + '" step="' + e.step + '" value="' + v + '"' + (locked ? ' disabled' : '') + '></div>';
  }
  function card(title, rows, note) {
    return '<section class="sp-card">' + (title ? '<h3 class="sp-card-title">' + title + '</h3>' : '') + rows +
      (note ? '<p class="sp-note">' + note + '</p>' : '') + '</section>';
  }
  // Sample chat that stays at the top of look-related pages while you scroll
  function previewCard() {
    return '<div class="sp-preview-sticky"><div class="sp-preview-box">' + X.previewChatHTML() + '</div>' +
      '<span class="sp-preview-label">Preview</span></div>';
  }
  var SPEED_SUB = { sub: function (v) { return { 0.6: 'Slower, gentler motion', 1: 'Default', 1.6: 'Snappier transitions' }[v] || ''; } };
  // Animations: one on/off switch + speed, with finer levels under Power Saving Mode
  function animationsCard() {
    var on = S.get('motion') !== 'off', locked = S.isLocked('motion');
    return card('Animations',
      '<label class="sp-row" data-label="Animations">' + ico('sparkle', '#8957e5') + label('Animations', on ? 'Smooth transitions and effects' : 'Everything changes instantly') +
        '<span class="switch"><input type="checkbox" data-anim-toggle' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '><span></span></span></label>' +
      (on ? '<div class="sp-sub-title">Animation speed</div>' + radioRows('animSpeed', SPEED_SUB) : '') +
      navRow('power', 'Power Saving Mode', 'zap', '#e5873b', motionLabel()));
  }
  function statusText(s) { return { online: 'online', away: 'away', dnd: 'do not disturb', offline: 'invisible' }[s] || s; }
  function motionLabel() { var m = S.get('motion'); return m === 'off' ? 'Maximum' : m === 'reduced' ? 'Enabled' : 'Disabled'; }
  function sampleTime(fmt) {
    var d = new Date(), h = d.getHours(), mm = ('0' + d.getMinutes()).slice(-2);
    return fmt === '12h' ? ((h % 12 || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM')) : (('0' + h).slice(-2) + ':' + mm);
  }

  // ---------------------------------------------------------
  // Pages
  // ---------------------------------------------------------
  var PAGES = {};

  PAGES.main = {
    title: 'Settings',
    render: function () {
      var me = X.me;
      var h = '<div class="sp-hero">' +
        '<span class="sp-hero-av" style="--av:' + me.color + '">' + X.initials(me.name) + '</span>' +
        '<h2>' + esc(X.fullName(me)) + '</h2>' +
        '<button class="sp-status" data-nav="status"><i class="pdot ' + me.status + '"></i>' + statusText(me.status) + '</button></div>';
      h += card('',
        infoRow('user', '#2f81f7', '@' + (me.username || ''), 'Username') +
        infoRow('megaphone', '#3fb950', me.callsign, 'Callsign') +
        infoRow('group', '#d29922', me.unit, 'Unit') +
        infoRow('shield', '#8957e5', X.roleLabel(), 'Account type'));
      h += card('',
        navRow('notifications', 'Notifications and Sounds', 'bell', '#e5534b') +
        navRow('data', 'Data and Storage', 'database', '#3fb950') +
        navRow('privacy', 'Privacy and Security', 'key', '#7d8590') +
        navRow('general', 'General Settings', 'settings', '#6e7681') +
        navRow('folders', 'Chat Folders', 'folder', '#2f81f7') +
        navRow('emoji', 'Emoji and Reactions', 'smile', '#db61a2') +
        navRow('media', 'Speakers and Camera', 'volume', '#2ea043') +
        navRow('devices', 'Devices', 'devices', '#388bfd', String(sessions.length + 1)) +
        navRow('language', 'Language', 'globe', '#8957e5', 'English') +
        navRow('accessibility', 'Accessibility', 'eye', '#1f9d8f') +
        navRow('shortcuts', 'Keyboard Shortcuts', 'keyboard', '#d29922'));
      h += card('', actRow('signout', 'Sign Out', 'logout', '#e5534b', { danger: true }));
      h += '<p class="sp-version">Syntra Desktop 0.4.0 · front-end prototype</p>';
      return h;
    }
  };

  PAGES.status = {
    title: 'Status',
    render: function () {
      var opts = [['online', 'Online', 'Others see you as available'], ['away', 'Away', 'Shown after you step away'],
        ['dnd', 'Do not disturb', 'Mutes notifications except Flash'], ['offline', 'Invisible', 'Appear offline but keep using Syntra']];
      return card('Your status', opts.map(function (o) {
        var on = X.me.status === o[0];
        return '<button class="sp-row sp-radio' + (on ? ' on' : '') + '" data-status="' + o[0] + '"><span class="radio"></span>' +
          label('<span class="sp-inline"><i class="pdot ' + o[0] + '"></i>' + o[1] + '</span>', o[2]) + '</button>';
      }).join(''));
    }
  };

  PAGES.notifications = {
    title: 'Notifications and Sounds',
    render: function () {
      return card('Message notifications', toggleRow('notifications') + toggleRow('sounds') + toggleRow('hidePreviews')) +
        card('Precedence', toggleRow('flashOverride'), 'Flash messages always alert you, even when your status is Do not disturb.') +
        card('', actRow('testnotif', 'Send a test notification', 'bell', '#e5534b'));
    }
  };

  PAGES.data = {
    title: 'Data and Storage',
    render: function () {
      var total = storage.media + storage.files + storage.cache;
      var seg = function (v, c) { return '<i style="flex:' + Math.max(v, 0.001) + ';background:' + c + '"></i>'; };
      var used = '<div class="sp-storage"><div class="sp-storage-top"><b>' + total.toFixed(1) + ' MB</b><span>used on this computer</span></div>' +
        '<div class="sp-bar">' + seg(storage.media, '#2f81f7') + seg(storage.files, '#3fb950') + seg(storage.cache, '#d29922') + '</div>' +
        '<div class="sp-legend"><span><i style="background:#2f81f7"></i>Media ' + storage.media.toFixed(1) + ' MB</span>' +
        '<span><i style="background:#3fb950"></i>Files ' + storage.files.toFixed(1) + ' MB</span>' +
        '<span><i style="background:#d29922"></i>Cache ' + storage.cache.toFixed(1) + ' MB</span></div></div>';
      return card('Storage usage', used + actRow('clearcache', 'Clear cache', 'trash', '#d29922', { value: storage.cache.toFixed(1) + ' MB' })) +
        card('Automatic media download', toggleRow('autoPhotos') + toggleRow('autoFiles')) +
        card('Maximum file size', radioRows('autoLimit')) +
        card('Links', toggleRow('linkPreviews')) +
        card('Backup', actRow('export', 'Export settings', 'download', '#2f81f7', { sub: 'Save your preferences to a file' }) +
          actRow('import', 'Import settings', 'upload', '#3fb950', { sub: 'Load a Syntra settings file' }) +
          actRow('resetall', 'Reset all settings', 'reset', '#e5534b', { danger: true }),
          'Settings format v' + S.VERSION + '. Older files are upgraded automatically.');
    }
  };

  PAGES.privacy = {
    title: 'Privacy and Security',
    render: function () {
      var cls = S.isLocked('classification');
      return card('Messages', toggleRow('readReceipts') + toggleRow('typingIndicators')) +
        card('Default disappearing timer' + lockTag('defaultTimer'), radioRows('defaultTimer'), 'Applies to new chats. Change it for one chat in that chat’s details.') +
        card('Screen lock' + lockTag('autoLock'), radioRows('autoLock'), 'Lock any time with the lock button or Ctrl+L.') +
        card('Classification marking' + lockTag('classification'), radioRows('classification'),
          cls ? (X.can('policy') ? 'Enforced for everyone. Change it in Admin Console › Security policy.' : 'Set by your Super Admin for this system.') : 'Shown in the banner at the top of the window.') +
        card('Encryption', '<div class="sp-row static">' + ico('lock', '#3fb950') +
          label('End-to-end encrypted', 'Verify a contact’s safety number from their chat details.') + '</div>');
    }
  };

  function themeCards() {
    var v = S.get('accent'), A = S.ACCENTS, dark = root.dataset.theme !== 'light';
    var custom = !A[v];
    return '<div class="theme-cards">' + Object.keys(A).map(function (k) {
      return '<button class="theme-card' + (v === k ? ' on' : '') + '" data-accent="' + k + '" style="--tc:' + A[k][dark ? 'dark' : 'light'] + '" title="' + A[k].label + '">' +
        '<span class="tc-in"></span><span class="tc-out"></span><span class="tc-name">' + A[k].label + '</span></button>';
    }).join('') +
      '<label class="theme-card custom' + (custom ? ' on' : '') + '" style="--tc:' + (custom ? v : '#888') + '" title="Custom color">' +
      '<span class="tc-in"></span><span class="tc-out"></span><span class="tc-name">Custom</span>' +
      '<input type="color" data-color="accent" value="' + (custom ? v : A[v].light) + '"></label></div>';
  }

  PAGES.general = {
    title: 'General Settings',
    render: function () {
      var themeNames = { light: 'Day', dark: 'Dark', night: 'Night ops', system: 'System Default' };
      var enter = S.get('enterToSend');
      return previewCard() +
        card('Settings',
          sliderRow('fontScale', 'Message Text Size') +
          navRow('wallpaper', 'Chat Wallpaper', 'palette', '#e5873b')) +
        animationsCard() +
        card('Color theme', themeCards() + radioRows('theme', { label: function (o) { return themeNames[o[0]]; },
          sub: function (v) { return v === 'night' ? 'Red on black to protect night vision' : ''; } })) +
        card('Time Format', radioRows('timeFormat', { label: function (o) { return o[0] === '12h' ? '12-hour' : '24-hour'; }, sub: sampleTime })) +
        card('Keyboard',
          '<button class="sp-row sp-radio' + (enter ? ' on' : '') + '" data-enter="1" data-label="Send with Enter"><span class="radio"></span>' + label('Send with Enter', 'New line with Shift + Enter') + '</button>' +
          '<button class="sp-row sp-radio' + (!enter ? ' on' : '') + '" data-enter="0" data-label="Send with Ctrl + Enter"><span class="radio"></span>' + label('Send with Ctrl + Enter', 'New line with Enter') + '</button>') +
        card('Message bubbles', radioRows('bubbleStyle') ) +
        card('Message layout', radioRows('messageLayout', { sub: function (v) { return v === 'list' ? 'Every message left-aligned, like a log' : 'Your messages on the right'; } }) + toggleRow('showAvatars')) +
        card('Font', radioRows('fontFamily')) +
        card('Layout', radioRows('density') + sliderRow('radius', 'Corner roundness') + sliderRow('sidebarWidth', 'Chat list width'),
          'You can also drag the edge of the chat list. Double-click it to reset.');
    }
  };

  PAGES.wallpaper = {
    title: 'Chat Wallpaper',
    render: function () {
      var e = S.entry('wallpaper'), v = S.get('wallpaper');
      var tiles = '<div class="wp-tiles sp-wp">' + e.options.map(function (o) {
        return '<button class="wp-tile wp-' + o[0] + (v === o[0] ? ' active' : '') + '" data-wp="' + o[0] + '" data-label="' + o[1] + '"><span>' + o[1] + '</span></button>';
      }).join('') + '</div>';
      return previewCard() + card('Choose a background', tiles);
    }
  };

  PAGES.power = {
    title: 'Power Saving Mode',
    render: function () {
      var subs = { system: 'Follow the Windows “Show animations” setting', full: 'All animations and effects', reduced: 'Fades only, no motion', off: 'No animations at all' };
      var names = { system: 'System default', full: 'Off — full animations', reduced: 'On — reduce animations', off: 'Maximum — no animations' };
      return card('Animations', radioRows('motion', { label: function (o) { return names[o[0]]; }, sub: function (v) { return subs[v]; } }),
        'Reducing animations saves battery and helps on slower computers. Speed is set in General Settings › Animations.');
    }
  };

  PAGES.folders = {
    title: 'Chat Folders',
    render: function () {
      return card('Folders above your chat list',
        '<div class="sp-row static">' + ico('chat', '#2f81f7') + label('All chats', 'Always shown') + '</div>' +
        toggleRow('folderUnread', { icon: 'bell', color: '#e5534b' }) +
        toggleRow('folderDirect', { icon: 'user', color: '#3fb950' }) +
        toggleRow('folderGroups', { icon: 'group', color: '#d29922' }) +
        toggleRow('folderPriority', { icon: 'alert', color: '#e5873b' }),
        'Folders filter your chat list. Turn off the ones you don’t use.');
    }
  };

  PAGES.emoji = {
    title: 'Emoji and Reactions',
    render: function () {
      return previewCard() + card('Emoji', toggleRow('largeEmoji')) +
        card('Quick reaction', radioRows('quickReaction', { label: function (o) { return '<span class="sp-emo">' + o[0] + '</span>' + o[1]; } }),
          'Double-click any message to react with this emoji.');
    }
  };

  PAGES.media = {
    title: 'Speakers and Camera',
    render: function () {
      return card('Speaker', radioRows('speaker')) +
        card('Microphone', radioRows('microphone') + toggleRow('noiseSuppression')) +
        card('Camera', radioRows('camera'), 'Device names are examples until Syntra is connected to your hardware.');
    }
  };

  PAGES.devices = {
    title: 'Devices',
    render: function () {
      var others = sessions.map(function (s) {
        return '<div class="sp-row static">' + ico('devices', '#7d8590') +
          label(esc(s.name), esc(s.device) + ' · ' + esc(s.place) + ' · ' + X.fmtListTime(s.last)) +
          '<button class="btn sm" data-act="terminate" data-id="' + s.id + '">Terminate</button></div>';
      }).join('');
      return card('This device', '<div class="sp-row static">' + ico('devices', '#388bfd') +
          label('Syntra Desktop 0.4', 'Windows · this computer · <span class="sp-online">online</span>') + '</div>') +
        card('Active sessions', (others || '<p class="sp-empty">No other devices are signed in.</p>') +
          (sessions.length ? actRow('terminateall', 'Terminate all other sessions', 'ban', '#e5534b', { danger: true }) : ''),
          'Lost a device? Terminate it here, and tell an Admin so they can remote-lock it.');
    }
  };

  PAGES.language = {
    title: 'Language',
    render: function () {
      var soon = [['fil', 'Filipino'], ['es', 'Español'], ['fr', 'Français']];
      return card('Interface language', radioRows('language', { sub: function () { return 'English'; } }) +
        soon.map(function (l) { return '<button class="sp-row sp-radio" disabled><span class="radio"></span>' + label(l[1], 'Coming soon') + '</button>'; }).join(''));
    }
  };

  PAGES.accessibility = {
    title: 'Accessibility',
    render: function () {
      return previewCard() +
        card('Display', toggleRow('highContrast') + toggleRow('focusRings')) +
        card('Related', navRow('general', 'Text size and animations', 'settings', '#6e7681', null, 'In General Settings'));
    }
  };

  PAGES.shortcuts = {
    title: 'Keyboard Shortcuts',
    render: function () {
      var list = [['Ctrl K', 'Search all chats'], ['Ctrl N', 'New message'], ['Ctrl F', 'Search in conversation'], ['Ctrl 1–4', 'Chats, Channels, Directory, Calls'],
        ['Ctrl 5', 'Admin console'], ['Alt ↑ / ↓', 'Previous / next chat'], ['↑', 'Reply to last message'], ['Ctrl D', 'Toggle dark mode'],
        ['Ctrl ,', 'Settings'], ['Ctrl L', 'Lock Syntra'], ['F1', 'User guide'], ['Esc', 'Close / go back']];
      return card('', list.map(function (k) {
        return '<div class="sp-row static sp-key" data-label="' + esc(k[1]) + '">' + label(esc(k[1])) + '<span class="sp-value">' +
          k[0].split(' ').map(function (x) { return x === '/' ? ' / ' : '<kbd>' + x + '</kbd>'; }).join('') + '</span></div>';
      }).join(''));
    }
  };

  PAGES.search = {
    title: 'Search settings',
    render: function () {
      var q = (searchQ || '').trim().toLowerCase();
      if (!q) return '<p class="sp-empty">Type to search all settings.</p>';
      var hits = [];
      Object.keys(PAGES).forEach(function (id) {
        if (id === 'search' || id === 'main') return;
        var tpl = document.createElement('template');
        tpl.innerHTML = PAGES[id].render();
        var seen = {};
        $$('[data-label]', tpl.content).forEach(function (el) {
          var l = el.getAttribute('data-label');
          if (seen[l] || l.toLowerCase().indexOf(q) === -1) return;
          seen[l] = 1; hits.push([id, l]);
        });
        if (PAGES[id].title.toLowerCase().indexOf(q) !== -1 && !seen[PAGES[id].title]) hits.unshift([id, null]);
      });
      if (!hits.length) return '<p class="sp-empty">No settings match “' + esc(searchQ) + '”.</p>';
      return card('Results', hits.slice(0, 40).map(function (hit) {
        return '<button class="sp-row" data-nav="' + hit[0] + '"' + (hit[1] ? ' data-find="' + esc(hit[1]) + '"' : '') + '>' +
          label(esc(hit[1] || PAGES[hit[0]].title), hit[1] ? PAGES[hit[0]].title : 'Page') + '</button>';
      }).join(''));
    }
  };

  // ---------------------------------------------------------
  // Page building & navigation
  // ---------------------------------------------------------
  var searchQ = '';
  function build(id) {
    var p = PAGES[id];
    var el = document.createElement('div');
    el.className = 'sp-page';
    el.dataset.page = id;
    var head = id === 'search'
      ? '<header class="sp-head"><button class="icon-btn sp-back" title="Back">' + icon('back') + '</button>' +
        '<input class="sp-search" id="spSearch" placeholder="Search settings" value="' + esc(searchQ) + '"></header>'
      : '<header class="sp-head"><button class="icon-btn sp-back" title="' + (id === 'main' ? 'Close' : 'Back') + '">' + icon('back') + '</button>' +
        '<h2>' + p.title + '</h2>' +
        (id === 'main' ? '<button class="icon-btn" data-act="search" title="Search settings">' + icon('search') + '</button>' +
          '' : '') + '</header>';
    el.innerHTML = head + '<div class="sp-body">' + p.render() + '</div>';
    return el;
  }

  function slide(newEl, dir) {
    var old = $('.sp-page', panel);
    panel.appendChild(newEl);
    var motion = root.dataset.motion;
    if (!old) return;
    if (motion === 'off' || !newEl.animate) { old.remove(); return; }
    var ease = 'cubic-bezier(.2,.8,.2,1)', dur = motion === 'reduced' ? 120 : 280;
    var fwd = dir !== 'back';
    var small = motion === 'reduced';
    newEl.animate(fwd
      ? [{ transform: small ? 'none' : 'translateX(100%)', opacity: small ? 0 : 1 }, { transform: 'none', opacity: 1 }]
      : [{ transform: small ? 'none' : 'translateX(-25%)', opacity: small ? 0 : .6 }, { transform: 'none', opacity: 1 }], { duration: dur, easing: ease });
    old.style.pointerEvents = 'none';
    var a = old.animate(fwd
      ? [{ transform: 'none', opacity: 1 }, { transform: small ? 'none' : 'translateX(-25%)', opacity: small ? 0 : .4 }]
      : [{ transform: 'none' }, { transform: small ? 'none' : 'translateX(100%)' }], { duration: dur, easing: ease, fill: 'forwards' });
    if (!fwd) old.style.zIndex = 2;
    var removed = false;
    var rm = function () { if (!removed) { removed = true; old.remove(); } };
    a.onfinish = rm; setTimeout(rm, X.motionMs(dur) + 80);
  }

  function push(id, find) {
    // already on this page (repeated clicks on the avatar, a row, etc.): don't stack a copy
    if (stack.length && stack[stack.length - 1].id === id) return;
    var cur = $('.sp-page:last-child', panel);
    if (cur && stack.length) stack[stack.length - 1].scroll = $('.sp-body', cur).scrollTop;
    stack.push({ id: id, scroll: 0 });
    syncRail();
    var el = build(id);
    slide(el, 'forward');
    if (find) {
      var row = $$('[data-label]', el).filter(function (r) { return r.getAttribute('data-label') === find; })[0];
      if (row) setTimeout(function () { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('sp-flash'); }, 300);
    }
    if (id === 'search') setTimeout(function () { var s = $('#spSearch'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 50);
  }

  // Show which left-bar button owns the open panel (gear = Settings, avatar = Status)
  function syncRail() {
    var top = isOpen && stack.length ? stack[stack.length - 1].id : null;
    $('#settingsBtn').classList.toggle('active', isOpen && top !== 'status');
    $('#meBtn').classList.toggle('active', top === 'status');
    $('#settingsBtn').setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  function back() {
    if (stack.length <= 1) { close(); return; }
    stack.pop();
    var prev = stack[stack.length - 1];
    var el = build(prev.id);
    slide(el, 'back');
    $('.sp-body', el).scrollTop = prev.scroll;
    syncRail();
  }

  function refresh() {
    if (!isOpen) return;
    var cur = $('.sp-page:last-child', panel); if (!cur) return;
    var body = $('.sp-body', cur), top = body.scrollTop;
    body.innerHTML = PAGES[cur.dataset.page].render();
    body.scrollTop = top;
  }

  function open(page) {
    closeMenu();
    if (X.isNarrow() && X.state.activeId && $('#app').classList.contains('chat-open')) X.closeConv();
    if (!isOpen) {
      isOpen = true;
      panel.innerHTML = '';
      stack = [];
      X.showEl(panel);
      push('main');
    }
    if (page && page !== 'main') push(page);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    searchQ = '';
    syncRail();
    X.hideEl(panel, 240, function () { panel.innerHTML = ''; stack = []; });
  }

  // ---------------------------------------------------------
  // Actions
  // ---------------------------------------------------------
  function bugModal() {
    var m = X.openModal('Report a bug',
      '<div class="modal-body"><div class="field"><label>What happened?</label>' +
      '<textarea class="a-textarea" id="bugText" rows="5" placeholder="What did you click, what did you expect, and what happened instead?"></textarea></div>' +
      '<div class="field"><label>Area</label><select id="bugArea"><option>Messages</option><option>Calls</option><option>Settings</option><option>Sign-in</option><option>Admin console</option><option>Other</option></select></div>' +
      '<p class="set-note">Don’t include classified or sensitive information in bug reports.</p></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn primary" id="bugSend">Send report</button>');
    $('#bugSend', m).addEventListener('click', function () {
      if (!$('#bugText', m).value.trim()) { $('#bugText', m).focus(); return; }
      X.closeModal();
      X.toast(icon('check') + 'Thanks! Report saved. It will be sent when the server is connected.');
    });
  }

  function doAct(act, el) {
    switch (act) {
      case 'search': searchQ = ''; push('search'); break;
      case 'guide': X.openGuide('start'); break;
      case 'bug': bugModal(); break;
      case 'signout': X.signOut(); break;
      case 'testnotif': X.toast(icon('bell') + '<span><b>Syntra</b> · This is a test notification</span>', 3000); break;
      case 'clearcache':
        X.confirm({ title: 'Clear cache?', message: 'Temporary files are removed. Your messages are not affected.', confirmLabel: 'Clear cache', icon: 'trash' })
          .then(function (ok) { if (ok) { storage.cache = 0; refresh(); X.toast(icon('trash') + 'Cache cleared'); } });
        break;
      case 'export':
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([S.exportJSON()], { type: 'application/json' }));
        a.download = 'syntra-settings.json'; a.click();
        X.toast(icon('download') + 'Settings exported'); break;
      case 'import':
        X.pickFile('application/json,.json', function (f) {
          f.text().then(function (txt) {
            var r = S.importJSON(txt);
            X.toast(r.ok ? icon('check') + 'Imported ' + r.count + ' settings' : icon('alert') + esc(r.error));
            refresh();
          });
        });
        break;
      case 'resetall':
        X.confirm({ title: 'Reset all settings?', message: 'Every preference returns to its default. Settings managed by your Super Admin stay as they are.', confirmLabel: 'Reset', danger: true, icon: 'reset' })
          .then(function (ok) { if (ok) { S.reset(); refresh(); X.toast(icon('reset') + 'All settings reset'); } });
        break;
      case 'terminate':
        var s = sessions.filter(function (x) { return x.id === el.dataset.id; })[0];
        X.confirm({ title: 'Terminate this session?', message: s.name + ' on ' + s.device + ' will be signed out.', confirmLabel: 'Terminate', danger: true, icon: 'ban' })
          .then(function (ok) { if (ok) { sessions = sessions.filter(function (x) { return x !== s; }); refresh(); X.toast(icon('ban') + 'Session terminated'); } });
        break;
      case 'terminateall':
        X.confirm({ title: 'Terminate all other sessions?', message: 'Every device except this computer will be signed out.', confirmLabel: 'Terminate all', danger: true, icon: 'ban' })
          .then(function (ok) { if (ok) { sessions = []; refresh(); X.toast(icon('ban') + 'All other sessions terminated'); } });
        break;
    }
  }

  // ---------------------------------------------------------
  // Panel events
  // ---------------------------------------------------------
  panel.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('.sp-back'))) { back(); return; }
    if ((t = e.target.closest('[data-nav]'))) { push(t.dataset.nav, t.dataset.find); return; }
    if ((t = e.target.closest('[data-radio]'))) { if (!t.disabled) S.set(t.dataset.radio, t.dataset.v); return; }
    if ((t = e.target.closest('[data-enter]'))) { S.set('enterToSend', t.dataset.enter === '1'); return; }
    if ((t = e.target.closest('[data-accent]'))) { S.set('accent', t.dataset.accent); return; }
    if ((t = e.target.closest('[data-wp]'))) { S.set('wallpaper', t.dataset.wp); return; }
    if ((t = e.target.closest('[data-status]'))) {
      X.me.status = t.dataset.status;
      $('#mePresence').className = 'presence ' + X.me.status;
      refresh(); return;
    }
    if ((t = e.target.closest('[data-act]'))) {
      doAct(t.dataset.act, t);
    }
  });
  panel.addEventListener('change', function (e) {
    var el = e.target;
    if (el.type === 'checkbox' && el.dataset.key) S.set(el.dataset.key, el.checked);
    if (el.hasAttribute('data-anim-toggle')) S.set('motion', el.checked ? 'system' : 'off');
  });
  panel.addEventListener('input', function (e) {
    var el = e.target;
    if (el.type === 'range' && el.dataset.key) {
      S.set(el.dataset.key, el.value);
      var out = el.parentNode.querySelector('output'); if (out) out.textContent = FMT[el.dataset.key](S.get(el.dataset.key));
    }
    if (el.dataset.color) {
      S.set('accent', el.value);
      var lbl = el.parentNode; lbl.style.setProperty('--tc', el.value);
      $$('.theme-card', panel).forEach(function (c) { c.classList.toggle('on', c === lbl); });
    }
    if (el.id === 'spSearch') {
      searchQ = el.value;
      var body = $('.sp-page:last-child .sp-body', panel);
      body.innerHTML = PAGES.search.render();
    }
  });
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); back(); }
  });

  // Re-render the visible page when any setting changes (but not while dragging a slider)
  S.onChange(function () {
    var a = document.activeElement;
    if (a && panel.contains(a) && (a.type === 'range' || a.type === 'color')) return;
    refresh();
  });

  // ---------------------------------------------------------
  // Main menu (☰)
  // ---------------------------------------------------------
  var menuEl = null, menuAnchor = null;
  function closeMenu() {
    if (!menuEl) return;
    var m = menuEl; menuEl = null;
    if (menuAnchor) menuAnchor.classList.remove('on');
    menuAnchor = null;
    m.classList.add('closing'); setTimeout(function () { m.remove(); }, X.motionMs(140));
  }

  // items: [act, icon, label, danger?] or null (separator); returns the element
  function showMenu(anchor, items, onPick, align, extraTop) {
    closeMenu();
    var m = document.createElement('div');
    m.className = 'hb-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = (extraTop || '') + items.map(function (it) {
      if (!it) return '<div class="hb-sep"></div>';
      if (typeof it === 'string') return it;
      if (it.sub) {
        return '<div class="hb-more"><button class="hb-item" data-sub role="menuitem" aria-haspopup="menu">' + icon(it.icon) + '<span>' + it.label + '</span>' + icon('chev', 'hb-chev') + '</button>' +
          '<div class="hb-menu hb-submenu" role="menu">' + it.sub.map(function (s) {
            if (!s) return '<div class="hb-sep"></div>';
            if (typeof s === 'string') return s;
            return '<button class="hb-item' + (s[3] ? ' danger' : '') + '" data-pick="' + s[0] + '" role="menuitem">' + icon(s[1]) + '<span>' + s[2] + '</span></button>';
          }).join('') + '</div></div>';
      }
      return '<button class="hb-item' + (it[3] ? ' danger' : '') + '" data-pick="' + it[0] + '" role="menuitem">' + icon(it[1]) + '<span>' + it[2] + '</span>' +
        (it[4] ? '<span class="hb-badge">' + it[4] + '</span>' : '') + '</button>';
    }).join('');
    document.body.appendChild(m);
    var r = anchor.getBoundingClientRect();
    var left = align === 'right' ? r.right - m.offsetWidth : r.left;
    m.style.left = Math.max(8, Math.min(left, window.innerWidth - m.offsetWidth - 8)) + 'px';
    m.style.top = Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 8) + 'px';
    m.style.transformOrigin = align === 'right' ? 'top right' : 'top left';
    m.addEventListener('click', function (e) {
      var s = e.target.closest('[data-sub]');
      if (s) { e.stopPropagation(); s.parentNode.classList.toggle('open'); return; }
      var b = e.target.closest('[data-pick]');
      if (b) { e.stopPropagation(); var act = b.dataset.pick; closeMenu(); onPick(act); }
    });
    // keyboard: arrows move, Esc closes
    m.addEventListener('keydown', function (e) {
      var items2 = $$('.hb-item', m).filter(function (x) { return x.offsetParent; });
      var i = items2.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items2[(i + 1) % items2.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items2[(i - 1 + items2.length) % items2.length].focus(); }
      if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); anchor.focus(); }
    });
    menuEl = m;
    menuAnchor = anchor;
    anchor.classList.add('on');
    setTimeout(function () { var f = $('.hb-item', m); if (f) f.focus({ preventScroll: true }); }, 30);
    return m;
  }

  function mainMenu() {
    var dark = root.dataset.theme !== 'light';
    var reduced = S.get('motion') === 'reduced' || S.get('motion') === 'off';
    var me = X.me;
    var top = '<button class="hb-item hb-profile" data-pick="profile" role="menuitem"><span class="avatar xs" style="--av:' + me.color + '">' + X.initials(me.name) + '</span>' +
      '<span><b>' + esc(X.fullName(me)) + '</b><small>' + X.roleLabel() + ' · ' + statusText(me.status) + '</small></span></button><div class="hb-sep"></div>';
    // Only things that are not already on the left bar (navigation and lock live there)
    var items = [
      ['settings', 'settings', 'Settings'],
      ['dark', dark ? 'sun' : 'moon', dark ? 'Disable Dark Mode' : 'Enable Dark Mode'],
      ['motion', 'zap', reduced ? 'Enable Animations' : 'Reduce Animations'],
      null,
      ['guide', 'sparkle', 'Syntra Features'],
      ['shortcuts', 'keyboard', 'Keyboard Shortcuts'],
      ['bug', 'flag', 'Report a Bug'],
      null,
      ['signout', 'logout', 'Sign Out', true],
      '<div class="hb-version">Syntra Desktop 0.4.0</div>'
    ];
    showMenu($('#menuBtn'), items, function (act) {
      switch (act) {
        case 'profile': open('status'); break;
        case 'settings': open('main'); break;
        case 'dark': X.toggleTheme(); break;
        case 'motion': S.set('motion', reduced ? 'full' : 'reduced'); X.toast(icon('zap') + (reduced ? 'Animations on' : 'Animations reduced')); break;
        case 'guide': X.openGuide('start'); break;
        case 'shortcuts': open('shortcuts'); break;
        case 'bug': bugModal(); break;
        case 'signout': X.signOut(); break;
      }
    }, 'left', top);
  }

  $('#menuBtn').addEventListener('click', function (e) { e.stopPropagation(); if (menuEl) closeMenu(); else mainMenu(); });
  document.addEventListener('click', function (e) { if (menuEl && !e.target.closest('.hb-menu')) closeMenu(); });
  window.addEventListener('resize', closeMenu);

  window.SyntraSettingsPanel = {
    open: open, close: close, back: back,
    isOpen: function () { return isOpen; },
    current: function () { return isOpen && stack.length ? stack[stack.length - 1].id : null; },
    menuOpen: function () { return !!menuEl; }, closeMenu: closeMenu
  };
})();
