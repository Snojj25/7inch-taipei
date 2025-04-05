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

const devPortalApiKey = process?.DEV_PORTAL_KEY;

// Validate environment variables
if (
  !makerPrivateKey ||
  !makerAddress ||
  !arbNodeUrl ||
  !opNodeUrl ||
  !devPortalApiKey
) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

function getSDKForNetwork(network) {
  const nodeUrl = network == "Arbitrum" ? arbNodeUrl : opNodeUrl;
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
  return chain == "Arbitrum" ? NetworkEnum.ARBITRUM : NetworkEnum.OPTIMISM;
}

// TOKENS_NAMES = {
//     "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH", # AR and OP
//     "0x4200000000000000000000000000000000000006": "WETH", # ARB and OP
//     "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC", # ARB
//     "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC", # OP
// }
function getTokenAddress(tokenName, chain) {
  if (chain == "Arbitrum") {
    return tokenName == "WETH"
      ? "0x4200000000000000000000000000000000000006"
      : "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
  } else {
    return tokenName == "WETH"
      ? "0x4200000000000000000000000000000000000006"
      : "0x0b2c639c533813f4aa9d7837caf62653d097ff85";
  }
}

// let srcChainId = NetworkEnum.ARBITRUM;
// let dstChainId = NetworkEnum.OPTIMISM;
// let srcTokenAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
// let dstTokenAddress = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";

async function executePlan(sources, destination) {
  let { token, chain } = destination;
  const dstTokenAddress = getTokenAddress(token, chain);
  const dstChainId = getNetworkEnumForChain(chain);

  console.log("111111111111111111111");

  const txhashes = [];

  const swapPromises = sources.map(async (source) => {
    let { token, chain, amount } = source;
    const srcTokenAddress = getTokenAddress(token, chain);
    const srcAmount = 100000; // amount;

    console.log("222222222222222222222: ", srcAmount);

    const sdk = getSDKForNetwork(chain);
    let srcChainId = getNetworkEnumForChain(chain);

    console.log("approving tokens for source: ", srcTokenAddress);

    await approveTokens(chain, srcTokenAddress);
    console.log("Executing swap for source: ", source);

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

  await Promise.all(swapPromises);

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

  const nodeUrl = network == "Arbitrum" ? arbNodeUrl : opNodeUrl;
  console.log("nodeUrl: ", nodeUrl);
  const provider = new JsonRpcProvider(nodeUrl);
  const wallet = new Wallet(makerPrivateKey, provider);
  const tkn = new Contract(srcTokenAddress, approveABI, wallet);

  console.log("tkn: ", tkn);
  console.log("srcTokenAddress: ", srcTokenAddress);
  console.log("makerAddress: ", makerAddress, AGGREGATION_ROUTER);

  // Check current allowance
  const currentAllowance = await tkn.allowance(
    makerAddress,
    AGGREGATION_ROUTER
  );

  console.log("currentAllowance: ", currentAllowance);

  // Only approve if allowance is zero
  if (currentAllowance == 0n) {
    console.log("Current allowance is zero, approving tokens...");
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
  amount = 100000 // 0.01 USDC
) {
  if (amount < 100000) {
    amount = 100000;
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
    console.log("Received Fusion+ quote from 1inch API", quote.prices);

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

    console.log("Received Fusion+ quote from 1inch API");

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
