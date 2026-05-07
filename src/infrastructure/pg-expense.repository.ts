// src/infrastructure/pg-expense.repository.ts
//
// EXERCICE 4 — À COMPLÉTER
//
// Implémentation Postgres du ExpenseRepository.
// À tester avec Testcontainers (voir SUJET.md exercice 4).

import type { Pool } from 'pg';
import type { Expense } from '../domain/types';
import type { ExpenseRepository } from '../ports/expense.repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToExpense(row: any): Expense {
  return {
    id : row.id,
    groupId : row.group_id,
    description : row.description,
    amount : Number(row.amount),
    currency : row.currency,
    paidBy : row.paid_by,
    paidAt : new Date(row.paid_at),
    split : row.split_data,
    category : row.category ?? undefined,
    createdAt : new Date(row.created_at),
  };
}
export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly pool: Pool) {}

  async save(expense: Expense): Promise<void> {
    const sql = `
      INSERT INTO expenses
        (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    `;
    await this.pool.query(sql, [
      expense.id,
      expense.groupId,
      expense.description,
      expense.amount,
      expense.currency,
      expense.paidBy,
      expense.paidAt,
      expense.split.mode,         
      JSON.stringify(expense.split),
      expense.category ?? null,
      expense.createdAt,
    ]);
  }

  async findById(id: string): Promise<Expense | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM expenses WHERE id = $1',
      [id],
    );
    if (rows.length === 0) return null;
    return rowToExpense(rows[0]);
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM expenses WHERE group_id = $1 ORDER BY paid_at ASC',
      [groupId],
    );
    return rows.map(rowToExpense);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM expenses
       WHERE group_id = $1
         AND paid_at >= $2
         AND paid_at <= $3
       ORDER BY paid_at ASC`,
      [groupId, from, to],
    );
    return rows.map(rowToExpense);
  }
}