import cron from "node-cron";
import { PerpStrategy } from "./strategy";
import { BotRegistry } from "./db";
import { Policy } from "./models";
import { userManagementDb, monitoringDb } from "./database_interface";
import logger from "./logger";

let strategy: PerpStrategy;

export async function runPerpetualStrategy() {
  const _start = new Date();
  logger.info(`Running strategy at: ${new Date().toISOString()}`);

  const policy = new Policy();

  try {
    // NOTE: This takes a second
    const botRegistry = new BotRegistry();
    const bots = await botRegistry.readBots();
    logger.info(`Found ${bots.length} active bots`);

    for (let bot of bots) {
      try {
        strategy = new PerpStrategy({
          bot_id: String(bot.id),
          walletPrivkey: bot.walletPrivateKey,
          token: bot.token,
          basePositionSize: bot.positionSize,
          leverage: bot.leverage,
          signalHorizonMin: policy.signalHorizonMin,
          keepStrategyHorizonMin: policy.keepStrategyHorizonMin,
          baseAsset: "USDC",
        });
        logger.info(
          `Bot ID: ${bot.id}, Exchange: ${bot.exchange}, Token: ${bot.token}, Size: ${bot.positionSize}, Leverage: ${bot.leverage}`
        );
        await strategy.execute();
      } catch (e) {
        logger.error(`Error executing strategy for bot ID ${bot.id}:`, e);
      }
    }
  } catch (e) {
    logger.error(e);
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

    logger.info("Starting perpetual bot session...");

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
