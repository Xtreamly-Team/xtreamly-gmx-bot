import express from "express";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { SENTRY_DSN } from "./config";
import logger from "./logger";
import { recordMetric } from "./monitoring";

import { runPerpetualStrategy } from "./run_perpetual.js";

const app = express();

Sentry.init({
  dsn: SENTRY_DSN,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

app.use(express.json());

// Monitoring Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, path } = req;
    const { statusCode } = res;
    
    recordMetric('api/request_latency_ms', duration, {
      http_method: method,
      path: path,
      status_code: String(statusCode),
    });

    if (statusCode >= 400) {
      recordMetric('api/error_count', 1, {
        http_method: method,
        path: path,
        status_code: String(statusCode),
      });
    }
  });
  next();
});

const port = parseInt(process.env.PORT || "3000", 10);

app.post("/run-strategy", async (req, res) => {
  try {
    console.info("Run strategy called - updated")
    await runPerpetualStrategy();
    res.json({ status: "success", message: "Strategy run initiated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/health", async (req, res) => {
  try {
    const { monitoringDb, userManagementDb } = await import('./database_interface');
    
    // Check database health
    const monitoringHealthy = await monitoringDb.isHealthy();
    const userManagementHealthy = await userManagementDb.isHealthy();
    
    const dbHealthy = monitoringHealthy && userManagementHealthy;
    const status = dbHealthy ? "healthy" : "unhealthy";
    
    if (!dbHealthy) {
      console.warn("Database health check failed");
      // Try to reconnect if needed
      try {
        if (!monitoringHealthy) {
          console.log("Attempting to reconnect monitoring database...");
          await monitoringDb.reconnect();
        }
        if (!userManagementHealthy) {
          console.log("Attempting to reconnect user management database...");
          await userManagementDb.reconnect();
        }
      } catch (error) {
        console.error("Database reconnection failed:", error);
      }
    }

    res.status(dbHealthy ? 200 : 503).json({
      status,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      databases: {
        monitoring: monitoringHealthy ? "healthy" : "unhealthy",
        user_management: userManagementHealthy ? "healthy" : "unhealthy"
      }
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      error: "Health check failed"
    });
  }
});

// Swagger definition
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Xtreamly GMX Bot API",
      version: "1.0.0",
      description: "API for the Xtreamly GMX trading bot server",
    },
    servers: [
      {
        url: "https://xtreamly-gmx-bot-664616721985.europe-west1.run.app",
        description: "Production server",
      },
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
  },
  apis: [__filename],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Optional fallthrough error handler
app.use(function onError(err, req, res, next) {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

app.listen(port, "0.0.0.0", () => {
  logger.info(`Server running at port ${port}`);
});
