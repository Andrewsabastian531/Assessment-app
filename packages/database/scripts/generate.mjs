#!/usr/bin/env node
/** Runs `prisma generate`, but only when the schema has actually changed. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(packageRoot, 'prisma', 'schema.prisma');
const stampPath = join(packageRoot, 'node_modules', '.cache', 'prisma-schema.hash');

const force = process.argv.includes('--force');

const schemaHash = createHash('sha256').update(readFileSync(schemaPath)).digest('hex');
const previousHash = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : null;

if (!force && previousHash === schemaHash) {
  console.log('prisma: schema unchanged, using the existing client');
  process.exit(0);
}

// Invoke Prisma's JS entrypoint with the current Node binary rather than the `prisma`
// shim.
// Resolve through package.json rather than a hardcoded build path: the entry
// point moves between Prisma versions and install layouts.
const require = createRequire(import.meta.url);
function resolvePrisma() {
  for (const candidate of ['prisma/build/index.js', 'prisma/package.json']) {
    try {
      const resolved = require.resolve(candidate);
      return candidate.endsWith('package.json')
        ? join(dirname(resolved), 'build', 'index.js')
        : resolved;
    } catch {
      // try the next shape
    }
  }
  throw new Error(
    'Could not find the prisma CLI. Run an install that includes devDependencies ' +
      '(pnpm install --prod=false).',
  );
}

const prismaEntry = resolvePrisma();

const result = spawnSync(process.execPath, [prismaEntry, 'generate'], {
  stdio: 'inherit',
  cwd: packageRoot,
});

if (result.status !== 0) {
  console.error(
    [
      '',
      'prisma generate failed.',
      '',
      'On Windows this is usually a file lock: a running API process holds',
      'query_engine-windows.dll.node open, and Windows cannot rename an open file.',
      '',
      'Stop the API and try again:',
      '',
      '  Get-NetTCPConnection -LocalPort 4000 -State Listen |',
      '    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }',
      '',
    ].join('\n'),
  );
  process.exit(result.status ?? 1);
}

mkdirSync(dirname(stampPath), { recursive: true });
writeFileSync(stampPath, schemaHash);
