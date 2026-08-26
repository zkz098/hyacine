declare module "astro:content" {
  export function defineCollection(config: any): any;
  export function reference(collection: string): any;
  export const z: typeof import("zod").z;
}
