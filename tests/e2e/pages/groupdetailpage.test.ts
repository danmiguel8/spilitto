import type { Page } from '@playwright/test';

export class GroupDetailPage {
  constructor(private readonly page: Page) {}

  /** Ouvre le dialog d'ajout de dépense. */
  async openNewExpenseDialog() {
    await this.page.getByRole('button', { name: 'Ajouter une dépense' }).click();
  }

  /**
   * Remplit et soumet le formulaire de nouvelle dépense.
   * Les bénéficiaires sont tous cochés par défaut dans l'UI — on ne les désélectionne pas.
   */
  async addExpense(description: string, amount: number, paidByName: string) {
    await this.openNewExpenseDialog();

    await this.page.getByLabel('Description').fill(description);
    await this.page.getByLabel('Montant').fill(String(amount));
    await this.page.getByLabel('Payé par').selectOption({ label: paidByName });

    await this.page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  }

  /** Retourne les descriptions des dépenses dans le tableau. */
  async getExpenseDescriptions(): Promise<string[]> {
    const table = this.page.getByRole('table', { name: 'Liste des dépenses' });
    const rows  = table.getByRole('row');
    const count = await rows.count();
    const descs: string[] = [];
    for (let i = 1; i < count; i++) {   // i=0 est le header
      const cells = rows.nth(i).getByRole('cell');
      descs.push((await cells.nth(0).textContent()) ?? '');
    }
    return descs.map((t) => t.trim());
  }

  /**
   * Retourne le solde affiché pour un membre donné (via data-testid="balance-{memberId}").
   * @param memberId  l'id du membre (ex: 'alice')
   */
  async getBalance(memberId: string): Promise<string> {
    const cell = this.page.getByTestId(`balance-${memberId}`);
    return (await cell.textContent()) ?? '';
  }

  /** Retourne le nombre de lignes dans le tableau des règlements. */
  async getSettlementCount(): Promise<number> {
    const table = this.page.getByRole('table', { name: 'Règlements' });
    // Si le tableau n'existe pas (aucun règlement), on retourne 0
    if (!(await table.isVisible().catch(() => false))) return 0;
    const rows = table.getByRole('row');
    return Math.max(0, (await rows.count()) - 1); // -1 pour le header
  }

  /**
   * Clique sur le bouton "Régler" du premier règlement dans la liste.
   * @param index  index du settlement (0-based, correspond à data-testid="settlement-row-{index}")
   */
  async settleRow(index = 0) {
    const row = this.page.getByTestId(`settlement-row-${index}`);
    await row.getByRole('button', { name: 'Régler' }).click();
  }

  /** Vérifie qu'un settlement-row avec cet index n'existe plus. */
  async isSettlementRowGone(index: number): Promise<boolean> {
    const row = this.page.getByTestId(`settlement-row-${index}`);
    return !(await row.isVisible().catch(() => false));
  }
}