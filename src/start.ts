import { BotListener } from "./bot";
import { logger } from "./logging";

async function listen() {
  const bot_listener = BotListener.getInstance()
  try {
    logger.info("Starting bot listener")
    await bot_listener.startListeningOnBots()
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("Caught interrupt signal, shutting down...")
      await bot_listener.stopListeningOnBots()
      process.exit(0)
    })

    // Block forever
    await new Promise(() => { })
  } finally {
    await bot_listener.stopListeningOnBots()
    logger.info("Stopped bot listener")
  }
}

listen()
