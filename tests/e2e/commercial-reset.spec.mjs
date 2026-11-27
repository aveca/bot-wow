import { test, expect } from '@playwright/test';

test.describe('commercial reset (#224) - storefront + qualification', () => {
  test('storefront: loads, skip link, no email input, no Stripe link, no waitlist', async ({ page }) => {
    const res = await page.goto('/docs/commercial-reset/index.html', { waitUntil: 'domcontentloaded' });
    expect(res.ok()).toBeTruthy();
    await expect(page.locator('.skip-link')).toBeAttached();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain('buy.stripe.com');
    expect(html).not.toContain('waitlist');
    expect(html).not.toContain('no paid offer');
    await expect(page.locator('[data-cta-id="qualification-contact"]')).toBeVisible();
  });

  test('storefront: links resolve to existing pages', async ({ page }) => {
    await page.goto('/docs/commercial-reset/index.html', { waitUntil: 'domcontentloaded' });
    const links = ['../../product.html', '../../demo.html', '../../buy.html', '../../faq.html', 'qualification.html'];
    for (const href of links) {
      const res = await page.goto(new URL(href, 'http://127.0.0.1:8099/docs/commercial-reset/index.html').pathname.replace('/docs/commercial-reset/index.html', ''), { waitUntil: 'domcontentloaded' });
      expect(res.ok(), href).toBeTruthy();
    }
  });

  test('qualification: submission failure path shows honest error and mailto fallback', async ({ page }) => {
    await page.goto('/docs/commercial-reset/qualification.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bw-email').fill('test@example.com');
    await page.locator('#bw-subject').fill('subject');
    await page.locator('#bw-message').fill('message');
    await page.locator('#bw-consent-transactional').check();
    await page.locator('#bw-submit').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#bw-err')).toBeVisible();
    await expect(page.locator('#bw-fallback')).toBeVisible();
    await expect(page.locator('#bw-fallback a')).toBeAttached();
  });

  test('funnel: page_view recorded once (session dedup), test flag + ref', async ({ page }) => {
    await page.goto('/docs/commercial-reset/index.html?funnel_test=issue224', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    await page.goto('/docs/commercial-reset/index.html?funnel_test=issue224', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const buf = await page.evaluate(() => (window.botwowFunnel && window.botwowFunnel.buffer) ? window.botwowFunnel.buffer : []);
    const views = buf.filter((e) => e.event === 'page_view');
    expect(views.length).toBe(1);
    expect(views[0].test).toBe(1);
    expect(views[0].ref).toBe('issue224');
    expect(views[0].source).toBe('direct');
  });

  test('funnel: support_lead recorded on submit attempt', async ({ page }) => {
    await page.goto('/docs/commercial-reset/qualification.html?funnel_test=issue224', { waitUntil: 'domcontentloaded' });
    await page.locator('#bw-email').fill('a@b.com');
    await page.locator('#bw-subject').fill('s');
    await page.locator('#bw-message').fill('m');
    await page.locator('#bw-consent-transactional').check();
    await page.locator('#bw-submit').click();
    await page.waitForTimeout(300);
    const buf = await page.evaluate(() => (window.botwowFunnel && window.botwowFunnel.buffer) ? window.botwowFunnel.buffer : []);
    const leads = buf.filter((e) => e.event === 'support_lead');
    expect(leads.length).toBeGreaterThanOrEqual(1);
    expect(leads[0].test).toBe(1);
    expect(leads[0].ref).toBe('issue224');
  });
});
