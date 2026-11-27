import { test, expect } from '@playwright/test';

test.describe('commercial reset launcher (#38) - auxiliary windows', () => {
  test('launcher: 9-step acceptance - loads, no forbidden fields/words, aux windows open/close, links resolve, funnel dedup', async ({ page }) => {
    // Step 1: page loads with status 200 and skip link present.
    await test.step('step 1: page loads and skip link is present', async () => {
      const res = await page.goto('/docs/commercial-reset-launcher/index.html', { waitUntil: 'domcontentloaded' });
      expect(res.ok(), 'page status').toBeTruthy();
      await expect(page.locator('.skip-link')).toBeAttached();
    });

    // Step 2: no email input, no buyForm / buyBtn ids on the storefront page.
    await test.step('step 2: no email input, no buyForm/buyBtn ids', async () => {
      await expect(page.locator('input[type="email"]')).toHaveCount(0);
      await expect(page.locator('#buyForm')).toHaveCount(0);
      await expect(page.locator('#buyBtn')).toHaveCount(0);
    });

    // Step 3: forbidden words absent from published HTML.
    await test.step('step 3: no waitlist / no paid offer words', async () => {
      const html = await page.content();
      expect(html).not.toContain('waitlist');
      expect(html).not.toContain('no paid offer');
    });

    // Step 4: no Stripe payment link promoted.
    await test.step('step 4: no buy.stripe.com link', async () => {
      const html = await page.content();
      expect(html).not.toContain('buy.stripe.com');
    });

    // Step 5: all four auxiliary window buttons are present and visible.
    await test.step('step 5: four aux window buttons visible', async () => {
      const buttons = [
        '[data-open-aux="help"]',
        '[data-open-aux="demo"]',
        '[data-open-aux="qualification"]',
        '[data-open-aux="faq"]',
      ];
      for (const sel of buttons) {
        await expect(page.locator(sel)).toBeVisible();
      }
    });

    // Step 6: opening each auxiliary window shows its content; closing via the
    // close button hides it.
    await test.step('step 6: open each aux window and close via close button', async () => {
      const auxMap = [
        { open: '[data-open-aux="help"]', close: '[data-close-aux="help"]', aux: '#bw-aux-help', text: 'Help' },
        { open: '[data-open-aux="demo"]', close: '[data-close-aux="demo"]', aux: '#bw-aux-demo', text: 'Demo' },
        { open: '[data-open-aux="qualification"]', close: '[data-close-aux="qualification"]', aux: '#bw-aux-qualification', text: 'Qualification' },
        { open: '[data-open-aux="faq"]', close: '[data-close-aux="faq"]', aux: '#bw-aux-faq', text: 'FAQ' },
      ];
      for (const m of auxMap) {
        await page.locator(m.open).click();
        await expect(page.locator(m.aux)).toHaveAttribute('aria-hidden', 'false');
        await expect(page.locator(m.aux).locator('.aux-title')).toContainText(m.text);
        await page.locator(m.close).click();
        await expect(page.locator(m.aux)).toHaveAttribute('aria-hidden', 'true');
      }
    });

    // Step 7: backdrop click closes an auxiliary window (exposed JS, avoids the
    // aux/z-index blocking a DOM click on the backdrop).
    await test.step('step 7: backdrop closes aux window', async () => {
      await page.locator('[data-open-aux="help"]').click();
      await expect(page.locator('#bw-aux-help')).toHaveAttribute('aria-hidden', 'false');
      await page.evaluate(() => window.closeAux && window.closeAux('all'));
      await expect(page.locator('#bw-aux-help')).toHaveAttribute('aria-hidden', 'true');
    });

    // Step 8: auxiliary links resolve to existing pages.
    await test.step('step 8: aux links resolve to existing pages', async () => {
      const links = [
        '../commercial-reset/index.html',
        '../../demo.html',
        '../commercial-reset/qualification.html',
        '../../faq.html',
      ];
      for (const href of links) {
        const res = await page.goto(new URL(href, 'http://127.0.0.1:8099/docs/commercial-reset-launcher/index.html').pathname, { waitUntil: 'domcontentloaded' });
        expect(res.ok(), href).toBeTruthy();
      }
      await page.goto('/docs/commercial-reset-launcher/index.html', { waitUntil: 'domcontentloaded' });
    });

    // Step 9: funnel page_view recorded once (session dedup), no console errors.
    await test.step('step 9: funnel page_view dedup and no console errors', async () => {
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.goto('/docs/commercial-reset-launcher/index.html?funnel_test=issue38', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      await page.goto('/docs/commercial-reset-launcher/index.html?funnel_test=issue38', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      const buf = await page.evaluate(() => (window.botwowFunnel && window.botwowFunnel.buffer) ? window.botwowFunnel.buffer : []);
      const views = buf.filter((e) => e.event === 'page_view');
      expect(views.length).toBe(1);
      expect(views[0].test).toBe(1);
      expect(views[0].ref).toBe('issue38');
      expect(errors).toHaveLength(0);
    });
  });
});
