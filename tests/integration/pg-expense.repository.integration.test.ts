// tests/unit/pg-expense.repository.test.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: PgExpenseRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('splitto-postgress')
    .withUsername('test')
    .withPassword('test')
    .start();

  pool = new Pool({
    host:     container.getHost(),
    port:     container.getMappedPort(5432),
    database: container.getDatabase(),
    user:     container.getUsername(),
    password: container.getPassword(),
  });

  const migration = readFileSync(
    join(__dirname, '../../migrations/001-initial.sql'),
    'utf-8',
  );
  await pool.query(migration);

  repo = new PgExpenseRepository(pool);
}, 60_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

async function insertGroup(id: string, name = 'Test Group') {
  await pool.query(
    `INSERT INTO groups (id, name, currency) VALUES ($1, $2, 'EUR')
     ON CONFLICT (id) DO NOTHING`,
    [id, name],
  );
}

async function insertMember(id: string, groupId: string, name = 'Member') {
  await pool.query(
    `INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, groupId, name, `${id}@test.com`],
  );
}

beforeEach(async () => {
  // Ordre important : expenses référencent members qui référencent groups
  await pool.query('TRUNCATE expenses CASCADE');
  await pool.query('TRUNCATE members  CASCADE');
  await pool.query('TRUNCATE groups   CASCADE');

  // Groupes et membres utilisés par défaut dans makeExpense()
  await insertGroup('group-1');
  await insertGroup('group-A');
  await insertGroup('group-B');
  await insertMember('alice', 'group-1');
  await insertMember('bob',   'group-1');
  await insertMember('alice', 'group-A');
  await insertMember('bob',   'group-A');
  await insertMember('alice', 'group-B');
  await insertMember('bob',   'group-B');
});

let counter = 0;
function makeExpense(overrides: Partial<Expense> = {}): Expense {
  counter++;
  return {
    id:          `exp-${counter}`,
    groupId:     'group-1',
    description: `Dépense ${counter}`,
    amount:      42.50,
    currency:    'EUR',
    paidBy:      'alice',
    paidAt:      new Date('2024-03-15T10:00:00Z'),
    split:       { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    createdAt:   new Date('2024-03-15T10:01:00Z'),
    ...overrides,
  };
}

describe('save() + findById()', () => {
  it("retourne l'expense avec les mêmes valeurs que celles sauvegardées", async () => {
    const expense = makeExpense({ amount: 99.99, description: 'Ciné' });
    await repo.save(expense);

    const found = await repo.findById(expense.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(expense.id);
    expect(found!.groupId).toBe(expense.groupId);
    expect(found!.description).toBe(expense.description);
    expect(found!.amount).toBeCloseTo(99.99, 2);
    expect(found!.currency).toBe('EUR');
    expect(found!.paidBy).toBe('alice');
    expect(found!.paidAt.toISOString()).toBe(expense.paidAt.toISOString());
    expect(found!.split).toEqual(expense.split);
    expect(found!.createdAt.toISOString()).toBe(expense.createdAt.toISOString());
  });

  it('retourne null pour un id inexistant', async () => {
    const result = await repo.findById('inexistant');
    expect(result).toBeNull();
  });

  it('gère correctement le split weighted (JSONB round-trip)', async () => {
    const expense = makeExpense({
      split: { mode: 'weighted', weights: { alice: 2, bob: 1 } },
    });
    await repo.save(expense);

    const found = await repo.findById(expense.id);
    expect(found!.split).toEqual({ mode: 'weighted', weights: { alice: 2, bob: 1 } });
  });
});

describe('findByGroupId()', () => {
  it('retourne uniquement les expenses du groupe demandé', async () => {
    // paidAt distincts pour éviter la contrainte UNIQUE (group_id, paid_at, amount, paid_by)
    const e1 = makeExpense({ groupId: 'group-A', paidAt: new Date('2024-04-01T10:00:00Z') });
    const e2 = makeExpense({ groupId: 'group-A', paidAt: new Date('2024-04-02T10:00:00Z') });
    const e3 = makeExpense({ groupId: 'group-B', paidAt: new Date('2024-04-03T10:00:00Z') });

    await repo.save(e1);
    await repo.save(e2);
    await repo.save(e3);

    const results = await repo.findByGroupId('group-A');

    expect(results).toHaveLength(2);
    const ids = results.map((e) => e.id);
    expect(ids).toContain(e1.id);
    expect(ids).toContain(e2.id);
    expect(ids).not.toContain(e3.id);
  });

  it("retourne un tableau vide si le groupe n'a aucune dépense", async () => {
    const results = await repo.findByGroupId('groupe-fantome');
    expect(results).toEqual([]);
  });
});

describe('findInDateRange()', () => {
  it('filtre correctement les dates, bornes incluses', async () => {
    const jan = makeExpense({ paidAt: new Date('2024-01-15T00:00:00Z') });
    const feb = makeExpense({ paidAt: new Date('2024-02-15T00:00:00Z') });
    const mar = makeExpense({ paidAt: new Date('2024-03-15T00:00:00Z') });

    await repo.save(jan);
    await repo.save(feb);
    await repo.save(mar);

    const from = new Date('2024-01-15T00:00:00Z');
    const to   = new Date('2024-02-15T00:00:00Z');

    const results = await repo.findInDateRange('group-1', from, to);

    expect(results).toHaveLength(2);
    const ids = results.map((e) => e.id);
    expect(ids).toContain(jan.id);
    expect(ids).toContain(feb.id);
    expect(ids).not.toContain(mar.id);
  });

  it('retourne vide si aucune expense dans la plage', async () => {
    await repo.save(makeExpense({ paidAt: new Date('2024-06-01T00:00:00Z') }));

    const results = await repo.findInDateRange(
      'group-1',
      new Date('2024-01-01'),
      new Date('2024-03-31'),
    );
    expect(results).toEqual([]);
  });
});

describe('contrainte UNIQUE', () => {
  it('rejette une expense dupliquée (même group_id + paid_at + amount + paid_by)', async () => {
    const base = makeExpense({
      groupId: 'group-1',
      paidBy:  'alice',
      amount:  50,
      paidAt:  new Date('2024-05-01T12:00:00Z'),
    });

    await repo.save(base);

    const duplicate: Expense = {
      ...base,
      id:          'other-id',
      description: 'Doublon',
    };

    await expect(repo.save(duplicate)).rejects.toThrow();
  });
});

describe('transaction et rollback', () => {
  it("une transaction qui échoue à mi-parcours ne sauvegarde aucune ligne", async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const e1 = makeExpense({ id: 'tx-ok' });
      await client.query(
        `INSERT INTO expenses
           (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
        [
          e1.id, e1.groupId, e1.description, e1.amount, e1.currency,
          e1.paidBy, e1.paidAt, e1.split.mode, JSON.stringify(e1.split), e1.createdAt,
        ],
      );

      await expect(
        client.query('INSERT INTO expenses (id) VALUES (NULL)'),
      ).rejects.toThrow();

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Après rollback, aucune ligne ne doit exister
    const result = await repo.findById('tx-ok');
    expect(result).toBeNull();
  });
});