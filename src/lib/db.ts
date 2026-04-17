import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

function trimEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function findProjectRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "prisma", "schema.prisma"))) {
    return cwd;
  }

  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(path.join(dir, "prisma", "schema.prisma"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return cwd;
}

/** Prisma on Windows expects `file:C:/path/db.sqlite`, not `file:///C:/...` from `pathToFileURL`. */
function toPrismaSqliteFileUrl(absFsPath: string) {
  const forward = absFsPath.replace(/\\/g, "/");
  return `file:${forward}`;
}

/**
 * Prisma CLI resolves relative SQLite URLs against the folder that contains `schema.prisma`
 * (usually `prisma/`). PrismaClient resolves the same string against `process.cwd()` instead,
 * so a URL like `file:./dev.db` points at two different files depending on who reads it.
 *
 * We always rewrite relative `file:` URLs to an absolute `file:` path under the repo so the
 * CLI, migrations, and Next.js agree on the same database file.
 */
function resolveRelativeSqliteFileToAbsolutePath(rest: string) {
  const clean = rest.replace(/^(\.\/)+/, "").replace(/\\/g, "/");
  const root = findProjectRoot();

  if (clean.startsWith("prisma/")) {
    return path.join(root, ...clean.split("/"));
  }

  return path.join(root, "prisma", ...clean.split("/"));
}

/**
 * `file:./x` must not be parsed with `new URL()` alone: Node turns `file:./prisma/dev.db` into
 * `file:///prisma/dev.db`, which points at the wrong place on disk.
 */
function normalizeSqliteDatabaseUrl() {
  const trimmed = trimEnv(process.env.DATABASE_URL);
  if (!trimmed) return;
  process.env.DATABASE_URL = trimmed;

  if (!trimmed.toLowerCase().startsWith("file:")) return;

  const rest = trimmed.slice("file:".length);
  const needsProjectRelativeResolution =
    rest.startsWith("./") ||
    rest.startsWith("../") ||
    (!rest.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(rest));

  if (needsProjectRelativeResolution) {
    const abs = resolveRelativeSqliteFileToAbsolutePath(rest);
    process.env.DATABASE_URL = toPrismaSqliteFileUrl(abs);
    return;
  }

  try {
    const abs = fileURLToPath(new URL(trimmed));
    process.env.DATABASE_URL = toPrismaSqliteFileUrl(abs);
  } catch {
    // Leave as-is if we cannot normalize.
  }
}

normalizeSqliteDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
