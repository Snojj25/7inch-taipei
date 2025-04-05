// use this when there is no `"type": "module"` in your package.json, i.e. you're using commonjs

const {
  SDK,
  HashLock,
  PrivateKeyProviderConnector,
  NetworkEnum,
} = require("@1inch/cross-chain-sdk");
const env = require("dotenv");
const process = env.config().parsed;

const { Web3 } = require("web3");
const {
  solidityPackedKeccak256,
  randomBytes,
  Contract,
  Wallet,
  JsonRpcProvider,
  ethers,
} = require("ethers");

// TODO write formal bug for this function being inaccessible
function getRandomBytes32() {
  // for some reason the cross-chain-sdk expects a leading 0x and can't handle a 32 byte long hex string
  return "0x" + Buffer.from(randomBytes(32)).toString("hex");
}

const makerPrivateKey = process?.WALLET_KEY;
const makerAddress = process?.WALLET_ADDRESS;

const arbNodeUrl = process?.RPC_URL_ARB;
const opNodeUrl = process?.RPC_URL_OP;
const baseNodeUrl = process?.BASE_RPC_URL;
const lineaNodeUrl = process?.RPC_URL_LINEA;

const devPortalApiKey = process?.DEV_PORTAL_KEY;

// Validate environment variables
if (
  !makerPrivateKey ||
  !makerAddress ||
  !arbNodeUrl ||
  !opNodeUrl ||
  !baseNodeUrl ||
  !lineaNodeUrl ||
  !devPortalApiKey
) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

function getSDKForNetwork(network) {
  let nodeUrl;
  switch (network) {
    case "Arbitrum":
      nodeUrl = arbNodeUrl;
      break;
    case "Optimism":
      nodeUrl = opNodeUrl;
      break;
    case "Base":
      nodeUrl = baseNodeUrl;
      break;
    case "Linea":
      nodeUrl = lineaNodeUrl;
      break;
    default:
      throw new Error("Unsupported network: " + network);
  }

  const web3Instance = new Web3(nodeUrl);
  const blockchainProvider = new PrivateKeyProviderConnector(
    makerPrivateKey,
    web3Instance
  );

  const sdk = new SDK({
    url: "https://api.1inch.dev/fusion-plus",
    authKey: devPortalApiKey,
    blockchainProvider,
  });

  return sdk;
}

function getNetworkEnumForChain(chain) {
  switch (chain) {
    case "Arbitrum":
      return NetworkEnum.ARBITRUM;
    case "Optimism":
      return NetworkEnum.OPTIMISM;
    case "Base":
      return NetworkEnum.COINBASE;
    case "Linea":
      return NetworkEnum.LINEA;
    default:
      throw new Error("Unsupported chain: " + chain);
  }
}

