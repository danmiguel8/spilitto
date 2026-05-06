// src/infrastructure/pg-expense.repository.ts
//
// EXERCICE 4 — À COMPLÉTER
//
// Implémentation Postgres du ExpenseRepository.
// À tester avec Testcontainers (voir SUJET.md exercice 4).

import type { Pool } from 'pg';
import type { Expense } from '../domain/types';
import type { ExpenseRepository } from '../ports/expense.repository';

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly pool: Pool) {}

  async save(expense: Expense): Promise<void> {
    throw new Error('Not implemented — voir SUJET.md exercice 4');
  }

  async findById(id: string): Promise<Expense | null> {
    throw new Error('Not implemented — voir SUJET.md exercice 4');
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    throw new Error('Not implemented — voir SUJET.md exercice 4');
  }

  async findInDateRange(
    groupId: string,
    from: Date,
    to: Date,
  ): Promise<Expense[]> {
    throw new Error('Not implemented — voir SUJET.md exercice 4');
  }
}
