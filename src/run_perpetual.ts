import cron from "node-cron";
import { PerpStrategy } from "./strategy";
import { BotRegistry } from "./db";
import { Policy } from "./models";
import { userManagementDb, monitoringDb } from "./database_interface";

import pLimit from 'p-limit';

// Allow only 5 strategies to run in parallel
const limit = pLimit(20);

let strategy: PerpStrategy;

export async function runPerpetualStrategy() {
  const _start = new Date();
  console.log("Starting strategy at: ", new Date().toISOString());

  const policy = new Policy(
    240,
    240,
  );

  // Initialize database connection
  try {
    await userManagementDb.reconnect();
    await monitoringDb.reconnect();
  } catch (e) {
    console.error(e)
  }

  try {
    const botRegistry = new BotRegistry();

    console.log(`Reading GMX active bots`)
    const bots = await botRegistry.readBots();
    console.log(`Found ${bots.length} active GMX bots`);

    const promises = bots.map(async (bot) => {
      try {
        const strategy = new PerpStrategy({
          bot_id: String(bot.id),
          walletPrivkey: bot.walletPrivateKey,
          walletAddress: bot.walletAddress,
          token: bot.token,
          basePositionSize: bot.positionSize,
          leverage: bot.leverage,
          signalHorizonMin: policy.signalHorizonMin,
          keepStrategyHorizonMin: policy.keepStrategyHorizonMin,
          baseAsset: "USDC",
        });

        await strategy.execute();
        return { botId: bot.id, status: "fulfilled" };
      } catch (e) {
        console.error(`Error executing strategy for bot ID ${bot.id}:`, e);
        return { botId: bot.id, status: "rejected", error: e };
      }
    });

    const results = await Promise.allSettled(promises);

    // Optional: handle/report results
    for (const result of results) {
      if (result.status === "fulfilled") {
        console.log(`Bot ${result.value.botId} finished successfully`);
      } else {
        console.warn(`Bot execution failed:`, result.reason);
      }
    }

    // for (let bot of bots) {
    //   try {
    //     strategy = new PerpStrategy({
    //       bot_id: String(bot.id),
    //       walletPrivkey: bot.walletPrivateKey,
    //       walletAddress: bot.walletAddress,
    //       token: bot.token,
    //       basePositionSize: bot.positionSize,
    //       leverage: bot.leverage,
    //       signalHorizonMin: policy.signalHorizonMin,
    //       keepStrategyHorizonMin: policy.keepStrategyHorizonMin,
    //       baseAsset: "USDC",
    //     });
    //     await strategy.execute()
    //   } catch (e) {
    //     console.error(`Error executing strategy for bot ID ${bot.id}:`, e);
    //   }
    // }
  } finally {
    // Clean up connection
    await userManagementDb.disconnect();
    await monitoringDb.disconnect()
  }

  console.log(
    `Whole strategy execution completed in ${(new Date().getTime() - _start.getTime()) / 1000
    } seconds`
  );

  return {
    status: "success",
    message: "Strategy execution completed"
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
