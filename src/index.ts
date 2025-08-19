import { GMX } from './gmx.js';

async function main() {
    const gmx = new GMX();
    await gmx.initialzeMarkets();
    await gmx.order('ETH', 'long', 1, 100, 5); // Example order: Long 1000 USDC worth of ETH with 5x leverage
}

main()

