import { z } from 'zod';
import { LOCALES } from './locales';

/**
 * Keys are dot-namespaced by screen or system (`creation.*`, `settings.*`,
 * `ledger.*`). The pattern is enforced because a flat key is the first step
 * toward two screens quietly sharing a string and then needing to diverge.
 */
const keySchema = z.string().regex(/^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z0-9_-]+)+$/);

export const CatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  locale: z.enum(LOCALES),
  // An empty translation renders as a blank label rather than falling back to
  // English, which looks like a rendering bug and is nearly impossible to spot
  // in review. Reject it at the schema instead.
  strings: z.record(keySchema, z.string().min(1)),
});

export type Catalog = z.infer<typeof CatalogSchema>;
