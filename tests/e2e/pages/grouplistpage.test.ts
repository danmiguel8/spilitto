import type { Page } from '@playwright/test';

export class GroupListPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/');
  }

  /** Clique sur "Nouveau groupe" pour ouvrir la dialog. */
  async openNewGroupDialog() {
    await this.page.getByRole('button', { name: 'Nouveau groupe' }).click();
  }

  /**
   * Remplit et soumet le formulaire de création de groupe.
   * @param name   Nom du groupe
   * @param currency  Devise (ex: 'EUR')
   * @param members   Tableau de strings "Nom <email>"
   */
  async createGroup(name: string, currency: string, members: string[]) {
    await this.openNewGroupDialog();

    await this.page.getByLabel('Nom du groupe').fill(name);

    await this.page.getByLabel('Devise').selectOption(currency);

    await this.page.getByLabel(/Membres/).fill(members.join('\n'));

    await this.page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click();
  }

  /** Retourne les noms des groupes affichés dans la liste. */
  async getGroupNames(): Promise<string[]> {
    const cards = this.page.getByRole('listitem');
    const count = await cards.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push((await cards.nth(i).textContent()) ?? '');
    }
    return names.map((t) => t.trim());
  }

  /** Clique sur un groupe par son nom pour accéder à sa page. */
  async openGroupByName(name: string) {
    await this.page.getByRole('listitem').filter({ hasText: name }).click();
  }
}