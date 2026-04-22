import { describe, it, expect } from "vitest";
import { OpRegistry } from "#src/graph/registry.js";
import { ARITHMETIC_OPS } from "#src/op-graph/arithmetic.js";
import { LOGICAL_OPS } from "#src/op-graph/logical.js";
import { CONST_OPS } from "#src/op-graph/const.js";

describe("OpRegistry", () => {
  function setup(): OpRegistry {
    const reg = new OpRegistry();
    reg.registerAll(ARITHMETIC_OPS, "arith");
    reg.registerAll(LOGICAL_OPS, "logical");
    reg.registerAll(CONST_OPS, "const");
    return reg;
  }

  it("constructs stateless arithmetic ops", () => {
    const reg = setup();

    const add = reg.construct("Add");
    expect(add.update(3, 4)).toBe(7);

    const mul = reg.construct("Mul");
    expect(mul.update(10, 2)).toBe(20);

    const neg = reg.construct("Negate");
    expect(neg.update(5)).toBe(-5);
  });

  it("constructs stateless logical ops", () => {
    const reg = setup();

    const lt = reg.construct("LT");
    expect(lt.update(1, 2)).toBe(true);
    expect(lt.update(2, 1)).toBe(false);

    const and = reg.construct("And");
    expect(and.update(true, false)).toBe(false);
  });

  it("constructs Const with opts", () => {
    const reg = setup();

    const c = reg.construct("Const", { value: 42 });
    expect(c.update()).toBe(42);
  });

  it("throws on unknown operator", () => {
    const reg = setup();
    expect(() => reg.construct("Nope")).toThrow(`Unknown operator "Nope"`);
  });

  it("rejects duplicate registration", () => {
    const reg = new OpRegistry();
    reg.register(ARITHMETIC_OPS[0]);
    expect(() => reg.register(ARITHMETIC_OPS[0])).toThrow(/already registered/);
  });
});
