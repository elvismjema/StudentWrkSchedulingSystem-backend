
import routes from "./app/routes/index.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import db  from "./app/models/index.js";
import logger from "./app/config/logger.js";

const app = express();

// HTTP request logger middleware
app.use(morgan('combined', { stream: logger.stream }));

// Also use the cors middleware as backup
var corsOptions = {
  origin: "http://localhost:8081",
  credentials: true
}
app.use(cors(corsOptions));


// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
  
// Load the routes from the routes folder
app.use("/workerscheduling-t2", routes); 


// set port, listen for requests
const PORT = process.env.PORT || 3132;
const shouldSyncSchema = process.env.DB_SYNC_ON_STARTUP === "true";

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    logger.info("Database connection established");
    
    // Require explicit opt-in for schema sync to prevent accidental production DDL changes.
    if (shouldSyncSchema) {
      await db.sequelize.sync();
      logger.info("Database schema synchronized");
    } else {
      logger.info("Database schema sync skipped at startup");
    }

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
