/* =========================================================
   Syntra — settings module
   ---------------------------------------------------------
   Future-proofing rules:
   1. Every setting is declared ONCE in SCHEMA below. The
      settings screen, validation, defaults, reset, import and
      export are all generated from it. Adding a new option
      means adding one entry here (and reading it in the UI).
   2. Stored data carries a version number. When a setting is
      renamed or its format changes, bump VERSION and add a
      migration so existing users keep their preferences.
   3. Values are validated on load, set and import, so bad or
      outdated data can never break the interface.
   4. Later, the same schema can be served by the backend so
      admins can set organisation defaults or lock settings
      (see `locked` below).
   ========================================================= */

(function () {
  'use strict';

  var KEY = 'syntra.settings';
  var VERSION = 2;

  var ACCENTS = {
    green:  { label: 'Olive',  light: '#2f6b4f', dark: '#4f9d76' },
    blue:   { label: 'Navy',   light: '#2f5f9e', dark: '#5b8fd1' },
    slate:  { label: 'Slate',  light: '#47566b', dark: '#8294ad' },
    sand:   { label: 'Desert', light: '#8a6a32', dark: '#c49a52' },
    maroon: { label: 'Maroon', light: '#8c2f3f', dark: '#c45a6b' },
    teal:   { label: 'Teal',   light: '#21706f', dark: '#46a7a5' }
  };

  var SECTIONS = [
    { id: 'appearance',     label: 'Appearance',         icon: 'image' },
    { id: 'layout',         label: 'Layout',             icon: 'layout' },
    { id: 'accessibility',  label: 'Accessibility',      icon: 'user' },
    { id: 'chats',          label: 'Chats',              icon: 'chat' },
    { id: 'notifications',  label: 'Notifications',      icon: 'bell' },
    { id: 'privacy',        label: 'Privacy & security', icon: 'lock' },
    { id: 'classification', label: 'Classification',     icon: 'shield' },
    { id: 'data',           label: 'Backup & reset',     icon: 'file' },
    { id: 'about',          label: 'About',              icon: 'info' }
  ];

  // type: toggle | segment | select | range | accent | wallpaper
  var SCHEMA = [
    // ---- Appearance
    { key: 'theme', section: 'appearance', type: 'segment', label: 'Theme', default: 'system',
      hint: 'Night ops uses red on black to protect night vision',
      options: [['light', 'Light'], ['dark', 'Dark'], ['night', 'Night ops'], ['system', 'System']] },
    { key: 'accent', section: 'appearance', type: 'accent', label: 'Accent color', default: 'green',
      hint: 'Pick a preset or any custom color' },
    { key: 'wallpaper', section: 'appearance', type: 'wallpaper', label: 'Chat background', default: 'doodle',
      options: [['doodle', 'Doodles'], ['plain', 'Plain'], ['dots', 'Dots'], ['grid', 'Grid'], ['topo', 'Contour'], ['hatch', 'Hatch']] },
    { key: 'bubbleStyle', section: 'appearance', type: 'segment', label: 'Bubble shape', default: 'rounded',
      options: [['rounded', 'Rounded'], ['soft', 'Soft'], ['square', 'Square']] },
    { key: 'radius', section: 'appearance', type: 'range', label: 'Interface corners', default: 12,
      min: 0, max: 20, step: 1, unit: 'px' },
    { key: 'fontFamily', section: 'appearance', type: 'select', label: 'Font', default: 'system',
      options: [['system', 'System default'], ['classic', 'Classic'], ['humanist', 'Humanist'], ['mono', 'Monospace']] },
    { key: 'fontScale', section: 'appearance', type: 'range', label: 'Text size', default: 100,
      min: 85, max: 130, step: 5, unit: '%' },

    // ---- Layout
    { key: 'density', section: 'layout', type: 'segment', label: 'Density', default: 'comfortable',
      options: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']] },
    { key: 'sidebarWidth', section: 'layout', type: 'range', label: 'Chat list width', default: 340,
      min: 260, max: 480, step: 10, unit: 'px', hint: 'You can also drag the edge of the chat list' },
    { key: 'messageLayout', section: 'layout', type: 'segment', label: 'Message layout', default: 'bubbles',
      hint: 'List shows every message left-aligned, like a log',
      options: [['bubbles', 'Bubbles'], ['list', 'List']] },
    { key: 'showAvatars', section: 'layout', type: 'toggle', label: 'Show avatars in conversations', default: true },
    { key: 'timeFormat', section: 'layout', type: 'segment', label: 'Time format', default: '24h',
      options: [['24h', '24-hour'], ['12h', '12-hour']] },

    // ---- Accessibility
    { key: 'motion', section: 'accessibility', type: 'segment', label: 'Animations', default: 'system',
      hint: 'System follows your Windows “Show animations” setting',
      options: [['system', 'System'], ['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']] },
    { key: 'animSpeed', section: 'accessibility', type: 'select', label: 'Animation speed', default: 1,
      options: [[0.6, 'Relaxed'], [1, 'Normal'], [1.6, 'Fast']] },
    { key: 'highContrast', section: 'accessibility', type: 'toggle', label: 'High contrast', default: false,
      hint: 'Stronger borders and text' },
    { key: 'focusRings', section: 'accessibility', type: 'toggle', label: 'Always show focus outlines', default: false,
      hint: 'Helpful when navigating with the keyboard' },

    // ---- Chats
    { key: 'enterToSend', section: 'chats', type: 'toggle', label: 'Enter to send', default: true,
      hint: 'When off, use Ctrl+Enter to send' },
    { key: 'linkPreviews', section: 'chats', type: 'toggle', label: 'Generate link previews', default: false,
      hint: 'Off by default for OPSEC' },

    // ---- Notifications
    { key: 'notifications', section: 'notifications', type: 'toggle', label: 'Show notifications', default: true },
    { key: 'sounds', section: 'notifications', type: 'toggle', label: 'Play sound', default: true },
    { key: 'hidePreviews', section: 'notifications', type: 'toggle', label: 'Hide message content', default: false,
      hint: 'Show “New message” instead of the text' },
    { key: 'flashOverride', section: 'notifications', type: 'toggle', label: 'Confirm before sending FLASH', default: true,
      hint: 'FLASH overrides recipients’ Do Not Disturb' },

    // ---- Privacy
    { key: 'readReceipts', section: 'privacy', type: 'toggle', label: 'Read receipts', default: true,
      hint: 'If off, you won’t see others’ receipts either' },
    { key: 'typingIndicators', section: 'privacy', type: 'toggle', label: 'Typing indicators', default: true },
    { key: 'defaultTimer', section: 'privacy', type: 'select', label: 'Default disappearing timer', default: 0,
      hint: 'Applies to new chats',
      options: [[0, 'Off'], [300, '5 minutes'], [3600, '1 hour'], [28800, '8 hours'], [86400, '24 hours'], [604800, '1 week']] },
    { key: 'autoLock', section: 'privacy', type: 'select', label: 'Screen lock', default: 15,
      hint: 'Lock Syntra after inactivity',
      options: [[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes']] },

    // ---- Chat folders (filters shown above the chat list)
    { key: 'folderUnread',   section: 'folders', type: 'toggle', label: 'Unread',   default: true, hint: 'Chats with unread messages' },
    { key: 'folderDirect',   section: 'folders', type: 'toggle', label: 'Direct',   default: true, hint: 'One-to-one conversations' },
    { key: 'folderGroups',   section: 'folders', type: 'toggle', label: 'Groups',   default: true, hint: 'Group conversations' },
    { key: 'folderPriority', section: 'folders', type: 'toggle', label: 'Priority', default: true, hint: 'Chats with Priority, Immediate or Flash messages' },

    // ---- Emoji and reactions
    { key: 'largeEmoji', section: 'emoji', type: 'toggle', label: 'Large emoji', default: true,
      hint: 'Show messages that contain only emoji in a bigger size' },
    { key: 'quickReaction', section: 'emoji', type: 'select', label: 'Quick reaction', default: '👍',
      options: [['👍', 'Thumbs up'], ['✅', 'Check'], ['🫡', 'Salute'], ['👀', 'Eyes'], ['🔥', 'Fire'], ['❗', 'Exclamation']] },

    // ---- Data and storage
    { key: 'autoPhotos', section: 'data', type: 'toggle', label: 'Photos', default: true, hint: 'Download photos automatically' },
    { key: 'autoFiles',  section: 'data', type: 'toggle', label: 'Files',  default: false, hint: 'Download documents automatically' },
    { key: 'autoLimit',  section: 'data', type: 'select', label: 'Maximum file size', default: 5,
      options: [[1, 'Up to 1 MB'], [5, 'Up to 5 MB'], [15, 'Up to 15 MB'], [50, 'Up to 50 MB'], [0, 'No restriction']] },

    // ---- Speakers and camera
    { key: 'speaker', section: 'media', type: 'select', label: 'Speaker', default: 'default',
      options: [['default', 'System default'], ['headset', 'Headset (USB)'], ['speakers', 'Speakers (built-in)']] },
    { key: 'microphone', section: 'media', type: 'select', label: 'Microphone', default: 'default',
      options: [['default', 'System default'], ['headset', 'Headset microphone (USB)'], ['array', 'Microphone array (built-in)']] },
    { key: 'camera', section: 'media', type: 'select', label: 'Camera', default: 'default',
      options: [['default', 'System default'], ['integrated', 'Integrated camera'], ['usb', 'USB camera']] },
    { key: 'noiseSuppression', section: 'media', type: 'toggle', label: 'Noise suppression', default: true,
      hint: 'Filter background noise on calls' },

    // ---- Language
    { key: 'language', section: 'language', type: 'select', label: 'Language', default: 'en', options: [['en', 'English']] },

    // ---- Classification
    { key: 'classification', section: 'classification', type: 'select', label: 'Classification marking', default: 'unclassified',
      hint: 'Shown at the top of the window',
      options: [['unclassified', 'UNCLASSIFIED'], ['cui', 'CUI'], ['confidential', 'CONFIDENTIAL'], ['secret', 'SECRET'], ['off', 'Hide banner']] }
  ];

  // ---------------------------------------------------------
  // Migrations: MIGRATIONS[n] upgrades data from version n to n+1
  // ---------------------------------------------------------
  var MIGRATIONS = {
    // v1 (first prototype) -> v2: fontSize enum became fontScale %, compact flag became density
    1: function (v) {
      if ('fontSize' in v) { v.fontScale = { small: 90, 'default': 100, large: 110 }[v.fontSize] || 100; delete v.fontSize; }
      if ('compact' in v) { v.density = v.compact ? 'compact' : 'comfortable'; delete v.compact; }
      return v;
    }
  };

  var byKey = {};
  SCHEMA.forEach(function (e) { byKey[e.key] = e; });

  function validate(e, value) {
    if (value === undefined || value === null) return e.default;
    switch (e.type) {
      case 'toggle':
        return typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : e.default;
      case 'segment': case 'select': case 'wallpaper':
        for (var i = 0; i < e.options.length; i++) if (String(e.options[i][0]) === String(value)) return e.options[i][0];
        return e.default;
      case 'range':
        var n = Number(value);
        if (!isFinite(n)) return e.default;
        return Math.min(e.max, Math.max(e.min, n));
      case 'accent':
        if (ACCENTS[value]) return value;
        if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
        return e.default;
    }
    return e.default;
  }

  function migrate(values, fromVersion) {
    var v = fromVersion || 1;
    while (v < VERSION) {
      if (MIGRATIONS[v]) values = MIGRATIONS[v](values) || values;
      v++;
    }
    return values;
  }

  function sanitize(raw) {
    var out = {};
    SCHEMA.forEach(function (e) { out[e.key] = validate(e, raw[e.key]); });
    return out;
  }

  // values is a single live object: never replaced, only mutated
  var values = {};
  function assign(obj) { for (var k in obj) values[k] = obj[k]; }

  // ---------------------------------------------------------
  // Organisation policy (set by the Super Admin)
  // A policy value overrides the user's setting and locks it.
  // Keys that are not user settings (e.g. allowFiles) are
  // organisation-only switches. In production this comes from
  // the server; here it is kept in localStorage.
  // ---------------------------------------------------------
  var POLICY_KEY = 'syntra.policy';
  var DEFAULT_POLICY = { classification: 'unclassified', allowFiles: true, allowPhotos: true, allowLocation: true };
  var policy = {};
  function loadPolicy() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(POLICY_KEY) || 'null'); } catch (e) {}
    policy = (p && typeof p === 'object') ? p : JSON.parse(JSON.stringify(DEFAULT_POLICY));
  }
  function savePolicy() { try { localStorage.setItem(POLICY_KEY, JSON.stringify(policy)); } catch (e) {} }
  function applyPolicy() {
    for (var k in policy) if (byKey[k]) values[k] = validate(byKey[k], policy[k]);
  }
  function isLocked(k) { return !!byKey[k] && Object.prototype.hasOwnProperty.call(policy, k); }
  function setPolicy(key, value) {
    if (value === undefined) delete policy[key];
    else policy[key] = byKey[key] ? validate(byKey[key], value) : value;
    savePolicy();
    if (byKey[key] && value !== undefined) values[key] = policy[key];
    if (byKey[key]) save();
    emit(key);
  }
  function getPolicy(key) {
    return Object.prototype.hasOwnProperty.call(policy, key) ? policy[key] : (key in DEFAULT_POLICY ? DEFAULT_POLICY[key] : undefined);
  }

  function load() {
    var raw = {}, ver = VERSION;
    try {
      var stored = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (stored && typeof stored === 'object') {
        if (stored.version && stored.values) { raw = stored.values; ver = stored.version; }
        else { raw = stored; ver = 1; }            // legacy flat format
      }
    } catch (e) {}
    assign(sanitize(migrate(raw, ver)));
    loadPolicy();
    applyPolicy();
    if (ver !== VERSION) save();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: VERSION, values: values })); } catch (e) {}
  }

  var listeners = [];
  function emit(key) { listeners.forEach(function (fn) { try { fn(key, values[key]); } catch (e) { console.error(e); } }); }

  function set(key, value) {
    var e = byKey[key];
    if (!e || isLocked(key)) return false;
    var v = validate(e, value);
    if (values[key] === v) return true;
    values[key] = v;
    save(); emit(key);
    return true;
  }

  function reset(section) {
    SCHEMA.forEach(function (e) {
      if ((!section || e.section === section) && !isLocked(e.key)) values[e.key] = e.default;
    });
    save(); emit('*');
  }

  function exportJSON() {
    return JSON.stringify({ app: 'syntra', version: VERSION, exported: new Date().toISOString(), values: values }, null, 2);
  }

  function importJSON(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'File is not valid JSON' }; }
    if (!data || typeof data !== 'object') return { ok: false, error: 'Unrecognized file' };
    var raw = data.values || data;
    var ver = data.version || 1;
    if (ver > VERSION) return { ok: false, error: 'File is from a newer version of Syntra' };
    var clean = sanitize(migrate(JSON.parse(JSON.stringify(raw)), ver));
    var count = 0;
    SCHEMA.forEach(function (e) { if (e.key in raw && !isLocked(e.key)) { values[e.key] = clean[e.key]; count++; } });
    save(); emit('*');
    return { ok: true, count: count };
  }

  load();

  window.SyntraSettings = {
    VERSION: VERSION,
    ACCENTS: ACCENTS,
    SECTIONS: SECTIONS,
    SCHEMA: SCHEMA,
    values: values,
    get: function (k) { return values[k]; },
    set: set,
    reset: reset,
    entry: function (k) { return byKey[k]; },
    isLocked: isLocked,
    setPolicy: setPolicy,
    getPolicy: getPolicy,
    resetPolicy: function () { policy = JSON.parse(JSON.stringify(DEFAULT_POLICY)); savePolicy(); applyPolicy(); save(); emit('*'); },
    exportJSON: exportJSON,
    importJSON: importJSON,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
