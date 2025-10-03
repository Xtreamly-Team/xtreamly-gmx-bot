// import { GMX } from "./gmx.js";
// require("dotenv").config();
//
import { config } from "dotenv";
// import { GmxSdk } from "@gmx-io/sdk";
// import { createPublicClient, createWalletClient, http } from "viem";
// import { arbitrum } from "viem/chains";
// import { privateKeyToAccount } from "viem/accounts";
//
import { GMX } from "./gmx.js";


async function test() {
  config()
  const rpcUrl = process.env.ARB_RPC_URL;
  const privateKey = process.env.YIELD_TEST_PRIVKEY;
  const gmx = new GMX(privateKey)
  await gmx.initialzeMarkets()

  // await gmx.openPosition("SOL", 'short', 18, 3)
  // await new Promise(r => setTimeout(r, 10000));
  // const positions = await gmx.getOpenPositions()
  // console.log(positions)
  // await new Promise(r => setTimeout(r, 10000));
  await gmx.closePosition('SOL')


  // const fixedPrivateKey: `0x${string}` = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
  // const account = privateKeyToAccount(fixedPrivateKey);
  // const walletClient = createWalletClient({
  //   account,
  //   chain: arbitrum,
  //   transport: http(rpcUrl),
  // });
  //
  // const sdk = new GmxSdk({
  //   chainId: arbitrum.id,
  //   rpcUrl: "https://arb1.arbitrum.io/rpc",
  //   oracleUrl: "https://arbitrum-api.gmxinfra.io",
  //   subsquidUrl: "https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql",
  //   walletClient: walletClient,
  // });
  //
  // const { marketsInfoData, tokensData } = await sdk.markets.getMarketsInfo();
  // console.log(marketsInfoData)

}

test().catch((e) => {
  console.error(e);
})
