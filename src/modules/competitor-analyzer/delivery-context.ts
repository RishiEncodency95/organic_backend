import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
const deliveries = new AsyncLocalStorage<string>();
export function withDeliveryContext<T>(key:string, work:()=>Promise<T>):Promise<T> { return deliveries.run(key,work); }
export function currentMessageId(recipient:string):string|undefined {
  const key=deliveries.getStore();
  return key ? `<analyzer-${createHash('sha256').update(`${key}:${recipient.toLowerCase()}`).digest('hex')}@reports.local>` : undefined;
}
