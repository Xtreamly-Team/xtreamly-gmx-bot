import { createPublicClient, erc20Abi, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARB_RPC_URL, getYieldGenerationUrl, MIN_WALLET_FOR_YIELD } from "./config";
import { Monitoring } from "./db";
import { GMX } from "./gmx";
import { Xtreamly } from "./xtreamly";
import { YieldGenerator } from "./yield_generation";
import { arbitrum } from 'viem/chains';

export class PerpStrategy {
    private walletPrivkey: string;
    private walletAddress: string;
    private token: 'ETH' | 'SOL' | 'BTC';
    private baseAsset: string;
    // private basePositionSize: number;
    private leverage: number;
    private signalHorizonMin: number;
    private keepStrategyHorizonMin: number;
    private lastReceivedLongSignalTime: number;
    private lastReceivedShortSignalTime: number;

    private gmx: GMX;
    private xtreamly: Xtreamly
    private monitoring: Monitoring;
    private bot_id: string;
    private yieldGenerator: YieldGenerator;

    constructor(params: {
        bot_id: string;
        walletPrivkey: string;
        token: 'ETH' | 'SOL' | 'BTC';
        // NOTE: This is not needed since we are using full wallet balance for position sizing. We can remove it later if everything works fine
        basePositionSize: number;
        leverage: number;
        signalHorizonMin: number;
        keepStrategyHorizonMin?: number;
        baseAsset?: string;
    }) {
        this.bot_id = params.bot_id;
        this.walletPrivkey = params.walletPrivkey;
        this.walletAddress = privateKeyToAccount(this.walletPrivkey as '0x{string}').address;
        this.token = params.token;
        // this.basePositionSize = params.basePositionSize;
        this.leverage = params.leverage;
        this.signalHorizonMin = params.signalHorizonMin;
        this.keepStrategyHorizonMin = params.keepStrategyHorizonMin ?? 240;
        this.baseAsset = params.baseAsset ?? "USDC";


        const now = Math.floor(Date.now() / 1000);
        this.lastReceivedLongSignalTime = now;
        this.lastReceivedShortSignalTime = now;

        this.gmx = new GMX(this.walletPrivkey);
        this.xtreamly = new Xtreamly()
        this.monitoring = new Monitoring()
        console.log(`PerpSignalStrategy GMX initialized fro ${this.walletAddress} with symbol ${this.token}`)

    }

    async _check_usdc_balance() {
        const publicClient = createPublicClient({
            chain: arbitrum,
            transport: http(ARB_RPC_URL),
        })
        let usdcBalance = await publicClient.readContract({
            abi: erc20Abi,
            // USDC_Address
            address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            functionName: "balanceOf",
            args: [publicClient.account.address],
        });
        return Number(usdcBalance / 10n ** 6n)
    }

    async _open_full_position(side: 'long' | 'short') {
        console.log(`Fetching USDC balance for ${this.walletAddress} to open a full position`)
        const positionSize = await this._check_usdc_balance()
        // NOTE: Do we have to multiply by leverage here?
        const res = await this.gmx.openPosition(this.token, side, positionSize, this.leverage);
        console.log(`Opened full position ${res}`)
        await this.monitoring.insertEvent(this.bot_id, 'opened_position_long', {
            'positionSize': positionSize,
            'leverage': this.leverage,
        })
    }

    async _try_depositing_to_yield_generator() {
        console.log(`Trying adding funds to yield generator ${this.walletAddress} `)
        console.log(`Fetching USDC balance for ${this.walletAddress} to check for depositing in yield`)
        const toDeposit = await this._check_usdc_balance()
        if (toDeposit > MIN_WALLET_FOR_YIELD) {
            console.log(`Depositing ${toDeposit} USDC to yield generator for wallet ${this.walletAddress}`)
            this.yieldGenerator.deposit(this.walletPrivkey)
            await this.monitoring.insertEvent(this.bot_id, 'depositing_to_yield_generator', { usdcBalance: toDeposit })
            return
        } else {
            console.log(`Not enough USDC in ${this.walletAddress} to deposit to yield generator, skipping deposit`)
            await this.monitoring.insertEvent(this.bot_id, 'not_depositing_to_yield_generator', { usdcBalance: toDeposit })
        }
    }

