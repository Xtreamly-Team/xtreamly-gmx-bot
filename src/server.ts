import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

import { startInstance } from "./run_perpetual.js";
import YAML from "yamljs"

const app = express();
app.use(express.json());
const spec = YAML.load("src/openapi.yaml");
const port = 3001;

app.get("/start", async (req, res) => {
    try {
        const result = await startInstance();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Swagger definition
const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Xtreamly GXM bot server",
            version: "1.0.0",
            description: "Xtreamly GMX bot server API documentation",
        },
    },
    apis: [__filename],
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at port ${port}`);
});
