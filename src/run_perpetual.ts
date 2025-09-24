import cron from "node-cron";
import { PerpStrategy } from "./strategy";
import { BotRegistry } from "./db";
import { Policy } from "./models";
import { userManagementDb, monitoringDb } from "./database_interface";

let strategy: PerpStrategy;

export async function runPerpetualStrategy() {
  const _start = new Date();
  console.log("Running strategy at: ", new Date().toISOString());

  const policy = new Policy();

  // Initialize database connection
  try {
    await userManagementDb.reconnect();
    await monitoringDb.reconnect();
  } catch (e) {
    console.error(e)
  }

  try {
    // NOTE: This takes a second
    const botRegistry = new BotRegistry();
    const bots = await botRegistry.readBots();
    console.log(`Found ${bots.length} active bots`);

    for (let bot of bots) {
      console.log(bot)
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
        console.log(
          `Bot ID: ${bot.id}, Exchange: ${bot.exchange}, Token: ${bot.token}, Size: ${bot.positionSize}, Leverage: ${bot.leverage}`
        );
        await strategy.execute()
      } catch (e) {
        console.error(`Error executing strategy for bot ID ${bot.id}:`, e);
      }
    }
  } finally {
    // Clean up connection
    await userManagementDb.disconnect();
    await monitoringDb.disconnect()
  }

  console.log(
    `Task completed in ${(new Date().getTime() - _start.getTime()) / 1000
    } seconds`
  );
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
