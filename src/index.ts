import { GMX } from './gmx.js';
import { PerpLowVolStrategy } from './strategy.js';
import { Xtreamly } from './xtreamly.js';
require('dotenv').config();




async function main() {
    const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    console.log(privateKey)

    // const strategy = new PerpLowVolStrategy({
    //     walletPrivkey: privateKey,
    //     token: 'ETH',
    //     predictionHorizon: 240,
    //     baseAsset: 'USDC',
    //     basePositionSize: 0.0005,
    //     leverage: 3,
    //     keepStrategyHorizonMin: 240,
    // });
    // await strategy.initialize();

    // await strategy.close()
    const gmx = new GMX(privateKey);
    await gmx.initialzeMarkets();
    // await gmx.openPosition('SOL', 'short', 10, 5);
    const positions = await gmx.getPositions()
    const solPosition = positions['SOL'][0];
    // console.log(solPosition)
    await gmx._closePosition(solPosition)

}

main()

