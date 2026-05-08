import { test, expect, type Page } from '@playwright/test';
import { GroupListPage }   from './pages/grouplistpage.test';
import { GroupDetailPage } from './pages/groupdetailpage.test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remet la DB à zéro avant chaque test (route fournie par server.ts). */
async function resetDb(page: Page) {
  await page.request.post('/_test/reset');
}

/**
 * Crée un groupe avec 3 membres via l'API directement.
 * Plus rapide que passer par l'UI pour les tests qui ont besoin d'un groupe préexistant.
 */
async function seedGroup(
  page: Page,
  groupId: string,
  groupName: string,
  members: Array<{ id: string; name: string; email: string }>,
) {
  await page.request.post('/api/groups', {
    data: { id: groupId, name: groupName, currency: 'EUR', members },
  });
}

// ─── Isolation ───────────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await resetDb(page);
});

// ─────────────────────────────────────────────────────────────────────────────
// SCÉNARIO 1 — Créer un groupe avec 3 membres
// ─────────────────────────────────────────────────────────────────────────────
test('1. créer un groupe avec 3 membres → le groupe apparaît dans la liste', async ({ page }) => {
  const listPage = new GroupListPage(page);
  await listPage.goto();

  await listPage.createGroup(
    'Vacances été',
    'EUR',
    [
      'Alice <alice@test.com>',
      'Bob <bob@test.com>',
      'Charlie <charlie@test.com>',
    ],
  );

  // Après fermeture du dialog, l'accueil est rechargé automatiquement
  // L'auto-wait de Playwright attend que le listitem soit visible
  const groupNames = await listPage.getGroupNames();
  expect(groupNames.some((n) => n.includes('Vacances été'))).toBe(true);
});

test('2. ajouter une dépense → elle apparaît dans la liste des dépenses', async ({ page }) => {
  await seedGroup(page, 'g-test', 'Trip', [
    { id: 'alice',   name: 'Alice',   email: 'alice@test.com' },
    { id: 'bob',     name: 'Bob',     email: 'bob@test.com' },
    { id: 'charlie', name: 'Charlie', email: 'charlie@test.com' },
  ]);

  const listPage   = new GroupListPage(page);
  const detailPage = new GroupDetailPage(page);

  await listPage.goto();
  await listPage.openGroupByName('Trip');

  await detailPage.addExpense('Resto du midi', 60, 'Alice');

  const descs = await detailPage.getExpenseDescriptions();
  expect(descs).toContain('Resto du midi');
});

test('3. dépense 30 € payée par Alice pour 3 → soldes Alice +20, Bob -10, Charlie -10', async ({ page }) => {
  await seedGroup(page, 'g-bal', 'Balances', [
    { id: 'alice',   name: 'Alice',   email: 'alice@test.com' },
    { id: 'bob',     name: 'Bob',     email: 'bob@test.com' },
    { id: 'charlie', name: 'Charlie', email: 'charlie@test.com' },
  ]);

  const listPage   = new GroupListPage(page);
  const detailPage = new GroupDetailPage(page);

  await listPage.goto();
  await listPage.openGroupByName('Balances');

  await detailPage.addExpense('Dîner', 30, 'Alice');

  const aliceBalance   = await detailPage.getBalance('alice');
  const bobBalance     = await detailPage.getBalance('bob');
  const charlieBalance = await detailPage.getBalance('charlie');

  // Vérification du signe et de la valeur affichée (format "20.00 EUR")
  expect(aliceBalance).toContain('20.00');    // créditrice
  expect(bobBalance).toContain('-10.00');     // débiteur
  expect(charlieBalance).toContain('-10.00'); // débiteur
});

test('4. cliquer sur "Régler" → le règlement disparaît de la liste', async ({ page }) => {
  await seedGroup(page, 'g-settle', 'Settle', [
    { id: 'alice', name: 'Alice', email: 'alice@test.com' },
    { id: 'bob',   name: 'Bob',   email: 'bob@test.com' },
  ]);

  const listPage   = new GroupListPage(page);
  const detailPage = new GroupDetailPage(page);

  await listPage.goto();
  await listPage.openGroupByName('Settle');

  // Créer une dépense pour générer un settlement (alice paie pour les deux)
  await detailPage.addExpense('Taxi', 20, 'Alice');

  // Il doit y avoir au moins un settlement
  const countBefore = await detailPage.getSettlementCount();
  expect(countBefore).toBeGreaterThan(0);

  // Cliquer sur "Régler" du premier settlement
  await detailPage.settleRow(0);

  // La ligne doit avoir disparu (l'UI la retire côté client)
  const isGone = await detailPage.isSettlementRowGone(0);
  expect(isGone).toBe(true);

  // Le message de succès doit être affiché
  await expect(page.getByRole('alert')).toContainText('Règlement marqué comme effectué');
});