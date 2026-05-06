// src/domain/simplify.ts — simplification des dettes
//
// EXERCICE 2 — À COMPLÉTER EN TDD STRICT
//
// Spec : voir SUJET.md, exercice 2
//
// Le but : transformer un dictionnaire de soldes en LISTE MINIMALE
// de règlements pour solder le groupe.

import type { Balances, Settlement } from './types';
 
/** Arrondit à 2 décimales pour éviter les erreurs flottantes. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
 
export function simplifyDebts(balances: Balances): Settlement[] {
  const settlements: Settlement[] = [];
 
  // Copie mutable des soldes (on ne modifie pas l'entrée)
  const bal = new Map<string, number>(
    Object.entries(balances).map(([id, b]) => [id, round2(b)]),
  );
 
  // Itérer tant qu'il reste des dettes non nulles
  while (true) {
    // Trouver le plus grand créditeur et le plus grand débiteur
    let maxCreditorId: string | null = null;
    let maxCreditorAmount = 0;
    let maxDebtorId: string | null = null;
    let maxDebtorAmount = 0; // stocké positif pour faciliter les comparaisons
 
    for (const [id, amount] of bal) {
      if (amount > maxCreditorAmount) {
        maxCreditorAmount = amount;
        maxCreditorId = id;
      }
      if (-amount > maxDebtorAmount) {
        maxDebtorAmount = -amount;
        maxDebtorId = id;
      }
    }
 
    // Si aucun créditeur ou débiteur significatif → terminé
    if (maxCreditorId === null || maxDebtorId === null) break;
    if (maxCreditorAmount < 0.01 || maxDebtorAmount < 0.01) break;
 
    // Le montant du settlement = min(dette, crédit)
    const transferAmount = round2(Math.min(maxCreditorAmount, maxDebtorAmount));
 
    settlements.push({
      from: maxDebtorId,
      to: maxCreditorId,
      amount: transferAmount,
    });
 
    // Mise à jour des soldes
    bal.set(maxCreditorId, round2(maxCreditorAmount - transferAmount));
    bal.set(maxDebtorId, round2(-maxDebtorAmount + transferAmount));
  }
 
  return settlements;
}
