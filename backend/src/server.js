// Arranque local: node src/server.js (lee .env.supabase.local si existe).
require('../scripts/env');
const app = require('./app');
const PORT = Number(process.env.PORT || 3010);
app.listen(PORT, () => console.log(`sintegra-backend en http://localhost:${PORT}`));
