import { z } from "zod";
export declare const StatsResponseSchema: z.ZodObject<{
    totals: z.ZodObject<{
        posts: z.ZodNumber;
        drafts: z.ZodNumber;
        published: z.ZodNumber;
    }, z.core.$strip>;
    byCategory: z.ZodRecord<z.ZodString, z.ZodNumber>;
    byMonth: z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    assets: z.ZodObject<{
        total: z.ZodNumber;
        remote: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
