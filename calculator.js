/* Auto True Cost Analyzer. MIT License. */
(function (root) {
  'use strict';
  const DEPRECIATION = [0.20, 0.15, 0.12, 0.10, 0.09];
  const MAINTENANCE = [1, 1.1, 1.25, 1.5, 1.8];
  function number(value, label, min, max) {
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new RangeError(`${label} is required.`);
    }
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new RangeError(`${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}.`);
    }
    return n;
  }
  function escapeHTML(value) {
    const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, c => replacements[c]);
  }
  function calculateVehicle(v, gasPrice) {
    const price = number(v.price, 'Purchase price', 0, 10000000);
    const down = number(v.down, 'Down payment', 0, price);
    const rate = number(v.rate, 'APR', 0, 100);
    const term = number(v.term, 'Loan term', 24, 84);
    if (![24, 36, 48, 60, 72, 84].includes(term)) throw new RangeError('Choose a supported loan term.');
    const mpg = number(v.mpg, 'Fuel economy', 0.1, 1000);
    const miles = number(v.miles, 'Annual miles', 0, 1000000);
    const ins = number(v.ins, 'Monthly insurance', 0, 100000);
    const maint = number(v.maint, 'Year-one maintenance', 0, 1000000);
    const gas = number(gasPrice, 'Gas price', 0, 1000);
    const principal = price - down;
    const monthlyRate = rate / 1200;
    const monthlyPayment = principal === 0 ? 0 : monthlyRate === 0 ? principal / term : principal * monthlyRate / -Math.expm1(-term * Math.log1p(monthlyRate));
    let balance = principal;
    let value = price;
    let cashOut = down;
    let interestTotal = 0;
    let totalFuel5 = 0;
    let totalIns5 = 0;
    let totalMaint5 = 0;
    const cumByYear = [];
    for (let year = 1; year <= 5; year++) {
      for (let month = (year - 1) * 12; month < year * 12 && month < term; month++) {
        const interest = balance * monthlyRate;
        const payment = Math.min(monthlyPayment, balance + interest);
        interestTotal += interest;
        cashOut += payment;
        balance = Math.max(0, balance + interest - payment);
        if (balance < 1e-8) balance = 0;
      }
      value *= 1 - DEPRECIATION[year - 1];
      totalFuel5 += miles / mpg * gas;
      totalIns5 += ins * 12;
      totalMaint5 += maint * MAINTENANCE[year - 1];
      const cum = cashOut + totalFuel5 + totalIns5 + totalMaint5;
      cumByYear.push({ year, cum, residual: value, balance, interest: interestTotal, net: cum + balance - value });
    }
    const tco5 = cumByYear[4].net;
    const totalMiles5 = miles * 5;
    return {
      monthlyPayment, totalInterest: interestTotal, tco5,
      cumDepreciation: price - value, totalFuel5, totalIns5, totalMaint5,
      residual5: value, remainingBalance5: balance, cashOut5yr: cashOut,
      cumByYear, cpm: totalMiles5 === 0 ? null : tco5 / totalMiles5,
      totalMiles5, price, down,
    };
  }
  const api = { calculateVehicle, escapeHTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoCost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
