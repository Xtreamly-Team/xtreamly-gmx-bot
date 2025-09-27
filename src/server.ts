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

/**
 * @swagger
 * /run-strategy:
 *   post:
 *     summary: Manually trigger the perpetual trading strategy
 *     description: Initiates a run of the perpetual trading strategy for all active bots. This is an asynchronous operation.
 *     responses:
 *       200:
 *         description: Strategy run has been successfully initiated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Strategy run initiated.
 *       500:
 *         description: Internal Server Error if the strategy fails to start.
 */
app.post("/run-strategy", async (req, res) => {
  try {
    logger.info("Run strategy called - updated");
    await runPerpetualStrategy();
    res.json({ status: "success", message: "Strategy run initiated." });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Checks the health of the service, including database connections.
 *     responses:
 *       200:
 *         description: The service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 databases:
 *                   type: object
 *                   properties:
 *                     monitoring:
 *                       type: string
 *                       example: healthy
 *                     user_management:
 *                       type: string
 *                       example: healthy
 *       503:
 *         description: The service is unhealthy, likely due to a database connection issue.
 */
app.get("/health", async (req, res) => {
  try {
    const { monitoringDb, userManagementDb } = await import('./database_interface');
    
    // Check database health
    let monitoringHealthy = await monitoringDb.isHealthy();
    let userManagementHealthy = await userManagementDb.isHealthy();
    
    if (!monitoringHealthy) {
      logger.warn("Monitoring database health check failed. Attempting to reconnect...");
      try {
        await monitoringDb.reconnect();
        monitoringHealthy = await monitoringDb.isHealthy(); // Re-check
      } catch (error) {
        logger.error(error, "Monitoring database reconnection failed:");
        monitoringHealthy = false;
      }
    }

    if (!userManagementHealthy) {
      logger.warn("User management database health check failed. Attempting to reconnect...");
      try {
        await userManagementDb.reconnect();
        userManagementHealthy = await userManagementDb.isHealthy(); // Re-check
      } catch (error) {
        logger.error(error, "User management database reconnection failed:");
        userManagementHealthy = false;
      }
    }
    
    const dbHealthy = monitoringHealthy && userManagementHealthy;
    const status = dbHealthy ? "healthy" : "unhealthy";

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
    logger.error(error, "Health check failed:");
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
