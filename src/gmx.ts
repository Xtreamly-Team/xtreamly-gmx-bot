const { BATCH_CONFIGS } = require("@gmx-io/sdk/configs/batch");

// --- Runtime imports using CommonJS ---
const { GmxSdk } = require('@gmx-io/sdk');
const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arbitrum } = require('viem/chains');

// --- Type imports using ESM (for TS type hints) ---
import type { GmxSdk as GmxSdkType } from '@gmx-io/sdk';
import { MarketsInfoData } from '@gmx-io/sdk/build/types/src/types/markets';
import { TokensData } from '@gmx-io/sdk/build/types/src/types/tokens';
import { BigNumber } from 'ethers';
import type { WalletClient, PublicClient } from 'viem';

import { erc20Abi } from "viem";


export class GMX {
    private sdk: GmxSdkType;
    private tokens: Record<string, string> = {
        'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        'WSOL': '0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07',
        'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    };
    private markets: Record<string, string> = {
        'ETH': '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',
        'SOL': '0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9',
        'BTC': '0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77',
    };
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

        // console.log(this.marketsInfoData)
        // 0x0e46941F9bfF8d0784BFfa3d0D7883CDb82D7aE7
        // 0x9e79146b3A022Af44E0708c6794F03Ef798381A5
        // 0x450bb6774Dd8a756274E0ab4107953259d2ac541
        // 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336

        console.log(Object.keys(marketsInfoData).length, "Markets found");

        // TODO: Refresh market addresses based on returned data

        // for (let market of Object.keys(marketsInfoData)) {
        //     const marketInfo = marketsInfoData[market];
        //     if (marketInfo.longToken.address.toLowerCase() === this.tokens['WETH'].toLowerCase() &&
        //         marketInfo.shortToken.address.toLowerCase() === this.tokens['USDC'].toLowerCase()) {
        //         this.markets['ETH'] = market
        //     } else if (marketInfo.longToken.address.toLowerCase() === this.tokens['WBTC'].toLowerCase() &&
        //         marketInfo.shortToken.address.toLowerCase() === this.tokens['USDC'].toLowerCase()) {
        //         this.markets['BTC'] = market
        //     } else if (marketInfo.longToken.address.toLowerCase() === this.tokens['WSOL'].toLowerCase() &&
        //         marketInfo.shortToken.address.toLowerCase() === this.tokens['USDC'].toLowerCase()) {
        //         this.markets['SOL'] = market
        //     }
        // }

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

    async getPositions() {
        const openPositions = await this.sdk.positions.getPositionsInfo({
            marketsInfoData: this.marketsInfoData,
            tokensData: this.tokensData,
            showPnlInLeverage: true,
        });
        return openPositions;
    }

    async getPosition() {
        const openPositions = await this.sdk.positions.getPositionsInfo({
            marketsInfoData: this.marketsInfoData,
            tokensData: this.tokensData,
            showPnlInLeverage: true,
        });
        return openPositions;
    }

    async order(market: 'ETH' | 'BTC' | 'SOL', side: 'long' | 'short', amount: number, slippageBps = 100, leverage: number = 5) {

        // const balance = await this.sdk.publicClient.readContract({
        //     abi: erc20Abi,
        //     address: this.tokens['WETH'],
        //     functionName: "balanceOf",
        //     args: [this.sdk.walletClient.account!.address],
        // });
        //
        // console.log("Balance:", balance.toString());

        // const allowance = await this.sdk.publicClient.readContract({
        //     abi: erc20Abi,
        //     address: this.tokens['USDC'],
        //     functionName: "allowance",
        //     args: [this.sdk.walletClient.account!.address, '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336'],
        // });
        // console.log("Allowance:", allowance.toString());


        // this.sdk.walletClient.writeContract({
        //     abi: erc20Abi,
        //     address: this.tokens['USDC'],
        //     functionName: "approve",
        //     // args: ['0x602b805EedddBbD9ddff44A7dcBD46cb07849685', 2390872455461035n],
        //     args: ['0x70d95587d40A2caf56bd97485aB3Eec10Bee6336', 1000000000],
        // }).then((res) => {
        //     console.log("Approve res", res);
        // }).catch((err) => {
        //     console.error("Approve error", err);
        // });
        // return


        if (!this.markets[market]) {
            console.error(`Market ${market} not initialized`);
            return;
        }
        console.log(this.markets[market], "Market address for", market);
        if (side == 'long') {
            console.log("Openning long")
            const res = await this.sdk.orders.long({
                // payAmount: 1000n,
                // sizeAmount: 10n ** 15n, // IN USDC
                payAmount: 100000n,
                marketAddress: this.markets[market],
                // marketAddress: '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',

                // marketAddress: '0x0e46941F9bfF8d0784BFfa3d0D7883CDb82D7aE7',
                // marketAddress: '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',

                payTokenAddress: this._tokenForMarket(market),
                // payTokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
                // payTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                collateralTokenAddress: this.tokens['USDC'],
                // collateralTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',

                allowedSlippageBps: 1000,
                leverage: BigInt(leverage) * 10n ** 4n,
                // leverage: 1000000n,
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

