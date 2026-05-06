// src/ports/expense.repository.ts

import type { Expense } from '../domain/types';

export interface ExpenseRepository {
  save(expense: Expense): Promise<void>;
  findById(id: string): Promise<Expense | null>;
  findByGroupId(groupId: string): Promise<Expense[]>;
  findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]>;
}
