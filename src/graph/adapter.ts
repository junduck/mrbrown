import { t } from "../prompts/provider.js";

/**
 * Resolves a dot-separated path on a state object.
 * @param state - The state object to traverse
 * @param parts - Path segments (e.g. `["path", "to", "value"]` resolves `state.path.to.value`)
 * @returns The value at the path, or `undefined` if the path does not exist
 */
function resolveValue(state: Record<string, any>, parts: string[]): any {
  let value: any = state[parts[0]!];
  if (value === null) {
    // deps waiting for more data, do not traverse obj yet
    return null;
  }
  for (let i = 1; i < parts.length && value !== undefined; i++) {
    value = value[parts[i]!];
  }
  return value;
}

/** Minimal interface for graph operators invoked by OpAdapter. */
interface GraphOp {
  /** Computes and returns a new value from the given inputs. */
  update(...args: any[]): any;
  /** Optional lifecycle hook called when the graph is reset. */
  reset?(): void;
}

/**
 * Invokes a graph operator with inputs resolved from state.
 *
 * Each `OpAdapter` instance wraps one operator and holds the parsed input paths.
 * At invoke time it reads values from the state, validates them, and forwards
 * them to the operator.
 *
 * @example
 * ```ts
 * const adapter = new OpAdapter(op, ["bar.close", "baz.volume"]);
 * adapter.invoke({ bar: { close: 100 }, baz: { volume: 50 } }); // calls op.update(100, 50)
 * ```
 *
 * @sealed
 */
export class OpAdapter {
  private readonly paths: string[][];

  /**
   * @param op - The operator to wrap
   * @param inputPaths - Dot-separated paths to inputs in the state object (e.g. `["bar.close"]`)
   */
  constructor(
    private readonly op: GraphOp,
    inputPaths: string[],
  ) {
    this.paths = inputPaths.map((p) => p.split("."));
  }

  /**
   * Resolves input paths from state and calls `op.update` with the resolved values.
   * @param state - The graph execution state
   * @throws If any input path resolves to `undefined` or `NaN`
   */
  invoke(state: Record<string, any>): any {
    const args = this.paths.map((parts) => {
      const val = resolveValue(state, parts);
      if (val === undefined) {
        // Validator can only validate node-level structure, it does not check return object keys
        // deps: "sma" -> ok, deps: "sma.nonexist" -> validate ok, runtime error
        throw new Error(
          t("graph.adapter.input_undefined", { path: parts.join(".") }),
        );
      }
      if (typeof val === "number" && Number.isNaN(val)) {
        throw new Error(
          t("graph.adapter.input_nan", { path: parts.join(".") }),
        );
      }
      return val;
    });
    //? Behaviour is thightly coupled with GraphExec
    if (args.some((it) => it === null)) {
      // deps still awaiting more data, do not invoke, return null directly
      return null;
    }
    return this.op.update(...args);
  }

  /** Forwards to `op.reset()` if defined. */
  reset(): void {
    this.op.reset?.();
  }
}
