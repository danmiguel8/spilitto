// src/main.ts — point d'entrée du serveur Splitto

import { Pool } from 'pg';
import { createApp } from './server';

const PORT = Number(process.env.PORT ?? 3000);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://splitto:splitto@localhost:5432/splitto';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  // Vérifier la connexion DB
  await pool.query('SELECT 1');

  const app = createApp(pool);

  app.listen(PORT, () => {
    console.log(`🚀 Splitto démarré sur http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
