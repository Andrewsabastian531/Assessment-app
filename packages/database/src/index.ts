import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/**
 * A single PrismaClient per process. Next.js dev-mode hot reload re-evaluates
 * modules on every change, so without the global cache each reload would open a
 * fresh connection pool and exhaust Postgres within a few edits.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Number of dimensions the embedding columns expect. Must match schema.prisma. */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * pgvector literals have to be interpolated as strings — Prisma cannot bind a
 * float array to a `vector` parameter. Callers must only ever pass numbers.
 */
export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-dimensional embedding, received ${embedding.length}`,
    );
  }
  return `[${embedding.map((n) => Number(n).toFixed(8)).join(',')}]`;
}
