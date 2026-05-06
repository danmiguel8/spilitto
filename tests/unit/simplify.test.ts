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
    // a=+10, b=0, c=-10  ⟹  c → a : 10
    const balances: Balances = { a: 10, b: 0, c: -10 };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'c', to: 'a', amount: 10 });
  });

  it('3 créances croisées réduites au minimum', () => {
    // a=+20, b=-5, c=-15 → a reçoit de b(5) et c(15) : 2 settlements
    const balances: Balances = { a: 20, b: -5, c: -15 };
    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    expectAllZero(applySettlements(balances, result));
  });
});

