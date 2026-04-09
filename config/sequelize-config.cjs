'use strict';

// Load .env if present (local dev and production)
try { require('dotenv').config(); } catch (_) {}

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
  host:     process.env.DB_HOST || '127.0.0.1',
  port:     Number(process.env.DB_PORT) || 3306,
  dialect:  'mysql',
  timezone: '-06:00',
  logging:  false,
};

module.exports = {
  development: base,
  test:        base,
  production:  base,
};
