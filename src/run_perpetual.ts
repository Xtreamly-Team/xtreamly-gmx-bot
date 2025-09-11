import cron from "node-cron";
import { PerpStrategy } from "./strategy";
import { BotRegistry } from "./db";
import { Policy } from "./models";

let strategy: PerpStrategy

export async function startInstance() {

    try {

        if (cron.getTasks().size > 0) {
            const tasks = cron.getTasks()
            for (let task of tasks.values()) {
                await task.stop()
            }
        }

        console.log("Starting perpetual bot session...")

        const policy = new Policy()

        cron.schedule("* * * * *", async () => {
            const _start = new Date();
            console.log("Running task every minute:", new Date().toISOString());

            // NOTE: This takes a second
            const botRegistery = new BotRegistry()
            await botRegistery.connect()

            const bots = await botRegistery.readBots()

            for (let bot of bots) {
                console.log(bot)
                // continue

                try {

                    strategy = new PerpStrategy(
                        {
                            bot_id: String(bot.id),
                            walletPrivkey: bot.walletPrivateKey,
                            token: bot.token,
                            basePositionSize: bot.positionSize,
                            leverage: bot.leverage,
                            signalHorizonMin: policy.signalHorizonMin,
                            keepStrategyHorizonMin: policy.keepStrategyHorizonMin,
                            baseAsset: 'USDC',
                        }
                    )
                    console.log(`Bot ID: ${bot.id}, Exchange: ${bot.exchange}, Token: ${bot.token}, Size: ${bot.positionSize}, Leverage: ${bot.leverage}`);

                    await strategy.execute()
                } catch (e) {
                    console.error(`Error executing strategy for bot ID ${bot.id}:`, e);
                }

            }

            await botRegistery.disconnect()

            console.log(`Task completed in ${(new Date().getTime() - _start.getTime()) / 1000} seconds`)

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


