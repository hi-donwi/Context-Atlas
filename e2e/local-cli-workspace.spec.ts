import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

interface RunningCli {
  readonly process: ChildProcessWithoutNullStreams;
  readonly url: string;
}

let workspaceRoot: string;
const running: RunningCli[] = [];

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(join(workspaceRoot, path)), { recursive: true });
  await writeFile(join(workspaceRoot, path), content);
}

async function startCli(args: readonly string[]): Promise<string> {
  const child = spawn(process.execPath, [resolve('apps/cli/dist/bin.js'), ...args, '--port', '0'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const url = await new Promise<string>((resolveReady, rejectReady) => {
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      const match = /Context Atlas API listening at (http:\/\/127\.0\.0\.1:\d+)/.exec(stdout);
      if (match !== null) resolveReady(match[1]!);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', rejectReady);
    child.once('exit', (code) => {
      rejectReady(new Error(`Local CLI exited before startup (${code}): ${stderr}`));
    });
  });
  running.push({ process: child, url });
  return url;
}

test.beforeAll(async () => {
  workspaceRoot = await mkdtemp(join(tmpdir(), 'context-atlas-workspace-fixture-'));
  await put(
    'context/registry.tsv',
    [
      'key\tclient\tgroup\tdescription\tcontext_repo',
      'billing-api\tnorthwind\tfinance\tSynthetic billing backend\tprojects/northwind/billing-context',
      'portal\tnorthwind\t-\t-\t-',
    ].join('\n'),
  );
  await put('context/atlas.json', JSON.stringify({ title: 'Synthetic workspace' }));
  await put('context/README.md', '# Workspace overview\n\nEvery client and project.');
  await put('context/memory/projects/billing-api/active.md', '# Billing focus');
  await put('context/memory/projects/portal/active.md', '# Portal focus');
  await put('context/clients/northwind/client.md', '# Northwind');
  await put('context/clients/northwind/groups/finance/decisions.md', '# Finance decisions');
  await put('context/clients/northwind/groups/retail/notes.md', '# Retail notes');
  await put('projects/northwind/billing-context/README.md', '# Billing context home');
});

test.afterAll(async () => {
  await Promise.all(
    running.map(
      ({ process: child }) =>
        new Promise<void>((resolveExit) => {
          if (child.exitCode !== null) return resolveExit();
          child.once('exit', () => resolveExit());
          child.kill('SIGTERM');
        }),
    ),
  );
  if (workspaceRoot !== undefined) await rm(workspaceRoot, { recursive: true, force: true });
});

test('switch from All to one project scope and keep it across a reload', async ({ page }) => {
  const url = await startCli([join(workspaceRoot, 'context')]);
  await page.goto(url);

  const navigation = page.getByRole('navigation', { name: 'Folder contents' });
  const scope = navigation.getByRole('combobox', { name: 'Scope' });
  await expect(scope).toHaveValue('all');
  await expect(page.getByRole('heading', { level: 1, name: 'Workspace overview' })).toBeVisible();
  await expect(page.getByText('Context Atlas · Workspace context')).toBeVisible();

  await scope.selectOption('project:billing-api');
  await expect(page).toHaveURL(/#\/project%3Abilling-api\/billing-context\/README\.md$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Billing context home' })).toBeVisible();
  for (const name of ['billing-context', 'client', 'group', 'memory']) {
    await expect(
      navigation.getByRole('button', { name: new RegExp(`folder ${name}$`) }),
    ).toBeVisible();
  }

  await navigation.getByRole('button', { name: /folder client$/ }).click();
  await expect(navigation.getByText('client.md')).toBeVisible();
  await expect(navigation.getByText('groups')).toHaveCount(0);

  await page.reload();
  await expect(scope).toHaveValue('project:billing-api');
  await expect(page.getByRole('heading', { level: 1, name: 'Billing context home' })).toBeVisible();

  await page.goBack();
  await expect(scope).toHaveValue('all');
});

test('a project lock shows one scope and no switcher', async ({ page }) => {
  const url = await startCli([join(workspaceRoot, 'context'), '--project', 'portal']);
  await page.goto(url);

  const navigation = page.getByRole('navigation', { name: 'Folder contents' });
  await expect(navigation.getByRole('combobox', { name: 'Scope' })).toHaveCount(0);
  await expect(navigation.getByText('portal', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Portal focus' })).toBeVisible();

  const response = await page.request.get(`${url}/atlas/api/tree?scope=all&dir=`);
  expect(response.status()).toBe(404);
});
