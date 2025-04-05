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


/**
 * GetQuote1
 * @description Quote for Swap ETH on OP to USDC on ARB
 */
async function GetQuote(sdk: SDK, _amount?: number) {
  const amount = ethers.parseEther(_amount?.toString() || "0.0005");

  const params: QuoteParams = {
    srcChainId: NetworkEnum.OPTIMISM,
    dstChainId: NetworkEnum.ARBITRUM,
    srcTokenAddress: "0x4200000000000000000000000000000000000006", // WETH on OP
    dstTokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on ARB
    amount: amount.toString(),
    enableEstimate: false,
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
  return ethers.hexlify(ethers.randomBytes(32));
}

async function main() {
  const order = await placeSwapOrder("ARB");
  console.log(order);
}

main();
