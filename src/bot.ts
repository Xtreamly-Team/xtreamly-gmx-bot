import { logger } from "./logging";
import { TradeStrategy } from "./strategy";
import { Bot, Policy } from "./models";
import { monitoringDb } from "./database_interface";

import { Consumer, Kafka } from "kafkajs";
import { KAFKA_BROKDER_ADDRESS } from "./config";


type BotCallback = (bot: Bot) => Promise<boolean>

const policy = new Policy(
  240,
  240,
);

export class BotListener {
  kafka: Kafka;
  consumerGroup: string;
  consumer: Consumer
  private static instance: BotListener

  private constructor() {
    logger.info("BotManager initialized")
    this.kafka = new Kafka({
      // clientId: 'my-app',
      brokers: [KAFKA_BROKDER_ADDRESS]  // your Kafka broker(s)
    })

    this.consumerGroup = 'gmx_bot_processors'
    this.consumer = this.kafka.consumer({ groupId: this.consumerGroup })
  }

  public static getInstance(): BotListener {
    if (!BotListener.instance) {
      BotListener.instance = new BotListener()
    }
    return BotListener.instance
  }

  async executeBot(bot: Bot) {
    const _start = new Date();
    logger.info("Starting executing bot at: ", new Date().toISOString());

    // Initialize database connection
    try {
      await monitoringDb.reconnect();
    } catch (e) {
      logger.error(e)
    }

    try {
      const strategy = new TradeStrategy({
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

      logger.info(`Executing ${bot}`)
      await strategy.execute();
      return true

    } catch (e) {
      logger.error(`Error executing strategy for bot ID ${bot.id}:`, e);
      return false
    } finally {
      // Clean up connection
      await monitoringDb.disconnect()
      const _end = new Date()
      const timeDiff = (_end.getTime() - _start.getTime()) / 1000
      logger.info(`Executing bot took ${timeDiff} seconds`);

    }

  }

  async startListeningOnBots() {
    await this._startListening(this.executeBot)
  }

  async stopListeningOnBots() {
    await this.consumer.stop()
    await this.consumer.disconnect()
  }

  async _startListening(botCallback: BotCallback) {
    await this.consumer.connect()
    await this.consumer.subscribe({ topic: 'gmx_bot', fromBeginning: true })

    this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const obj = JSON.parse(message.value.toString())
        const bot = Bot.fromObject(obj)
        await botCallback(bot)
      }
    })
  }
}

