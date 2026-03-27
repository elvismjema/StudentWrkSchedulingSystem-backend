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

db.sequelize.sync({ alter: true })
  .then(() => {
    logger.info('Database synchronized successfully');
    logger.info('Models in sync: ' + Object.keys(db).filter(key => typeof db[key] === 'object' && db[key] !== null && 'tableName' in db[key]).join(', '));
  })
  .catch(err => {
    logger.error('Error syncing database:', err);
    process.exit(1); // Exit if we can't sync the database
  });

import { runSeeds } from "./app/config/seed.js";


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// HTTP request logger middleware
app.use(morgan('combined', { stream: logger.stream }));

// CORS configuration with preflight support
var corsOptions = {
  origin: "http://localhost:8081",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
    
    // Sync schema – alter:true adds missing columns (safe for adding new fields)
    // TODO: revert to sync() after request_status column is confirmed on deployed DB
    await db.sequelize.sync({ alter: true });
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