    async execute() {
        this.monitoring = new Monitoring()
        this.yieldGenerator = new YieldGenerator(getYieldGenerationUrl())
        const usdDivisor = 10n ** 30n;
        try {
            await this.monitoring.insertEvent(this.bot_id, 'execution', {})
            const signals = await this.xtreamly.getSignals(this.token);

            const signal = signals[signals.length - 1];
            const firstSignal = signals[0];
            console.log(`Fetched ${signals.length} signals`);
            console.log(`First signal: ${firstSignal.symbol}, Long: ${firstSignal.long}, Short: ${firstSignal.short}, Horizon: ${firstSignal.horizon} minutes, ${firstSignal.stop_loss} Stop loss, ${firstSignal.take_profit}`);
            console.log(`Last signal: ${signal.symbol}, Long: ${signal.long}, Short: ${signal.short}, Horizon: ${signal.horizon} minutes, ${signal.stop_loss} Stop loss, ${signal.take_profit}`);

            for (const _signal of signals) {
                if (_signal.long) {
                    this.lastReceivedLongSignalTime = Math.floor(new Date(_signal.prediction_time).getTime() / 1000);
                } else if (_signal.short) {
                    this.lastReceivedShortSignalTime = Math.floor(new Date(_signal.prediction_time).getTime() / 1000);
                }
            }

            await this.monitoring.insertEvent(this.bot_id, 'signal_received', signal)

            if (signal.long && signal.short) {
                console.error("Received both long and short signals, cannot proceed with strategy.");
                await this.monitoring.insertEvent(this.bot_id, 'signal_confusing', signal)
                return
            }


            console.log(
                `Signal long: ${signal.long}, Signal short: ${signal.short} for ${this.token}, stop_loss: ${signal.stop_loss}, take_profit: ${signal.take_profit}`
            )

            const allPositions = await this.gmx.getOpenPositions();
            const positions = allPositions[this.token] ? allPositions[this.token] : [];

            const currentTime = Math.floor(Date.now() / 1000);
            console.log(`Current epoch: ${currentTime}`)

            const time_since_last_long_signal = currentTime - this.lastReceivedLongSignalTime;
            console.log("Time since last long signal:", time_since_last_long_signal);
            const time_since_last_short_signal = currentTime - this.lastReceivedShortSignalTime;
            console.log("Time since last short signal:", time_since_last_short_signal);

            if (positions.length > 0) {
                const position = positions[0];
                console.log("Checking existing position for stop loss or take profit")
                console.log(position)
                const entryPrice = position.entryPrice
                if (position.isLong) {
                    console.log(`Current long position entry price: ${entryPrice}`)
                    const priceToStopLoss = (1 - (signal.stop_loss / 100)) * Number(entryPrice)
                    const priceToTakeProfit = (1 + (signal.take_profit / 100)) * Number(entryPrice)
                    console.log(`Current long position entry price: ${entryPrice} and stop loss of ${priceToStopLoss} and take profit of ${priceToTakeProfit} at mark price of ${position.markPrice}`)
                    if (position.markPrice <= priceToStopLoss) {
                        console.log("Long position hit stop loss, closing position")
                        await this.monitoring.insertEvent(this.bot_id, 'long_position_hit_stop_loss', {
                            'entryPrice': entryPrice,
                            'markPrice': position.markPrice,
                            'stopLossPercent': signal.stop_loss,
                            'position': {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        })
                        await this.gmx.closePosition(this.token);
                        await this.monitoring.insertEvent(this.bot_id, 'closed_position_long', {
                            'side': position.isLong ? 'long' : 'short',
                            'size': Number(position.sizeInUsd / usdDivisor)
                        })
                        await new Promise(r => setTimeout(r, 500));
                        await this._try_depositing_to_yield_generator()
                        return
                    }
                    else if (position.markPrice >= priceToTakeProfit) {
                        console.log("Long position hit take profit, closing position")
                        await this.monitoring.insertEvent(this.bot_id, 'long_position_hit_take_profit', {
                            'entryPrice': entryPrice,
                            'markPrice': position.markPrice,
                            'takeProfitPercent': signal.take_profit,
                            'position': {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        })
                        await this.gmx.closePosition(this.token);
                        await this.monitoring.insertEvent(this.bot_id, 'closed_position_long', {
                            'side': position.isLong ? 'long' : 'short',
                            'size': Number(position.sizeInUsd / usdDivisor)
                        })
                        await new Promise(r => setTimeout(r, 500));
                        await this._try_depositing_to_yield_generator()
                        return

                    }
                    else {
                        console.log("No stop loss or take profit hit for long position")
                    }


                }
                else {
                    console.log(`Current short position entry price: ${entryPrice}`)
                    const priceToTakeProfit = (1 - (signal.stop_loss / 100)) * Number(entryPrice)
                    const priceToStopLoss = (1 + (signal.take_profit / 100)) * Number(entryPrice)
                    console.log(`Current short position entry price: ${entryPrice} and stop loss of ${priceToStopLoss} and take profit of ${priceToTakeProfit} at mark price of ${position.markPrice}`)
                    if (position.markPrice >= priceToStopLoss) {
                        console.log("Short position hit stop loss, closing position")
                        await this.monitoring.insertEvent(this.bot_id, 'short_position_hit_stop_loss', {
                            'entryPrice': entryPrice,
                            'markPrice': position.markPrice,
                            'stopLossPercent': signal.stop_loss,
                            'position': {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        })
                        await this.gmx.closePosition(this.token);
                        await this.monitoring.insertEvent(this.bot_id, 'closed_position_short', {
                            'side': position.isLong ? 'long' : 'short',
                            'size': Number(position.sizeInUsd / usdDivisor)
                        })
                        await new Promise(r => setTimeout(r, 500));
                        await this._try_depositing_to_yield_generator()
                        return
                    }
                    else if (position.markPrice <= priceToTakeProfit) {
                        console.log("Short position hit take profit, closing position")
                        await this.monitoring.insertEvent(this.bot_id, 'short_position_hit_take_profit', {
                            'entryPrice': entryPrice,
                            'markPrice': position.markPrice,
                            'takeProfitPercent': signal.take_profit,
                            'position': {
                                "side": position.isLong ? 'long' : 'short',
                                "size": Number(position.sizeInUsd / usdDivisor)
                            }
                        })
                        await this.gmx.closePosition(this.token);
                        await this.monitoring.insertEvent(this.bot_id, 'closed_position_short', {
                            'side': position.isLong ? 'long' : 'short',
                            'size': Number(position.sizeInUsd / usdDivisor)
                        })
                        await new Promise(r => setTimeout(r, 500));
                        await this._try_depositing_to_yield_generator()
                        return
                    }
                    else {
                        console.log("No stop loss or take profit hit for short position")
                    }

                }
            }

            if (signal.long) {
                console.log(`Long signal received for ${this.token}, at ${currentTime}, last long signal at ${this.lastReceivedLongSignalTime}`);
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
                        await this._open_full_position('long')
                    }
                }
                else {
                    console.log(`Withdrawing from yield generator to open long position`)
                    this.yieldGenerator.withdraw(this.walletPrivkey)
                    // Sleep for 2 seconds to make sure the withdrawal is processed
                    await new Promise(r => setTimeout(r, 3000));
                    console.log("Creating a new long position")
                    await new Promise(r => setTimeout(r, 500));

                    await this.monitoring.insertEvent(this.bot_id, 'opening_new_position_long', {
                        'basePositionSize': this._check_usdc_balance(),
                        'leverage': this.leverage,
                    })
                    await this._open_full_position('long')
                }
            } else if (signal.short) {
                console.log("Short signal received for", this.token, "at", currentTime, "last short signal at", this.lastReceivedShortSignalTime);
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
                        await this._open_full_position('short')
                    }
                } else {
                    console.log(`Withdrawing from yield generator to open short position`)
                    this.yieldGenerator.withdraw(this.walletPrivkey)
                    await new Promise(r => setTimeout(r, 3000));
                    console.log("Creating a new short position")
                    await new Promise(r => setTimeout(r, 500));

                    await this.monitoring.insertEvent(this.bot_id, 'opening_new_position_short', {
                        'basePositionSize': this._check_usdc_balance(),
                        'leverage': this.leverage,
                    })

                    await this._open_full_position('short')
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
                            console.log(`Haven't received long signal for a while ${time_since_last_long_signal}, exiting the long position`)
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
                            await new Promise(r => setTimeout(r, 500));
                            await this._try_depositing_to_yield_generator()
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
                            console.log(`Haven't received short signal for a while ${time_since_last_short_signal}, exiting the short position`)
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


                            await new Promise(r => setTimeout(r, 500));
                            await this._try_depositing_to_yield_generator()
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
                    // NOTE: This is not necessary since after each close position we call try depositing to yield generator
                    await this._try_depositing_to_yield_generator()
                }
            }

        }
        catch (e) {
            console.error("Error during strategy execution:", e);
            this.monitoring.insertEvent(this.bot_id, 'error', { error: e })
        }
    }
}
