import { Monitoring } from "./db";
import { GMX } from "./gmx";
import { Xtreamly } from "./xtreamly";
import { monitoringDb } from "./database_interface";
// const { privateKeyToAccount } = require('viem/accounts');
import { privateKeyToAddress } from "viem/accounts";


export class PerpStrategy {
    private walletPrivkey: string;
    private token: 'ETH' | 'SOL' | 'BTC';
    private baseAsset: string;
    private basePositionSize: number;
    private leverage: number;
    private signalHorizonMin: number;
    private keepStrategyHorizonMin: number;
    private lastReceivedLongSignalTime: number;
    private lastReceivedShortSignalTime: number;

    private gmx: GMX;
    private xtreamly: Xtreamly
    private monitoring: Monitoring;
    bot_id: string;

    constructor(params: {
        bot_id: string;
        walletPrivkey: string;
        token: 'ETH' | 'SOL' | 'BTC';
        basePositionSize: number;
        leverage: number;
        signalHorizonMin: number;
        keepStrategyHorizonMin?: number;
        baseAsset?: string;
    }) {
        console.warn(params)
        this.bot_id = params.bot_id;
        this.walletPrivkey = params.walletPrivkey;
        this.token = params.token;
        this.basePositionSize = params.basePositionSize;
        this.leverage = params.leverage;
        this.signalHorizonMin = params.signalHorizonMin;
        this.keepStrategyHorizonMin = params.keepStrategyHorizonMin ?? 60;
        this.baseAsset = params.baseAsset ?? "USDC";

        const now = Math.floor(Date.now() / 1000);
        this.lastReceivedLongSignalTime = now;
        this.lastReceivedShortSignalTime = now;

        this.gmx = new GMX(this.walletPrivkey);
        this.xtreamly = new Xtreamly()
        this.monitoring = new Monitoring()
        // this.bot_id = `perp_gmx_${this.token.toUpperCase()}_${privateKeyToAddress(this.walletPrivkey)}_${formatTimestamp(Date.now())}_${Math.floor(Math.random() * 100) + 1}`

    }

