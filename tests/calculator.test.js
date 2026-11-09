const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateVehicle, escapeHTML } = require('../calculator.js');
const base = { price: 30000, down: 5000, rate: 0, term: 60, mpg: 25, miles: 12000, ins: 150, maint: 800 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`);

test('zero APR and 60 months match depreciation plus operating costs', () => {
  const r = calculateVehicle(base, 3.25);
  close(r.monthlyPayment, 25000 / 60);
  close(r.tco5, r.cumDepreciation + r.totalFuel5 + r.totalIns5 + r.totalMaint5);
  close(r.totalInterest, 0);
  close(r.remainingBalance5, 0);
});
test('84-month loan includes outstanding balance without treating principal as interest', () => {
  const r = calculateVehicle({ ...base, term: 84 }, 3.25);
  close(r.remainingBalance5, 25000 * 24 / 84);
  close(r.tco5, calculateVehicle(base, 3.25).tco5);
  close(r.totalInterest, 0);
  close(r.cumByYear[4].net, r.tco5);
});
test('positive APR amortizes monthly and reconciles every year', () => {
  for (const term of [24, 36, 48, 60, 72, 84]) {
    const r = calculateVehicle({ ...base, rate: 6.5, term }, 3.25);
    assert.ok(r.totalInterest > 0);
    close(r.tco5, r.cumDepreciation + r.totalInterest + r.totalFuel5 + r.totalIns5 + r.totalMaint5);
    close(r.cashOut5yr + r.remainingBalance5 - r.residual5 + r.totalFuel5 + r.totalIns5 + r.totalMaint5, r.tco5);
    close(r.cumByYear[4].net, r.tco5);
    assert.ok(r.cumByYear.every(y => y.balance >= 0 && y.interest >= 0));
  }
});
for (const rate of [1e-12, 1e-14]) {
  test(`tiny positive APR ${rate} stays finite and pays off a 60-month loan`, () => {
    const r = calculateVehicle({ ...base, rate }, 3.25);
    assert.ok(Number.isFinite(r.monthlyPayment));
    close(r.monthlyPayment, 25000 / 60);
    close(r.remainingBalance5, 0);
    assert.ok(Number.isFinite(r.tco5));
    // Independently calculated depreciation and operating costs; interest is negligible.
    close(r.tco5, 37417.312);
  });
}

// Independent references: Python Decimal at 70-digit precision. Sum monthly
// discount factors by repeated division, divide principal by that sum, then
// roll the debt forward 60 months. No log1p/expm1 or closed-form annuity formula.
for (const [term, payment, balance60] of [
  [72, 420.24824059455648707856, 4869.82258820756094601733],
  [84, 371.23591179577726192434, 8333.71832307546484475493],
]) {
  test(`${term}-month positive APR matches independent high-precision references`, () => {
    const r = calculateVehicle({ ...base, rate: 6.5, term }, 3.25);
    close(r.monthlyPayment, payment);
    close(r.remainingBalance5, balance60);
  });
}

test('cash purchase has no payment or interest', () => {
  const r = calculateVehicle({ ...base, down: 30000, rate: 6.5 }, 3.25);
  close(r.monthlyPayment, 0);
  close(r.totalInterest, 0);
  close(r.remainingBalance5, 0);
});
test('explicit zero operating inputs remain zero and zero mileage gives unavailable cost per mile', () => {
  const r = calculateVehicle({ ...base, ins: 0, maint: 0, miles: 0 }, 0);
  close(r.totalIns5, 0);
  close(r.totalMaint5, 0);
  close(r.totalFuel5, 0);
  assert.equal(r.cpm, null);
});
test('missing inputs and invalid values fail closed', () => {
  for (const change of [{ price: '' }, { down: -1 }, { down: 30001 }, { rate: -1 }, { rate: 101 }, { mpg: 0 }, { mpg: 'Infinity' }, { miles: -1 }, { ins: '' }, { maint: 'nope' }, { term: 0 }, { term: 12 }, { term: 60.5 }]) {
    assert.throws(() => calculateVehicle({ ...base, ...change }, 3.25), RangeError);
  }
  assert.throws(() => calculateVehicle(base, -1), RangeError);
  assert.throws(() => calculateVehicle(base, ''), RangeError);
});
test('zero price and costs produce a valid zero total', () => {
  const r = calculateVehicle({ ...base, price: 0, down: 0, ins: 0, maint: 0 }, 0);
  close(r.tco5, 0);
  close(r.cpm, 0);
});
test('unsafe HTML and quoted attributes are escaped', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)"> & \'test\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;test&#39;');
});
