export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS?: R2Bucket;
  AI: Ai;
  SETUP_CODE?: string;
  AI_SUMMARY_ENDPOINT?: string;
  AI_SUMMARY_KEY?: string;
  AI_SUMMARY_MODEL?: string;
  AI_SUMMARY_PROVIDER?: string;
  R2_S3_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  EMBED_MODEL?: string;
}

export interface Variables {
  tokenId: string;
  scopes: string[];
  label: string;
}
