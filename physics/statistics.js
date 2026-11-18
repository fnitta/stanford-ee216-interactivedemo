/** Boltzmann constant in eV/K; energies in this module are relative to E_F. */
export const KB_EV = 8.617333262e-5;

function inRange(name, value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number between ${min} and ${max}.`);
  }
}

function occupation(energy, temperature) {
  const z = energy / (KB_EV * temperature);
  const mb = Math.exp(-z);
  // This form avoids an overflowing exp(z) for positive energies.
  const f = z >= 0 ? mb / (1 + mb) : 1 / (1 + Math.exp(z));
  return { energy, f, mb };
}

/**
 * Fermi–Dirac occupation of one energy state, with a Boltzmann comparison.
 * temperature: kelvin, 50–2000; energy: E−E_F in eV, −0.35…0.5.
 * These instructional bounds also keep every returned value finite.
 * relativeError = |f_MB−f_FD|/f_FD (a fraction; multiply by 100 for percent).
 * curve samples the fixed energy domain −0.35…0.5 eV in 0.0025 eV steps.
 * This is an occupation probability, not an integrated carrier concentration.
 * MB is reliable only when E−E_F is sufficiently positive (typically >3k_BT).
 * Source: EE 216, “260929 - Carriers.pdf”, p.1, slides 2–3.
 */
export function statistics({ temperature = 300, energy = 0.1 } = {}) {
  inRange('temperature (K)', temperature, 50, 2000);
  inRange('energy relative to E_F (eV)', energy, -0.35, 0.5);
  const selected = occupation(energy, temperature);
  const curve = Array.from({ length: 341 }, (_, i) =>
    occupation(-0.35 + (0.85 * i) / 340, temperature));
  return {
    temperature,
    ...selected,
    relativeError: Math.abs(selected.mb - selected.f) / selected.f,
    curve,
  };
}
