import {
  BookOpen,
  Boxes,
  Braces,
  CheckCheck,
  CircleUserRound,
  Database,
  FileCode2,
  FileText,
  GitBranch,
  LayoutDashboard,
  LayoutTemplate,
  ListTodo,
  Network,
  Server,
  Waypoints,
} from 'lucide-react';
import type { NodeKind, ViewKind } from '@context-atlas/model';

const nodeIcons = {
  module: Boxes,
  actor: CircleUserRound,
  journey: Waypoints,
  page: LayoutTemplate,
  operation: Braces,
  service: Server,
  entity: Database,
  table: Database,
  task: ListTodo,
  document: FileText,
  decision: GitBranch,
  test: CheckCheck,
  topic: BookOpen,
};
const viewIcons = {
  overview: LayoutDashboard,
  journey: Waypoints,
  architecture: Network,
  api: Braces,
  data: Database,
  work: ListTodo,
  study: BookOpen,
};

export function KindIcon({ kind, size = 16 }: { kind: NodeKind; size?: number }) {
  const Icon = nodeIcons[kind] ?? FileCode2;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export function ViewIcon({ kind, size = 18 }: { kind: ViewKind; size?: number }) {
  const Icon = viewIcons[kind];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
