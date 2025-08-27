import { GMX } from "./gmx";
import { Xtreamly } from "./xtreamly";


export class PerpStrategy {
    private walletPrivkey: string;
    private token: 'ETH' | 'SOL' | 'BTC';
    private baseAsset: string;
    private basePositionSize: number;
    private leverage: number;
    private keepStrategyHorizonMin: number;
    private lastReceivedLongSignalTime: number;
    private lastReceivedShortSignalTime: number;

    private gmx: GMX;
    private xtreamly: Xtreamly

    constructor(params: {
        walletPrivkey: string;
        token: 'ETH' | 'SOL' | 'BTC';
        basePositionSize: number;
        leverage: number;
        keepStrategyHorizonMin?: number;
        baseAsset?: string;
    }) {
        this.walletPrivkey = params.walletPrivkey;
        this.token = params.token;
        this.basePositionSize = params.basePositionSize;
        this.leverage = params.leverage;
        this.keepStrategyHorizonMin = params.keepStrategyHorizonMin ?? 240;
        this.baseAsset = params.baseAsset ?? "USDC";

        const now = Math.floor(Date.now() / 1000);
        this.lastReceivedLongSignalTime = now;
        this.lastReceivedShortSignalTime = now;

        this.gmx = new GMX(this.walletPrivkey);

        this.xtreamly = new Xtreamly()

    }

    async initialize() {
        await this.gmx.initialzeMarkets();
    }

    async execute() {
        const signals = await this.xtreamly.getSignals();

        for (let signal of signals) {
            console.log(`Signal: ${signal.symbol}, Long: ${signal.long}, Short: ${signal.short}, Horizon: ${signal.horizon} minutes`);
        }
        const signal = signals.filter(signal => signal.symbol === this.token)[0];

        if (signal.long && signal.short) {
            console.error("Received both long and short signals, cannot proceed with strategy.");
            return
        }

        const allPositions = await this.gmx.getOpenPositions();
        const positions = allPositions[this.token] ? allPositions[this.token] : [];

        const currentTime = Math.floor(Date.now() / 1000);
        console.log(currentTime)

        const time_since_last_long_signal = currentTime - this.lastReceivedLongSignalTime;
        console.log("Time since last long signal:", time_since_last_long_signal);
        const time_since_last_short_signal = currentTime - this.lastReceivedShortSignalTime;
        console.log("Time since last short signal:", time_since_last_short_signal);

        if (signal.long) {
            console.log(`Long signal received for ${this.token}, at ${currentTime}, last long signal at ${this.lastReceivedLongSignalTime}`);
            console.log(`Resetting last received long signal time to current time.`);
            this.lastReceivedLongSignalTime = Math.floor(Date.now() / 1000);
            if (positions.length > 0) {
                const position = positions[0];
                if (position.isLong) {
                    console.log("Keeping existing long position open")
                } else {
                    console.log("Flipping short position to long")
                    console.log("closing short position")
                    await this.gmx.closePosition(this.token);
                    console.log("Opening long position")
                    const res = await this.gmx.openPosition(this.token, 'long', this.basePositionSize, this.leverage);
                    console.log(res)
                }
            }
            else {
                console.log("Creating a new long position")
                const res = await this.gmx.openPosition(this.token, 'long', this.basePositionSize, this.leverage);
                console.log(res)
            }
        } else if (signal.short) {
            console.log("Short signal received for", this.token, "at", currentTime, "last short signal at", this.lastReceivedShortSignalTime);
            console.log("Resetting last received short signal time to current time.");
            this.lastReceivedShortSignalTime = Math.floor(Date.now() / 1000);
            if (
                positions.length > 0
            ) {
                const position = positions[0];
                if (!position.isLong) {
                    console.log("Keeping existing short position open")
                } else {
                    console.log("Flipping long position to short")
                    console.log("closing long position")
                    await this.gmx.closePosition(this.token);
                    // const orderSize = position.sizeInUsd + BigInt(this.basePositionSize);
                    console.log("Opening short position")
                    const res = await this.gmx.openPosition(this.token, 'short', this.basePositionSize, this.leverage);
                    console.log(res)
                }
            } else {
                console.log("Creating a new short position")
                const res = await this.gmx.openPosition(this.token, 'short', this.basePositionSize, this.leverage);
                console.log(res)
            }
        } else {
            console.log("No signal received for", this.token, "at", currentTime);
            if (
                positions.length > 0
            ) {
                const position = positions[0];
                if (position.isLong) {
                    console.log("Checking whether to keep long position open")
                    if (time_since_last_long_signal > this.keepStrategyHorizonMin * 60) {
                        console.log("Haven't received long signal for a while, closing long position")
                        console.log("Closing long position due to no recent long signal")
                        await this.gmx.closePosition(this.token);
                    } else {
                        console.log("Keeping long position open")
                    }
                } else {
                    console.log("Checking whether to keep short position open")
                    if (time_since_last_short_signal > this.keepStrategyHorizonMin * 60) {
                        console.log("Haven't received short signal for a while, closing short position")
                        console.log("Closing short position due to no recent short signal")
                        await this.gmx.closePosition(this.token);
                    } else {
                        console.log("Keeping short position open")
                    }
                }
            } else {
                console.log("No open positions for", this.token, "at", currentTime);
            }
        }

    }
}

