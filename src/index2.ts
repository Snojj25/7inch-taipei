import {
  HashLock,
  NetworkEnum,
  OrderStatus,
  PresetEnum,
  PrivateKeyProviderConnector,
  QuoteParams,
  SDK,
} from "@1inch/cross-chain-sdk";
import Web3 from "web3";
import { randomBytes } from "node:crypto";

import "dotenv/config";
import { ethers } from "ethers";

const privateKey = process.env.PRIVATE_KEY!;
const rpc = process.env.RPC_URL_OP!;
const authKey = process.env.ONEINCH_API_KEY!;
const source = process.env.SOURCE_APP_NAME!;
const makerAddress = process.env.ADDRESS!;

console.log("privateKey: ", privateKey);
console.log("rpc: ", rpc);
console.log("authKey: ", authKey);
console.log("source: ", source);
console.log("makerAddress: ", makerAddress);

const web3: any = new Web3(rpc);
const walletAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address;

const sdk = new SDK({
  url: "https://api.1inch.dev/fusion-plus",
  authKey,
  blockchainProvider: new PrivateKeyProviderConnector(privateKey, web3), // only required for order creation
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const amount = ethers.parseEther("0.0005");
  const params: QuoteParams = {
    srcChainId: NetworkEnum.OPTIMISM,
    dstChainId: NetworkEnum.ARBITRUM,
    srcTokenAddress: "0x4200000000000000000000000000000000000006", // WETH on OP
    dstTokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on ARB
    amount: amount.toString(),
    enableEstimate: true,
    walletAddress: makerAddress,
  };

  const quote = await sdk.getQuote(params);

  const preset = PresetEnum.fast;

  // generate secrets
  const secrets = Array.from({
    length: quote.presets[preset].secretsCount,
  }).map(() => "0x" + randomBytes(32).toString("hex"));

  const hashLock =
    secrets.length === 1
      ? HashLock.forSingleFill(secrets[0])
      : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets));

  const secretHashes = secrets.map((s) => HashLock.hashSecret(s));

  // create order
  const { hash, quoteId, order } = await sdk.createOrder(quote, {
    walletAddress,
    hashLock,
    preset,
    source,
    secretHashes,
  });
  console.log({ hash }, "order created");

  // submit order
  const _orderInfo = await sdk.submitOrder(
    quote.srcChainId,
    order,
    quoteId,
    secretHashes
  );

  console.log({ hash }, "order submitted");

  // submit secrets for deployed escrows
  while (true) {
    const secretsToShare = await sdk.getReadyToAcceptSecretFills(hash);

    if (secretsToShare.fills.length) {
      for (const { idx } of secretsToShare.fills) {
        await sdk.submitSecret(hash, secrets[idx]);

        console.log({ idx }, "shared secret");
      }
    }

    // check if order finished
    const { status } = await sdk.getOrderStatus(hash);

    if (
      status === OrderStatus.Executed ||
      status === OrderStatus.Expired ||
      status === OrderStatus.Refunded
    ) {
      break;
    }

    await sleep(1000);
  }

  const statusResponse = await sdk.getOrderStatus(hash);

  console.log(statusResponse);
}

main();
