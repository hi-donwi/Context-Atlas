import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ContextSnapshot } from '../packages/model/src/types.js';

async function expectNoDocumentOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(geometry.document, 'The document must fit the viewport horizontally.').toBeLessThanOrEqual(
    geometry.viewport + 1,
  );
  expect(geometry.body, 'Content must not create a horizontal body scroll.').toBeLessThanOrEqual(
    geometry.viewport + 1,
  );
}

async function expectReadableText(locator: Locator) {
  await expect(locator).toBeVisible();
  const geometry = await locator.evaluate((element) => ({
    width: element.clientWidth,
    contentWidth: element.scrollWidth,
    overflow: getComputedStyle(element).overflowX,
    textOverflow: getComputedStyle(element).textOverflow,
  }));
  expect(
    geometry.contentWidth,
    'Imported text should wrap within its own box.',
  ).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.overflow, 'Inspector text must not silently clip long content.').not.toBe(
    'hidden',
  );
  expect(geometry.textOverflow).not.toBe('ellipsis');
}

for (const width of [320, 768, 1024]) {
  test(`${width}px keeps project navigation, display controls, and source inspection reachable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expectNoDocumentOverflow(page);

    const mobileMenu = page.getByRole('button', { name: 'Open navigation', exact: true });
    if (width <= 760) {
      await expect(mobileMenu).toBeInViewport();
      await mobileMenu.click();
    } else {
      await expect(mobileMenu).toBeHidden();
    }

    const navigation = page.getByRole('navigation', { name: 'Project views' });
    await expect(navigation).toBeInViewport();
    await navigation.getByRole('button', { name: /^Place an order/ }).click();
    await expectNoDocumentOverflow(page);

    const graph = page.getByRole('button', { name: 'Graph view', exact: true });
    const list = page.getByRole('button', { name: 'List view', exact: true });
    for (const control of [graph, list]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(24);
      expect(box?.height).toBeGreaterThanOrEqual(24);
    }
    await expect(graph).toHaveAttribute('aria-pressed', 'true');
    await list.click();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /^Create an order Accepts/ }).click();

    const inspector = page.getByRole('complementary', { name: 'Object inspector' });
    const title = inspector.getByRole('heading', { name: 'Create an order', exact: true });
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeInViewport();
    await inspector.getByRole('button', { name: /sources/i }).click();
    const path = inspector.getByText('contracts/openapi.json', { exact: true });
    await path.scrollIntoViewIfNeeded();
    await expect(path).toBeInViewport();
    await expectNoDocumentOverflow(page);
  });
}

for (const width of [320, 1024]) {
  test(`${width}px preserves long imported metadata and inspector content without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const snapshot = JSON.parse(
      readFileSync(
        new URL('../apps/demo/public/examples/atlas-commerce.context.json', import.meta.url),
        'utf8',
      ),
    ) as ContextSnapshot;
    const projectName = 'SyntheticProject'.repeat(8);
    const operationName = 'CreateOrder'.repeat(12);
    const operationDescription = 'RequestedOperationContext'.repeat(10);
    const sourcePath = `contracts/${'LongSchemaName'.repeat(14)}.json`;
    snapshot.project.id = 'long-import';
    snapshot.project.name = projectName;
    snapshot.project.description = 'ProjectContext'.repeat(20);
    const operation = snapshot.nodes.find((node) => node.id === 'create-order')!;
    operation.label = operationName;
    operation.description = operationDescription;
    const source = snapshot.sources.find((item) => item.id === 'commerce-api')!;
    source.path = sourcePath;
    source.label = 'SyntheticContractSource'.repeat(6);
    source.revision = 'Revision'.repeat(12);

    await page.getByLabel('Import context JSON').setInputFiles({
      name: 'long-project.context.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot)),
    });
    const projectTitle = page.getByRole('heading', { name: projectName, exact: true });
    await expect(projectTitle).toHaveText(projectName);
    await expectReadableText(projectTitle);
    await expectNoDocumentOverflow(page);

    if (width <= 760) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('navigation', { name: 'Project views' })
      .getByRole('button', { name: /API reference/ })
      .click();
    await page.getByRole('button', { name: new RegExp(`^${operationName} `) }).click();
    const inspector = page.getByRole('complementary', { name: 'Object inspector' });
    const operationTitle = inspector.getByRole('heading', { name: operationName, exact: true });
    await operationTitle.scrollIntoViewIfNeeded();
    await expect(operationTitle).toHaveText(operationName);
    await expectReadableText(operationTitle);
    const description = inspector.getByText(operationDescription, { exact: true });
    await expect(description).toHaveText(operationDescription);
    await expectReadableText(description);
    await inspector.getByRole('button', { name: /sources/i }).click();
    const path = inspector.getByText(sourcePath, { exact: true });
    await path.scrollIntoViewIfNeeded();
    await expect(path).toHaveText(sourcePath);
    await expectReadableText(path);
    await expectNoDocumentOverflow(page);
  });
}
