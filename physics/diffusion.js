function inRange(name, value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number between ${min} and ${max}.`);
  }
}

/**
 * Steady minority-hole profile near a recombining surface of n-type material.
 * D: diffusivity, cm²/s (0.01…1000); tau: bulk lifetime, µs (0.001…10000);
 * S: surface recombination velocity, cm/s (0…1e8).
 * Returns L and profile[].x in µm, and y = (p−p0)/(G_L tau).
 * The x domain follows the diffusion length: 0…5L, with 201 samples.
 * Model: D p'' − (p−p0)/tau + G_L = 0, D p'(0)=S[p(0)−p0].
 * Thus y=1−[a/(1+a)]exp(−x/L), a=S tau/L, L=sqrt(D tau).
 * Assumes low injection, constant D/tau, uniform generation, negligible drift,
 * a planar surface at x=0, and a semi-infinite bulk. It does not model a
 * finite wafer, pulsed excitation, or injection-dependent recombination.
 * Source: EE 216, “261022 - Diffusion 2.pdf”, pp.4–5.
 */
export function diffusion({ D = 12.4, tau = 1, S = 1e4 } = {}) {
  inRange('D (cm²/s)', D, 0.01, 1000);
  inRange('tau (µs)', tau, 0.001, 10000);
  inRange('S (cm/s)', S, 0, 1e8);
  const tauSeconds = tau * 1e-6;
  const lengthCm = Math.sqrt(D * tauSeconds);
  const L = lengthCm * 1e4;
  const a = S * tauSeconds / lengthCm;
  const surfaceFraction = 1 / (1 + a);
  const lossFraction = a / (1 + a);
  const profile = Array.from({ length: 201 }, (_, i) => {
    const normalizedX = (5 * i) / 200;
    return { x: normalizedX * L, y: 1 - lossFraction * Math.exp(-normalizedX) };
  });
  return { D, tau, S, L, surfaceFraction, profile };
}
