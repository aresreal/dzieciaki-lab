'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'plan-state.js'), 'utf8');

class FakeLocalStorage {
  constructor(initial) {
    this.values = new Map(Object.entries(initial || {}).map(([key, value]) => [key, String(value)]));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function loadPlanState(storage) {
  const window = { localStorage: storage };
  vm.runInNewContext(source, { window }, { filename: 'plan-state.js' });
  return window.PlanState;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('zapisuje formularz i odtwarza go po ponownym uruchomieniu', () => {
  const storage = new FakeLocalStorage();
  let state = loadPlanState(storage);

  state.saveForm({
    names: 'Klara, Maja',
    layout: 'daily-together',
    morning: 'Śniadanie',
    unknown: 'nie zapisuj'
  });

  state = loadPlanState(storage);
  assert.deepEqual(plain(state.load().form), {
    names: 'Klara, Maja',
    layout: 'daily-together',
    morning: 'Śniadanie'
  });
});

test('zapisuje identyfikator wylosowanej frazy', () => {
  const storage = new FakeLocalStorage();
  let state = loadPlanState(storage);

  state.setPhraseId('adhd-17');
  state = loadPlanState(storage);

  assert.equal(state.load().phraseId, 'adhd-17');
});

test('zapisuje odhaczenia osobno dla planów i pozwala je wycofać', () => {
  const storage = new FakeLocalStorage();
  let state = loadPlanState(storage);

  state.setChecked('plan-a', 'task-1', true);
  state.setChecked('plan-a', 'task-2', true);
  state.setChecked('plan-b', 'task-1', true);
  state.setChecked('plan-a', 'task-1', false);
  state = loadPlanState(storage);

  assert.deepEqual(plain(state.getChecks('plan-a')), { 'task-2': true });
  assert.deepEqual(plain(state.getChecks('plan-b')), { 'task-1': true });
  assert.equal(state.isChecked('plan-a', 'task-1'), false);
  assert.equal(state.isChecked('plan-a', 'task-2'), true);
});

test('reset usuwa wyłącznie odhaczenia wskazanego planu', () => {
  const storage = new FakeLocalStorage();
  let state = loadPlanState(storage);

  state.setChecked('plan-a', 'task-1', true);
  state.setChecked('plan-b', 'task-1', true);
  state.resetPlan('plan-a');
  state = loadPlanState(storage);

  assert.deepEqual(plain(state.getChecks('plan-a')), {});
  assert.deepEqual(plain(state.getChecks('plan-b')), { 'task-1': true });
  assert.deepEqual(plain(state.load().planOrder), ['plan-b']);
});

test('migruje formularz v1 do aktualnego formatu', () => {
  const storage = new FakeLocalStorage({
    'planownia-form-v1': JSON.stringify({
      names: 'Klara',
      season: 'school',
      title: 'Mój plan',
      foreign: 'pomiń'
    })
  });
  const state = loadPlanState(storage);
  const loaded = plain(state.load());

  assert.equal(loaded.version, 2);
  assert.deepEqual(loaded.form, {
    names: 'Klara',
    season: 'school',
    title: 'Mój plan'
  });
  assert.equal(JSON.parse(storage.getItem(state.STORAGE_KEY)).version, 2);
});

test('uszkodzony JSON nie wywraca aplikacji i daje pusty, poprawny stan', () => {
  const storage = new FakeLocalStorage({
    'planownia-v2': '{to nie jest json',
    'planownia-form-v1': '[również uszkodzone'
  });
  const state = loadPlanState(storage);

  assert.deepEqual(plain(state.load()), {
    version: 2,
    form: {},
    phraseId: null,
    checks: {},
    planOrder: []
  });
  assert.doesNotThrow(() => JSON.parse(storage.getItem(state.STORAGE_KEY)));
});
