export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ViewKind = 'overview' | 'journey' | 'architecture' | 'api' | 'data' | 'work' | 'study';
export type NodeKind =
  | 'module'
  | 'actor'
  | 'journey'
  | 'page'
  | 'operation'
  | 'service'
  | 'entity'
  | 'table'
  | 'task'
  | 'document'
  | 'decision'
  | 'test'
  | 'topic';
export type ImplementationStatus = 'proposed' | 'implemented' | 'verified' | 'accepted';
export type EvidenceStatus = 'declared' | 'inferred' | 'reviewed';

export interface ContextSource {
  id: string;
  label: string;
  path: string;
  revision: string;
  repository?: string;
  freshness: 'current' | 'stale' | 'unknown';
}

export interface DataField {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  primaryKey?: boolean;
  references?: string;
}

export interface EndpointDetails {
  method: string;
  path: string;
  authentication: string;
  request?: JsonValue;
  responses: Record<string, JsonValue>;
  parameters?: JsonValue;
}

export interface ContextNode {
  id: string;
  kind: NodeKind;
  label: string;
  description: string;
  moduleId?: string;
  sourceIds: string[];
  status: ImplementationStatus;
  evidence: EvidenceStatus;
  tags: string[];
  details?: {
    endpoint?: EndpointDetails;
    fields?: DataField[];
    notes?: string[];
    code?: string;
    task?: {
      state: 'todo' | 'in-progress' | 'blocked' | 'done';
      priority: 'low' | 'medium' | 'high';
    };
  };
}

export interface ContextEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  label?: string;
  sourceIds: string[];
  evidence: EvidenceStatus;
}

export interface ContextView {
  id: string;
  kind: ViewKind;
  label: string;
  description: string;
  nodeIds: string[];
  steps?: { nodeId: string; label: string; description?: string }[];
}

export interface ContextSnapshot {
  schemaVersion: '1.0';
  project: {
    id: string;
    name: string;
    description: string;
    kind: 'api' | 'website' | 'full-stack' | 'learning';
    capabilities: ViewKind[];
    tags: string[];
    version: string;
  };
  sources: ContextSource[];
  nodes: ContextNode[];
  edges: ContextEdge[];
  views: ContextView[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}
export type ValidationResult =
  { success: true; snapshot: ContextSnapshot } | { success: false; issues: ValidationIssue[] };

export interface ContextExportOptions {
  nodeIds: readonly string[];
  allowedSourceIds: readonly string[];
  depth?: 0 | 1;
  maxNodes?: number;
  objective?: string;
}

export interface ContextPacket {
  projectId: string;
  nodeIds: string[];
  markdown: string;
  snapshot: ContextSnapshot;
}

export interface ExplorerHost {
  openReference?: (source: ContextSource) => void;
  requestEdit?: (node: ContextNode) => void;
}
