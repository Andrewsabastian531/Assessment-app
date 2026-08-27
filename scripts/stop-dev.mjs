#!/usr/bin/env node
/** Stops the dev servers, including the whole process tree they belong to. */
import { execSync } from 'node:child_process';

const PORTS = [Number(process.env.WEB_PORT) || 3000, Number(process.env.API_PORT) || 4000];
const isWindows = process.platform === 'win32';

/** Process names that can appear in a `pnpm dev` tree. */
const TREE_NAMES = /^(node|turbo|pnpm|npm|sh|bash|cmd|conhost)(\.exe)?$/i;

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

function pidsOnPort(port) {
  try {
    if (isWindows) {
      const out = run(`netstat -ano -p TCP | findstr LISTENING | findstr :${port}`);
      return [
        ...new Set(
          out
            .split('\n')
            .map((line) => line.trim().split(/\s+/).pop())
            .filter((pid) => pid && /^\d+$/.test(pid) && pid !== '0'),
        ),
      ];
    }
    return run(`lsof -ti tcp:${port} -sTCP:LISTEN`)
      .split('\n')
      .map((pid) => pid.trim())
      .filter(Boolean);
  } catch {
    // findstr / lsof exit non-zero when nothing matches.
    return [];
  }
}

/** pid -> { parent, name } for every running process. */
function processTable() {
  try {
    if (isWindows) {
      const json = run(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process | ' +
          'Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress"',
      );
      const rows = JSON.parse(json);
      return new Map(
        (Array.isArray(rows) ? rows : [rows]).map((row) => [
          String(row.ProcessId),
          { parent: String(row.ParentProcessId), name: row.Name ?? '' },
        ]),
      );
    }
    const out = run('ps -eo pid=,ppid=,comm=');
    return new Map(
      out
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter((parts) => parts.length >= 3)
        .map(([pid, ppid, ...rest]) => [pid, { parent: ppid, name: rest.join(' ') }]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Climbs from a leaf to the highest ancestor that still looks like part of the dev run,
 * so we kill turbo rather than one of its children.
 */
function rootOfRun(pid, table) {
  let current = pid;
  const seen = new Set([pid]);

  for (;;) {
    const entry = table.get(current);
    if (!entry) return current;
    const parent = table.get(entry.parent);
    // Stop at the shell/terminal — never climb past the dev run itself.
    if (!parent || !TREE_NAMES.test(parent.name) || seen.has(entry.parent)) {
      return current;
    }
    seen.add(entry.parent);
    current = entry.parent;
  }
}

const table = processTable();
const roots = new Set();
let anyListening = false;

for (const port of PORTS) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    console.log(`port ${port}: free`);
    continue;
  }
  anyListening = true;
  for (const pid of pids) {
    const root = rootOfRun(pid, table);
    const name = table.get(root)?.name ?? 'process';
    console.log(`port ${port}: pid ${pid} -> killing tree at ${name} (${root})`);
    roots.add(root);
  }
}

for (const root of roots) {
  try {
    execSync(isWindows ? `taskkill /PID ${root} /T /F` : `kill -9 -${root} || kill -9 ${root}`, {
      stdio: 'ignore',
    });
  } catch {
    console.warn(`  could not kill ${root} (already gone?)`);
  }
}

// A watch task that holds no port can still survive if it was started detached.
if (anyListening && isWindows) {
  try {
    execSync('taskkill /IM turbo.exe /T /F', { stdio: 'ignore' });
  } catch {
    // No turbo left — fine.
  }
}

console.log(roots.size === 0 ? '\nNothing to stop.' : `\nStopped ${roots.size} process tree(s).`);
