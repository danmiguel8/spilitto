// src/domain/expense.service.ts — service métier de gestion des dépenses
//
// Code FOURNI (déjà implémenté). À tester dans l'exercice 3.

import type { Expense, CreateExpenseInput } from './types';
import type { ExpenseRepository } from '../ports/expense.repository';
import type { EmailNotifier } from '../ports/notifier';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { Logger } from '../ports/logger';

const NOTIFICATION_THRESHOLD = 100;

export class ExpenseService {
  constructor(
    private readonly repo: ExpenseRepository,
    private readonly notifier: EmailNotifier,
    private readonly clock: Clock,
    private readonly idGen: IdGenerator,
    private readonly logger: Logger,
  ) {}

  async create(input: CreateExpenseInput): Promise<Expense> {
    const expense: Expense = {
      ...input,
      id: this.idGen.next(),
      createdAt: this.clock.now(),
    };

    await this.repo.save(expense);
    this.logger.info(`Expense ${expense.id} created`);

    if (expense.amount >= NOTIFICATION_THRESHOLD) {
      await this.notifier.notifyGroupMembers(
        expense.groupId,
        `Nouvelle dépense importante : ${expense.description} (${expense.amount}€)`,
      );
    }

    return expense;
  }
}
