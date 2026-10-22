import { randomUUID } from 'node:crypto';
import { ProviderError, type ListServersResult, type ProviderAdapter, type RemoteServer, type ServerExtras } from './provider.types';

export const CONTABO_AUTH_URL = 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token';
export const CONTABO_API_BASE = 'https://api.contabo.com/v1';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const TIMEOUT_MS = 15_000;

export interface ContaboCredentials extends Record<string, string> {
  clientId: string;
  clientSecret: string;
  apiUser: string;
  apiPassword: string;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function mapContaboInstance(raw: Record<string, unknown>): RemoteServer | null {
  const id = raw.instanceId;
  if (typeof id !== 'number' && typeof id !== 'string') return null;
  const ipConfig = (raw.ipConfig ?? {}) as { v4?: { ip?: unknown }; v6?: { ip?: unknown } };
  const productType = str(raw.productType)?.toLowerCase() ?? null;
  const diskMb = num(raw.diskMb);
  const additionalIps = Array.isArray(raw.additionalIps)
    ? (raw.additionalIps as Array<{ v4?: { ip?: unknown } }>).map((i) => str(i?.v4?.ip)).filter((v): v is string => Boolean(v))
    : [];
  const created = str(raw.createdDate);
  const createdAt = created && !Number.isNaN(new Date(created).getTime()) ? new Date(created) : null;
  const productName = str(raw.productName) ?? str(raw.productId);
  return {
    remoteId: String(id),
    name: str(raw.displayName) ?? str(raw.name) ?? `Contabo instance ${id}`,
    hostname: str(raw.name),
    ipv4: str(ipConfig.v4?.ip),
    ipv6: str(ipConfig.v6?.ip),
    additionalIps,
    region: str(raw.regionName) ?? str(raw.region),
    datacenter: str(raw.dataCenter),
    operatingSystem: str(raw.osType),
    vcpu: num(raw.cpuCores),
    ramMb: num(raw.ramMb),
    storageGb: diskMb === null ? null : Math.round(diskMb / 1024),
    storageType: null,
    planName: productName,
    serverType: ['vps', 'vds', 'ssd', 'nvme', 'hdd'].includes(productType ?? '') ? 'VPS' : productType === 'dedicated' ? 'DEDICATED' : 'OTHER',
    providerStatus: str(raw.status),
    providerCreatedAt: createdAt,
    providerReported: {
      cancelDate: str(raw.cancelDate),
      productId: str(raw.productId),
      productType: productType,
      imageId: str(raw.imageId),
      macAddress: str(raw.macAddress),
      defaultUser: str(raw.defaultUser),
      vHostName: str(raw.vHostName),
      vHostNumber: num(raw.vHostNumber),
      applicationId: str(raw.applicationId),
      gpuVendor: str(raw.gpuVendor),
      gpuModel: str(raw.gpuModel),
      regionName: str(raw.regionName),
      addOns: Array.isArray(raw.addOns) ? (raw.addOns as Array<{ id?: unknown; quantity?: unknown }>).map((a) => `#${String(a.id ?? '?')}×${String(a.quantity ?? 1)}`).join(', ') || null : null,
    },
  };
}

export class ContaboAdapter implements ProviderAdapter<ContaboCredentials> {
  readonly key = 'contabo';
  readonly label = 'Contabo';
  readonly live = true;
  readonly docsUrl = 'https://api.contabo.com/';
  readonly capabilities = {
    inventory: 'automatic_api',
    configuration: 'automatic_api',
    networking: 'automatic_api',
    billing: 'unsupported',
    utilization: 'unsupported',
  } as const;
  readonly credentialFields = [
    { key: 'clientId', label: 'Client ID', secret: false },
    { key: 'clientSecret', label: 'Client Secret', secret: true },
    { key: 'apiUser', label: 'API User (email)', secret: false },
    { key: 'apiPassword', label: 'API Password', secret: true },
  ];

  constructor(private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init)) { }

  parseCredentials(input: Record<string, unknown>) {
    const out: Record<string, string> = {};
    for (const f of this.credentialFields) {
      const v = typeof input[f.key] === 'string' ? (input[f.key] as string).trim() : '';
      if (!v) return { ok: false as const, message: `${f.label} is required.` };
      if (v.length > 500) return { ok: false as const, message: `${f.label} is too long.` };
      out[f.key] = v;
    }
    return { ok: true as const, value: out as ContaboCredentials };
  }

