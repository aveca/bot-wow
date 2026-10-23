/**
 * playwright.config.mjs — QA visuelle et fonctionnelle BOT-WOW.
 *
 * Pourquoi Playwright ici : le projet est un site statique sans framework.
 * Playwright pilote un vrai Chromium contre le build local (`_site`), ce qui
 * permet de vérifier les interactions réelles (démo, formulaires, CTA), les
 * erreurs console/réseau et de produire des captures comparables avant/après.
 *
 * Aucune dépendance runtime n'est ajoutée au site : @playwright/test est une
 * devDependency utilisée uniquement par la QA.
 *
 * Serveur local : `node scripts/serve.mjs 8099 _site` (commande réelle du
 * dépôt, déduite de scripts/serve.mjs, pas d'hypothèse).
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Les captures sont des artefacts de vérification : pas de diff auto.
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
  reporter: [['list']],
  use: {
    baseURL: BASE,
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `node scripts/serve.mjs ${PORT} _site`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
