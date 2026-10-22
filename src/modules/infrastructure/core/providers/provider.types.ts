export type CapabilityLevel = 'automatic_api' | 'automatic_public_lookup' | 'manual' | 'unsupported' | 'authentication_required';

export interface ProviderCapabilities {
  inventory: CapabilityLevel;
  configuration: CapabilityLevel;
  networking: CapabilityLevel;
  billing: CapabilityLevel;
  utilization: CapabilityLevel;
}

export interface RemoteServer {
  remoteId: string;
  name: string;
  hostname: string | null;
  ipv4: string | null;
  ipv6: string | null;
  additionalIps: string[];
  region: string | null;
  datacenter: string | null;
  operatingSystem: string | null;
  vcpu: number | null;
  ramMb: number | null;
  storageGb: number | null;
  storageType: string | null;
  planName: string | null;
  serverType: 'VPS' | 'DEDICATED' | 'CLOUD_INSTANCE' | 'OTHER';
  providerStatus: string | null;
  providerCreatedAt: Date | null;
  providerReported: Record<string, string | number | boolean | null>;
}

export interface ProviderSnapshot {
  id: string;
  name: string | null;
  description: string | null;
  createdAt: string | null;
  autoDeleteAt: string | null;
  imageName: string | null;
}

export interface ProviderAuditEvent {
  id: string;
  action: string;
  at: string | null;
  actor: string | null;
  /** Names of the fields that changed. Values are never copied (they can contain credentials or user data). */
  changedFields: string[];
}

export interface ServerExtras {
  snapshots: ProviderSnapshot[];
  audits: ProviderAuditEvent[];
  /** Per-source problems (e.g. snapshots endpoint failed) so the UI can say what is missing and why. */
  errors: string[];
}

export interface ListServersResult {
  servers: RemoteServer[];
  errors: string[];
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: 'AUTH_FAILED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'INVALID_RESPONSE' | 'NETWORK',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
}

export interface ProviderAdapter<TCredentials = Record<string, string>> {
  readonly key: string;
  readonly label: string;
  readonly live: boolean;
  readonly capabilities: ProviderCapabilities;
  readonly credentialFields: CredentialField[];
  readonly docsUrl: string;
  parseCredentials(input: Record<string, unknown>): { ok: true; value: TCredentials } | { ok: false; message: string };
  hint(credentials: TCredentials): Record<string, string>;
  testConnection(credentials: TCredentials): Promise<{ ok: true; instanceCount: number | null }>;
  listServers(credentials: TCredentials): Promise<ListServersResult>;
  /** Read-only provider detail for one instance (snapshots, audit trail). Optional: not every provider has it. */
  getServerExtras?(credentials: TCredentials, remoteId: string): Promise<ServerExtras>;
}
