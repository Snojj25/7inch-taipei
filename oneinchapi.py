import requests  
import os  
from dotenv import load_dotenv  

# Load environment variables from .env file  
load_dotenv()  

def get_token_balances(wallet_address, chain_id):  
    # Get API key from environment variables  
    api_key = os.getenv('ONEINCH_API_KEY')  
    
    endpoint = f'https://api.1inch.dev/balance/v1.2/{chain_id}/balances/{wallet_address}'
    response = requests.get(endpoint, headers={'Authorization': f'Bearer {api_key}'})  

    if response.status_code == 200:  
        return response.json()  
    else:  
        print(f"Failed to fetch token balances. Error code: {response.status_code}")  
        return None  

CHAINS = [{"name": "Optimism", "chainId": 10}, 
          {"name": "Base", "chainId": 8453}, 
          {"name": "Arbitrum", "chainId": 42161}, 
          {"name": "ZK Sync", "chainId": 324},
          {"name": "Ethereum", "chainId": 1}]

TOKENS_DECIMALS = {
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": 18.0,
    "0x4200000000000000000000000000000000000006": 18.0,
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": 6.0,
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85": 6.0,
}

TOKENS_NAMES = {
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH", # AR and OP
    "0x4200000000000000000000000000000000000006": "WETH", # ARB and OP
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC", # ARB
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC", # OP
}




def fetch_balances(wallet_address):    
    chain_balances = {}
    for chain in CHAINS:
        token_balances = get_token_balances(wallet_address, chain["chainId"])  

        if token_balances:  

            balances = []
            for token, balance in token_balances.items():  
                
                token = token.lower()
                balance = float(balance)
                if balance > 0:
                    token_name = TOKENS_NAMES[token] if token in TOKENS_NAMES else token
                    balances.append({"tokenName": token_name, 
                                     "balance": balance / 10**TOKENS_DECIMALS[token], 
                                     "scaledBalance": balance})

            if balances:
                chain_balances[chain["name"]] = balances

        else:  
            print("Token balance fetch failed. Please check your wallet address.")  

    print(chain_balances)

    return chain_balances





""" if __name__ == '__main__':  
    fetch_balances()   """