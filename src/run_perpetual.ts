import cron from "node-cron";
import { PerpStrategy } from "./strategy";

let strategy: PerpStrategy

export async function perpReset(
    wallet_address: string,
    wallet_privkey: string,
    token: string,
    base_position_size: number,
    leverage: number,
    keep_strategy_horizon_min: number,
    base_asset: string,
) {
    try {
        if (!wallet_address || !wallet_privkey) {
            console.error("Wallet address and private key are required")
            return {
                'status': 'error',
                'message': 'Wallet address and private key are required'
            }
        }


        const tasks = cron.getTasks()
        for (let task of tasks.values()) {
            await task.stop()
        }

        strategy = new PerpStrategy(
            {
                walletPrivkey: wallet_privkey,
                token: token,
                basePositionSize: base_position_size,
                leverage: leverage,
                keepStrategyHorizonMin: keep_strategy_horizon_min,
                baseAsset: base_asset,
            }
        )

        return {
            'status': 'success',
            'message': 'Strategy reset successfully',
        }
    }

    catch (e) {
        return {
            'status': 'error',
            'message': e,
        }
    }
}

export async function perpStart() {

    try {

        if (cron.getTasks().size > 0) {
            return {
                'status': 'error',
                'message': 'session already running, stop first'
            }
        }

        cron.schedule("* * * * * *", async () => {
            console.log("Running task every minute:", new Date().toISOString());
            await strategy.execute()
        })

        return {
            'status': 'success',
            'message': 'Session successfully started'
        }
    }

    catch (e) {
        return {
            'status': 'error',
            'message': e
        }
    }
}


