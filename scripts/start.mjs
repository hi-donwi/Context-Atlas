#!/usr/bin/env node
// `npm start`: build the folder explorer, then serve a folder. The build runs quietly and
// its output is shown only when it fails, so a broken checkout never fails silently.
import { spawnSync } from 'node:child_process';

const npmCli = process.env.npm_execpath;
const [command, args] = npmCli === undefined ? ['npm', []] : [process.execPath, [npmCli]];
const build = spawnSync(command, [...args, 'run', 'build:cli'], {
  encoding: 'utf8',
  env: { ...process.env, npm_config_loglevel: 'error' },
  shell: npmCli === undefined && process.platform === 'win32',
});

if (build.status !== 0) {
  process.stderr.write(build.stdout ?? '');
  process.stderr.write(build.stderr ?? '');
  if (build.error !== undefined) process.stderr.write(`${build.error.message}\n`);
  process.stderr.write('Context Atlas could not be built; the output above says why.\n');
  process.exit(build.status ?? 1);
}

await import('../apps/cli/dist/bin.js');
