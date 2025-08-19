require('dotenv').config();
const { BATCH_CONFIGS } = require("@gmx-io/sdk/configs/batch");

// --- Runtime imports using CommonJS ---
const { GmxSdk } = require('@gmx-io/sdk');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arbitrum } = require('viem/chains');

// --- Type imports using ESM (for TS type hints) ---
import type { GmxSdk as GmxSdkType } from '@gmx-io/sdk';
import { BigNumber } from 'ethers';
import type { WalletClient, PublicClient } from 'viem';

export class GMX {
    private sdk: GmxSdkType;
    private tokens: Record<string, string> = {
        'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        'WSOL': '0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07',
        'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    };
    private markets: Record<string, string> = {};

    constructor() {
        const rpcUrl = process.env.ARB_RPC_URL;
        const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

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

        console.log(Object.keys(marketsInfoData).length, "Markets found");

        for (let market of Object.keys(marketsInfoData)) {
            const marketInfo = marketsInfoData[market];
            if (marketInfo.longToken.address.toLowerCase() === this.tokens['WETH'].toLowerCase() &&
                marketInfo.shortToken.address.toLowerCase() === this.tokens['USDC'].toLowerCase()) {
                this.markets['ETH'] = market
            } else if (marketInfo.longToken.address.toLowerCase() === this.tokens['WBTC'].toLowerCase() &&
                marketInfo.shortToken.address.toLowerCase() === this.tokens['USDC'].toLowerCase()) {
                this.markets['BTC'] = market
            } else if (marketInfo.longToken.address.toLowerCase() === this.tokens['WSOL'].toLowerCase() &&
                marketInfo.shortToken.address.toLowerCase() === this.tokens['USDC'].toLowerCase()) {
                this.markets['SOL'] = market
            }
        }

        console.log("Markets", this.markets);
    }

    _tokenForMarket(market: 'ETH' | 'BTC' | 'SOL'): string {
        switch (market) {
            case 'ETH':
                return this.tokens['WETH'];
            case 'BTC':
                return this.tokens['WBTC'];
            case 'SOL':
                return this.tokens['WSOL'];
            default:
                throw new Error(`Unknown market: ${market}`);
        }
    }

    async order(market: 'ETH' | 'BTC' | 'SOL', side: 'long' | 'short', amount: number, slippageBps = 100, leverage: number = 5) {
        if (!this.markets[market]) {
            console.error(`Market ${market} not initialized`);
            return;
        }
        if (side == 'long') {
            const res = await this.sdk.orders.long({
                payAmount: BigInt(amount) * 10n ** 6n, // IN USDC
                marketAddress: this.markets[market],
                payTokenAddress: this._tokenForMarket(market),
                collateralTokenAddress: this.tokens['USDC'],
                allowedSlippageBps: slippageBps,
                leverage: BigInt(leverage),
            });
            console.log(res)
        } else if (side == 'short') {
            const res = await this.sdk.orders.short({
                sizeAmount: BigInt(amount) * 10n ** 6n, // IN USDC
                marketAddress: this.markets[market],
                payTokenAddress: this._tokenForMarket(market),
                collateralTokenAddress: this.tokens['USDC'],
                allowedSlippageBps: slippageBps,
                leverage: BigInt(leverage),
            });
            console.log(res)
        } else {
            throw new Error(`Unknown side: ${side}`);
        }
    }

    getSdk() {
        return this.sdk;
    }
}

async function main() {
    const gmx = new GMX();
    await gmx.initialzeMarkets();
    await gmx.order('ETH', 'long', 1, 100, 5); // Example order: Long 1000 USDC worth of ETH with 5x leverage
}

main()

