/** Triangle LFO — linear sweep between min and max. */
export function triangleLfo(timeSeconds, rateHz, min, max) {
  const phase = (timeSeconds * rateHz) % 1;
  const t = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return min + (max - min) * t;
}
