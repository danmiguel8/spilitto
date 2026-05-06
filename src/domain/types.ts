// src/domain/types.ts — types métier du domaine Splitto

export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

export type Member = {
  id: string;
  name: string;
  email: string;
};

export type Group = {
  id: string;
  name: string;
  currency: Currency;
  members: Member[];
};

/** Mode de répartition d'une dépense entre les bénéficiaires. */
export type SplitMode = 'equal' | 'weighted' | 'percentage';

export type ExpenseSplit =
  | { mode: 'equal'; beneficiaries: string[] }
  | { mode: 'weighted'; weights: Record<string, number> }
  | { mode: 'percentage'; percentages: Record<string, number> };

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amount: number;          // dans la devise de la dépense
  currency: Currency;      // devise de la dépense
  paidBy: string;          // memberId
  paidAt: Date;            // date du paiement (≠ createdAt)
  split: ExpenseSplit;
  createdAt: Date;
  category?: string;
};

export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

/** Solde par membre. Positif = créditeur, négatif = débiteur. */
export type Balances = Record<string, number>;

/** Règlement entre deux membres pour solder une partie d'une dette. */
export type Settlement = {
  from: string;            // memberId du débiteur
  to: string;              // memberId du créditeur
  amount: number;          // toujours positif, en devise du groupe
};
