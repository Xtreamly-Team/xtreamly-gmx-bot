import cron from "node-cron";
import { Strategy } from "./strategy";
import logger from './logger';
import { recordMetric } from './monitoring';
import { getActiveBots } from './db';

export async function runPerpetualStrategy() {
  const start = Date.now();
  let status = 'success';
  try {
    logger.info("Running perpetual strategy for all active bots...");

    const activeBots = await getActiveBots();
    if (activeBots.length === 0) {
      logger.info("No active bots found.");
      return;
    }

    for (const bot of activeBots) {
      const strategy = new Strategy({
        bot_id: bot.id.toString(),
        walletPrivkey: bot.walletPrivateKey,
        token: bot.token,
        basePositionSize: bot.positionSize,
        leverage: bot.leverage,
        signalHorizonMin: bot.metadata?.signalHorizonMin || 60,
        keepStrategyHorizonMin: bot.metadata?.keepStrategyHorizonMin || 60,
        baseAsset: bot.metadata?.baseAsset || "USDC",
      });
      await strategy.execute();
    }

    logger.info("Perpetual strategy executed successfully for all bots.");
  } catch (err) {
    logger.error("Error executing perpetual strategy:", err);
    status = 'error';
  } finally {
    const duration = Date.now() - start;
    recordMetric('strategy/duration_ms', duration, { status });
    recordMetric('strategy/run_count', 1, { status });
  }
}

export async function startInstance() {
  try {
    if (cron.getTasks().size > 0) {
      const tasks = cron.getTasks();
      for (let task of tasks.values()) {
        await task.stop();
      }
    }

    console.log("Starting perpetual bot session...");

    if (process.env.NODE_ENV !== "production") {
      cron.schedule("* * * * *", async () => {
        runPerpetualStrategy();
      });
    }

    return {
      status: "success",
      message: "Session successfully started",
    };
  } catch (e) {
    return {
      status: "error",
      message: e,
    };
  }
}
