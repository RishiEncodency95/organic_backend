/** Short-lived memory cache for the website-facing SEO endpoints; cleared the moment an admin fix or undo is saved. */
export const deliveryCache = new Map<string, { at: number; value: unknown }>();
export const clearDeliveryCache = (): void => deliveryCache.clear();
