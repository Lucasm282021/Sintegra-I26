const { createApp } = require('./app');

const PORT = process.env.PORT || 3003;

createApp().listen(PORT, () => {
  console.log(`ARBA escuchando en http://localhost:${PORT}`);
});
