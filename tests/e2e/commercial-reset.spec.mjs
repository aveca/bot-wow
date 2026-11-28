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
    const html = await page.content();
    expect(html).not.toContain('real acknowledgment');
    expect(html).toContain('you must send it yourself');
    expect(html).toContain('does not send or store the request');
  });


  test('storefront funnel: sends first-party page, offer and CTA events without personal data', async ({ page }) => {
    const events = [];
    await page.route('**/api/track', async (route) => {
      const payload = route.request().postDataJSON();
      events.push(payload);
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, stored: true })
      });
    });

    await page.goto('/docs/commercial-reset/index.html', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => events.some((item) => item.event === 'page_view')).toBeTruthy();

    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect.poll(() => events.some((item) => item.event === 'offer_view' && item.props.step === 'pricing')).toBeTruthy();

    const demoCta = page.locator('[data-cta-id="commercial-demo"]');
    await demoCta.evaluate((element) => {
      element.addEventListener('click', (event) => event.preventDefault(), { once: true });
    });
    await demoCta.click();
    await expect.poll(() => events.some((item) => item.event === 'cta_click' && item.props.cta === 'commercial-demo')).toBeTruthy();

    const pageView = events.find((item) => item.event === 'page_view');
    expect(pageView).toMatchObject({
      v: 1,
      page: '/docs/commercial-reset/index.html',
      lang: 'en'
    });
    for (const item of events) {
      expect(item.props || {}).not.toHaveProperty('email');
      expect(item.props || {}).not.toHaveProperty('message');
      expect(item.props || {}).not.toHaveProperty('name');
      expect(item.props || {}).not.toHaveProperty('text');
    }
  });

  test('storefront: links resolve to existing pages', async ({ page }) => {
    await page.goto('/docs/commercial-reset/index.html', { waitUntil: 'domcontentloaded' });
    const links = ['../../product.html', '../../demo.html', '../../buy.html', '../../faq.html', 'qualification.html'];
    for (const href of links) {
      const res = await page.goto(new URL(href, 'http://127.0.0.1:8099/docs/commercial-reset/index.html').pathname.replace('/docs/commercial-reset/index.html', ''), { waitUntil: 'domcontentloaded' });
      expect(res.ok(), href).toBeTruthy();
    }
  });

  test('qualification: prepares a truthful mailto handoff without server submission', async ({ page }) => {
    const subscribeRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/subscribe')) subscribeRequests.push(request.url());
    });

    await page.goto('/docs/commercial-reset/qualification.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await page.locator('#bw-subject').fill('Compatibility question');
    await page.locator('#bw-message').fill('Can you confirm whether WoW Classic 1.13 is covered?');
    await page.locator('#bw-submit').click();

    await expect(page.locator('#bw-status')).toContainText('Nothing has been sent or saved');
    const href = await page.locator('#bw-email-link').getAttribute('href');
    expect(href).toMatch(/^mailto:botwow@outlook\.com\?/);
    const mailto = new URL(href);
    expect(mailto.protocol).toBe('mailto:');
    expect(mailto.pathname).toBe('botwow@outlook.com');
    expect(mailto.searchParams.get('subject')).toBe('Compatibility question');
    expect(mailto.searchParams.get('body')).toContain('Can you confirm whether WoW Classic 1.13 is covered?');
    await expect(page.locator('#bw-static-contact')).toHaveAttribute('href', 'mailto:botwow@outlook.com');
    expect(subscribeRequests).toHaveLength(0);
  });

  test('funnel: email handoff is a CTA click, never a support lead', async ({ page }) => {
    await page.route('**/api/track', (route) => route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, stored: true })
    }));
    await page.goto('/docs/commercial-reset/qualification.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bw-subject').fill('Product question');
    await page.locator('#bw-message').fill('I would like to understand the planner.');
    await page.locator('#bw-submit').click();

    await page.evaluate(() => {
      const originalTrack = window.botwowTrack;
      window.__trackedEvents = [];
      window.botwowTrack = function(event, props) {
        window.__trackedEvents.push({ event, props });
        return originalTrack(event, props);
      };
      document.getElementById('bw-email-link').addEventListener('click', (event) => {
        event.preventDefault();
      }, { once: true });
    });
    await page.locator('#bw-email-link').click();

    const events = await page.evaluate(() => window.__trackedEvents);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('cta_click');
    expect(events[0].props.cta).toBe('support_email_open');
    expect(events[0].props.step).toBe('qualification');
    expect(events[0].props).not.toHaveProperty('email');
    expect(events[0].props).not.toHaveProperty('message');
    expect(events.some((item) => item.event === 'support_lead')).toBe(false);
  });
});
