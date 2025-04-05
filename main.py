from flask import Flask, request, jsonify

from semantic_router import SemanticRouter  
from utils import models
import json
import os
from dotenv import load_dotenv  
from consensus import consensus_engine
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

    if route_category == "TOKEN_BRIDGE_PLAN":
        aggregated_responses, model_outputs_by_round = consensus_engine.handle_user_input(req_data["message"], system_prompt)
        print("Aggregated responses: ", aggregated_responses)
        print("Model outputs by round: ", model_outputs_by_round)

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

    # Simple validation  
    if not req_data or not "message" in req_data:  
        return jsonify({"error": "Invalid request data"}), 400  


    print("Executing bridge plan: ", req_data["message"])
    
    
    # items.append(new_item)  
    return jsonify({"response": "Bridge plan executed"}), 201  

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