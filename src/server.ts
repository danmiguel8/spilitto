// src/server.ts — serveur Express + Postgres
//
// FOURNI (déjà implémenté) — sert pour les exos 5 (Pact provider) et 6 (E2E).

import express from 'express';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeBalances } from './domain/balances';
import { simplifyDebts } from './domain/simplify';
import { PgExpenseRepository } from './infrastructure/pg-expense.repository';
import type { Group, Member } from './domain/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(pool: Pool) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, '..', 'frontend')));

  const repo = new PgExpenseRepository(pool);

  // ─── Health ────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // ─── Groups ────────────────────────────────────────────────
  app.post('/api/groups', async (req, res) => {
    const { id, name, currency, members } = req.body;
    if (!id || !name || !currency || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    try {
      await pool.query(
        'INSERT INTO groups (id, name, currency) VALUES ($1, $2, $3)',
        [id, name, currency],
      );
      for (const m of members) {
        await pool.query(
          'INSERT INTO members (id, group_id, name, email) VALUES ($1, $2, $3, $4)',
          [m.id, id, m.name, m.email],
        );
      }
      res.status(201).json({ id, name, currency, members });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/groups', async (_req, res) => {
    const { rows } = await pool.query('SELECT id, name, currency FROM groups ORDER BY created_at DESC');
    res.json(rows);
  });

  app.get('/api/groups/:id', async (req, res) => {
    const groupResult = await pool.query(
      'SELECT id, name, currency FROM groups WHERE id = $1',
      [req.params.id],
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = groupResult.rows[0];
    const membersResult = await pool.query(
      'SELECT id, name, email FROM members WHERE group_id = $1',
      [req.params.id],
    );
    res.json({ ...group, members: membersResult.rows });
  });

  // ─── Expenses ──────────────────────────────────────────────
  app.post('/api/groups/:groupId/expenses', async (req, res) => {
    const { id, description, amount, currency, paidBy, paidAt, split, category } = req.body;
    try {
      await pool.query(
        `INSERT INTO expenses (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, req.params.groupId, description, amount, currency, paidBy, paidAt, split.mode, split, category],
      );
      res.status(201).json({ id, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/groups/:groupId/expenses', async (req, res) => {
    const expenses = await repo.findByGroupId(req.params.groupId);
    res.json(expenses);
  });

  // ─── Balances ──────────────────────────────────────────────
  app.get('/api/groups/:id/balances', async (req, res) => {
    const groupResult = await pool.query(
      'SELECT id, name, currency FROM groups WHERE id = $1',
      [req.params.id],
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const groupRow = groupResult.rows[0];
    const membersResult = await pool.query(
      'SELECT id, name, email FROM members WHERE group_id = $1',
      [req.params.id],
    );
    const group: Group = { ...groupRow, members: membersResult.rows };

    const expenses = await repo.findByGroupId(req.params.id);
    const balances = computeBalances(group, expenses);
    const settlements = simplifyDebts(balances);

    res.json({ groupId: req.params.id, balances, settlements });
  });

  // ─── Test reset (pour E2E uniquement) ──────────────────────
  app.post('/_test/reset', async (_req, res) => {
    await pool.query('TRUNCATE groups CASCADE');
    res.json({ ok: true });
  });

  return app;
}