// TOKENS_NAMES = {
//     "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH",    // Native ETH on all chains
//     "0x4200000000000000000000000000000000000006": "WETH",   // WETH on ARB, OP, Base
//     "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f": "WETH",   // WETH on Linea
//     "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",   // USDC on ARB
//     "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC",   // USDC on OP
//     "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",   // USDC on Base
//     "0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "USDC"    // USDC on Linea
// }
function getTokenAddress(tokenName, chain) {
  if (tokenName == "ETH") {
    return "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  }

  if (tokenName == "WETH") {
    switch (chain) {
      case "Arbitrum":
      case "Optimism":
      case "Base":
        return "0x4200000000000000000000000000000000000006";
      case "Linea":
        return "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f";
      default:
        throw new Error("Unsupported chain for WETH: " + chain);
    }
  }

  if (tokenName == "USDC") {
    switch (chain) {
      case "Arbitrum":
        return "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
      case "Optimism":
        return "0x0b2c639c533813f4aa9d7837caf62653d097ff85";
      case "Base":
        return "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
      case "Linea":
        return "0x176211869ca2b568f2a7d4ee941e073a821ee1ff";
      default:
        throw new Error("Unsupported chain for USDC: " + chain);
    }
  }

  throw new Error("Unsupported token: " + tokenName);
}

async function executePlan(sources, destination) {
  let { token, chain } = destination;
  const dstTokenAddress = getTokenAddress(token, chain);
  const dstChainId = getNetworkEnumForChain(chain);

  const txhashes = [];

  const swapPromises = sources.map(async (source) => {
    let { token, chain, amount } = source;
    const srcTokenAddress = getTokenAddress(token, chain);
    // const srcAmount = token.includes("USDC")
    //   ? 50000n
    //   : ethers.parseEther(0.0004); // amount;
    const srcAmount = amount;

    const sdk = getSDKForNetwork(chain);
    let srcChainId = getNetworkEnumForChain(chain);

    await approveTokens(chain, srcTokenAddress);

    // console.log("Executing swap for source: ", source);
    // console.log("srcAmount: ", srcAmount);
    // console.log("srcTokenAddress: ", srcTokenAddress);
    // console.log("dstTokenAddress: ", dstTokenAddress);
    // console.log("dstChainId: ", dstChainId);
    // console.log("srcChainId: ", srcChainId);

    hash = await executeSwap(
      sdk,
      srcChainId,
      dstChainId,
      srcTokenAddress,
      dstTokenAddress,
      srcAmount
    );

    txhashes.push(hash);
    return hash;
  });

  await Promise.all(swapPromises).catch((error) => {
    // console.error("Error in executePlan:", error);
    // throw error;
    throw new Error("Error in executePlan");
  });

  return txhashes;
}

const approveABI = [
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

async function approveTokens(network, srcTokenAddress) {
  const AGGREGATION_ROUTER = "0x111111125421ca6dc452d289314280a0f8842a65"; // aggregation router v6

  let nodeUrl;
  switch (network) {
    case "Arbitrum":
      nodeUrl = arbNodeUrl;
      break;
    case "Optimism":
      nodeUrl = opNodeUrl;
      break;
    case "Base":
      nodeUrl = baseNodeUrl;
      break;
    case "Linea":
      nodeUrl = lineaNodeUrl;
      break;
    default:
      throw new Error("Unsupported network: " + network);
  }
  const provider = new JsonRpcProvider(nodeUrl);
  const wallet = new Wallet(makerPrivateKey, provider);
  const tkn = new Contract(srcTokenAddress, approveABI, wallet);

  // Check current allowance
  const currentAllowance = await tkn.allowance(
    makerAddress,
    AGGREGATION_ROUTER
  );

  // Only approve if allowance is zero
  if (currentAllowance == 0n) {
    await tkn.approve(
      AGGREGATION_ROUTER,
      2n ** 256n - 1n // unlimited allowance
    );
    console.log("Approved tokens for spending");
  } else {
    console.log("Token already has sufficient allowance");
  }
}

async function executeSwap(
  sdk,
  srcChainId,
  dstChainId,
  srcTokenAddress,
  dstTokenAddress,
  amount // 0.01 USDC
) {
  if (!amount || amount < 100000n) {
    amount = 100000n;
  }

  const invert = false;

  if (invert) {
    const temp = srcChainId;
    srcChainId = dstChainId;
    dstChainId = temp;

    const tempAddress = srcTokenAddress;
    srcTokenAddress = dstTokenAddress;
    dstTokenAddress = tempAddress;
  }

  const params = {
    srcChainId,
    dstChainId,
    srcTokenAddress,
    dstTokenAddress,
    amount: amount.toString(),
    enableEstimate: true,
    walletAddress: makerAddress,
  };

  try {
    const quote = await sdk.getQuote(params);

    const secretsCount = quote.getPreset().secretsCount;
    const secrets = Array.from({ length: secretsCount }).map(() =>
      getRandomBytes32()
    );
    const secretHashes = secrets.map((x) => HashLock.hashSecret(x));

    const hashLock =
      secretsCount == 1
        ? HashLock.forSingleFill(secrets[0])
        : HashLock.forMultipleFills(
            secretHashes.map((secretHash, i) =>
              solidityPackedKeccak256(
                ["uint64", "bytes32"],
                [i, secretHash.toString()]
              )
            )
          );

    const quoteResponse = await sdk.placeOrder(quote, {
      walletAddress: makerAddress,
      hashLock,
      secretHashes,
    });

    const orderHash = quoteResponse.orderHash;
    console.log(`Order successfully placed: ${orderHash}`);

    // Create a promise that resolves when the order is complete
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(async () => {
        try {
          console.log(
            `Polling for fills until order status is set to "executed"...`
          );

          const order = await sdk.getOrderStatus(orderHash);
          if (order.status == "executed") {
            console.log(`Order is complete. Exiting.`);
            clearInterval(intervalId);
            resolve(orderHash);
            return;
          }

          const fillsObject = await sdk.getReadyToAcceptSecretFills(orderHash);
          if (fillsObject.fills.length > 0) {
            for (const fill of fillsObject.fills) {
              try {
                await sdk.submitSecret(orderHash, secrets[fill.idx]);
                console.log(
                  `Fill order found! Secret submitted: ${JSON.stringify(
                    secretHashes[fill.idx],
                    null,
                    2
                  )}`
                );
              } catch (error) {
                console.error(
                  `Error submitting secret: ${JSON.stringify(error, null, 2)}`
                );
              }
            }
          }
        } catch (error) {
          if (error.response) {
            console.error("Error getting ready to accept secret fills:", {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data,
            });
          } else if (error.request) {
            console.error("No response received:", error.request);
          } else {
            console.error("Error", error.message);
          }
          // Don't reject here as we want to keep trying
        }
      }, 5000);
    });
  } catch (error) {
    console.error("Error in executeSwap:", error);
    throw error; // Re-throw to be handled by caller
  }
}

module.exports = {
  executePlan,
};
