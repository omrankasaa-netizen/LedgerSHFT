import type { z } from "zod";

/**
 * Validate request data with a zod schema. Throws ZodError (→ 400) on failure.
 * Returns the schema's *output* type (defaults applied). Never trust client
 * input: every write endpoint runs through this.
 */
export function validate<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  return schema.parse(data);
}
