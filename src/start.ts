import { BotListener } from "./bot";

async function listen() {
  const bot_listener = BotListener.getInstance()
  try {
    console.log("Starting bot listener")
    await bot_listener.startListeningOnBots()
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Caught interrupt signal, shutting down...")
      await bot_listener.stopListeningOnBots()
      process.exit(0)
    })

    // Block forever
    await new Promise(() => { })
  } finally {
    await bot_listener.stopListeningOnBots()
    console.log("Stopped bot listener")
  }
}

listen()
