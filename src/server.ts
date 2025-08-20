import express from "express";

import { perpReset, perpStart } from "./run_perpetual.js";

const app = express();
const port = 3000;

// Dummy placeholder for your async functions
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

// GET /perp_reset
app.get("/perp_reset", async (req, res) => {
    try {
        const {
            wallet_address,
            wallet_private_key,
            token = "ETH",
            base_position_size = 0.005,
            leverage = 3,
            keep_strategy_horizon_min = 60,
            base_asset = "USDC",
        } = req.query;


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

// GET /perp_start
app.get("/perp_start", async (req, res) => {
    try {
        const result = await _perp_start();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
