import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { validateSnapshot } from '../packages/model/src/index.js';
import { apiProject } from '../apps/demo/src/fixtures/index.js';

test('loads the snapshot validator without dynamic function evaluation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const OriginalFunction = window.Function;
    Object.defineProperty(window, 'Function', {
      configurable: false,
      writable: false,
      value: new Proxy(OriginalFunction, {
        apply() {
          throw new EvalError('Dynamic function evaluation is disabled');
        },
        construct() {
          throw new EvalError('Dynamic function evaluation is disabled');
        },
      }),
    });
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Atlas Commerce API', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('inspect an API contract and trace its source', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Atlas Commerce API', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Project views' })
    .getByRole('button', { name: /API reference/ })
    .click();
  await page.getByRole('button', { name: /^Create an order Accepts/ }).click();
  const inspector = page.getByRole('complementary', { name: 'Object inspector' });
  await expect(
    inspector.getByRole('heading', { name: 'Create an order', exact: true }),
  ).toBeVisible();
  await expect(inspector.getByRole('code').filter({ hasText: /^\/api\/orders$/ })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Response 409' })).toBeVisible();
  await inspector.getByRole('button', { name: /sources/i }).click();
  await expect(inspector.getByText('contracts/openapi.json', { exact: true })).toBeVisible();
  await expect(errors).toEqual([]);
});

test('journey graph has ordered steps and an accessible list alternative', async ({ page }) => {
  await page.goto('/?project=atlas-commerce&view=place-order');
  await expect(page.getByRole('list', { name: 'Journey steps' }).getByRole('listitem')).toHaveCount(
    6,
  );
  await expect(
    page.getByRole('button', { name: 'Inspect Create an order', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await page.getByRole('button', { name: /^Insufficient stock Returns/ }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Object inspector' })
      .getByRole('heading', { name: 'Insufficient stock', exact: true }),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search context' }).fill('no-such-context');
  await expect(page.getByRole('heading', { name: 'No objects in this selection.' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('heading', { name: 'No objects in this selection.' })).toHaveCount(0);
});

test('project switching and deep links preserve the selected object', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Select project' }).selectOption('fieldnotes-website');
  await expect(
    page.getByRole('heading', { name: 'Fieldnotes Website', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Project views' })
    .getByRole('button', { name: /API reference/ })
    .click();
  await page.getByRole('button', { name: /^Subscribe to newsletter A public endpoint/ }).click();
  const url = page.url();
  expect(url).toContain('project=fieldnotes-website');
  expect(url).toContain('node=subscribe-api');
  await page.reload();
  await expect(
    page
      .getByRole('complementary', { name: 'Object inspector' })
      .getByRole('heading', { name: 'Subscribe to newsletter', exact: true }),
  ).toBeVisible();
});

test('selected context exports portable JSON and the task objective', async ({ page }) => {
  await page.goto('/?project=atlas-commerce&view=api&node=create-order');
  await page.getByRole('button', { name: 'Export context', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Task objective').fill('Review the declared error contract.');
  await expect(dialog.getByLabel('Context packet preview')).toContainText(
    'Review the declared error contract.',
  );
  await dialog.getByRole('checkbox').uncheck();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'JSON', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const snapshot: unknown = JSON.parse(await readFile(path!, 'utf8'));
  const result = validateSnapshot(snapshot);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.snapshot.nodes.map((n) => n.id)).toEqual(['orders-module', 'create-order']);
    expect(result.snapshot.sources.some((s) => s.id === 'commerce-study')).toBe(false);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('invalid import preserves the current project and valid OpenAPI import stays local', async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:'))
      externalRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByLabel('Import context JSON').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(
    page.getByRole('heading', { name: 'Atlas Commerce API', exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Import context JSON')
    .setInputFiles('apps/demo/public/examples/catalog.openapi.json');
  await expect(page.getByRole('status')).toContainText('is ready');
  await expect(page.getByRole('heading', { name: 'Atlas Commerce API', exact: true })).toHaveCount(
    0,
  );
  expect(externalRequests).toEqual([]);
});

test('same-ID imports reconcile removed views and modules', async ({ page }) => {
  await page.goto('/?project=atlas-commerce&view=place-order&module=orders-module');
  const replacement = structuredClone(apiProject);
  const operation = replacement.nodes.find((node) => node.id === 'create-order')!;
  delete operation.moduleId;
  replacement.nodes = [operation];
  replacement.edges = [];
  replacement.project.capabilities = ['api'];
  replacement.views = [
    {
      id: 'new-api',
      kind: 'api',
      label: 'Replacement API',
      description: 'A new contract slice.',
      nodeIds: [operation.id],
    },
  ];
  await page.getByLabel('Import context JSON').setInputFiles({
    name: 'replacement.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await expect(page.getByRole('status')).toContainText('is ready');
  await expect(page).not.toHaveURL(/module=orders-module/);
  await expect(page).not.toHaveURL(/view=place-order/);
  await expect(page.getByRole('heading', { name: 'No objects in this selection.' })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Project views' })
    .getByRole('button', { name: /Replacement API/ })
    .click();
  await expect(page.getByRole('button', { name: /^Create an order Accepts/ })).toBeVisible();
});

test('long project versions stay bounded in the sidebar', async ({ page }) => {
  const snapshot = structuredClone(apiProject);
  const revision = `revision-${'0123456789'.repeat(8)}`;
  snapshot.project.version = revision;
  await page.goto('/');
  await page.getByLabel('Import context JSON').setInputFiles({
    name: 'long-version.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await expect(page.getByRole('status')).toContainText('is ready');

  const projectType = page.locator('.atlas-project-type');
  const assertBounded = async () => {
    const bounds = await projectType.boundingBox();
    expect(bounds?.height).toBeLessThanOrEqual(24);
    await expect(projectType.locator('.atlas-project-version')).toHaveAttribute('title', revision);
  };
  await assertBounded();

  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await assertBounded();
});

test('mobile layout keeps navigation, inspector and controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Project views' })
    .getByRole('button', { name: /API reference/ })
    .click();
  await page.getByRole('button', { name: /^Create an order Accepts/ }).click();
  await page.getByRole('link', { name: 'Inspect Create an order', exact: true }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Object inspector' })
      .getByRole('heading', { name: 'Create an order', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('desktop geometry and keyboard entry remain usable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to project content' })).toBeFocused();
  await page.getByRole('heading', { name: 'Atlas Commerce API', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/overview-wide.png', fullPage: true });
  await page.goto('/?project=atlas-commerce&view=place-order&node=create-order');
  await expect(
    page.getByRole('button', { name: 'Inspect Create an order', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/journey-wide.png', fullPage: true });
});
