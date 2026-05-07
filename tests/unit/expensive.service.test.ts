import { describe, it, expect, vi } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';
import type { CreateExpenseInput, Expense } from '../../src/domain/types';


const dummyLogger: Logger = {
  info: (_msg: string) => { /* jamais appelé dans ces tests */ },
  error: (_msg: string) => { /* jamais appelé dans ces tests */ },
};

const FIXED_DATE = new Date('2024-06-01T12:00:00Z');
const FIXED_ID   = 'expense-uuid-42';

const stubClock: Clock = {
  now: () => FIXED_DATE,
};

const stubIdGen: IdGenerator = {
  next: () => FIXED_ID,
};

class FakeExpenseRepository implements ExpenseRepository {
  private readonly store = new Map<string, Expense>();

  async save(expense: Expense): Promise<void> {
    this.store.set(expense.id, expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.store.get(id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return [...this.store.values()].filter((e) => e.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return [...this.store.values()].filter(
      (e) => e.groupId === groupId && e.paidAt >= from && e.paidAt <= to,
    );
  }

  has(id: string): boolean {
    return this.store.has(id);
  }
}

function makeInput(overrides: Partial<CreateExpenseInput> = {}): CreateExpenseInput {
  return {
    groupId:  'group-1',
    description: 'Resto',
    amount:   50,
    currency: 'EUR',
    paidBy:   'alice',
    paidAt:   new Date('2024-06-01'),
    split:    { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
    ...overrides,
  };
}

describe('ExpenseService.create()', () => {

  // ── Test 1 : L'expense retourné a les bonnes valeurs ────────────────────
  it('retourne une expense avec id et createdAt injectés par les stubs', async () => {
    // ─── SPY ─────────────────────────────────────────────────────────────
    // Un spy enregistre les appels sans changer le comportement.
    // On l'utilise pour vérifier les effets de bord (logger.info appelé).
    // ─────────────────────────────────────────────────────────────────────
    const infoSpy = vi.fn<(msg: string) => void>();
    const spyLogger: Logger = { info: infoSpy, error: vi.fn() };

    const repo = new FakeExpenseRepository();

    // notifier non sollicité (amount < 100), un dummy suffit
    const dummyNotifier: EmailNotifier = {
      notifyGroupMembers: async () => {},
    };

    const service = new ExpenseService(repo, dummyNotifier, stubClock, stubIdGen, spyLogger);
    const input   = makeInput({ amount: 50 });

    const result = await service.create(input);

    // Valeurs issues du SUT
    expect(result.id).toBe(FIXED_ID);
    expect(result.createdAt).toEqual(FIXED_DATE);
    expect(result.amount).toBe(50);
    expect(result.groupId).toBe('group-1');
    expect(result.paidBy).toBe('alice');

    // Le spy confirme que le logger a bien été appelé une fois
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledWith(`Expense ${FIXED_ID} created`);
  });

  // ── Test 2 : Le repository contient l'expense après save ────────────────
  it('persiste l\'expense dans le repository (via le Fake)', async () => {
    const repo = new FakeExpenseRepository();

    const service = new ExpenseService(
      repo,
      { notifyGroupMembers: async () => {} },
      stubClock,
      stubIdGen,
      dummyLogger,
    );

    await service.create(makeInput({ amount: 50 }));

    // Le fake nous permet d'inspecter directement le store
    expect(repo.has(FIXED_ID)).toBe(true);
    const saved = await repo.findById(FIXED_ID);
    expect(saved?.amount).toBe(50);
    expect(saved?.createdAt).toEqual(FIXED_DATE);
  });

  // ── Test 3 : Notifier appelé si amount >= 100 ───────────────────────────
  it('notifie les membres du groupe quand amount >= 100 (MOCK)', async () => {
    // ─── MOCK ────────────────────────────────────────────────────────────
    // Un mock est un objet préconfiguré avec des ATTENTES comportementales.
    // Il vérifie lui-même (ou via vi.fn) que les appels ont eu lieu
    // avec les bons arguments et le bon nombre de fois.
    // ─────────────────────────────────────────────────────────────────────
    const notifyMock = vi.fn<(groupId: any, message: string) => Promise<void>>().mockResolvedValue(undefined);
    const mockNotifier: EmailNotifier = { notifyGroupMembers: notifyMock };

    const service = new ExpenseService(
      new FakeExpenseRepository(),
      mockNotifier,
      stubClock,
      stubIdGen,
      dummyLogger,
    );

    await service.create(makeInput({ amount: 150, description: 'Hôtel' }));

    // Le mock vérifie : appelé exactement une fois, avec les bons args
    expect(notifyMock).toHaveBeenCalledOnce();
    expect(notifyMock).toHaveBeenCalledWith(
      'group-1',
      'Nouvelle dépense importante : Hôtel (150€)',
    );
  });

  // ── Test 4 : Notifier NON appelé si amount < 100 ────────────────────────
  it('ne notifie PAS les membres si amount < 100', async () => {
    const notifyMock = vi.fn<(groupId: any, message: string) => Promise<void>>().mockResolvedValue(undefined);
    const mockNotifier: EmailNotifier = { notifyGroupMembers: notifyMock };

    const service = new ExpenseService(
      new FakeExpenseRepository(),
      mockNotifier,
      stubClock,
      stubIdGen,
      dummyLogger,
    );

    await service.create(makeInput({ amount: 99 }));

    expect(notifyMock).not.toHaveBeenCalled();
  });

  // ── Test 5 : Exactement au seuil (100 €) ────────────────────────────────
  it('notifie exactement au seuil de 100 €', async () => {
    const notifyMock = vi.fn<(groupId: any, message: any) => Promise<void>>().mockResolvedValue(undefined);

    const service = new ExpenseService(
      new FakeExpenseRepository(),
      { notifyGroupMembers: notifyMock },
      stubClock,
      stubIdGen,
      dummyLogger,
    );

    await service.create(makeInput({ amount: 100, description: 'Concert' }));

    expect(notifyMock).toHaveBeenCalledOnce();
    expect(notifyMock).toHaveBeenCalledWith(
      'group-1',
      'Nouvelle dépense importante : Concert (100€)',
    );
  });

});