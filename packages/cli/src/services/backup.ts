import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as tar from "tar";
import type { ProjectConfig } from "../config/project";

export async function createBackup(projectRoot: string, config: ProjectConfig): Promise<string> {
  const backupsDir = join(projectRoot, "backups");
  mkdirSync(backupsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `hyacine-${ts}.tar.gz`;
  const outPath = join(backupsDir, filename);
  // Collect existing dirs/files to archive
  const candidates = [config.contentDir, config.assetsDir, "hyacine.yml", "hyacine.yaml"];
  if (config.themeConfigPath !== null) candidates.push(config.themeConfigPath);
  const existing = candidates.filter((p) => existsSync(join(projectRoot, p)));
  if (existing.length === 0) {
    // At least include contentDir if empty
    existing.push(config.contentDir);
  }
  await tar.create(
    {
      gzip: true,
      file: outPath,
      cwd: projectRoot,
    },
    existing,
  );
  return outPath;
}
