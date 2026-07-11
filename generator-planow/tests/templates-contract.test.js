'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const templatesDir = path.join(__dirname, '..', 'templates');

function read(name) {
  return fs.readFileSync(path.join(templatesDir, name), 'utf8');
}

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

function chunks(source, startPattern, endPattern) {
  const pattern = new RegExp(startPattern + '([\\s\\S]*?)(?=' + endPattern + ')', 'g');
  return Array.from(source.matchAll(pattern), match => match[1]);
}

function dailySections(scope) {
  const blocks = Array.from(scope.matchAll(
    /<section class="block"[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<div class="block-body">([\s\S]*?)<\/div>\s*<\/section>/g
  ), match => ({
    title: match[1].replace(/<[^>]+>/g, '').trim(),
    slots: count(match[2], /class="rule"/g)
  }));
  const joy = scope.match(/<section class="joy">([\s\S]*?)<\/section>/);
  return {
    blocks,
    joySlots: joy ? count(joy[1], /class="rule"/g) : 0
  };
}

function assertDailyScope(scope) {
  assert.deepEqual(dailySections(scope), {
    blocks: [
      { title: 'Rano', slots: 3 },
      { title: 'Po szkole', slots: 5 },
      { title: 'Wieczorem', slots: 3 }
    ],
    joySlots: 2
  });
  assert.equal(count(scope, /class="name"/g), 1);
}

test('plan osobny zachowuje kontrakt dwóch prototypowych stron A4', () => {
  const html = read('plan-osobno.html');
  const sheets = chunks(html, '<section class="sheet[^>]*>', '<section class="sheet|<\/body>');

  assert.match(html, /@page\s*{\s*size:\s*A4 portrait;\s*margin:\s*0;/);
  assert.equal(sheets.length, 2);
  assert.equal(count(html, /class="datefield"/g), 2);
  assert.equal(count(html, /class="foot"/g), 2);
  sheets.forEach(assertDailyScope);
});

test('plan wspólny zachowuje kontrakt dwóch kolumn na jednej stronie', () => {
  const html = read('plan-wspolny.html');
  const columns = chunks(html, '<section class="col[^>]*>', '<section class="col|<footer class="foot">');

  assert.match(html, /@page\s*{\s*size:\s*A4 portrait;\s*margin:\s*0;/);
  assert.equal(count(html, /<section class="sheet">/g), 1);
  assert.equal(columns.length, 2);
  assert.equal(count(html, /class="datefield"/g), 1);
  assert.equal(count(html, /<header class="topbar">/g), 1);
  assert.equal(count(html, /<header class="topbar">[\s\S]*?<h1>/g), 1);
  columns.forEach(assertDailyScope);
});

function assertWeeklyContract(file, middleClass, expected) {
  const html = read(file);

  assert.match(html, /@page\s*{\s*size:\s*A4 landscape;\s*margin:\s*0;/);
  assert.equal(count(html, /<section class="sheet">/g), 1);
  assert.equal(count(html, /class="name"/g), 1);
  assert.equal(count(html, /class="weekof"/g), 1);
  assert.equal(count(html, /class="group"/g), 3);
  assert.equal(count(html, /class="task rano"/g), expected.morning);
  assert.equal(count(html, new RegExp('class="task ' + middleClass + '"', 'g')), expected.daytime);
  assert.equal(count(html, /class="task wieczor"/g), expected.evening);
  assert.equal(count(html, /class="task-name"/g), expected.morning + expected.daytime + expected.evening);
  assert.equal(count(html, /class="checkbox"/g),
    (expected.morning + expected.daytime + expected.evening) * 7);
}

test('harmonogram szkolny zachowuje grupy i pojemność 4/3/3', () => {
  assertWeeklyContract('harmonogram-szkola.html', 'szkola', {
    morning: 4,
    daytime: 3,
    evening: 3
  });
});

test('harmonogram wakacyjny zachowuje grupy i pojemność 4/4/3', () => {
  assertWeeklyContract('harmonogram-wakacje.html', 'dzien', {
    morning: 4,
    daytime: 4,
    evening: 3
  });
});