    async execute() {
        this.monitoring = new Monitoring()
        const usdDivisor = 10n ** 30n;
        try {
            try {
                await monitoringDb.connect()
            } catch (e) {
                console.error(e)
            }
            await this.monitoring.insertEvent(this.bot_id, 'execution', {})
            const signals = await this.xtreamly.getSignals();

            for (let signal of signals) {
                console.log(`Signal: ${signal.symbol}, Long: ${signal.long}, Short: ${signal.short}, Horizon: ${signal.horizon} minutes`);
            }
            const signal = signals.filter(signal => signal.symbol === this.token)[0];
            await this.monitoring.insertEvent(this.bot_id, 'signal_received', signal)

            if (signal.long && signal.short) {
                console.error("Received both long and short signals, cannot proceed with strategy.");
                await this.monitoring.insertEvent(this.bot_id, 'signal_confusing', signal)
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
                await this.monitoring.insertEvent(this.bot_id, 'signal_received_long', signal)
                if (positions.length > 0) {
                    const position = positions[0];
                    if (position.isLong) {
                        console.log("Keeping existing long position open")
                        await this.monitoring.insertEvent(this.bot_id, 'keeping_position_long',
                            {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        )
                    } else {
                        console.log("Flipping short position to long")
                        await this.monitoring.insertEvent(this.bot_id, 'flipping_position_short_to_long',
                            {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        )
                        console.log("closing short position")
                        await this.gmx.closePosition(this.token);
                        await this.monitoring.insertEvent(this.bot_id, 'closed_position_short',
                            {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        )
                        console.log("Opening long position")
                        const res = await this.gmx.openPosition(this.token, 'long', this.basePositionSize, this.leverage);
                        console.log(res)
                        await this.monitoring.insertEvent(this.bot_id, 'opened_position_long', {
                            'basePositionSize': this.basePositionSize,
                            'leverage': this.leverage,
                        })
                    }
                }
                else {
                    console.log("Creating a new long position")
                    await this.monitoring.insertEvent(this.bot_id, 'opening_new_position_long', {
                        'basePositionSize': this.basePositionSize,
                        'leverage': this.leverage,
                    })
                    const res = await this.gmx.openPosition(this.token, 'long', this.basePositionSize, this.leverage);
                    await this.monitoring.insertEvent(this.bot_id, 'opened_new_position_long', {
                        'basePositionSize': this.basePositionSize,
                        'leverage': this.leverage,
                    })
                    console.log(res)
                }
            } else if (signal.short) {
                console.log("Short signal received for", this.token, "at", currentTime, "last short signal at", this.lastReceivedShortSignalTime);
                console.log("Resetting last received short signal time to current time.");
                this.lastReceivedShortSignalTime = Math.floor(Date.now() / 1000);
                await this.monitoring.insertEvent(this.bot_id, 'signal_received_short', signal)
                if (
                    positions.length > 0
                ) {
                    const position = positions[0];
                    if (!position.isLong) {
                        console.log("Keeping existing short position open")
                        await this.monitoring.insertEvent(this.bot_id, 'keeping_position_short',
                            {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        )
                    } else {
                        console.log("Flipping long position to short")
                        await this.monitoring.insertEvent(this.bot_id, 'flipping_position_long_to_short',
                            {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        )
                        console.log("closing long position")
                        await this.gmx.closePosition(this.token);
                        await this.monitoring.insertEvent(this.bot_id, 'closed_position_long',
                            {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        )
                        console.log("Opening short position")
                        const res = await this.gmx.openPosition(this.token, 'short', this.basePositionSize, this.leverage);
                        await this.monitoring.insertEvent(this.bot_id, 'opened_position_short', {
                            'basePositionSize': this.basePositionSize,
                            'leverage': this.leverage,
                        })
                        console.log(res)
                    }
                } else {
                    console.log("Creating a new short position")
                    await this.monitoring.insertEvent(this.bot_id, 'opening_new_position_short', {
                        'basePositionSize': this.basePositionSize,
                        'leverage': this.leverage,
                    })
                    const res = await this.gmx.openPosition(this.token, 'short', this.basePositionSize, this.leverage);
                    await this.monitoring.insertEvent(this.bot_id, 'opened_new_position_short', {
                        'basePositionSize': this.basePositionSize,
                        'leverage': this.leverage,
                    })
                    console.log(res)
                }
            } else {
                console.log("No signal received for", this.token, "at", currentTime);
                await this.monitoring.insertEvent(this.bot_id, 'signal_received_none', signal)
                if (
                    positions.length > 0
                ) {
                    const position = positions[0];
                    if (position.isLong) {
                        console.log("Checking whether to keep long position open")
                        if (time_since_last_long_signal > this.keepStrategyHorizonMin * 60) {
                            console.log("Haven't received long signal for a while, closing long position")
                            console.log("Closing long position due to no recent long signal")
                            await this.monitoring.insertEvent(this.bot_id, 'closing_position_long_no_recent_signal', {
                                'lastReceivedLongSignalTime': this.lastReceivedLongSignalTime,
                                'timesinceLastLongSignal': time_since_last_long_signal,
                                'position':
                                {
                                    "side": position.isLong ? 'long' : 'short',
                                    "size": Number(position.sizeInUsd / usdDivisor)
                                }
                            })
                            await this.gmx.closePosition(this.token);
                            await this.monitoring.insertEvent(this.bot_id, 'closed_position_long', {
                                'side': position.isLong ? 'long' : 'short',
                                'size': Number(position.sizeInUsd / usdDivisor)
                            })
                        } else {
                            console.log("Keeping long position open")
                            await this.monitoring.insertEvent(this.bot_id, 'keeping_position_long', {
                                'lastReceivedLongSignalTime': this.lastReceivedLongSignalTime,
                                'timesinceLastLongSignal': time_since_last_long_signal,
                                'position':
                                {
                                    "side": position.isLong ? 'long' : 'short',
                                    "size": Number(position.sizeInUsd / usdDivisor)
                                }
                            })
                        }
                    } else {
                        console.log("Checking whether to keep short position open")
                        if (time_since_last_short_signal > this.keepStrategyHorizonMin * 60) {
                            console.log("Haven't received short signal for a while, closing short position")
                            console.log("Closing short position due to no recent short signal")
                            await this.monitoring.insertEvent(this.bot_id, 'closing_position_short_no_recent_signal', {
                                'lastReceivedShortSignalTime': this.lastReceivedShortSignalTime,
                                'timesinceLastShortSignal': time_since_last_short_signal,
                                'position':
                                {
                                    "side": position.isLong ? 'long' : 'short',
                                    "size": Number(position.sizeInUsd / usdDivisor)
                                }
                            })
                            await this.gmx.closePosition(this.token);
                            await this.monitoring.insertEvent(this.bot_id, 'closed_position_short', {
                                'side': position.isLong ? 'long' : 'short',
                                'size': Number(position.sizeInUsd / usdDivisor)
                            })
                        } else {
                            console.log("Keeping short position open")
                            await this.monitoring.insertEvent(this.bot_id, 'keeping_position_short', {
                                'lastReceivedShortSignalTime': this.lastReceivedShortSignalTime,
                                'timesinceLastShortSignal': time_since_last_short_signal,
                                'position':
                                {
                                    "side": position.isLong ? 'long' : 'short',
                                    "size": Number(position.sizeInUsd / usdDivisor)
                                }
                            })
                        }
                    }
                } else {
                    console.log("No open positions for", this.token, "at", currentTime);
                    await this.monitoring.insertEvent(this.bot_id, 'no_open_positions_and_no_signal', {
                        'lastReceivedLongSignalTime': this.lastReceivedLongSignalTime,
                        'timesinceLastLongSignal': time_since_last_long_signal,
                        'lastReceivedShortSignalTime': this.lastReceivedShortSignalTime,
                        'timesinceLastShortSignal': time_since_last_short_signal,
                    })
                }
            }

        }
        catch (e) {
            console.error("Error during strategy execution:", e);
            this.monitoring.insertEvent(this.bot_id, 'error', { error: e })
        }
        finally {
            await monitoringDb.disconnect()
        }
    }
}
