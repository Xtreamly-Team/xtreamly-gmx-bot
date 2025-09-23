import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

import { runPerpetualStrategy } from "./run_perpetual.js";

const app = express();
app.use(express.json());
const port = parseInt(process.env.PORT || "3000", 10);

app.post("/run-strategy", async (req, res) => {
  try {
    await runPerpetualStrategy();
    res.json({ status: "success", message: "Strategy run initiated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running at port ${port}`);
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

