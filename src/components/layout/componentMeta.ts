import { Monitor, Globe, Network, Shield, ShieldAlert, Server, Database, Zap, Radio, Gauge, KeyRound, Activity, Cog, Boxes, HardDrive, Copy, BarChart3, FileText, UserCheck, Hash, type LucideIcon } from 'lucide-react';

export const CATEGORIES = ['Clients', 'Networking', 'Compute', 'Caching', 'Storage', 'Messaging', 'Security', 'Observability'] as const;
export const CATEGORY_HELP: Record<string, string> = {
  Clients: 'Who sends traffic', Networking: 'Routing, edge and traffic distribution', Compute: 'Services that run your logic',
  Caching: 'Fast in-memory lookups', Storage: 'Durable data stores and replicas', Messaging: 'Async buffering between services',
  Security: 'Protect and limit access', Observability: 'Metrics, logs and tracing',
};
export const CATEGORY_COLORS: Record<string, string> = {
  Clients: '#8b949e', Networking: '#58a6ff', Compute: '#3fb950', Storage: '#f0883e',
  Caching: '#d2a8ff', Messaging: '#e3b341', Security: '#f778ba', Observability: '#56d4dd',
};
const CAT: Record<string, string> = {
  client: 'Clients', dns: 'Networking', cdn: 'Networking', 'load-balancer': 'Networking', 'api-gateway': 'Networking',
  'application-server': 'Compute', worker: 'Compute', 'key-generator': 'Compute',
  'sql-database': 'Storage', 'nosql-database': 'Storage', 'read-replica': 'Storage', 'analytics-store': 'Storage',
  cache: 'Caching', 'message-queue': 'Messaging', 'rate-limiter': 'Security', waf: 'Security', 'auth-service': 'Security',
  'metrics-collector': 'Observability', logging: 'Observability',
};
const ICON: Record<string, LucideIcon> = {
  client: Monitor, dns: Globe, cdn: Globe, 'load-balancer': Network, 'api-gateway': Shield, 'application-server': Server,
  worker: Cog, 'key-generator': Hash, 'sql-database': Database, 'nosql-database': HardDrive, 'read-replica': Copy,
  'analytics-store': BarChart3, cache: Zap, 'message-queue': Radio, 'rate-limiter': Gauge, waf: ShieldAlert,
  'auth-service': UserCheck, 'metrics-collector': Activity, logging: FileText,
};
export const categoryOf = (type: string) => CAT[type] ?? 'Compute';
export const iconOf = (type: string): LucideIcon => ICON[type] ?? (type === 'x' ? KeyRound : Boxes);