  hint(c: ContaboCredentials) {
    const tail = (s: string) => (s.length > 4 ? `…${s.slice(-4)}` : '…');
    return { clientId: tail(c.clientId), apiUser: c.apiUser };
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new ProviderError(`Could not reach Contabo: ${e instanceof Error ? e.name : 'network error'}`, 'NETWORK');
    }
  }

  private async token(c: ContaboCredentials): Promise<string> {
    const body = new URLSearchParams({ grant_type: 'password', client_id: c.clientId, client_secret: c.clientSecret, username: c.apiUser, password: c.apiPassword });
    const res = await this.request(CONTABO_AUTH_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new ProviderError('Contabo rejected these API credentials. Check the Client ID, Client Secret, API User and API Password.', 'AUTH_FAILED');
    }
    if (res.status === 429) throw new ProviderError('Contabo is rate-limiting authentication requests. Try again shortly.', 'RATE_LIMITED');
    if (!res.ok) throw new ProviderError(`Contabo authentication is unavailable (HTTP ${res.status}).`, 'PROVIDER_UNAVAILABLE');
    const json = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
    if (!json || typeof json.access_token !== 'string') throw new ProviderError('Contabo returned an unexpected authentication response.', 'INVALID_RESPONSE');
    return json.access_token;
  }

  private async page(token: string, page: number): Promise<{ data: Array<Record<string, unknown>>; totalPages: number }> {
    const url = `${CONTABO_API_BASE}/compute/instances?page=${page}&size=${PAGE_SIZE}`;
    const res = await this.request(url, { method: 'GET', headers: { authorization: `Bearer ${token}`, 'x-request-id': randomUUID(), accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) throw new ProviderError('Contabo denied access to the instance list.', 'AUTH_FAILED');
    if (res.status === 429) throw new ProviderError('Contabo rate-limited the instance list. It will be retried.', 'RATE_LIMITED');
    if (!res.ok) throw new ProviderError(`Contabo instance list failed (HTTP ${res.status}).`, 'PROVIDER_UNAVAILABLE');
    const json = (await res.json().catch(() => null)) as { data?: unknown; _pagination?: { totalPages?: unknown } } | null;
    if (!json || !Array.isArray(json.data)) throw new ProviderError('Contabo returned an unexpected instance list.', 'INVALID_RESPONSE');
    return { data: json.data as Array<Record<string, unknown>>, totalPages: num(json._pagination?.totalPages) ?? 1 };
  }

  async testConnection(c: ContaboCredentials) {
    const token = await this.token(c);
    const first = await this.page(token, 1);
    return { ok: true as const, instanceCount: first.data.length < PAGE_SIZE ? first.data.length : null };
  }

  /** Snapshots and the provider audit trail of one instance. Read-only GETs; a failing source is reported, not hidden. */
  async getServerExtras(c: ContaboCredentials, remoteId: string): Promise<ServerExtras> {
    if (!/^[0-9]{1,12}$/.test(remoteId)) throw new ProviderError("Invalid instance id.", "INVALID_RESPONSE");
    const token = await this.token(c);
    const out: ServerExtras = { snapshots: [], audits: [], errors: [] };
    const call = async (path: string) => {
      const res = await this.request(`${CONTABO_API_BASE}${path}`, { method: "GET", headers: { authorization: `Bearer ${token}`, "x-request-id": randomUUID(), accept: "application/json" } });
      if (!res.ok) throw new ProviderError(`HTTP ${res.status}`, res.status === 401 || res.status === 403 ? "AUTH_FAILED" : "PROVIDER_UNAVAILABLE");
      const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
      return Array.isArray(json?.data) ? (json!.data as Array<Record<string, unknown>>) : [];
    };
    try {
      out.snapshots = (await call(`/compute/instances/${remoteId}/snapshots`)).map((s) => ({
        id: String(s.snapshotId ?? s.id ?? ""), name: str(s.name), description: str(s.description), createdAt: str(s.createdDate), autoDeleteAt: str(s.autoDeleteDate), imageName: str(s.imageName),
      }));
    } catch (e) {
      out.errors.push(`Snapshots: ${e instanceof Error ? e.message : "failed"}`);
    }
    try {
      out.audits = (await call(`/compute/instances/audits?instanceId=${remoteId}&size=25&page=1`)).map((a) => ({
        id: String(a.id ?? ""), action: str(a.action) ?? "unknown", at: str(a.timestamp), actor: str(a.username), changedFields: Object.keys(((a.changes as { new?: object } | undefined)?.new ?? {}) as object).slice(0, 20),
      }));
    } catch (e) {
      out.errors.push(`Audit history: ${e instanceof Error ? e.message : "failed"}`);
    }
    return out;
  }

  async listServers(c: ContaboCredentials): Promise<ListServersResult> {
    const token = await this.token(c);
    const servers: RemoteServer[] = [];
    const errors: string[] = [];
    const first = await this.page(token, 1); // A failure on page 1 is a hard failure: nothing was read.
    const ingest = (rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        const mapped = mapContaboInstance(row);
        if (mapped) servers.push(mapped);
        else errors.push('An instance without an id was skipped.');
      }
    };
    ingest(first.data);
    const totalPages = Math.min(first.totalPages, MAX_PAGES);
    for (let p = 2; p <= totalPages; p += 1) {
      try {
        ingest((await this.page(token, p)).data);
      } catch (e) {
        errors.push(`Page ${p}: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }
    return { servers, errors };
  }
}
