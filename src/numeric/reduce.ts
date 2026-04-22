import { Kahan } from "./accum.js";

/**
 * Sum of array elements.
 * @group Numeric Utilities - Array Reducers
 */
export function sum(x: number[]): number {
  let s = new Kahan();
  for (let i = 0; i < x.length; i++) {
    s.accum(x[i]!);
  }
  return s.val;
}

/**
 * Minimum value in array.
 * @group Numeric Utilities - Array Reducers
 */
export function min(x: number[]): number {
  if (x.length === 0) return NaN;
  let m = x[0]!;
  for (let i = 1; i < x.length; i++) {
    if (x[i]! < m) m = x[i]!;
  }
  return m;
}

/**
 * Maximum value in array.
 * @group Numeric Utilities - Array Reducers
 */
export function max(x: number[]): number {
  if (x.length === 0) return NaN;
  let m = x[0]!;
  for (let i = 1; i < x.length; i++) {
    if (x[i]! > m) m = x[i]!;
  }
  return m;
}

/**
 * Index of minimum value. Returns -1 for empty array.
 * @group Numeric Utilities - Array Reducers
 */
export function argmin(x: number[]): number {
  if (x.length === 0) return -1;
  let idx = 0;
  let m = x[0]!;
  for (let i = 1; i < x.length; i++) {
    if (x[i]! < m) {
      m = x[i]!;
      idx = i;
    }
  }
  return idx;
}

/**
 * Index of maximum value. Returns -1 for empty array.
 * @group Numeric Utilities - Array Reducers
 */
export function argmax(x: number[]): number {
  if (x.length === 0) return -1;
  let idx = 0;
  let m = x[0]!;
  for (let i = 1; i < x.length; i++) {
    if (x[i]! > m) {
      m = x[i]!;
      idx = i;
    }
  }
  return idx;
}
