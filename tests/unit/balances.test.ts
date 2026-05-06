// tests/unit/balances.test.ts
// Framework : Vitest (compatible Jest)

import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Group, Expense, Member } from '../../src/domain/types';

function makeGroup(memberIds: string[]): Group {
  const members: Member[] = memberIds.map((id) => ({ id, name: id, email: `${id}@test.com` }));
  return { id: 'g1', name: 'Test Group', currency: 'EUR', members };
}

let expenseCounter = 0;
function makeExpense(overrides: Omit<Expense, 'id' | 'groupId' | 'description' | 'currency' | 'paidAt' | 'createdAt'>): Expense {
  return {
    id: `e${++expenseCounter}`,
    groupId: 'g1',
    description: 'Test expense',
    currency: 'EUR',
    paidAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/** Vérifie que la somme des balances est ≈ 0 (tolérance 1 centime). */
function expectSumToZero(balances: Record<string, number>) {
  const sum = Object.values(balances).reduce((s, b) => s + b, 0);
  expect(Math.abs(sum)).toBeLessThanOrEqual(0.01);
}

// ---------------------------------------------------------------------------
// CAS OBLIGATOIRES
// ---------------------------------------------------------------------------

describe('computeBalances — cas obligatoires', () => {

  it('1. aucune dépense → tous les soldes sont 0', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const balances = computeBalances(group, []);
    expect(balances).toEqual({ alice: 0, bob: 0, charlie: 0 });
  });

  it('2. equal — payeur inclus comme bénéficiaire', () => {
    // Alice paie 30 € partagés équitablement entre alice, bob, charlie
    // alice : +30 payé − 10 quote-part = +20
    // bob / charlie : −10 chacun
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 30,
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBeCloseTo(20, 2);
    expect(balances.bob).toBeCloseTo(-10, 2);
    expect(balances.charlie).toBeCloseTo(-10, 2);
    expectSumToZero(balances);
  });

  it('3. equal — payeur NON bénéficiaire', () => {
    // Alice paie 30 € pour bob et charlie uniquement
    // alice : +30 ; bob : −15 ; charlie : −15
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 30,
      split: { mode: 'equal', beneficiaries: ['bob', 'charlie'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBeCloseTo(30, 2);
    expect(balances.bob).toBeCloseTo(-15, 2);
    expect(balances.charlie).toBeCloseTo(-15, 2);
    expectSumToZero(balances);
  });

  it('4. plusieurs dépenses qui se compensent partiellement', () => {
    // Dép 1 : alice paie 100 € pour alice+bob → alice +50, bob −50
    // Dép 2 : bob paie  60 € pour alice+bob  → bob  +30, alice −30
    // Résultat : alice +20, bob −20
    const group = makeGroup(['alice', 'bob']);
    const expenses = [
      makeExpense({
        paidBy: 'alice',
        amount: 100,
        split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
      }),
      makeExpense({
        paidBy: 'bob',
        amount: 60,
        split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
      }),
    ];

    const balances = computeBalances(group, expenses);

    expect(balances.alice).toBeCloseTo(20, 2);
    expect(balances.bob).toBeCloseTo(-20, 2);
    expectSumToZero(balances);
  });

  it('5. weighted — poids non-uniformes (1:2:3)', () => {
    // Alice paie 120 €, poids alice=1 bob=2 charlie=3 (total=6)
    // alice doit 20, bob 40, charlie 60
    // alice : +120 − 20 = +100
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 120,
      split: { mode: 'weighted', weights: { alice: 1, bob: 2, charlie: 3 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBeCloseTo(100, 2);
    expect(balances.bob).toBeCloseTo(-40, 2);
    expect(balances.charlie).toBeCloseTo(-60, 2);
    expectSumToZero(balances);
  });

  it('6. percentage — 100 € entre 3 (arrondis 33.33 / 33.33 / 33.34)', () => {
    // alice paie 100 €, parts : 33.33 + 33.33 + 33.34 = 100.00 exactement
    // alice : +100 − 33.33 = +66.67 ; bob : −33.33 ; charlie : −33.34
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 100,
      split: {
        mode: 'percentage',
        percentages: { alice: 33.33, bob: 33.33, charlie: 33.34 },
      },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBeCloseTo(66.67, 2);
    expect(balances.bob).toBeCloseTo(-33.33, 2);
    expect(balances.charlie).toBeCloseTo(-33.34, 2);
    expectSumToZero(balances);
  });

});

// ---------------------------------------------------------------------------
// CAS LIMITES
// ---------------------------------------------------------------------------

describe('computeBalances — cas limites', () => {

  it('L1. membre supprimé encore présent dans une ancienne dépense', () => {
    // "dave" n'est plus dans le groupe mais figure dans la dépense
    // Il doit quand même apparaître dans les balances
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 30,
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'dave'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.dave).toBeCloseTo(-10, 2);
    expect(balances.alice).toBeCloseTo(20, 2);
    expect(balances.bob).toBeCloseTo(-10, 2);
    expectSumToZero(balances);
  });

  it('L2. dépense de 0 € — autorisée, ne modifie aucun solde', () => {
    // Choix de conception : une dépense à 0 € est valide (ex : mémo, annulation).
    // Elle ne doit modifier aucun solde.
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 0,
      split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBe(0);
    expect(balances.bob).toBe(0);
  });

  it('L3. payeur est le seul bénéficiaire → soldes tous à 0', () => {
    // alice paie 50 € pour elle-même uniquement → +50 − 50 = 0
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 50,
      split: { mode: 'equal', beneficiaries: ['alice'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBe(0);
    expect(balances.bob).toBe(0);
    expectSumToZero(balances);
  });

  it('L4. liste vide de dépenses → tous les soldes sont 0', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const balances = computeBalances(group, []);
    for (const id of ['alice', 'bob', 'charlie']) {
      expect(balances[id]).toBe(0);
    }
  });

  it('L5. 10 membres en equal — Σ balances ≈ 0, chaque non-payeur à −10', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `m${i}`);
    const group = makeGroup(ids);
    const expense = makeExpense({
      paidBy: 'm0',
      amount: 100,
      split: { mode: 'equal', beneficiaries: ids },
    });

    const balances = computeBalances(group, [expense]);

    // m0 paie 100, doit 10 → +90
    expect(balances.m0).toBeCloseTo(90, 2);
    for (let i = 1; i < 10; i++) {
      expect(balances[`m${i}`]).toBeCloseTo(-10, 2);
    }
    expectSumToZero(balances);
  });

  it('L6. pourcentages ne sommant pas à 100 — la dernière part absorbe l\'écart', () => {
    // 30 + 30 + 30 = 90 ≠ 100
    // Sur 90 €: alice 27, bob 27, charlie = 90 − 27 − 27 = 36
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      paidBy: 'alice',
      amount: 90,
      split: {
        mode: 'percentage',
        percentages: { alice: 30, bob: 30, charlie: 30 },
      },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances.alice).toBeCloseTo(63, 2);  // +90 − 27
    expect(balances.bob).toBeCloseTo(-27, 2);
    expect(balances.charlie).toBeCloseTo(-36, 2); // reste = 90 − 27 − 27
    expectSumToZero(balances);
  });

});