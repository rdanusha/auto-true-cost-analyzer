/* Auto True Cost Analyzer. MIT License. */
'use strict';
const { calculateVehicle, escapeHTML: esc } = AutoCost;
const $ = id => document.getElementById(id);
const COLORS = ['#91b7ff', '#c7a6ff', '#83e5bd', '#ffc38a'];
const FIELDS = [
  ['name', 'Vehicle name', 'text', '', '', ''],
  ['price', 'Purchase price (USD)', 'number', 0, 10000000, '0.01'],
  ['down', 'Down payment (USD)', 'number', 0, 10000000, '0.01'],
  ['rate', 'Loan APR (%)', 'number', 0, 100, '0.01'],
  ['term', 'Loan term (months)', 'select'],
  ['mpg', 'Fuel economy (US MPG)', 'number', 0.1, 1000, '0.1'],
  ['miles', 'Annual miles', 'number', 0, 1000000, '1'],
  ['ins', 'Insurance (USD / month)', 'number', 0, 100000, '0.01'],
  ['maint', 'Year-one maintenance (USD)', 'number', 0, 1000000, '0.01'],
];
let vehicles = [];
let nextId = 0;
let activeView = 'tco';
const money = (n, decimals = 0) => n === null || !Number.isFinite(n) ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
const nameOf = (v, i) => v.name.trim() || `Vehicle ${i + 1}`;
function makeVehicle(values = {}) {
  return { id: nextId++, name: '', price: '', down: 0, rate: 0, term: 60, mpg: '', miles: 12000, ins: '', maint: '', ...values };
}
function loadExamples() {
  vehicles = [
    makeVehicle({ name: 'Example pickup', price: 38500, down: 5000, rate: 6.5, term: 60, mpg: 22, miles: 14000, ins: 165, maint: 900 }),
    makeVehicle({ name: 'Example crossover', price: 31000, down: 5000, rate: 6.5, term: 60, mpg: 31, miles: 14000, ins: 140, maint: 700 }),
  ];
  renderCards();
}
function renderCards() {
  const grid = $('vehiclesGrid');
  grid.replaceChildren();
  if (!vehicles.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Add a vehicle to start, or load the illustrative examples.';
    grid.append(empty);
  }
  vehicles.forEach((v, index) => {
    const card = $('vehicleTemplate').content.firstElementChild.cloneNode(true);
    card.id = `card-${v.id}`;
    card.style.setProperty('--vehicle-color', COLORS[index % COLORS.length]);
    card.querySelector('.vehicle-number').textContent = `VEHICLE ${index + 1}`;
    card.querySelector('.vehicle-title').textContent = nameOf(v, index);
    const remove = card.querySelector('.remove');
    remove.setAttribute('aria-label', `Remove vehicle ${index + 1}`);
    remove.addEventListener('click', () => {
      vehicles = vehicles.filter(vehicle => vehicle.id !== v.id);
      renderCards();
      $('addBtn').focus();
    });
    for (const [key, labelText, type, min, max, step] of FIELDS) {
      const group = document.createElement('div');
      group.className = key === 'name' ? 'field full' : 'field';
      const label = document.createElement('label');
      const input = document.createElement(type === 'select' ? 'select' : 'input');
      input.id = `v-${v.id}-${key}`;
      label.htmlFor = input.id;
      label.textContent = labelText;
      if (type === 'select') {
        for (const term of [24, 36, 48, 60, 72, 84]) input.add(new Option(`${term} months`, term));
      } else {
        input.type = type;
        if (type === 'number') {
          input.min = min;
          input.max = max;
          input.step = step;
          input.required = true;
          input.inputMode = 'decimal';
        } else { input.maxLength = 100; input.autocomplete = 'off'; }
      }
      input.value = v[key];
      input.addEventListener('input', () => {
        v[key] = input.value;
        card.querySelector('.vehicle-title').textContent = nameOf(v, index);
        recalculate();
      });
      group.append(label, input);
      card.querySelector('.fields').append(group);
    }
    card.querySelector('.results').innerHTML = ['Monthly loan payment', 'Five-year total cost', 'Estimated resale value', 'Cost per mile'].map(label => `<div class="stat"><dt>${label}</dt><dd>Not available</dd></div>`).join('');
    grid.append(card);
  });
  recalculate();
}
function recalculate() {
  const results = [];
  let invalid = false;
  $('globalError').textContent = '';
  $('gasPrice').removeAttribute('aria-invalid');
  try {
    // Validate the shared setting even when the list is empty.
    const raw = $('gasPrice').value;
    if (raw.trim() === '' || !Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 1000) throw new Error('Enter a gas price from 0 to 1,000 USD per US gallon.');
  } catch (error) {
    $('globalError').textContent = error.message;
    $('gasPrice').setAttribute('aria-invalid', 'true');
    invalid = true;
  }
  for (const [i, v] of vehicles.entries()) {
    const card = $(`card-${v.id}`);
    const errorEl = card.querySelector('.validation-message');
    const stats = card.querySelectorAll('dd');
    try {
      const r = calculateVehicle(v, $('gasPrice').value);
      errorEl.textContent = '';
      [money(r.monthlyPayment, 2), money(r.tco5), money(r.residual5), money(r.cpm, 3)].forEach((value, j) => { stats[j].textContent = value; });
      results.push({ v, r, index: i });
    } catch (error) {
      invalid = true;
      errorEl.textContent = error.message;
      stats.forEach(stat => { stat.textContent = 'Not available'; });
    }
  }
  $('status').textContent = invalid ? 'Complete or correct the fields above to see a comparison. Zero is allowed for costs and annual mileage.' : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} in this comparison. ${vehicles.length < 2 ? 'Add another vehicle to compare.' : ''}`;
  $('comparison').hidden = invalid || results.length < 2;
  if (!invalid && results.length >= 2) renderComparison(results);
}
function renderComparison(results) {
  const ranked = [...results].sort((a, b) => a.r.tco5 - b.r.tco5);
  const best = ranked[0];
  const savings = ranked.at(-1).r.tco5 - best.r.tco5;
  const tied = results.filter(res => Math.abs(res.r.tco5 - best.r.tco5) < 0.005).length;
  $('verdict').innerHTML = tied > 1
    ? `<strong>${tied} vehicles tie for the lowest estimated cost</strong> at ${money(best.r.tco5)} over five years, based on your inputs.`
    : `<strong>${esc(nameOf(best.v, best.index))}</strong> has the lowest estimated five-year cost at <strong>${money(best.r.tco5)}</strong>. That is ${money(savings)} less than the highest-cost option, about ${money(savings / 60)} a month.`;
  renderBars('view-tco', results, 'tco5', 0);
  renderBars('view-costmile', results, 'cpm', 3);
  const labels = [
    ['cumDepreciation', 'Depreciation'], ['totalInterest', 'Interest paid during five years'],
    ['totalFuel5', 'Fuel'], ['totalIns5', 'Insurance'], ['totalMaint5', 'Maintenance'],
    ['remainingBalance5', 'Loan debt after five years*'], ['residual5', 'Estimated resale value*'], ['tco5', 'Total five-year cost'],
  ];
  $('view-breakdown').innerHTML = '<div class="breakdowns">' + results.map(({ v, r, index }) => `<div class="breakdown"><h3 style="color:${COLORS[index % COLORS.length]}">${esc(nameOf(v, index))}</h3><dl>${labels.map(([key, label]) => `<div class="breakdown-row"><dt>${label}</dt><dd>${money(r[key], 2)}</dd></div>`).join('')}</dl></div>`).join('') + '</div><p class="help">*Loan debt and resale value are reference figures, not extra costs to add to the breakdown. Depreciation already accounts for resale value.</p>';
  $('view-yearly').innerHTML = `<div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable year-by-year comparison"><table><caption>Net ownership cost to each year end, including any remaining loan debt and subtracting estimated resale value.</caption><thead><tr><th scope="col">Year</th>${results.map(({ v, index }) => `<th scope="col">${esc(nameOf(v, index))}</th>`).join('')}</tr></thead><tbody>${[1, 2, 3, 4, 5].map(year => `<tr><th scope="row">Year ${year}</th>${results.map(({ r }) => `<td>${money(r.cumByYear[year - 1].net)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  setView(activeView);
}
function renderBars(target, results, key, decimals) {
  const max = Math.max(0, ...results.map(res => res.r[key] ?? 0));
  $(target).innerHTML = results.map(({ v, r, index }) => {
    const value = r[key];
    const percent = max > 0 && value !== null ? value / max * 100 : 0;
    return `<div class="chart-row"><div class="chart-label"><span>${esc(nameOf(v, index))}</span><strong>${money(value, decimals)}</strong></div><div class="track" aria-hidden="true"><div class="fill" style="width:${percent}%;background:${COLORS[index % COLORS.length]}"></div></div></div>`;
  }).join('') + (key === 'cpm' ? '<p class="help">Five-year cost divided by five years of mileage. Not available for zero annual miles.</p>' : '');
}
function setView(view) {
  activeView = view;
  for (const button of document.querySelectorAll('.tab')) {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    $(`view-${button.dataset.view}`).hidden = !active;
  }
}
$('gasPrice').addEventListener('input', recalculate);
$('addBtn').addEventListener('click', () => {
  const vehicle = makeVehicle();
  vehicles.push(vehicle);
  renderCards();
  $(`v-${vehicle.id}-name`).focus();
});
$('sampleBtn').addEventListener('click', () => {
  if (vehicles.length && !window.confirm('Replace your current entries with illustrative examples?')) return;
  loadExamples();
});
$('clearBtn').addEventListener('click', () => {
  if (vehicles.length && !window.confirm('Clear all vehicle entries? This cannot be undone.')) return;
  vehicles = [];
  renderCards();
  $('addBtn').focus();
});
for (const button of document.querySelectorAll('.tab')) button.addEventListener('click', () => setView(button.dataset.view));
loadExamples();
