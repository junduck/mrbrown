export interface OpNode {
  name: string;
  type: string;
  init?: Record<string, unknown>;
  inputs?: string[];
}

export interface OpGraph {
  root: string;
  nodes: OpNode[];
  output?: string[];
}

export type OpGraphTopoError =
  | { type: "cycle"; nodes: string[] }
  | { type: "unreachable"; nodes: string[] };

export type OpGraphError =
  | { type: "structure"; path: string; message: string }
  | { type: "unknown_type"; node: string; opType: string }
  | { type: "duplicate_name"; node: string }
  | { type: "root_conflict"; node: string }
  | { type: "dangling_input"; node: string; input: string }
  | OpGraphTopoError;

export interface OpGraphValidationResult {
  valid: boolean;
  errors: OpGraphError[];
}
