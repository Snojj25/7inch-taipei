from flask import Flask, request, jsonify

from semantic_router import SemanticRouter  
from utils import models
import json
import os
from dotenv import load_dotenv  
from consensus import consensus_engine
from oneinchapi import fetch_balances
import requests

load_dotenv() 

# Initialize Flask app  
app = Flask(__name__)  

semantic_router = SemanticRouter(models["gemini-1.5-flash"])


# Home route  
@app.route('/', methods=['GET'])  
def home():  
    return jsonify({"message": "Welcome to the Demo API!"})  

# POST new item  
@app.route('/api/chat', methods=['POST'])  
def chat():
    req_data = request.json  
    print(req_data)

    wallet_address = os.environ.get("ADDRESS")  

    # Simple validation  
    if not req_data or not "message" in req_data:  
        return jsonify({"error": "Invalid request data"}), 400  
    
    route_category = semantic_router.route_request(req_data["message"])
    print("Route category: ", route_category)

    response, system_prompt = semantic_router.get_route_response(req_data["message"], route_category, wallet_address)
    print("Response: ", response)

    # if route_category == "TOKEN_BRIDGE_PLAN":
    #     aggregated_responses, model_outputs_by_round = consensus_engine.handle_user_input(req_data["message"], system_prompt)
    #     print("Aggregated responses: ", aggregated_responses)
    #     print("Model outputs by round: ", model_outputs_by_round)

    aggregated_responses = None
    model_outputs_by_round = None

    # items.append(new_item)  
    return jsonify({"route": route_category, 
                    "response": response, 
                    "aggregated_responses": aggregated_responses, 
                    "model_outputs_by_round": model_outputs_by_round}), 201  

# POST new item  
@app.route('/api/execute_bridge_plan', methods=['POST'])  
def execute_bridge_plan():
    req_data = request.json  
    print(req_data)

    wallet_address = os.environ.get("ADDRESS")  
    balances_info = fetch_balances(wallet_address)

    print("Balances info: ", balances_info)

    # Simple validation  
    if not req_data or not "message" in req_data:  
        return jsonify({"error": "Invalid request data"}), 400  

    print("Request data: ", req_data)
    print("source_tokens: ", req_data["message"]["source_tokens"])

    bridge_plan = req_data["message"]

    print("Bridge plan: ", bridge_plan)
    
    # Process source tokens with balances
    enriched_sources = []
    for source in bridge_plan["source_tokens"]:
        chain_balances = balances_info.get(source["chain"], [])
        for balance in chain_balances:
            if balance["tokenName"] == source["token"]:
                enriched_sources.append({
                    "token": source["token"],
                    "chain": source["chain"],
                    "amount": balance["scaledBalance"]
                })
                break
    
    # Process destination token (no balance needed as it's the target)
    destination = {
        "token": bridge_plan["destination"]["token"],
        "chain": bridge_plan["destination"]["chain"],
        "amount": None  # Target amount will be determined by the bridge/swap
    }
    
    enriched_plan = {
        "sources": enriched_sources,
        "destination": destination
    }

    print("Enriched bridge plan: ", enriched_plan)
    
    # Call the Node.js server endpoint
    try:
        nodejs_response = requests.post(
            'http://localhost:4000/api/execute_plan',
            json=enriched_plan,
            headers={'Content-Type': 'application/json'}
        )
        nodejs_response.raise_for_status()  # Raise an exception for bad status codes
        
        return jsonify({
            "response": enriched_plan,
            "execution_status": nodejs_response.json()["message"]
        }), 201
    except requests.exceptions.RequestException as e:
        return jsonify({
            "error": "Failed to execute bridge plan",
            "details": str(e)
        }), 500

# Enable CORS for demo purposes  
@app.after_request  
def add_cors_headers(response):  
    response.headers.add('Access-Control-Allow-Origin', '*')  
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')  
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')  
    return response  

# Run the server in debug mode if executed directly  
if __name__ == '__main__':  
    app.run(debug=True)  