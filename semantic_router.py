from typing import Final
from utils import OpenRouterClient, ConversationHistory
from oneinchapi import fetch_balances

SEMANTIC_ROUTER: Final = """
Carefully analyze the user's input and classify it into ONLY ONE of the following categories. Choose the most precise and relevant category based on the intent expressed.

Available Categories (ranked by priority):

1. FIND_BALANCES
   • Trigger words: find, my tokens, my balances, my funds, where do I have, etc.
   • Indicates the user wants to know the balances of their tokens on different chains

2. TOKEN_BRIDGE_PLAN  
   • Keywords: consolidate, move, swap, gather, bridge, combine, plan  
   • Applies when user wants to move multiple tokens (but not all!) to a single chain/token  
   • User must specify source chains and tokens and destination chain and token
   • Identifies intent to create a multi-step consolidation plan

3. REQUEST_ATTESTATION
   • Keywords: verify, attestation, proof, secure enclave
   • Applies to intent to verify data or perform trust validation

4. CONVERSATIONAL (default fallback)
   • Used when the user's intent is unclear, casual, or doesn't map cleanly to any category
   • Includes greetings, general questions, or unclear commands

User Input: ${user_input}

Instructions:
- Pick only one matching category
- Select the most accurate and narrow category
- Ignore greetings or fluff in the sentence
- If ambiguous, default to CONVERSATIONAL
- The valid chains are: "Arbitrum", "Optimism", "Base", "Linea", fix any typos or case sensitivity
- The valid tokens are: "ETH", and "USDC", fix any typos or case sensitivity
"""


FOLLOW_UP_TOKEN_SWAP: Final = """
   Please provide the following information in your next response: ["amount", "from_token", "to_token"]
"""


TOKEN_BRIDGE_PLAN: Final = """  
Extract information about specific tokens to bridge from the user's input:  

1. SOURCE TOKENS (Required)  
   Format: List of tokens with their chains  
   • Must identify at least one token and its chain  
   • Valid chains: "Arbitrum", "Optimism", "Base", "ZK Sync"  
   • Valid tokens: "ETH", "USDC", "USDT", etc.  
   • Extract from phrases like:  
     - "my ETH on Optimism"  
     - "USDC from Arbitrum"  
     - "ETH and USDT on Base"
     - "USDC and ETH tokens on ZK Sync"  
   • FAIL if no valid source token+chain pair found  

2. DESTINATION TOKEN (Required)  
   Format: Single token with its chain  
   • Must identify one token and its chain  
   • Same validation rules as source tokens  
   • Extract from phrases like:  
     - "to USDC on Base"  
     - "into ETH on Arbitrum"  
     - "bridge to ETH on Optimism"  
     - "bridge to USDT on ZK Sync"  
   • FAIL if no valid destination token+chain pair found  

Input: ${user_input}  

Response format:  
{  
  "source_tokens": [  
    {"token": "<TOKEN_SYMBOL>", "chain": "<CHAIN_NAME>"},  
    ...  
  ],  
  "destination": {"token": "<TOKEN_SYMBOL>", "chain": "<CHAIN_NAME>"}  
}  

Processing rules:  
- At least one source token and one destination must be present
- DO NOT infer missing required values  
- FAIL if any required information is missing or invalid  

Examples:  
✓ "Bridge my ETH on Ethereum to USDC on Base" → {"source_tokens": [{"token": "ETH", "chain": "Ethereum"}], "destination": {"token": "USDC", "chain": "Base"}}  
✓ "Move USDC from Arbitrum and ETH from Optimism to USDT on Zk Sync" → {"source_tokens": [{"token": "USDC", "chain": "Arbitrum"}, {"token": "ETH", "chain": "Optimism"}], "destination": {"token": "USDT", "chain": "Zk Sync"}}  
✓ "Bridge my ETH and USDC from Optimism to ETH on Arbitrum" → {"source_tokens": [{"token": "ETH", "chain": "Optimism"}, {"token": "USDC", "chain": "Optimism"}], "destination": {"token": "ETH", "chain": "Arbitrum"}}  
✗ "Bridge my tokens" → FAIL (missing specific tokens and chains)  
"""  


CONVERSATIONAL: Final = """
I'm 7inch, a conversational AI assistant.

What I bring:
- Expertise in 1Inch native features like the Fusinon and Fusion+ APIs
- A friendly, helpful demeanor combined with technical clarity
- Support for smart contract developers, users, and blockchain explorers

When answering:
1. I address the specific question at hand
2. I provide accurate, clear info based on 1Inch's capabilities
3. I maintain a helpful and conversational tone
4. I clearly state when I don't know something

<input>
${user_input}
</input>
"""

FIND_BALANCES: Final = """
Format the token balances in a clear, readable markdown format.

Input format:
{
  "chainName": [
    {"tokenName": "<TOKEN_SYMBOL>", "balance": <float_value>},
    ...
  ],
  ...
}

Display rules:
1. Group balances by chain
2. Sort chains alphabetically
3. Sort tokens within each chain alphabetically
4. Format large numbers with appropriate decimal places
5. Use markdown formatting for better readability
6. Include a total value summary if possible for each token

Output format:
# Token Balances

## Chain Name
- Token Name: Balance
- Token Name: Balance
...

## Chain Name
- Token Name: Balance
- Token Name: Balance
...

Example input:
{
  "Ethereum": [
    {"tokenName": "ETH", "balance": 1.5},
    {"tokenName": "USDC", "balance": 1000.0}
  ],
  "Arbitrum": [
    {"tokenName": "ETH", "balance": 0.5},
    {"tokenName": "USDT", "balance": 500.0}
  ]
}

Example output:
# Token Balances

## Arbitrum
- ETH: 0.5
- USDT: 500.0

## Ethereum
- ETH: 1.5
- USDC: 1,000.0

Total Value: 2.0 ETH, 1500.0 USDC
"""


class SemanticRouter:
    def __init__(self, model: OpenRouterClient):
        self.model = model

    def route_request(self, user_message):
        history = ConversationHistory()
        history.add_system_message(SEMANTIC_ROUTER)

        history.add_user_message(user_message)

        response = self.model.send_message(history.get_history())

        clean_route = response.strip() 
        return clean_route
    
    def get_route_response(self, user_message, semantic_category, wallet_address):
        user_message = str(user_message)

        history = ConversationHistory()

        if semantic_category == "SWAP_TOKEN":
            system_prompt = TOKEN_SWAP
        elif semantic_category == "TOKEN_BRIDGE_PLAN":
            system_prompt = TOKEN_BRIDGE_PLAN
        elif semantic_category == "FIND_BALANCES":
            system_prompt = FIND_BALANCES
            
            balances_info = fetch_balances(wallet_address)

            return balances_info, system_prompt
            # user_message = f"{balances_info}"
            # print("Balances info: ", balances_info)

            # system_prompt = FIND_BALANCES
        elif semantic_category == "CONVERSATIONAL":
            system_prompt = CONVERSATIONAL
        else:
            print("Default fallback")
            system_prompt = CONVERSATIONAL  # Default fallback

        history.add_system_message(system_prompt)
        history.add_user_message(user_message)
        response = self.model.send_message(history.get_history())
        return response, system_prompt
         


