(function () {
  'use strict';

  var fields = ['names', 'layout', 'season', 'date', 'title', 'morning', 'daytime', 'evening', 'meTime']
    .map(function (id) { return document.getElementById(id); });
  var plan = document.getElementById('plan');
  var printButton = document.getElementById('printPlan');
  var validation = document.getElementById('validation');
  var status = document.getElementById('status');
  var renderTimer = null;
  var renderToken = 0;
  var frameReady = false;

  var phrases = [
    ['Odhaczam, gdy zrobione.', 'Każdy dzień to nowy start.'],
    ['Wakacje to też trochę rytmu.', 'Zrobione - i biegnę się bawić!'],
    ['Nie musi być idealnie.', 'Wystarczy jedna rzecz naraz.'],
    ['Mały krok też jest krokiem.', 'I właśnie go robię.'],
    ['Najpierw zaczynam.', 'Potem zobaczę, co dalej.'],
    ['Mój mózg ma swój rytm.', 'I to jest w porządku.'],
    ['Dzisiaj nie ścigam się z nikim.', 'Robię to w swoim tempie.'],
    ['Nie wszystko naraz.', 'Tylko następna mała rzecz.'],
    ['Przerwa też jest częścią planu.', 'Po niej mogę wrócić.'],
    ['Zrobione po swojemu.', 'Też znaczy zrobione.'],
    ['Nie muszę robić wszystkiego samodzielnie.', 'Mogę prosić o pomoc.'],
    ['Jedno odhaczenie.', 'To już sukces.'],
    ['Gdy utknę, biorę oddech.', 'Potem próbuję jeszcze raz.'],
    ['Mogę zacząć od najłatwiejszego.', 'Start jest najważniejszy.'],
    ['Plan ma mi pomagać.', 'Mam prawo go zmienić.'],
    ['Mój wysiłek się liczy.', 'Nawet jeśli go nie widać.'],
    ['Dzisiaj wystarczy tyle.', 'Ile dam radę.'],
    ['Nie muszę pamiętać wszystkiego.', 'Plan pamięta ze mną.'],
    ['Małe zwycięstwa.', 'Robią wielką różnicę.'],
    ['Najpierw jedna rzecz.', 'Potem zasłużona frajda.'],
    ['Wolniej.', 'Nie znaczy gorzej.'],
    ['Mogę wrócić do zadania.', 'Po potrzebnej przerwie.'],
    ['To jest mój plan.', 'Nie test.'],
    ['Wybieram jedną rzecz.', 'I daję jej chwilę.'],
    ['Pomyłka to informacja.', 'Nie katastrofa.'],
    ['Moje tempo.', 'Jest okej.'],
    ['Nie muszę widzieć całej drogi.', 'Wystarczy następny krok.'],
    ['Odhaczone!', 'Mózg lubi widzieć postęp.'],
    ['Nawet trudny dzień.', 'Może mieć miły moment.'],
    ['Nie chodzi o perfekcję.', 'Dobrze, że próbuję.'],
    ['Nie jestem spóźniony ani spóźniona.', 'Jestem tutaj.'],
    ['Plan jest po to, żeby pomagać.', 'Nigdy żeby straszyć.'],
    ['Po zadaniu.', 'Należy się chwila dumy.'],
    ['Wystarczy zacząć.', 'Choćby od dwóch minut.'],
    ['Dzisiaj wybieram.', 'Łagodność dla siebie.']
  ];

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function currentForm() {
    return fields.reduce(function (result, field) {
      result[field.id] = field.value;
      return result;
    }, {});
  }

  function names() {
    var result = value('names').split(',').map(function (name) { return name.trim(); }).filter(Boolean);
    return result.length ? result : ['Moje dziecko'];
  }

  function tasks(id) {
    return value(id).split('\n').map(function (task) { return task.trim(); }).filter(Boolean);
  }

  function sections() {
    return {
      morning: tasks('morning'),
      daytime: tasks('daytime'),
      evening: tasks('evening'),
      meTime: tasks('meTime')
    };
  }

  function templatePath() {
    if (value('layout') === 'daily-together') return 'templates/plan-wspolny.html';
    if (value('layout') === 'daily-separate') return 'templates/plan-osobno.html';
    return value('season') === 'holiday'
      ? 'templates/harmonogram-wakacje.html'
      : 'templates/harmonogram-szkola.html';
  }

  function localToday() {
    var now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function parsedDate() {
    var match = value('date').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
  }

  function shortDate(date, includeYear) {
    if (!date) return includeYear ? '__.__.____' : '__.__';
    var day = String(date.getDate()).padStart(2, '0');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    return includeYear ? day + '.' + month + '.' + date.getFullYear() : day + '.' + month;
  }

  function weekRange() {
    var date = parsedDate();
    if (!date) return ['__.__', '__.__'];
    var monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return [shortDate(monday, false), shortDate(sunday, false)];
  }

  function capacity() {
    if (value('layout') !== 'weekly') return { morning: 3, daytime: 5, evening: 3, meTime: 2 };
    return value('season') === 'holiday'
      ? { morning: 4, daytime: 4, evening: 3 }
      : { morning: 4, daytime: 3, evening: 3 };
  }

  function validate() {
    var limits = capacity();
    var data = sections();
    var labels = { morning: 'Rano', daytime: value('season') === 'holiday' ? 'W ciągu dnia' : 'Po szkole', evening: 'Wieczorem', meTime: 'Coś dla mnie' };
    var errors = [];
    Object.keys(limits).forEach(function (key) {
      if (data[key].length > limits[key]) {
        errors.push(labels[key] + ': maksymalnie ' + limits[key] + ' zadań (jest ' + data[key].length + ').');
      }
    });
    validation.textContent = errors.join(' ');
    validation.classList.toggle('show', errors.length > 0);
    return errors;
  }

  function setFooter(scope, phrase) {
    scope.querySelectorAll('.foot span').forEach(function (node) {
      node.textContent = phrase[0] + ' ';
      var emphasis = node.ownerDocument.createElement('b');
      emphasis.textContent = phrase[1];
      node.appendChild(emphasis);
    });
  }

  function setDailyHeader(scope, childName, title) {
    var name = scope.querySelector('.name');
    if (name) name.textContent = childName;
    scope.querySelectorAll('.kicker').forEach(function (node) { node.textContent = title; });
    scope.querySelectorAll('.topbar h1').forEach(function (node) { node.textContent = title; });
    scope.querySelectorAll('.datefield').forEach(function (node) {
      node.textContent = '';
      var bold = node.ownerDocument.createElement('b');
      bold.textContent = 'Data:';
      node.appendChild(bold);
      node.appendChild(node.ownerDocument.createTextNode(' ' + shortDate(parsedDate(), true)));
    });
    scope.querySelectorAll('.sub').forEach(function (node) {
      node.textContent = value('season') === 'holiday' ? 'Wakacyjny rytm - małe kroki' : 'Planujemy razem, wieczorem';
    });
    var blocks = scope.querySelectorAll('.block');
    if (blocks[1]) {
      var heading = blocks[1].querySelector('h2');
      if (heading) heading.textContent = value('season') === 'holiday' ? 'W ciągu dnia' : 'Po szkole';
      var hint = blocks[1].querySelector('.hint, .block-sub, .block-head small');
      if (hint && value('season') === 'holiday') hint.textContent = 'odpoczynek · ruch · własne sprawy';
    }
  }

  function taskKeys(list, options) {
    var seen = Object.create(null);
    return list.map(function (task) {
      var normalized = PlanState.normalizeText(task);
      var occurrence = seen[normalized] || 0;
      seen[normalized] = occurrence + 1;
      return PlanState.makeItemId({
        kind: options.kind,
        child: options.child,
        section: options.section,
        task: task,
        occurrence: occurrence,
        day: options.day
      });
    });
  }

  function installInteractiveStyle(doc) {
    var style = doc.createElement('style');
    style.textContent = [
      '@media print{.sheet + .sheet{break-before:page;page-break-before:always}}',
      '@media screen{body{zoom:var(--preview-zoom,1)}}',
      'input.box,input.checkbox{appearance:none;-webkit-appearance:none;padding:0;cursor:pointer;display:inline-grid;place-items:center;font:700 12px/1 system-ui;color:#fff}',
      'input.box:checked,input.checkbox:checked{background:var(--c,var(--cb,#22b8a6))}',
      'input.box:checked::after,input.checkbox:checked::after{content:"✓"}',
      'input.box:focus-visible,input.checkbox:focus-visible{outline:2px solid #30245c;outline-offset:2px}'
    ].join('');
    doc.head.appendChild(style);
  }

  function makeInput(original, key, label, planId) {
    var input = original.ownerDocument.createElement('input');
    input.type = 'checkbox';
    input.className = original.className;
    input.dataset.check = key;
    input.setAttribute('aria-label', label);
    input.checked = PlanState.isChecked(planId, key);
    original.replaceWith(input);
    return input;
  }

  function fillDailySection(scope, blockIndex, list, childName, sectionKey, planId) {
    var block = scope.querySelectorAll('.block')[blockIndex];
    if (!block) return;
    var rules = Array.from(block.querySelectorAll('.rule'));
    var keys = taskKeys(list, { kind: 'daily', child: childName, section: sectionKey });
    rules.forEach(function (rule, index) {
      rule.textContent = list[index] || '';
      var box = rule.parentElement.querySelector('.box');
      if (box && list[index]) makeInput(box, keys[index], childName + ', ' + list[index], planId);
    });
  }

  function fillJoy(scope, list) {
    var rules = Array.from(scope.querySelectorAll('.joy .rule'));
    rules.forEach(function (rule, index) { rule.textContent = list[index] || ''; });
  }

  function fillDailyScope(scope, childName, planId) {
    var data = sections();
    setDailyHeader(scope, childName, value('title') || 'Plan na dziś');
    fillDailySection(scope, 0, data.morning, childName, 'morning', planId);
    fillDailySection(scope, 1, data.daytime, childName, 'daytime', planId);
    fillDailySection(scope, 2, data.evening, childName, 'evening', planId);
    fillJoy(scope, data.meTime);
  }

  function prepareSeparate(doc, children, planId) {
    var prototypes = Array.from(doc.querySelectorAll('.sheet'));
    prototypes.forEach(function (sheet) { sheet.remove(); });
    children.forEach(function (childName, index) {
      var sheet = prototypes[index % prototypes.length].cloneNode(true);
      fillDailyScope(sheet, childName, planId);
      setFooter(sheet, phrases[phraseId]);
      doc.body.appendChild(sheet);
    });
  }

  function prepareTogether(doc, children, planId) {
    var prototype = doc.querySelector('.sheet');
    prototype.remove();
    for (var start = 0; start < children.length; start += 2) {
      var sheet = prototype.cloneNode(true);
      var columns = Array.from(sheet.querySelectorAll('.col'));
      var pair = children.slice(start, start + 2);
      columns.forEach(function (column, index) {
        if (!pair[index]) {
          column.remove();
          return;
        }
        fillDailyScope(column, pair[index], planId);
      });
      var heading = sheet.querySelector('.topbar h1');
      if (heading) heading.textContent = value('title') || 'Plan na dziś';
      setDailyHeader(sheet, pair[0], value('title') || 'Plan na dziś');
      if (pair.length === 1) {
        var cols = sheet.querySelector('.cols');
        if (cols) cols.style.justifyContent = 'stretch';
      }
      setFooter(sheet, phrases[phraseId]);
      doc.body.appendChild(sheet);
    }
  }

  function fillWeeklyRows(sheet, selector, list, childName, sectionKey, planId) {
    var rows = Array.from(sheet.querySelectorAll(selector));
    var keys = taskKeys(list, { kind: 'weekly', child: childName, section: sectionKey });
    rows.forEach(function (row, rowIndex) {
      var task = list[rowIndex] || '';
      var label = row.querySelector('.task-name');
      if (label) label.textContent = task;
      Array.from(row.querySelectorAll('.checkbox')).forEach(function (box, dayIndex) {
        if (!task) return;
        var key = PlanState.makeItemId({ kind: 'weekly', child: childName, section: sectionKey, task: task, occurrence: keys[rowIndex], day: dayIndex });
        makeInput(box, key, childName + ', ' + task + ', dzień ' + (dayIndex + 1), planId);
      });
    });
  }

  function prepareWeekly(doc, children, planId) {
    var prototype = doc.querySelector('.sheet');
    prototype.remove();
    var data = sections();
    var middleSelector = value('season') === 'holiday' ? '.task.dzien' : '.task.szkola';
    var range = weekRange();
    children.forEach(function (childName) {
      var sheet = prototype.cloneNode(true);
      var name = sheet.querySelector('.name');
      if (name) name.textContent = childName;
      var kicker = sheet.querySelector('.kicker');
      var requestedTitle = value('title');
      var defaultWeeklyTitle = value('season') === 'holiday' ? 'Moje wakacyjne obowiązki' : 'Moje codzienne obowiązki';
      if (/^plan na (dziś|jutro)$/i.test(requestedTitle)) requestedTitle = '';
      if (kicker) kicker.textContent = requestedTitle || defaultWeeklyTitle;
      var week = sheet.querySelector('.weekof');
      if (week) {
        week.textContent = 'Tydzień od ';
        var from = doc.createElement('b');
        from.textContent = range[0];
        var to = doc.createElement('b');
        to.textContent = range[1];
        week.appendChild(from);
        week.appendChild(doc.createTextNode(' do '));
        week.appendChild(to);
      }
      fillWeeklyRows(sheet, '.task.rano', data.morning, childName, 'morning', planId);
      fillWeeklyRows(sheet, middleSelector, data.daytime, childName, 'daytime', planId);
      fillWeeklyRows(sheet, '.task.wieczor', data.evening, childName, 'evening', planId);
      setFooter(sheet, phrases[phraseId]);
      doc.body.appendChild(sheet);
    });
  }

  function bindChecks(doc, planId) {
    doc.addEventListener('change', function (event) {
      var checkbox = event.target.closest('input[data-check]');
      if (!checkbox) return;
      PlanState.setChecked(planId, checkbox.dataset.check, checkbox.checked);
      status.textContent = checkbox.checked ? 'Odhaczenie zapisane.' : 'Odhaczenie usunięte.';
    });
  }

  function fitFrame(frame, doc) {
    doc.documentElement.style.setProperty('--preview-zoom', '1');
    var naturalWidth = Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth, 1);
    var scale = Math.min(1, Math.max(0.45, (frame.clientWidth - 4) / naturalWidth));
    doc.documentElement.style.setProperty('--preview-zoom', String(scale));
    var height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 650);
    frame.style.height = height + 'px';
  }

  async function fillFrame(frame, token) {
    if (token !== renderToken) return;
    var doc = frame.contentDocument;
    if (!doc) throw new Error('Nie udało się otworzyć szablonu.');
    var form = currentForm();
    var planId = PlanState.makePlanId(form);
    installInteractiveStyle(doc);
    if (form.layout === 'daily-separate') prepareSeparate(doc, names(), planId);
    else if (form.layout === 'daily-together') prepareTogether(doc, names(), planId);
    else prepareWeekly(doc, names(), planId);
    doc.querySelectorAll('.tip').forEach(function (tip) { tip.remove(); });
    bindChecks(doc, planId);
    if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
    await new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
    if (token !== renderToken) return;
    fitFrame(frame, doc);
    frameReady = validate().length === 0;
    printButton.disabled = !frameReady;
    status.textContent = frameReady ? 'Plan gotowy do wydruku.' : 'Popraw liczbę zadań przed wydrukiem.';
  }

  function render() {
    clearTimeout(renderTimer);
    renderTimer = null;
    renderToken += 1;
    var token = renderToken;
    frameReady = false;
    printButton.disabled = true;
    document.getElementById('daytimeLabel').textContent = value('season') === 'holiday' ? 'W ciągu dnia' : 'Po szkole';
    document.getElementById('meTimeField').classList.toggle('field-hidden', value('layout') === 'weekly');
    validate();
    plan.textContent = '';
    var frame = document.createElement('iframe');
    frame.className = 'template-preview';
    frame.id = 'templatePreview';
    frame.title = 'Podgląd wybranego szablonu';
    frame.src = templatePath();
    frame.addEventListener('load', function () {
      fillFrame(frame, token).catch(function () {
        frameReady = false;
        printButton.disabled = true;
        status.textContent = 'Nie udało się przygotować podglądu. Odśwież stronę i spróbuj ponownie.';
      });
    });
    frame.addEventListener('error', function () {
      status.textContent = 'Nie udało się wczytać szablonu.';
    });
    plan.appendChild(frame);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 180);
  }

  var stored = PlanState.load();
  fields.forEach(function (field) {
    if (typeof stored.form[field.id] === 'string') field.value = stored.form[field.id];
  });
  if (!value('date')) document.getElementById('date').value = localToday();
  var phraseId = Number(stored.phraseId);
  if (!Number.isInteger(phraseId) || phraseId < 0 || phraseId >= phrases.length) {
    phraseId = Math.floor(Math.random() * phrases.length);
    PlanState.setPhraseId(phraseId);
  }

  fields.forEach(function (field) {
    field.addEventListener('input', function () {
      PlanState.saveForm(currentForm());
      scheduleRender();
    });
    field.addEventListener('change', function () {
      PlanState.saveForm(currentForm());
      render();
    });
  });

  document.getElementById('newPlan').addEventListener('click', function () {
    var next = phraseId;
    while (phrases.length > 1 && next === phraseId) next = Math.floor(Math.random() * phrases.length);
    phraseId = next;
    PlanState.setPhraseId(phraseId);
    render();
  });

  printButton.addEventListener('click', function () {
    var frame = document.getElementById('templatePreview');
    if (!frameReady || !frame || !frame.contentWindow) return;
    frame.contentWindow.print();
  });

  document.getElementById('resetPlan').addEventListener('click', function () {
    PlanState.resetPlan(PlanState.makePlanId(currentForm()));
    status.textContent = 'Odhaczenia tego planu zostały wyczyszczone.';
    render();
  });

  PlanState.saveForm(currentForm());
  render();
})();
