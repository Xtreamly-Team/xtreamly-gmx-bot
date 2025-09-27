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
import logger from './logger';


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

    // These two will be populated in initializeMarkets
    private tokensData!: TokensData;
    private marketsInfoData!: MarketsInfoData;

    constructor(privateKey: string) {
        const rpcUrl = process.env.ARB_RPC_URL;
        const fixedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
        const account = privateKeyToAccount(fixedPrivateKey);

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
            logger.error("Error fetching tokens data or markets info");
            return
        }
        this.marketsInfoData = marketsInfoData;
        this.tokensData = tokensData;

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
            address: this.tokenAddresses['USDC'] as `0x${string}`,
            functionName: "balanceOf",
            args: [this.sdk.walletClient.account!.address],
        });

        if (balance < amount) {
            logger.error(`Insufficient balance for USDC, needed: ${(amount / 1_000_000n).toString()} but got: ${(balance / 1_000_000n).toString()}`);
            return false;
        } else {
            logger.info(`Sufficient balance for USDC, needed: ${(amount / 1_000_000n).toString()} got: ${(balance / 1_000_000n).toString()}`);
        }

        const allowance = await this.sdk.publicClient.readContract({
            abi: erc20Abi,
            address: this.tokenAddresses['USDC'] as `0x${string}`,
            functionName: "allowance",
            args: [this.sdk.walletClient.account!.address, '0x602b805EedddBbD9ddff44A7dcBD46cb07849685'],
        });
        if (allowance >= amount) {
            return true;
        }
        else {
            logger.info(`Allowance insufficient. Allowance: ${(allowance / 1_000_000n).toString()} Needed: ${(amount / 1_000_000n).toString()}`);
            const res = await this.sdk.walletClient.writeContract({
                abi: erc20Abi,
                address: this.tokenAddresses['USDC'] as `0x${string}`,
                functionName: "approve",
                // args: ['0x602b805EedddBbD9ddff44A7dcBD46cb07849685', 2390872455461035n],
                args: ['0x602b805EedddBbD9ddff44A7dcBD46cb07849685', amount],
                account: this.sdk.walletClient.account || null,
                chain: null,
            })
            logger.info(res);
            logger.info(`Increased allowance to ${(amount / 1_000_000n).toString()}`);
            return true
        }
    }

    async openPosition(market: 'ETH' | 'BTC' | 'SOL', side: 'long' | 'short', amount: number, leverage: number = 5, baseToken: string = 'USDC') {


        await this._ensureTokenBalanceAndAllowance(BigInt(amount) * 10n ** 6n); // IN USDC

        const payAmount = Math.floor(amount / leverage);

        if (!this.marketAddresses[market]) {
            logger.error(`Market ${market} not initialized`);
            return;
        }
        logger.info(`${this.marketAddresses[market]} Market address for ${market}`);
        if (side == 'long') {
            logger.info("Opening long");
            const res = await this.sdk.orders.long({
                payAmount: BigInt(payAmount) * 10n ** 6n, // IN USDC
                marketAddress: this.marketAddresses[market],
                payTokenAddress: this.tokenAddresses[baseToken],
                collateralTokenAddress: this.tokenAddresses[baseToken],
                allowedSlippageBps: 125,
                leverage: BigInt(leverage) * 10n ** 4n,
            });
            return res
        } else if (side == 'short') {
            const res = await this.sdk.orders.short({
                payAmount: BigInt(payAmount) * 10n ** 6n, // IN USDC
                marketAddress: this.marketAddresses[market],
                payTokenAddress: this.tokenAddresses[baseToken],
                collateralTokenAddress: this.tokenAddresses[baseToken],
                allowedSlippageBps: 125,
                leverage: BigInt(leverage) * 10n ** 4n,
            });
            return res
        } else {
            throw new Error(`Unknown side: ${side}`);
        }
    }


    async getOpenPositions() {
        const openPositions = await this.sdk.positions.getPositionsInfo({
            marketsInfoData: this.marketsInfoData,
            tokensData: this.tokensData,
            showPnlInLeverage: true,
        });
        let positions: Record<string, PositionInfo[]> = {}

        for (let position of Object.values(openPositions)) {
            const market = this.marketAddressToMarket(position.marketAddress);
            if (market) {
                if (!positions[market]) {
                    positions[market] = [];
                }
                positions[market].push(position);
            }
        }

        return positions
    }

    async _closePosition(position: PositionInfo, baseToken: 'USDC', allowedSlippageBps: number = 10000) {
        const tx = await this.sdk.orders.createDecreaseOrder({
            marketInfo: position.marketInfo!,
            marketsInfoData: this.marketsInfoData,
            tokensData: this.tokensData,
            isLong: position.isLong,
            allowedSlippage: allowedSlippageBps,
            decreaseAmounts: getDecreasePositionAmounts({
                marketInfo: position.marketInfo!,
                collateralToken: this.tokensData[this.tokenAddresses[baseToken]],
                isLong: position.isLong,
                position: position,
                closeSizeUsd: position.sizeInUsd,
                keepLeverage: true,
                userReferralInfo: undefined,
                minCollateralUsd: 0n,
                minPositionSizeUsd: 0n,
                uiFeeFactor: 0n,
                isLimit: false,
                receiveToken: this.tokensData[this.tokenAddresses[baseToken]],

            }),
            collateralToken: this.tokensData[this.tokenAddresses[baseToken]],
            referralCode: undefined,
            isTrigger: false,
        });
    }

    async closePosition(market: 'ETH' | 'BTC' | 'SOL', allowedSlippageBps: number = 10000) {
        const marketPositions = await this.getOpenPositions();
        if (!marketPositions[market] || marketPositions[market].length == 0) {
            logger.warn(`No open positions for market ${market} to close`);
            return;
        }
        if (marketPositions[market].length > 1) {
            logger.warn(`Multiple open positions for market ${market}, closing the first one`);
        }
        const position: PositionInfo = marketPositions[market][0];
        await this._closePosition(position, 'USDC', allowedSlippageBps)
    }


    marketAddressToMarket(marketAddress: string): 'ETH' | 'BTC' | 'SOL' | null {
        return Object.keys(this.marketAddresses).find(market => this.marketAddresses[market].toLowerCase() === marketAddress.toLowerCase()) as 'ETH' | 'BTC' | 'SOL' | null;

    }

    getSdk() {
        return this.sdk;
    }
}

