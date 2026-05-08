// tests/contract/balances.consumer.pact.test.ts
//
// EXERCICE 5 — Contract testing Pact (côté CONSUMER)
//
// On simule le comportement du frontend qui appelle GET /api/groups/:id/balances.
// Le mock Pact joue le rôle du serveur Express et génère le fichier de contrat
// dans pacts/ que le provider devra vérifier.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { join } from 'node:path';

const { like, decimal, string, integer } = MatchersV3;

// ─── Configuration du mock provider Pact ─────────────────────────────────────
const provider = new PactV3({
  consumer: 'splitto-frontend',
  provider: 'splitto-api',
  dir: join(__dirname, '../../pacts'),
  port: 4001,
  logLevel: 'error',
});

// ─── Client HTTP minimal (simule ce que le frontend ferait) ──────────────────
async function fetchBalances(groupId: string) {
  const res = await fetch(`http://localhost:4001/api/groups/${groupId}/balances`);
  return { status: res.status, body: res.ok ? await res.json() : null };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION 1 — groupe avec des dépenses → 200 + balances + settlements
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/groups/:id/balances', () => {

  it('retourne 200 avec balances et settlements quand le groupe a des dépenses', () => {
    return provider
      .given('group-1 a 3 membres et 2 dépenses')
      .uponReceiving('une requête de balances pour un groupe existant')
      .withRequest({
        method: 'GET',
        path: '/api/groups/group-1/balances',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          // groupId est une string dynamique → like()
          groupId: like('group-1'),
          // balances est un objet dont chaque valeur est un nombre flottant
          // On vérifie la forme avec like() sur un exemple réaliste
          balances: like({
            alice:   like(20.00),
            bob:     like(-10.00),
            charlie: like(-10.00),
          }),
          // settlements est un tableau d'objets ; on vérifie la forme du premier élément
          settlements: MatchersV3.eachLike({
            from:   string('bob'),
            to:     string('alice'),
            amount: decimal(10.00),
          }),
        },
      })
      .executeTest(async () => {
        const { status, body } = await fetchBalances('group-1');

        expect(status).toBe(200);
        expect(body).toHaveProperty('groupId');
        expect(body).toHaveProperty('balances');
        expect(body).toHaveProperty('settlements');
        expect(typeof body.balances).toBe('object');
        expect(Array.isArray(body.settlements)).toBe(true);
      });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // INTERACTION 2 — groupe inexistant → 404
  // ─────────────────────────────────────────────────────────────────────────
  it('retourne 404 quand le groupe n\'existe pas', () => {
    return provider
      .given('aucun groupe inexistant')
      .uponReceiving('une requête de balances pour un groupe qui n\'existe pas')
      .withRequest({
        method: 'GET',
        path: '/api/groups/inexistant/balances',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          error: like('Group not found'),
        },
      })
      .executeTest(async () => {
        const { status } = await fetchBalances('inexistant');
        expect(status).toBe(404);
      });
  });

});