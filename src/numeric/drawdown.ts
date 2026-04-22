import type { NumericBuffer } from "./utils.js";

/**
 * Result of drawdown/drawup calculation
 * @group Performance Analysis
 */
export interface DrawdownResult {
  /** The drawdown/drawup value */
  value: number;
  /** Index of the extremum (peak for drawdown, trough for drawup) */
  from: number;
  /** Index where maximum movement occurred */
  to: number;
}

function calculateMovement(
  buffer: NumericBuffer,
  isPeak: boolean,
  isRelative: boolean,
): DrawdownResult {
  let initial = buffer.at(0) ?? 0;
  let startIndex = 0;

  // For relative calculations, skip initial zeros to find first non-zero value
  if (isRelative) {
    while (initial === 0 && startIndex < buffer.length - 1) {
      startIndex++;
      initial = buffer.at(startIndex) ?? 0;
    }
    if (initial === 0) return { value: 0, from: 0, to: 0 };
  }

  let extremum = initial;
  let extremumIndex = startIndex;
  let result = 0;
  let resultFrom = startIndex;
  let resultTo = startIndex;

  for (let i = startIndex + 1; i < buffer.length; i++) {
    const value = buffer.at(i) ?? 0;
    const updateExtremum = isPeak ? value > extremum : value < extremum;

    if (updateExtremum) {
      extremum = value;
      extremumIndex = i;
    } else {
      const diff = value - extremum;
      const movement = isRelative && extremum !== 0 ? diff / extremum : diff;
      const isNewExtreme = isPeak ? movement < result : movement > result;
      if (isNewExtreme) {
        result = movement;
        resultFrom = extremumIndex;
        resultTo = i;
      }
    }
  }

  return { value: result, from: resultFrom, to: resultTo };
}

/**
 * Calculates the maximum absolute drawdown (peak to trough decline) in a numeric buffer.
 * @param buffer - The numeric buffer to analyze
 * @returns The drawdown result with value and position indices
 * @group Performance Analysis
 */
export function maxDrawDown(buffer: NumericBuffer): DrawdownResult {
  return calculateMovement(buffer, true, false);
}

/**
 * Calculates the maximum relative drawdown (peak to trough decline as percentage) in a numeric buffer.
 * @param buffer - The numeric buffer to analyze
 * @returns The drawdown result with value and position indices
 * @group Performance Analysis
 */
export function maxRelDrawDown(buffer: NumericBuffer): DrawdownResult {
  return calculateMovement(buffer, true, true);
}

/**
 * Calculates the maximum absolute drawup (trough to peak increase) in a numeric buffer.
 * @param buffer - The numeric buffer to analyze
 * @returns The drawup result with value and position indices
 * @group Performance Analysis
 */
export function maxDrawUp(buffer: NumericBuffer): DrawdownResult {
  return calculateMovement(buffer, false, false);
}

/**
 * Calculates the maximum relative drawup (trough to peak increase as percentage) in a numeric buffer.
 * @param buffer - The numeric buffer to analyze
 * @returns The drawup result with value and position indices
 * @group Performance Analysis
 */
export function maxRelDrawUp(buffer: NumericBuffer): DrawdownResult {
  return calculateMovement(buffer, false, true);
}
