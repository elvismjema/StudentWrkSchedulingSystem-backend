// Server entry point for Student Worker Scheduling System - Team 2
import "dotenv/config";
import routes from "./app/routes/index.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import db from "./app/models/index.js";
import logger from "./app/config/logger.js";

db.sequelize
  .sync({ alter: true })
  .then(() => {
    logger.info("Database synchronized successfully");
    logger.info(
      "Models in sync: " +
        Object.keys(db)
          .filter(
            (key) =>
              typeof db[key] === "object" &&
              db[key] !== null &&
              "tableName" in db[key],
          )
          .join(", "),
    );
  })
  .catch((err) => {
    logger.error("Error syncing database:", err);
    process.exit(1); // Exit if we can't sync the database
  });

const app = express();

// HTTP request logger middleware
app.use(morgan("combined", { stream: logger.stream }));

// CORS configuration with preflight support
const configuredOrigins = (
  process.env.FRONTEND_ORIGINS ||
  "http://localhost:8081,https://workerscheduling.eaglesoftwareteam.com"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests and configured browser origins.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    logger.warn(`Blocked CORS origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204.
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Load the routes from the routes folder
app.use("/workerscheduling-t2", routes);

// set port, listen for requests
const PORT = process.env.PORT || 3132;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}

// Export logger for use in other modules
export { logger };

export default app;
