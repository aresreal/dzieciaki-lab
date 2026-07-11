(function (global) {
  'use strict';

  var STORAGE_KEY = 'planownia-v2';
  var LEGACY_FORM_KEY = 'planownia-form-v1';
  var VERSION = 2;
  var MAX_PLANS = 30;
  var FORM_FIELDS = [
    'names',
    'layout',
    'season',
    'date',
    'title',
    'morning',
    'daytime',
    'evening',
    'meTime'
  ];

  var memoryState = null;

  function emptyState() {
    return {
      version: VERSION,
      form: {},
      phraseId: null,
      checks: {},
      planOrder: []
    };
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeGet(key) {
    try {
      return global.localStorage ? global.localStorage.getItem(key) : null;
    } catch (_error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      if (!global.localStorage) return false;
      global.localStorage.setItem(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function safeParse(raw) {
    if (typeof raw !== 'string' || raw === '') return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function sanitizeForm(form) {
    if (!isObject(form)) return {};
    return FORM_FIELDS.reduce(function (result, key) {
      if (typeof form[key] === 'string') result[key] = form[key];
      return result;
    }, {});
  }

  function sanitizePhraseId(phraseId) {
    if (typeof phraseId === 'string' || typeof phraseId === 'number') return phraseId;
    return null;
  }

  function sanitizeChecks(checks) {
    if (!isObject(checks)) return {};
    return Object.keys(checks).reduce(function (plans, planId) {
      var source = checks[planId];
      if (!isObject(source)) return plans;
      var marked = Object.keys(source).reduce(function (items, itemId) {
        if (source[itemId] === true) items[itemId] = true;
        return items;
      }, {});
      if (Object.keys(marked).length) plans[planId] = marked;
      return plans;
    }, {});
  }

  function normalizeOrder(order, checks) {
    var seen = Object.create(null);
    var result = [];
    if (Array.isArray(order)) {
      order.forEach(function (planId) {
        if (typeof planId !== 'string' || seen[planId] || !checks[planId]) return;
        seen[planId] = true;
        result.push(planId);
      });
    }
    Object.keys(checks).forEach(function (planId) {
      if (seen[planId]) return;
      seen[planId] = true;
      result.push(planId);
    });
    return result.slice(-MAX_PLANS);
  }

  function sanitizeState(candidate) {
    var state = emptyState();
    if (!isObject(candidate)) return state;
    state.form = sanitizeForm(candidate.form);
    state.phraseId = sanitizePhraseId(candidate.phraseId);
    state.checks = sanitizeChecks(candidate.checks);
    state.planOrder = normalizeOrder(candidate.planOrder, state.checks);
    Object.keys(state.checks).forEach(function (planId) {
      if (state.planOrder.indexOf(planId) === -1) delete state.checks[planId];
    });
    return state;
  }

  function migrateLegacyForm() {
    var legacy = safeParse(safeGet(LEGACY_FORM_KEY));
    var state = emptyState();
    state.form = sanitizeForm(legacy);
    return state;
  }

  function persist(state) {
    var sanitized = sanitizeState(state);
    memoryState = sanitized;
    safeSet(STORAGE_KEY, JSON.stringify(sanitized));
    return clone(sanitized);
  }

  function load() {
    if (memoryState) return clone(memoryState);
    var stored = safeParse(safeGet(STORAGE_KEY));
    if (isObject(stored) && stored.version === VERSION) {
      memoryState = sanitizeState(stored);
      return clone(memoryState);
    }
    return persist(migrateLegacyForm());
  }

  function normalizeText(value) {
    var text = value === null || value === undefined ? '' : String(value);
    if (typeof text.normalize === 'function') text = text.normalize('NFC');
    return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL');
  }

  function hash(value) {
    var text = String(value);
    var result = 0x811c9dc5;
    for (var index = 0; index < text.length; index += 1) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 0x01000193);
    }
    return ('00000000' + (result >>> 0).toString(16)).slice(-8);
  }

  function namesKey(names) {
    var list = Array.isArray(names) ? names : String(names || '').split(',');
    return list.map(normalizeText).filter(Boolean).join('|');
  }

  function makePlanId(form) {
    var source = isObject(form) ? form : {};
    var canonical = [
      normalizeText(source.layout),
      normalizeText(source.season),
      normalizeText(source.date),
      namesKey(source.names)
    ].join('\u001f');
    return 'plan-' + hash(canonical);
  }

  function makeItemId(options) {
    var source = isObject(options) ? options : {};
    var canonical = [
      normalizeText(source.kind || 'daily'),
      normalizeText(source.child),
      normalizeText(source.section),
      normalizeText(source.task),
      Number.isFinite(Number(source.occurrence)) ? String(Number(source.occurrence)) : '0',
      normalizeText(source.day)
    ].join('\u001f');
    return 'item-' + hash(canonical);
  }

  function updateForm(form) {
    var state = load();
    state.form = sanitizeForm(form);
    return persist(state);
  }

  function setPhraseId(phraseId) {
    var state = load();
    state.phraseId = sanitizePhraseId(phraseId);
    return persist(state);
  }

  function touchPlan(state, planId) {
    state.planOrder = state.planOrder.filter(function (id) { return id !== planId; });
    state.planOrder.push(planId);
    while (state.planOrder.length > MAX_PLANS) {
      delete state.checks[state.planOrder.shift()];
    }
  }

  function getChecks(planId) {
    var state = load();
    return clone(state.checks[planId] || {});
  }

  function isChecked(planId, itemId) {
    var state = load();
    return Boolean(state.checks[planId] && state.checks[planId][itemId]);
  }

  function setChecked(planId, itemId, checked) {
    if (typeof planId !== 'string' || !planId || typeof itemId !== 'string' || !itemId) {
      return load();
    }
    var state = load();
    if (checked) {
      if (!state.checks[planId]) state.checks[planId] = {};
      state.checks[planId][itemId] = true;
      touchPlan(state, planId);
    } else if (state.checks[planId]) {
      delete state.checks[planId][itemId];
      if (!Object.keys(state.checks[planId]).length) {
        delete state.checks[planId];
        state.planOrder = state.planOrder.filter(function (id) { return id !== planId; });
      }
    }
    return persist(state);
  }

  function resetPlan(planId) {
    if (typeof planId !== 'string' || !planId) return load();
    var state = load();
    delete state.checks[planId];
    state.planOrder = state.planOrder.filter(function (id) { return id !== planId; });
    return persist(state);
  }

  global.PlanState = Object.freeze({
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    MAX_PLANS: MAX_PLANS,
    load: load,
    saveForm: updateForm,
    setPhraseId: setPhraseId,
    getChecks: getChecks,
    isChecked: isChecked,
    setChecked: setChecked,
    resetPlan: resetPlan,
    makePlanId: makePlanId,
    makeItemId: makeItemId,
    normalizeText: normalizeText,
    hash: hash
  });
})(window);
