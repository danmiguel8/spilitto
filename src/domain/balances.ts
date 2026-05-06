// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — À COMPLÉTER
//
// Spec : voir SUJET.md, exercice 1
//
// Cette fonction est PURE : pas d'effets de bord, pas d'I/O.
// Elle prend un groupe et ses dépenses, retourne les soldes.

import type { Group, Expense, Balances } from './types';

/**
 * Arrondit un montant à 2 décimales (centimes).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcule la quote-part de chaque bénéficiaire pour une dépense donnée.
 *
 * Stratégie d'arrondi : les n-1 premières parts sont arrondies à 2 décimales,
 * la dernière absorbe le reste (montant − Σ parts précédentes).
 * Cela garantit que Σ parts = montant exact, sans accumulation d'erreur flottante.
 */
function computeShares(amount: number, split: Expense['split']): Record<string, number> {
  const shares: Record<string, number> = {};

  if (split.mode === 'equal') {
    const { beneficiaries } = split;
    const n = beneficiaries.length;
    if (n === 0) return {};

    const baseShare = round2(amount / n);
    let distributed = 0;
    for (let i = 0; i < n - 1; i++) {
      shares[beneficiaries[i]] = baseShare;
      distributed = round2(distributed + baseShare);
    }
    // La dernière part corrige l'éventuel écart d'arrondi
    shares[beneficiaries[n - 1]] = round2(amount - distributed);

  } else if (split.mode === 'weighted') {
    const { weights } = split;
    const beneficiaries = Object.keys(weights);
    const n = beneficiaries.length;
    if (n === 0) return {};

    const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
    let distributed = 0;
    for (let i = 0; i < n - 1; i++) {
      const id = beneficiaries[i];
      const share = round2((amount * weights[id]) / totalWeight);
      shares[id] = share;
      distributed = round2(distributed + share);
    }
    shares[beneficiaries[n - 1]] = round2(amount - distributed);

  } else if (split.mode === 'percentage') {
    const { percentages } = split;
    const beneficiaries = Object.keys(percentages);
    const n = beneficiaries.length;
    if (n === 0) return {};

    let distributed = 0;
    for (let i = 0; i < n - 1; i++) {
      const id = beneficiaries[i];
      const share = round2((amount * percentages[id]) / 100);
      shares[id] = share;
      distributed = round2(distributed + share);
    }
    shares[beneficiaries[n - 1]] = round2(amount - distributed);
  }

  return shares;
}

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  // Initialiser tous les membres connus à 0
  const balances: Balances = {};
  for (const member of group.members) {
    balances[member.id] = 0;
  }

  for (const expense of expenses) {
    const { paidBy, amount, split } = expense;

    // Le payeur est crédité du montant total de la dépense
    if (!(paidBy in balances)) {
      balances[paidBy] = 0; // membre supprimé encore présent dans une ancienne dépense
    }
    balances[paidBy] = round2(balances[paidBy] + amount);

    // Calcul des quotes-parts selon le mode de partage
    const shares = computeShares(amount, split);

    // Chaque bénéficiaire est débité de sa quote-part
    for (const [beneficiaryId, share] of Object.entries(shares)) {
      if (!(beneficiaryId in balances)) {
        balances[beneficiaryId] = 0; // membre supprimé
      }
      balances[beneficiaryId] = round2(balances[beneficiaryId] - share);
    }
  }

  return balances;
}