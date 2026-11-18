/**
 * Abrupt Si pn-junction depletion approximation, 300 K.
 * Local course references: "261105 - ideal pn diode.pdf", pp. 2–5;
 * "HW 5 Solutions.pdf", pp. 1–3; "EE 216 HW6.pdf", pp. 2–3.
 * Constants use cm internally (epsilon in F/cm). Outputs explicitly convert
 * widths and x coordinates to micrometers. Positive bias is forward bias.
 * This is electrostatics, not a breakdown or carrier-transport solver.
 */
const Q = 1.602176634e-19;
const EPSILON = 11.7 * 8.8541878128e-14;
const THERMAL_VOLTAGE = 8.617333262145e-5 * 300;
const NI = 1e10;

export function junction({ logNa = 16, logNd = 16, bias = 0 } = {}) {
  for (const [name, value] of Object.entries({ logNa, logNd })) {
    if (!Number.isFinite(value) || value < 14 || value > 18) {
      throw new RangeError(`${name} must be a number from 14 to 18.`);
    }
  }
  const Na = 10 ** logNa;
  const Nd = 10 ** logNd;
  const Vbi = THERMAL_VOLTAGE * Math.log((Na * Nd) / NI ** 2);
  const minBias = -3;
  const maxBias = Math.min(0.5, Vbi - 0.15);
  if (!Number.isFinite(bias) || bias < minBias || bias > maxBias + 1e-12) {
    throw new RangeError(`bias must be between ${minBias} and ${maxBias} V.`);
  }
  const barrier = Vbi - bias;
  const widthCm = Math.sqrt((2 * EPSILON / Q) * (1 / Na + 1 / Nd) * barrier);
  const xpCm = widthCm * Nd / (Na + Nd);
  const xnCm = widthCm * Na / (Na + Nd);
  const peakField = (2 * barrier) / widthCm;

  const x = [];
  const rho = [];
  const field = [];
  const potential = [];
  function sample(position, region) {
    x.push(position * 1e4);
    if (region === 'p-neutral') {
      rho.push(0); field.push(0); potential.push(0);
    } else if (region === 'p-depletion') {
      rho.push(-Q * Na);
      field.push(-Q * Na * (position + xpCm) / EPSILON);
      potential.push(Q * Na * (position + xpCm) ** 2 / (2 * EPSILON));
    } else if (region === 'n-depletion') {
      rho.push(Q * Nd);
      field.push(Q * Nd * (position - xnCm) / EPSILON);
      potential.push(barrier - Q * Nd * (xnCm - position) ** 2 / (2 * EPSILON));
    } else {
      rho.push(0); field.push(0); potential.push(barrier);
    }
  }
  // Separate meshes retain narrow-side detail even for 10,000:1 doping.
  // Duplicate boundary coordinates draw the discontinuous box-charge edges.
  sample(-xpCm - widthCm * 0.25, 'p-neutral');
  sample(-xpCm, 'p-neutral');
  for (let i = 0; i <= 100; i++) sample(i === 100 ? 0 : -xpCm + xpCm * i / 100, 'p-depletion');
  for (let i = 0; i <= 100; i++) sample(i === 100 ? xnCm : xnCm * i / 100, 'n-depletion');
  sample(xnCm, 'n-neutral');
  sample(xnCm + widthCm * 0.25, 'n-neutral');

  return {
    Na, Nd, Vbi, barrier, bias, minBias, maxBias,
    W: widthCm * 1e4, xp: xpCm * 1e4, xn: xnCm * 1e4,
    peakField, capacitance: EPSILON / widthCm,
    x, rho, field, potential,
  };
}
