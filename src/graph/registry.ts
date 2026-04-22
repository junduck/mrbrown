import type { OpContext } from "../common.js";

/**
 * Structural contract for operator classes consumed by the registry.
 * Any class with a static `doc: OpContext` and a constructable shape satisfies this.
 */
export interface OpClass {
  new (opts: any): { update(...args: any[]): any };
  readonly doc: OpContext;
}

/** Entry stored in the registry for one operator type. */
interface OpEntry {
  ctor: OpClass;
  doc: OpContext;
}

/**
 * Operator registry for the computation graph.
 *
 * Maintains a flat map of type-name → constructor + metadata, and a secondary
 * index grouping entries by an optional group string (e.g. `"rolling.sma"`).
 * Used by `GraphExec.create` to validate `node.type` and instantiate operators.
 */
export class OpRegistry {
  private entries = new Map<string, OpEntry>();
  private groups = new Map<string, OpContext[]>();

  /**
   * Registers a single operator constructor.
   * @throws If `doc.type` is missing or already registered
   */
  register(ctor: OpClass, group = ""): this {
    const doc = ctor.doc;
    if (!doc.type) {
      throw new Error("Constructor must have static doc.type property");
    }
    if (this.entries.has(doc.type)) {
      throw new Error(`Operator "${doc.type}" already registered`);
    }
    this.entries.set(doc.type, { ctor, doc });

    if (!this.groups.has(group)) {
      this.groups.set(group, []);
    }
    this.groups.get(group)!.push(doc);

    return this;
  }

  /**
   * Registers multiple operators under an optional group.
   */
  registerAll(ctors: readonly OpClass[], group?: string): this {
    for (const ctor of ctors) this.register(ctor, group);
    return this;
  }

  /** Returns `true` if `name` is registered. */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Constructs an operator instance by registered name.
   * @throws If `name` is not registered
   */
  construct(name: string, opts?: any): InstanceType<OpClass> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Unknown operator "${name}"`);
    return new entry.ctor(opts);
  }

  /** Returns the operator metadata for `name`, or `undefined` if not found. */
  getContext(name: string): OpContext | undefined {
    return this.entries.get(name)?.doc;
  }

  /** Returns a map of group name → operator contexts registered in that group. */
  getAllContexts(): ReadonlyMap<string, OpContext[]> {
    return this.groups;
  }
}
