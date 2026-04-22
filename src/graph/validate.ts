import { t } from "../prompts/provider.js";
import type { OpRegistry } from "./registry.js";
import type {
  OpGraph,
  OpGraphError,
  OpGraphValidationResult,
  OpGraphTopoError,
} from "./types.js";

/**
 * Converts a node's `inputs` field to a normalized array of dot-separated paths.
 * @param inputs - A single path, an array of paths, or `undefined`
 * @returns An array of path strings (empty array if `inputs` is falsy)
 */
export function normalizeInputs(inputs?: string[] | string): string[] {
  if (!inputs) return [];
  return Array.isArray(inputs) ? inputs : [inputs];
}

/**
 * Builds a successor map: node name -> names of nodes that depend on it.
 * The root node is included as a special sentinel with no dependencies of its own.
 */
function buildSuccessorMap(graph: OpGraph): Map<string, string[]> {
  const succ = new Map<string, string[]>();
  succ.set(graph.root, []);
  for (const node of graph.nodes) {
    succ.set(node.name, []);
  }

  for (const node of graph.nodes) {
    const sources = normalizeInputs(node.inputs);
    if (sources.length === 0) {
      const rootSuccs = succ.get(graph.root)!;
      if (!rootSuccs.includes(node.name)) {
        rootSuccs.push(node.name);
      }
    } else {
      for (const depPath of sources) {
        const dep = depPath.split(".")[0]!;
        const depSuccs = succ.get(dep);
        if (depSuccs && !depSuccs.includes(node.name)) {
          depSuccs.push(node.name);
        }
      }
    }
  }

  return succ;
}

/**
 * Structural validation: checks that `graph` is a well-formed object with a
 * root string and a nodes array whose each element has a non-empty `name`
 * and `type`.
 */
function validateStructure(graph: unknown): OpGraphError[] {
  const errors: OpGraphError[] = [];

  if (!graph || typeof graph !== "object") {
    errors.push({
      type: "structure",
      path: "",
      message: "Graph must be an object",
    });
    return errors;
  }

  const g = graph as Record<string, unknown>;

  if (typeof g["root"] !== "string" || g["root"].length === 0) {
    errors.push({
      type: "structure",
      path: "root",
      message: "Root must be a non-empty string",
    });
  }

  if (!Array.isArray(g["nodes"])) {
    errors.push({
      type: "structure",
      path: "nodes",
      message: "Nodes must be an array",
    });
    return errors;
  }

  for (let i = 0; i < g["nodes"].length; i++) {
    const node = g["nodes"][i] as Record<string, unknown>;
    const basePath = `nodes[${i}]`;

    if (!node || typeof node !== "object") {
      errors.push({
        type: "structure",
        path: basePath,
        message: "Node must be an object",
      });
      continue;
    }

    if (typeof node["name"] !== "string" || node["name"].length === 0) {
      errors.push({
        type: "structure",
        path: `${basePath}.name`,
        message: "Node name must be a non-empty string",
      });
    }

    if (typeof node["type"] !== "string" || node["type"].length === 0) {
      errors.push({
        type: "structure",
        path: `${basePath}.type`,
        message: "Node type must be a non-empty string",
      });
    }
  }

  return errors;
}

/**
 * Detects directed cycles in the graph using a three-color DFS.
 * @param succ - Successor map from `buildSuccessorMap`
 * @returns An array of cycle errors, each describing one detected cycle
 */
function detectCycle(succ: Map<string, string[]>): OpGraphTopoError[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const state = new Map<string, number>();
  for (const node of succ.keys()) {
    state.set(node, WHITE);
  }

  const cycles: string[][] = [];

  const dfs = (node: string, path: string[]): void => {
    state.set(node, GRAY);
    path.push(node);

    const neighbors = succ.get(node) ?? [];
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor);
      if (neighborState === GRAY) {
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart).concat(neighbor));
      } else if (neighborState === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    state.set(node, BLACK);
  };

  for (const node of succ.keys()) {
    if (state.get(node) === WHITE) {
      dfs(node, []);
    }
  }

  return cycles.map((nodes) => ({ type: "cycle", nodes }));
}

