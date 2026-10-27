// Usa better-sqlite3 si está compilado; si no (Node 24 o Vercel), usa el
// SQLite que trae Node (node:sqlite) con los dos métodos extra que usa db.js.
let Database;
try {
  const Better = require('better-sqlite3');
  new Better(':memory:').close();
  Database = Better;
} catch {
  const { DatabaseSync } = require('node:sqlite');
  Database = class extends DatabaseSync {
    pragma(sql) { this.exec(`PRAGMA ${sql}`); }
    transaction(fn) {
      return (...args) => {
        this.exec('BEGIN');
        try { const out = fn(...args); this.exec('COMMIT'); return out; }
        catch (err) { this.exec('ROLLBACK'); throw err; }
      };
    }
  };
}
module.exports = Database;
