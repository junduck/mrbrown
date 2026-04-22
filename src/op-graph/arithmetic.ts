import { type OpContext } from "../common.js";

// ============================================================================
// Binary Arithmetic Operators
// ============================================================================

export class Add {
  update(lhs: number, rhs: number): number {
    return lhs + rhs;
  }

  static readonly doc: OpContext = {
    type: "Add",
    input: "lhs, rhs",
    output: "number",
  };
}

export class Sub {
  update(lhs: number, rhs: number): number {
    return lhs - rhs;
  }

  static readonly doc: OpContext = {
    type: "Sub",
    input: "lhs, rhs",
    output: "number",
  };
}

export class Mul {
  update(lhs: number, rhs: number): number {
    return lhs * rhs;
  }

  static readonly doc: OpContext = {
    type: "Mul",
    input: "lhs, rhs",
    output: "number",
  };
}

export class Div {
  update(lhs: number, rhs: number): number {
    if (rhs === 0) return lhs / Number.EPSILON;
    return lhs / rhs;
  }

  static readonly doc: OpContext = {
    type: "Div",
    desc: "Division",
    input: "lhs, rhs",
    output: "number",
  };
}

export class Mod {
  update(lhs: number, rhs: number): number {
    return lhs % rhs;
  }

  static readonly doc: OpContext = {
    type: "Mod",
    desc: "Modulo",
    input: "lhs, rhs",
    output: "number",
  };
}

export class Pow {
  update(base: number, exp: number): number {
    return base ** exp;
  }

  static readonly doc: OpContext = {
    type: "Pow",
    input: "base, exp",
    output: "number",
  };
}

export class Min {
  update(lhs: number, rhs: number): number {
    return Math.min(lhs, rhs);
  }

  static readonly doc: OpContext = {
    type: "Min",
    input: "lhs, rhs",
    output: "number",
  };
}

export class Max {
  update(lhs: number, rhs: number): number {
    return Math.max(lhs, rhs);
  }

  static readonly doc: OpContext = {
    type: "Max",
    input: "lhs, rhs",
    output: "number",
  };
}

// ============================================================================
// Unary Math Operations
// ============================================================================

export class Negate {
  update(x: number): number {
    return -x;
  }

  static readonly doc: OpContext = {
    type: "Negate",
    input: "x",
    output: "number",
  };
}

export class Abs {
  update(x: number): number {
    return Math.abs(x);
  }

  static readonly doc: OpContext = {
    type: "Abs",
    input: "x",
    output: "number",
  };
}

export class Sign {
  update(x: number): number {
    return Math.sign(x);
  }

  static readonly doc: OpContext = {
    type: "Sign",
    input: "x",
    output: "-1, 0, 1",
  };
}

export class Floor {
  update(x: number): number {
    return Math.floor(x);
  }

  static readonly doc: OpContext = {
    type: "Floor",
    input: "x",
    output: "number",
  };
}

export class Ceil {
  update(x: number): number {
    return Math.ceil(x);
  }

  static readonly doc: OpContext = {
    type: "Ceil",
    input: "x",
    output: "number",
  };
}

export class Round {
  update(x: number): number {
    return Math.round(x);
  }

  static readonly doc: OpContext = {
    type: "Round",
    input: "x",
    output: "number",
  };
}

export class Sqrt {
  update(x: number): number {
    return Math.sqrt(x);
  }

  static readonly doc: OpContext = {
    type: "Sqrt",
    input: "x",
    output: "number",
  };
}

export class Log {
  update(x: number): number {
    return Math.log(x);
  }

  static readonly doc: OpContext = {
    type: "Log",
    desc: "Natural logarithm",
    input: "x",
    output: "number",
  };
}

export class Exp {
  update(x: number): number {
    return Math.exp(x);
  }

  static readonly doc: OpContext = {
    type: "Exp",
    input: "x",
    output: "number",
  };
}

export class Log1p {
  update(x: number): number {
    return Math.log1p(x);
  }

  static readonly doc: OpContext = {
    type: "Log1p",
    input: "x",
    output: "number",
  };
}

export class Expm1 {
  update(x: number): number {
    return Math.expm1(x);
  }

  static readonly doc: OpContext = {
    type: "Expm1",
    input: "x",
    output: "number",
  };
}

export class Reciprocal {
  update(x: number): number {
    return 1 / x;
  }

  static readonly doc: OpContext = {
    type: "Reciprocal",
    input: "x",
    output: "number",
  };
}

export class Clamp {
  update(x: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, x));
  }

  static readonly doc: OpContext = {
    type: "Clamp",
    input: "x, min, max",
    output: "number",
  };
}

export class Lerp {
  update(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  static readonly doc: OpContext = {
    type: "Lerp",
    input: "a, b, t",
    output: "number",
  };
}

export class InvLerp {
  update(a: number, b: number, v: number): number {
    return (v - a) / (b - a);
  }

  static readonly doc: OpContext = {
    type: "InvLerp",
    input: "a, b, v",
    output: "number",
  };
}

// ============================================================================
// N-ary Arithmetic Operators
// ============================================================================

export class SumOf {
  update(...inputs: number[]): number {
    let sum = 0;
    for (const x of inputs) sum += x;
    return sum;
  }

  static readonly doc: OpContext = {
    type: "SumOf",
    input: "...inputs: number[]",
    output: "number",
  };
}

export class ProdOf {
  update(...inputs: number[]): number {
    let prod = 1;
    for (const x of inputs) prod *= x;
    return prod;
  }

  static readonly doc: OpContext = {
    type: "ProdOf",
    input: "...inputs: number[]",
    output: "number",
  };
}

export class AvgOf {
  update(...inputs: number[]): number {
    if (inputs.length === 0) return 0;
    let sum = 0;
    for (const x of inputs) sum += x;
    return sum / inputs.length;
  }

  static readonly doc: OpContext = {
    type: "AvgOf",
    input: "...inputs: number[]",
    output: "number",
  };
}

export class MinOf {
  update(...inputs: number[]): number {
    return Math.min(...inputs);
  }

  static readonly doc: OpContext = {
    type: "MinOf",
    input: "...inputs: number[]",
    output: "number",
  };
}

export class MaxOf {
  update(...inputs: number[]): number {
    return Math.max(...inputs);
  }

  static readonly doc: OpContext = {
    type: "MaxOf",
    input: "...inputs: number[]",
    output: "number",
  };
}

// ============================================================================
// Statistical / Distance
// ============================================================================

export class RelDist {
  update(a: number, b: number): number {
    return Math.abs(a - b) / (Math.abs(b) + Number.EPSILON);
  }

  static readonly doc: OpContext = {
    type: "RelDist",
    desc: "abs(a-b)/abs(b)",
    input: "a, b",
    output: "number",
  };
}

export const ARITHMETIC_OPS = [
  Add,
  Sub,
  Mul,
  Div,
  Mod,
  Pow,
  Min,
  Max,
  Negate,
  Abs,
  Sign,
  Floor,
  Ceil,
  Round,
  Sqrt,
  Log,
  Exp,
  Log1p,
  Expm1,
  Reciprocal,
  Clamp,
  Lerp,
  InvLerp,
  SumOf,
  ProdOf,
  AvgOf,
  MinOf,
  MaxOf,
  RelDist,
] as const;
