import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

import { perpReset, perpStart } from "./run_perpetual.js";
import YAML from "yamljs"

const app = express();
app.use(express.json());
const spec = YAML.load("src/openapi.yaml");
const port = 3000;

async function _perp_reset(
    wallet_address: string,
    wallet_private_key: string,
    token: string,
    base_position_size: number,
    leverage: number,
    keep_strategy_horizon_min: number,
    base_asset: string
) {
    return await perpReset(
        wallet_address,
        wallet_private_key,
        token,
        base_position_size,
        leverage,
        keep_strategy_horizon_min,
        base_asset
    );
}

async function _perp_start() {
    return await perpStart();
}

app.post("/perp_reset", async (req, res) => {
    try {
        const {
            wallet_address,
            wallet_private_key,
            token = "ETH",
            base_position_size = 20,
            leverage = 3,
            keep_strategy_horizon_min = 60,
            base_asset = "USDC",
        } = req.body


        const result = await _perp_reset(
            wallet_address,
            wallet_private_key,
            token,
            Number(base_position_size),
            Number(leverage),
            Number(keep_strategy_horizon_min),
            base_asset
        );

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/perp_start", async (req, res) => {
    try {
        const result = await _perp_start();
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
