const { Pool } = require("pg");

// DATABASE_URL doit être défini en variable d'environnement.
// En production (Vercel), utiliser la chaîne de connexion "pooled" fournie par Neon.
// En local, on retombe sur une base Postgres locale de développement.
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/schoolmanager";

const pool = new Pool({
  connectionString,
  // Neon exige SSL en production ; en local (développement), pas de SSL.
  ssl: connectionString.includes("neon.tech") || process.env.PGSSL === "require"
    ? { rejectUnauthorized: false }
    : false,
  max: 5, // les fonctions serverless doivent garder peu de connexions ouvertes
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
