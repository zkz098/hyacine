import { z } from "zod";
import { CategoryNameSchema } from "./common";

export const StatsResponseSchema = z.object({
  totals: z.object({
    posts: z.number().int().nonnegative(),
    drafts: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
  }),
  byCategory: z.record(CategoryNameSchema, z.number().int().nonnegative()),
  byMonth: z.array(
    z.object({
      /** YYYY-MM */
      month: z.string().regex(/^\d{4}-\d{2}$/),
      count: z.number().int().nonnegative(),
    }),
  ),
  assets: z.object({
    total: z.number().int().nonnegative(),
    remote: z.number().int().nonnegative(),
  }),
});

export type StatsResponse = z.infer<typeof StatsResponseSchema>;