/**
 * Detects nodes that cannot be reached by any directed path from the root.
 * @param root - The root node name
 * @param succ - Successor map from `buildSuccessorMap`
 * @returns An array containing at most one error with all unreachable node names
 */
function detectUnreachable(
  root: string,
  succ: Map<string, string[]>,
): OpGraphTopoError[] {
  const reachable = new Set<string>([root]);
  const queue = [root];

  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const neighbor of succ.get(node) ?? []) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const unreachable: string[] = [];
  for (const node of succ.keys()) {
    if (!reachable.has(node)) {
      unreachable.push(node);
    }
  }

  return unreachable.length > 0
    ? [{ type: "unreachable", nodes: unreachable }]
    : [];
}

/**
 * Full validation of a `OpGraph` against an operator registry.
 *
 * Checks performed in order, stopping at the first failure group:
 * 1. Structural — `graph` is an object with a non-empty root string and a
 *    nodes array where every node has non-empty `name` and `type`.
 * 2. Name uniqueness, root conflict, and registry membership.
 * 3. All input references resolve to an existing node or the root.
 * 4. Output references resolve to an existing node or the root.
 * 5. No directed cycles and no nodes unreachable from root.
 *
 * @param graph - The graph to validate
 * @param registry - The operator registry to check `node.type` against
 */
export function validateOpGraph(
  graph: unknown,
  registry: OpRegistry,
): OpGraphValidationResult {
  const errors: OpGraphError[] = [];

  const structureErrors = validateStructure(graph);
  if (structureErrors.length > 0) {
    return { valid: false, errors: structureErrors };
  }

  const g = graph as OpGraph;

  const nodeNames = new Set<string>();
  for (const node of g.nodes) {
    if (nodeNames.has(node.name)) {
      errors.push({ type: "duplicate_name", node: node.name });
    }
    nodeNames.add(node.name);

    if (node.name === g.root) {
      errors.push({ type: "root_conflict", node: node.name });
    }

    if (!registry.has(node.type)) {
      errors.push({ type: "unknown_type", node: node.name, opType: node.type });
    }
  }

  if (errors.length === 0) {
    for (const node of g.nodes) {
      const inputs = normalizeInputs(node.inputs);
      for (const inputPath of inputs) {
        const dep = inputPath.split(".")[0]!;
        if (dep !== g.root && !nodeNames.has(dep)) {
          errors.push({ type: "dangling_input", node: node.name, input: dep });
        }
      }
    }
  }

  if (errors.length === 0) {
    if (g.output) {
      for (const out of g.output) {
        if (out !== g.root && !nodeNames.has(out)) {
          errors.push({ type: "dangling_input", node: "output", input: out });
        }
      }
    }
  }

  if (errors.length === 0) {
    const succ = buildSuccessorMap(g);
    errors.push(...detectCycle(succ));
    errors.push(...detectUnreachable(g.root, succ));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Converts a `OpGraphError` into a human-readable string.
 */
export function formatFlowValidationError(error: OpGraphError): string {
  switch (error.type) {
    case "structure":
      return t("graph.validate.structure", {
        path: error.path,
        message: error.message,
      });
    case "unknown_type":
      return t("graph.validate.unknown_type", {
        opType: error.opType,
        node: error.node,
      });
    case "duplicate_name":
      return t("graph.validate.duplicate_name", { node: error.node });
    case "root_conflict":
      return t("graph.validate.root_conflict", { node: error.node });
    case "dangling_input":
      return t("graph.validate.dangling_input", {
        node: error.node,
        input: error.input,
      });
    case "cycle":
      return t("graph.validate.cycle", { nodes: error.nodes.join(" → ") });
    case "unreachable":
      return t("graph.validate.unreachable", { nodes: error.nodes.join(", ") });
  }
}
