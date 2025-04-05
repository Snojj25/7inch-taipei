import {
  SDK,
  NetworkEnum,
  QuoteParams,
  HashLock,
  PrivateKeyProviderConnector,
  Quote,
} from "@1inch/cross-chain-sdk";

import { ethers, solidityPackedKeccak256 } from "ethers";

import "dotenv/config";

const oneinchUrl = "https://api.1inch.dev/fusion-plus";
const oneinchApiKey = process.env.ONEINCH_API_KEY!;
const makerPrivateKey = process.env.PRIVATE_KEY!;
const makerAddress = process.env.ADDRESS!;

const opNodeUrl = process.env.RPC_URL_OP!;
const arbNodeUrl = process.env.RPC_URL_ARB!;

const source = process.env.SOURCE_APP_NAME!;

console.log("oneinchApiKey: ", oneinchApiKey);
console.log("makerPrivateKey: ", makerPrivateKey);
console.log("makerAddress: ", makerAddress);
console.log("opNodeUrl: ", opNodeUrl);
console.log("arbNodeUrl: ", arbNodeUrl);

// throw new Error("test");

async function GetQuote(sdk: SDK, chain: "OP" | "ARB", _amount?: number) {
  if (chain === "OP") {
    return _GetQuote1(sdk, _amount);
  } else {
    return _GetQuote2(sdk, _amount);
  }
}

/**
 * GetQuote1
 * @description Quote for Swap ETH on OP to USDC on ARB
 */
async function _GetQuote1(sdk: SDK, _amount?: number) {
  const amount = ethers.parseEther(_amount?.toString() || "0.0005");

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
  return quote;
}

/**
 * GetQuote2
 * @description Quote for Swap USDC on ARB to ETH on OP
 */
async function _GetQuote2(sdk: SDK, _amount?: number) {
  const amount = ethers.parseUnits(_amount?.toString() || "0.5", 6);

  const params: QuoteParams = {
    srcChainId: NetworkEnum.ARBITRUM,
    dstChainId: NetworkEnum.OPTIMISM,
    srcTokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on ARB
    dstTokenAddress: "0x4200000000000000000000000000000000000006", // WETH on OP
    amount: amount.toString(),
    enableEstimate: true,
    walletAddress: makerAddress,
  };

  const quote = await sdk.getQuote(params);
  return quote;
}

async function placeSwapOrder(chain: "OP" | "ARB", _amount?: number) {
  const rpcProvider: any = new ethers.JsonRpcProvider(
    chain === "OP" ? opNodeUrl : arbNodeUrl
  );

  const blockchainProvider = new PrivateKeyProviderConnector(
    makerPrivateKey,
    rpcProvider
  );

  const sdk = new SDK({
    url: oneinchUrl,
    authKey: oneinchApiKey,
    blockchainProvider,
  });

  const quote = await GetQuote(sdk, chain, _amount);

  const { hashLock, secretHashes } = getHLAndSecretHashes(quote);

  console.log("Placing order", quote);
  const order = await sdk.placeOrder(quote, {
    walletAddress: makerAddress,
    hashLock,
    secretHashes,
    // fee is an optional field
    fee: {
      takingFeeBps: 100, // 1% as we use bps format, 1% is equal to 100bps
      takingFeeReceiver: "0x0000000000000000000000000000000000000000", //  fee receiver address
    },
  });

  return order;
}

function getHLAndSecretHashes(quote: Quote) {
  const secretsCount = quote.getPreset().secretsCount;

  const secrets = Array.from({ length: secretsCount }).map(() =>
    getRandomBytes32()
  );
  const secretHashes = secrets.map((x) => HashLock.hashSecret(x));

  const hashLock =
    secretsCount === 1
      ? HashLock.forSingleFill(secrets[0])
      : HashLock.forMultipleFills(
          secretHashes.map((secretHash, i) =>
            solidityPackedKeccak256(
              ["uint64", "bytes32"],
              [i, secretHash.toString()]
            )
          ) as (string & {
            _tag: "MerkleLeaf";
          })[]
        );

  return { hashLock, secretHashes };
}

function getRandomBytes32(): string {
  // Generate 32 random bytes and convert to hex string
  return ethers.hexlify(ethers.randomBytes(32));
}

async function main() {
  // const orders = await sdk.getActiveOrders({ page: 1, limit: 2 });
  // console.log(orders);
  //   const address = process.env.ADDRESS!;
  //   const makerOrders = await sdk.getOrdersByMaker({
  //     page: 1,
  //     limit: 2,
  //     address,
  //   });
  // console.log(makerOrders);
  // const quote = await GetQuote2(sdk);
  // console.log(quote);

  const order = await placeSwapOrder("ARB");
  console.log(order);
}

main();
