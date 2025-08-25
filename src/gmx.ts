const { BATCH_CONFIGS } = require("@gmx-io/sdk/configs/batch");

// --- Runtime imports using CommonJS ---
const { GmxSdk } = require('@gmx-io/sdk');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arbitrum } = require('viem/chains');

// --- Type imports using ESM (for TS type hints) ---
import type { GmxSdk as GmxSdkType } from '@gmx-io/sdk';
import { MarketInfo, MarketsInfoData } from '@gmx-io/sdk/build/types/src/types/markets';
import { PositionInfo } from '@gmx-io/sdk/build/types/src/types/positions';
import { TokensData } from '@gmx-io/sdk/build/types/src/types/tokens';
import { BigNumber } from 'ethers';
import type { WalletClient, PublicClient } from 'viem';

import { erc20Abi } from "viem";
import { getDecreasePositionAmounts } from './decrease';


export class GMX {
    private sdk: GmxSdkType;
    private tokenAddresses: Record<string, string> = {
        'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        'WSOL': '0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07',
        'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    };
    private marketAddresses: Record<string, string> = {
        'ETH': '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',
        'SOL': '0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9',
        'BTC': '0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77',
    };
    // private marketInfos: Record<string, MarketInfo> = {};
    private tokensData!: TokensData;
    private marketsInfoData!: MarketsInfoData;

    constructor(privateKey: string) {
        const rpcUrl = process.env.ARB_RPC_URL;
        const account = privateKeyToAccount(privateKey);

        this.sdk = new GmxSdk({
            chainId: arbitrum.id,
            rpcUrl,
            oracleUrl: 'https://arbitrum-api.gmxinfra.io',
            subsquidUrl: 'https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql',
            publicClient: createPublicClient({
                chain: arbitrum,
                transport: http(rpcUrl),
                batch: BATCH_CONFIGS[arbitrum.id].client,
            }),
            walletClient: createWalletClient({
                account,
                chain: arbitrum,
                transport: http(rpcUrl, {
                    batch: BATCH_CONFIGS[arbitrum.id].http
                }),
            }),
        });

        this.sdk.setAccount(account.address);
    }

    async initialzeMarkets() {


        const { marketsInfoData, tokensData } = await this.sdk.markets.getMarketsInfo();
        if (!tokensData || !marketsInfoData) {
            console.error("Error fetching tokens data or markets info")
            return
        }
        this.marketsInfoData = marketsInfoData;
        this.tokensData = tokensData;
        // console.log(marketsInfoData)
        return

        // this.marketInfos = Object.fromEntries(
        //     Object.entries(marketsInfoData).map(([market, marketInfo]) => {
        //         return [market, marketInfo];
        //     })
        // );

    }

    _tokenForMarket(market: 'ETH' | 'BTC' | 'SOL'): string {
        switch (market) {
            case 'ETH':
                return this.tokenAddresses['WETH'];
            case 'BTC':
                return this.tokenAddresses['WBTC'];
            case 'SOL':
                return this.tokenAddresses['WSOL'];
            default:
                throw new Error(`Unknown market: ${market}`);
        }
    }

    async _ensureTokenBalanceAndAllowance(amount: bigint) {

        const balance = await this.sdk.publicClient.readContract({
            abi: erc20Abi,
            address: this.tokenAddresses['USDC'],
            functionName: "balanceOf",
            args: [this.sdk.walletClient.account!.address],
        });

        if (balance < amount) {
            console.error("Insufficient balance for USDC, needed:", (amount / 1_000_000n).toString(), "but got:", (balance / 1_000_000n).toString());
            return false;
        } else {
            console.log("Sufficient balance for USDC, needed: ", (amount / 1_000_000n).toString(), " got:", (balance / 1_000_000n).toString());
        }

        const allowance = await this.sdk.publicClient.readContract({
            abi: erc20Abi,
            address: this.tokenAddresses['USDC'],
            functionName: "allowance",
            args: [this.sdk.walletClient.account!.address, '0x602b805EedddBbD9ddff44A7dcBD46cb07849685'],
        });
        if (allowance >= amount) {
            return true;
        }
        else {
            console.log("Allowance insufficient. Allowence: ", (allowance / 1_000_000n).toString(), "Needed:", (amount / 1_000_000n).toString());
            const res = await this.sdk.walletClient.writeContract({
                abi: erc20Abi,
                address: this.tokenAddresses['USDC'],
                functionName: "approve",
                // args: ['0x602b805EedddBbD9ddff44A7dcBD46cb07849685', 2390872455461035n],
                args: ['0x602b805EedddBbD9ddff44A7dcBD46cb07849685', amount],
            })
            console.log(res)
            console.log("Increased allowance to", (amount / 1_000_000n).toString());
            return true
        }
    }

    async openPosition(market: 'ETH' | 'BTC' | 'SOL', side: 'long' | 'short', amount: number, leverage: number = 5) {


        await this._ensureTokenBalanceAndAllowance(BigInt(amount) * 10n ** 6n); // IN USDC

        if (!this.marketAddresses[market]) {
            console.error(`Market ${market} not initialized`);
            return;
        }
        console.log(this.marketAddresses[market], "Market address for", market);
        if (side == 'long') {
            console.log("Openning long")
            const res = await this.sdk.orders.long({
                payAmount: BigInt(amount) * 10n ** 6n, // IN USDC
                // marketAddress: '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',
                marketAddress: this.marketAddresses[market],
                payTokenAddress: this.tokenAddresses['USDC'],
                collateralTokenAddress: this.tokenAddresses['USDC'],
                allowedSlippageBps: 125,
                leverage: BigInt(leverage) * 10n ** 4n,
            });
            console.log(res)
        } else if (side == 'short') {
            const res = await this.sdk.orders.short({
                payAmount: BigInt(amount) * 10n ** 6n, // IN USDC
                // marketAddress: '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',
                marketAddress: this.marketAddresses[market],
                payTokenAddress: this.tokenAddresses['USDC'],
                collateralTokenAddress: this.tokenAddresses['USDC'],
                allowedSlippageBps: 125,
                leverage: BigInt(leverage) * 10n ** 4n,
            });
            console.log(res)
        } else {
            throw new Error(`Unknown side: ${side}`);
        }
    }


    async getPositions() {
        const openPositions = await this.sdk.positions.getPositionsInfo({
            marketsInfoData: this.marketsInfoData,
            tokensData: this.tokensData,
            showPnlInLeverage: true,
        });
        let positions: Record<string, any[]> = {}

        for (let position of Object.values(openPositions)) {
            const market = this.marketAddressToMarket(position.marketAddress);
            if (market) {
                if (!positions[market]) {
                    positions[market] = [];
                }
                // position.clo
                positions[market].push(position);
                // console.log(positions[market])
            }
        }

        return positions
    }

    async _closePosition(position: PositionInfo) {

        // const tx = await this.sdk.orders.createDecreaseOrder({
        //     marketInfo: position.marketInfo!,
        //     marketsInfoData: this.marketsInfoData,
        //     tokensData: this.tokensData,
        //     isLong: position.isLong,
        //     allowedSlippage: 125,
        //     collateralToken: this.tokensData['USDC'],
        //     decreaseAmounts: {
        //         isFullClose: true,
        //         sizeDeltaUsd: position.sizeInUsd,
        //         sizeDeltaInTokens: position.sizeInTokens,
        //         collateralDeltaUsd: position.collateralAmount,
        //         collateralDeltaAmount: position.collateralAmount,
        //
        //         // indexPrice: position.markPrice,
        //         // collateralPrice: position.price
        //         acceptablePrice: position.markPrice,
        //         positionFeeUsd: position.closingFeeUsd,
        //         // collateralDeltaAmount: position.collateralAmount,
        //     },
        // });
        // console.log(tx)
    }

    async closePosition(market: 'ETH' | 'BTC' | 'SOL') {
        const position: PositionInfo = (await this.getPositions())[market][0]
        // console.log("POSITION TO CLOSE")
        // console.log(position)

        // console.log("MARKET INFO")
        // console.log(this.marketInfos)

        // console.warn(this.marketsInfoData[this.marketAddresses[market]])

        const tx = await this.sdk.orders.createDecreaseOrder({
            marketInfo: this.marketsInfoData[this.marketAddresses[market]],
            marketsInfoData: this.marketsInfoData,
            tokensData: this.tokensData,
            isLong: position.isLong,
            allowedSlippage: 10000,
            decreaseAmounts: getDecreasePositionAmounts({
                marketInfo: this.marketsInfoData[this.marketAddresses[market]],
                collateralToken: this.tokensData[this.tokenAddresses['USDC']],
                isLong: position.isLong,
                position: position,
                closeSizeUsd: position.sizeInUsd,
                keepLeverage: true,
                // triggerPrice undefined,
                // fixedAcceptablePriceImpactBps: undefined,
                userReferralInfo: undefined,
                minCollateralUsd: 0n,
                minPositionSizeUsd: 0n,
                uiFeeFactor: 0n,
                isLimit: false,
                // limitPrice: undefined,
                // triggerOrderType: undefined,
                receiveToken: this.tokensData[this.tokenAddresses['USDC']],

            }),
            collateralToken: this.tokensData[this.tokenAddresses['USDC']],
            referralCode: undefined,
            isTrigger: false,
        });
    }


    marketAddressToMarket(marketAddress: string): 'ETH' | 'BTC' | 'SOL' | null {
        return Object.keys(this.marketAddresses).find(market => this.marketAddresses[market].toLowerCase() === marketAddress.toLowerCase()) as 'ETH' | 'BTC' | 'SOL' | null;

    }

    getSdk() {
        return this.sdk;
    }
}

