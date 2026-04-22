import { type OpContext } from "../common.js";

// ============================================================================
// Comparison Operators
// ============================================================================

export class LT {
  update(lhs: number, rhs: number): boolean {
    return lhs < rhs;
  }

  static readonly doc: OpContext = {
    type: "LT",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class GT {
  update(lhs: number, rhs: number): boolean {
    return lhs > rhs;
  }

  static readonly doc: OpContext = {
    type: "GT",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class LTE {
  update(lhs: number, rhs: number): boolean {
    return lhs <= rhs;
  }

  static readonly doc: OpContext = {
    type: "LTE",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class GTE {
  update(lhs: number, rhs: number): boolean {
    return lhs >= rhs;
  }

  static readonly doc: OpContext = {
    type: "GTE",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class EQ {
  update(lhs: number, rhs: number): boolean {
    return lhs === rhs;
  }

  static readonly doc: OpContext = {
    type: "EQ",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class NEQ {
  update(lhs: number, rhs: number): boolean {
    return lhs !== rhs;
  }

  static readonly doc: OpContext = {
    type: "NEQ",
    input: "lhs, rhs",
    output: "boolean",
  };
}

// ============================================================================
// Range Operators
// ============================================================================

export class Between {
  update(x: number, lo: number, hi: number): boolean {
    return x >= lo && x <= hi;
  }

  static readonly doc: OpContext = {
    type: "Between",
    desc: "lo <= x <= hi",
    input: "x, lo, hi",
    output: "boolean",
  };
}

export class Outside {
  update(x: number, lo: number, hi: number): boolean {
    return x < lo || x > hi;
  }

  static readonly doc: OpContext = {
    type: "Outside",
    desc: "x < lo || x > hi",
    input: "x, lo, hi",
    output: "boolean",
  };
}

// ============================================================================
// Boolean Logic
// ============================================================================

export class And {
  update(lhs: boolean, rhs: boolean): boolean {
    return lhs && rhs;
  }

  static readonly doc: OpContext = {
    type: "And",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class Or {
  update(lhs: boolean, rhs: boolean): boolean {
    return lhs || rhs;
  }

  static readonly doc: OpContext = {
    type: "Or",
    input: "lhs, rhs",
    output: "boolean",
  };
}

export class Not {
  update(x: boolean): boolean {
    return !x;
  }

  static readonly doc: OpContext = {
    type: "Not",
    input: "x",
    output: "boolean",
  };
}

export class Xor {
  update(lhs: boolean, rhs: boolean): boolean {
    return lhs !== rhs;
  }

  static readonly doc: OpContext = {
    type: "Xor",
    input: "lhs, rhs",
    output: "boolean",
  };
}

// ============================================================================
// N-ary Boolean Logic
// ============================================================================

export class AllOf {
  update(...inputs: boolean[]): boolean {
    for (const x of inputs) if (!x) return false;
    return true;
  }

  static readonly doc: OpContext = {
    type: "AllOf",
    input: "...inputs: boolean[]",
    output: "boolean",
  };
}

export class AnyOf {
  update(...inputs: boolean[]): boolean {
    for (const x of inputs) if (x) return true;
    return false;
  }

  static readonly doc: OpContext = {
    type: "AnyOf",
    input: "...inputs: boolean[]",
    output: "boolean",
  };
}

export class NoneOf {
  update(...inputs: boolean[]): boolean {
    for (const x of inputs) if (x) return false;
    return true;
  }

  static readonly doc: OpContext = {
    type: "NoneOf",
    input: "...inputs: boolean[]",
    output: "boolean",
  };
}

// ============================================================================
// Numeric Predicates
// ============================================================================

export class IsNaN {
  update(x: number): boolean {
    return Number.isNaN(x);
  }

  static readonly doc: OpContext = {
    type: "IsNaN",
    input: "x",
    output: "boolean",
  };
}

export class IsFinite {
  update(x: number): boolean {
    return Number.isFinite(x);
  }

  static readonly doc: OpContext = {
    type: "IsFinite",
    input: "x",
    output: "boolean",
  };
}

export class IsPositive {
  update(x: number): boolean {
    return x > 0;
  }

  static readonly doc: OpContext = {
    type: "IsPositive",
    input: "x",
    output: "boolean",
  };
}

export class IsNegative {
  update(x: number): boolean {
    return x < 0;
  }

  static readonly doc: OpContext = {
    type: "IsNegative",
    input: "x",
    output: "boolean",
  };
}

export class IsZero {
  update(x: number): boolean {
    return x === 0;
  }

  static readonly doc: OpContext = {
    type: "IsZero",
    input: "x",
    output: "boolean",
  };
}

// ============================================================================
// Consumer
// ============================================================================

export class IfThenElse {
  update<T>(cond: boolean, thenVal: T, elseVal: T): T {
    return cond ? thenVal : elseVal;
  }

  static readonly doc: OpContext = {
    type: "IfThenElse",
    input: "cond, thenVal, elseVal",
    output: "thenVal | elseVal",
  };
}

export class Gate {
  update<T>(cond: boolean, val: T): T | null {
    return cond ? val : null;
  }

  static readonly doc: OpContext = {
    type: "Gate",
    input: "cond, val",
    output: "val | null",
  };
}

// TODO: this seems contradicting
export class Coalesce {
  update<T>(...inputs: (T | null)[]): T | null {
    for (const x of inputs) if (x != null) return x;
    return null;
  }

  static readonly doc: OpContext = {
    type: "Coalesce",
    input: "...inputs",
    output: "first non-null",
  };
}

export const LOGICAL_OPS = [
  LT,
  GT,
  LTE,
  GTE,
  EQ,
  NEQ,
  Between,
  Outside,
  And,
  Or,
  Not,
  Xor,
  AllOf,
  AnyOf,
  NoneOf,
  IsNaN,
  IsFinite,
  IsPositive,
  IsNegative,
  IsZero,
  IfThenElse,
  Gate,
  Coalesce,
] as const;
