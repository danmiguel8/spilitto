// tests/contract/balances.provider.pact.test.ts
//
// EXERCICE 5 — Contract testing Pact (côté PROVIDER)
//
// On démarre le vrai serveur Express avec une vraie DB Testcontainers,
// puis on laisse Pact rejouer les interactions du consumer et vérifier
// que le provider respecte le contrat généré côté consumer.

import { beforeAll, afterAll, describe, it } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../../src/server';
import type { Server } from 'node:http';

// ─── Infrastructure ───────────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let pool: Pool;
let server: Server;
const PROVIDER_PORT = 4002;

beforeAll(async () => {
  // 1. Démarrage Postgres via Testcontainers
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('splitto_pact')
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

  // 2. Migrations
  const migration = readFileSync(
    join(__dirname, '../../migrations/001-initial.sql'),
    'utf-8',
  );
  await pool.query(migration);

  // 3. Démarrage du vrai serveur Express
  const app = createApp(pool);
  await new Promise<void>((resolve) => {
    server = app.listen(PROVIDER_PORT, resolve);
  });
}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  await pool.end();
  await container.stop();
});

// ─── State handlers : préparent la DB avant chaque interaction ────────────────

async function truncateAll() {
  await pool.query('TRUNCATE groups CASCADE');
}

async function seedGroupWith3MembersAnd2Expenses() {
  await truncateAll();

  // Groupe
  await pool.query(
    `INSERT INTO groups (id, name, currency) VALUES ('group-1', 'Vacances', 'EUR')`,
  );

  // 3 membres
  await pool.query(`
    INSERT INTO members (id, group_id, name, email) VALUES
      ('alice',   'group-1', 'Alice',   'alice@test.com'),
      ('bob',     'group-1', 'Bob',     'bob@test.com'),
      ('charlie', 'group-1', 'Charlie', 'charlie@test.com')
  `);

  // 2 dépenses :
  //   Dépense 1 : Alice paie 30 € pour tout le monde (equal)
  //     → alice +20, bob -10, charlie -10
  //   Dépense 2 : Bob paie 0 € (dépense neutre, pour avoir 2 dépenses)
  const split1 = JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] });
  await pool.query(`
    INSERT INTO expenses
      (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
    VALUES
      ('exp-1', 'group-1', 'Restaurant', 30.00, 'EUR', 'alice',
       '2024-06-01T12:00:00Z', 'equal', $1::jsonb)
  `, [split1]);

  const split2 = JSON.stringify({ mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] });
  await pool.query(`
    INSERT INTO expenses
      (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
    VALUES
      ('exp-2', 'group-1', 'Courses', 15.00, 'EUR', 'bob',
       '2024-06-02T12:00:00Z', 'equal', $1::jsonb)
  `, [split2]);
}

// ─── Vérification du contrat ──────────────────────────────────────────────────

describe('Pact provider verification — splitto-api', () => {
  it('vérifie le contrat généré par le consumer', async () => {
    const verifier = new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: `http://localhost:${PROVIDER_PORT}`,

      // Fichier de contrat généré par le consumer
      pactUrls: [
        join(__dirname, '../../pacts/splitto-frontend-splitto-api.json'),
      ],

      // State handlers : appelés par Pact avant chaque interaction selon le "given"
      stateHandlers: {
        'group-1 a 3 membres et 2 dépenses': async () => {
          await seedGroupWith3MembersAnd2Expenses();
        },
        'aucun groupe inexistant': async () => {
          await truncateAll();
        },
      },

      logLevel: 'error',
    });

    await verifier.verifyProvider();
  }, 60_000);
});