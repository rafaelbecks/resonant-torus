export function c(re, im = 0) {
  return { re, im };
}

export function cAdd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a, b) {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cScale(a, s) {
  return { re: a.re * s, im: a.im * s };
}

export function cConj(a) {
  return { re: a.re, im: -a.im };
}

export function cAbs2(a) {
  return a.re * a.re + a.im * a.im;
}

export function cAbs(a) {
  return Math.sqrt(cAbs2(a));
}

export function cInv(a) {
  const d = cAbs2(a);
  if (d < 1e-20) return c(NaN, NaN);
  return { re: a.re / d, im: -a.im / d };
}

export function cDiv(a, b) {
  return cMul(a, cInv(b));
}

export function cExp(a) {
  const e = Math.exp(a.re);
  return { re: e * Math.cos(a.im), im: e * Math.sin(a.im) };
}

export function cLogAbs(a) {
  return 0.5 * Math.log(cAbs2(a));
}

export function cFromUV(u, v) {
  return c(u, v);
}
