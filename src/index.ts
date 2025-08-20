import { GMX } from './gmx.js';
import { PerpLowVolStrategy } from './strategy.js';
import { Xtreamly } from './xtreamly.js';
require('dotenv').config();




async function main() {
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    console.log(privateKey)

    const strategy = new PerpLowVolStrategy({
        walletPrivkey: privateKey,
        token: 'ETH',
        predictionHorizon: 240,
        baseAsset: 'USDC',
        basePositionSize: 0.0005,
        leverage: 3,
        keepStrategyHorizonMin: 240,
    });
    await strategy.initialize();

    await strategy.close()
    // const gmx = new GMX(privateKey);
    // await gmx.initialzeMarkets();
    // await gmx.order('ETH', 'long', 1, 100, 5);


}

main()

