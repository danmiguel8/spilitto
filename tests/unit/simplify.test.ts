// tests/unit/simplify.test.ts
import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';
import type { Balances, Settlement } from '../../src/domain/types';

// vérifie que les settlements soldent bien le groupe
function applySettlements(
  balances: Balances,
  settlements: Settlement[],
): Record<string, number> {
  const result = { ...balances };
  for (const { from, to, amount } of settlements) {
    result[from] = Math.round(((result[from] ?? 0) + amount) * 100) / 100;
    result[to]  = Math.round(((result[to]  ?? 0) - amount) * 100) / 100;
  }
  return result;
}

function expectAllZero(final: Record<string, number>) {
  for (const [id, b] of Object.entries(final)) {
    expect(Math.abs(b), `solde résiduel de ${id}`).toBeLessThanOrEqual(0.01);
  }
}

describe('simplifyDebts — 2 personnes', () => {
  it('b doit 10 € à a → 1 settlement', () => {
    const balances: Balances = { a: 10, b: -10 };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'b', to: 'a', amount: 10 });

    expectAllZero(applySettlements(balances, result));
  });
});

describe('simplifyDebts — soldes déjà à 0', () => {
  it('aucun mouvement nécessaire → aucun settlement', () => {
    const balances: Balances = { a: 0, b: 0, c: 0 };
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(0);
  });
});

describe('simplifyDebts — 3 personnes en triangle', () => {
  it('a créditeur, c débiteur, b neutre → 1 seul settlement', () => {
    const balances: Balances = { a: 10, b: 0, c: -10 };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'c', to: 'a', amount: 10 });
  });

  it('3 créances croisées réduites au minimum', () => {
    const balances: Balances = { a: 20, b: -5, c: -15 };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    expectAllZero(applySettlements(balances, result));
  });
});

describe('simplifyDebts — 4 personnes, dette circulaire complexe', () => {
  it('a=+30, b=-20, c=-10, d=0 → exactement 2 settlements', () => {
    const balances: Balances = { a: 30, b: -20, c: -10, d: 0 };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    expectAllZero(applySettlements(balances, result));

    const bToA = result.find((s) => s.from === 'b' && s.to === 'a');
    const cToA = result.find((s) => s.from === 'c' && s.to === 'a');
    expect(bToA?.amount).toBeCloseTo(20, 2);
    expect(cToA?.amount).toBeCloseTo(10, 2);
  });

  it('2 créditeurs, 2 débiteurs → nombre minimal de settlements', () => {
    const balances: Balances = { a: 50, b: 30, c: -40, d: -40 };
    const result = simplifyDebts(balances);

    expect(result.length).toBeLessThanOrEqual(3);
    expectAllZero(applySettlements(balances, result));
  });
});

describe('simplifyDebts — arrondis et centimes', () => {
  it('100 € ÷ 3 → settlements sans erreur flottante', () => {
    const balances: Balances = {
      alice:   66.67,  
      bob:    -33.33,
      charlie: -33.34,
    };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    expectAllZero(applySettlements(balances, result));
    for (const s of result) {
      expect(s.amount).toBeGreaterThanOrEqual(0.01);
    }
  });
});

describe('simplifyDebts — cas limites', () => {
  it('balances vides → aucun settlement', () => {
    expect(simplifyDebts({})).toHaveLength(0);
  });

  it('un seul membre avec solde 0 → aucun settlement', () => {
    expect(simplifyDebts({ alice: 0 })).toHaveLength(0);
  });

  it('chaque settlement a un montant strictement positif', () => {
    const balances: Balances = { a: 100, b: -60, c: -40 };
    const result = simplifyDebts(balances);
    for (const s of result) {
      expect(s.amount).toBeGreaterThan(0);
    }
  });

  it('les settlements soldent toujours exactement le groupe (propriété générale)', () => {
    const balances: Balances = { a: 150, b: -80, c: 30, d: -70, e: -30 };
    const result = simplifyDebts(balances);
    expectAllZero(applySettlements(balances, result));
  });

  it('groupe avec un seul créditeur et plusieurs débiteurs', () => {
    const balances: Balances = { a: 90, b: -30, c: -30, d: -30 };
    const result = simplifyDebts(balances);
    expect(result).toHaveLength(3);
    expectAllZero(applySettlements(balances, result));
  });
});