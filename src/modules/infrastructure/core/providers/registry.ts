import { ContaboAdapter } from './contabo.adapter';
import type { CapabilityLevel, ProviderAdapter } from './provider.types';

export const MANUAL_PROVIDERS: Array<{ key: string; label: string }> = [
  { key: 'hostinger', label: 'Hostinger' },
  { key: 'digitalocean', label: 'DigitalOcean' },
  { key: 'aws', label: 'AWS' },
  { key: 'vultr', label: 'Vultr' },
  { key: 'hetzner', label: 'Hetzner' },
  { key: 'linode', label: 'Linode / Akamai' },
  { key: 'other', label: 'Other / custom' },
];

const manualCapability: CapabilityLevel = 'manual';

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter<any>>();

  constructor(adapters: ProviderAdapter<any>[] = [new ContaboAdapter()]) {
    for (const a of adapters) this.adapters.set(a.key, a);
  }

  get(key: string): ProviderAdapter<any> | null {
    return this.adapters.get(key) ?? null;
  }

  catalogue() {
    const live = [...this.adapters.values()].map((a) => ({
      key: a.key,
      label: a.label,
      live: true as const,
      capabilities: a.capabilities,
      credentialFields: a.credentialFields,
      docsUrl: a.docsUrl,
    }));
    const manual = MANUAL_PROVIDERS.map((p) => ({
      key: p.key,
      label: p.label,
      live: false as const,
      capabilities: { inventory: manualCapability, configuration: manualCapability, networking: manualCapability, billing: manualCapability, utilization: 'unsupported' as CapabilityLevel },
      credentialFields: [],
      docsUrl: null,
    }));
    return [...live, ...manual];
  }

  isKnownProvider(key: string): boolean {
    return this.adapters.has(key) || MANUAL_PROVIDERS.some((p) => p.key === key);
  }
}

export const PROVIDER_REGISTRY = Symbol('INFRA_PROVIDER_REGISTRY');
