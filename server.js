// Server entry point for Student Worker Scheduling System - Team 2
import routes from "./app/routes/index.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import db  from "./app/models/index.js";
import logger from "./app/config/logger.js";


// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add missing columns that teammates may have added to models
const addMissingColumns = async () => {
  const columnsToAdd = [
    { table: 'users', column: 'is_active', sql: 'ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1' },
    { table: 'users', column: 'deactivated_at', sql: 'ADD COLUMN deactivated_at DATETIME NULL' },
    { table: 'positions', column: 'is_critical', sql: "ADD COLUMN is_critical TINYINT(1) NOT NULL DEFAULT 0" },
    {
      table: 'user_departments',
      column: 'request_status',
      sql: "ADD COLUMN request_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'",
    },
  ];
  for (const col of columnsToAdd) {
    try {
      await db.sequelize.query(`ALTER TABLE ${col.table} ${col.sql}`);
      logger.info(`Added ${col.column} column to ${col.table} table`);
    } catch (err) {
      // Column already exists – safe to ignore
    }
  }
};

import { runSeeds } from "./app/config/seed.js";


const app = express();

// HTTP request logger middleware
app.use(morgan('combined', { stream: logger.stream }));

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGIN || "";
  const defaults = [
    "http://localhost:8081",
    "https://workerscheduling.eaglesoftwareteam.com",
  ];

  if (!configuredOrigins.trim()) {
    return defaults;
  }

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

// CORS configuration with preflight support
var corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Blocked by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}

// Apply CORS with the updated options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));


// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  
// Load the routes from the routes folder
app.use("/workerscheduling-t2", routes); 


// set port, listen for requests
const PORT = process.env.PORT || 3132;
const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    logger.info("Database connection established");
    
    // Add any missing columns before syncing
    await addMissingColumns();
    
    await db.sequelize.sync();
    logger.info("Database schema synchronized");

    // Seed essential data (uses findOrCreate, safe to run every startup)
    await runSeeds();

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`Startup failed: ${err.message}`);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

// Export logger for use in other modules
export { logger };

export default app;
