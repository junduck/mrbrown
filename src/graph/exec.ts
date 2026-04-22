import { OpAdapter } from "./adapter.js";
import type { OpRegistry } from "./registry.js";
import type { OpGraph } from "./types.js";
import {
  formatFlowValidationError,
  normalizeInputs,
  validateOpGraph,
} from "./validate.js";

/** Single executable step in the evaluation order. */
interface ExecStep {
  name: string;
  adapter: OpAdapter;
}

/**
 * Compile-time validated graph executor.
 *
 * `create` validates the graph, builds the Kahn topological order, and
 * pre-computes the evaluation steps. `update` then runs the flat update loop
 * against a state object without any further validation overhead.
 */
export class GraphExec {
  /**
   * @param rootName - The root node name
   * @param steps - Pre-computed evaluation order (ExecStep[])
   * @param outputNames - Node names collected as outputs
   */
  private constructor(
    readonly rootName: string,
    private readonly steps: readonly ExecStep[],
    private readonly outputNames: readonly string[],
  ) {}

  /**
   * Validates the graph, instantiates operators, computes the Kahn topological
   * order, and returns a ready-to-execute `GraphExec`.
   *
   * @param schema - The flow graph to compile
   * @param registry - The operator registry to instantiate nodes from
   * @throws Error if validation fails
   */
  static create(schema: OpGraph, registry: OpRegistry): GraphExec {
    const result = validateOpGraph(schema, registry);
    if (!result.valid) {
      const msgs = result.errors.map(formatFlowValidationError).join("; ");
      throw new Error(`Invalid graph: ${msgs}`);
    }

    const adapters = new Map<string, OpAdapter>();
    const successors = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    successors.set(schema.root, []);

    for (const node of schema.nodes) {
      const instance = registry.construct(node.type, node.init);
      const inputs = normalizeInputs(node.inputs);
      adapters.set(node.name, new OpAdapter(instance, inputs));
      successors.set(node.name, []);
      inDegree.set(node.name, 0);
    }

    for (const node of schema.nodes) {
      const inputs = normalizeInputs(node.inputs);
      if (inputs.length === 0) {
        // Const node has no deps, we inject root dependency to them.
        successors.get(schema.root)!.push(node.name);
        inDegree.set(node.name, 1);
      } else {
        const seen = new Set<string>();
        for (const depPath of inputs) {
          const dep = depPath.split(".")[0]!;
          if (seen.has(dep)) continue;
          seen.add(dep);
          if (
            successors.has(dep) &&
            !successors.get(dep)!.includes(node.name)
          ) {
            successors.get(dep)!.push(node.name);
            inDegree.set(node.name, (inDegree.get(node.name) ?? 0) + 1);
          }
        }
      }
    }

    const steps: ExecStep[] = [];
    const queue: string[] = [schema.root];

    let head = 0;
    while (head < queue.length) {
      const name = queue[head++]!;
      for (const succ of successors.get(name) ?? []) {
        const d = inDegree.get(succ)! - 1;
        inDegree.set(succ, d);
        if (d === 0) queue.push(succ);
      }
    }

    for (let i = 1; i < queue.length; i++) {
      const name = queue[i]!;
      const adapter = adapters.get(name)!;
      steps.push({ name, adapter });
    }

    return new GraphExec(schema.root, steps, schema.output ?? []);
  }

  /**
   * Runs one flat update pass over the graph.
   * @param data - The input bar / tick / numeric value for the root node
   * @returns A state object mapping every node name to its current output value
   */
  update(data: unknown): Record<string, unknown> {
    const state: Record<string, unknown> = { [this.rootName]: data };

    for (let i = 0; i < this.steps.length; i++) {
      const { name, adapter } = this.steps[i]!;
      const result = adapter.invoke(state);
      //? Behaviour is thightly coupled with OpAdaptor
      // if an op returns null, that means the op is still awaiting more data to produce correctly result
      // op input mehtod update() do not check null, OpAdaptor enforces this
      // we proceed the exec as-is, so filling all satisfied nodes.
      state[name] = result; // <- can be null
    }

    return state;
  }

  /**
   * Extracts output values from a state object by configured output node names.
   * @param state - State object produced by `update`
   */
  outputs(state: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const n of this.outputNames) {
      out[n] = state[n];
    }
    return out;
  }

  /** Forwards to `reset()` on every wrapped operator. */
  reset(): void {
    for (let i = 0; i < this.steps.length; i++) {
      this.steps[i]!.adapter.reset();
    }
  }
}
