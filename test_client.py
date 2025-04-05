import requests  
import json  

# Base URL of your Flask server - change if needed  
BASE_URL = "http://127.0.0.1:5000"  

def print_response(response): 
    """Print response details in a readable format"""  
    print("\n----- Response -----")  
    print(f"Status Code: {response.status_code}")  
    print("Headers:", response.headers)  
    try:  
        print("Body:", json.dumps(response.json(), indent=2))  
    except ValueError:  
        print("Body:", response.text)  
    print("-------------------\n")  

def get_welcome():  
    """Test the welcome endpoint"""  
    print("Testing welcome endpoint...")  
    response = requests.get(f"{BASE_URL}/")  
    print_response(response)  

# def get_all_items():  
#     """Get all items"""  
#     print("Getting all items...")  
#     response = requests.get(f"{BASE_URL}/api/items")  
#     print_response(response)  
    
#     # Return items for potential reuse  
#     try:  
#         return response.json().get('items', [])  
#     except ValueError:  
#         return []  



def create_new_item():  
    """Create a new item"""  
    message1 = "Can you help me find my balances"
    message2 = "Bridge my ETH and USDC from Optimism to USDT on Zk Sync"
    
    new_item = {  
        "message": message1
    }  
    
    response = requests.post(  
        f"{BASE_URL}/api/chat",  
        json=new_item,  
        headers={"Content-Type": "application/json"}  
    )  
    print_response(response)  



def main():  
    """Main function to run the test client"""  
    print("Simple API Test Client")  
    print(f"Testing server at: {BASE_URL}")  
    

    # get_welcome()
    create_new_item()



if __name__ == "__main__":  
    main()  