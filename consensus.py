from typing import Dict

from utils import OpenRouterClient, ConversationHistory

import os
from dotenv import load_dotenv  
load_dotenv() 



class Aggregator:
    def __init__(self, api_key: str, model: str, system_message: str, temperature: float = 0.1, max_tokens: int = 200):
        self.aggregator = OpenRouterClient(api_key, model, temperature, max_tokens)
        self.aggregator_system_message = system_message

    def get_aggregated_message(self, user_message: str, model_outputs: Dict[str, str]) -> str:
        history = ConversationHistory()
        history.add_system_message(self.aggregator_system_message)
        model_outputs_str = "\n".join([f"{model}: {output}" for model, output in model_outputs.items()])
        messages = f"""
        Users message was {user_message}
        The responses from the models were {model_outputs_str}
        """
        history.add_user_message(messages)
        response = self.aggregator.send_message(history.get_history())
        print(f"Aggregated response: {response}\n")
        return response


class ConsensusEngine:
    def __init__(self, aggregator: Aggregator, improvement_prompt: str, model_system_prompts: Dict[str, str],
                 models: Dict[str, OpenRouterClient]):
        self.models = models
        self.model_histories = {k: ConversationHistory() for k in self.models.keys()}

        # Aggregator model
        self.aggregator = aggregator
        self.n_rounds = 1
        self.improvement_prompt = improvement_prompt

        for name, client in self.models.items():
            self.model_histories[name].add_system_message(model_system_prompts[name])

    def handle_user_input(self, user_input: str, system_prompt: str):
        aggregated_responses = {}
        model_outputs_by_round = {}
        for name in self.models.keys():
            self.model_histories[name].add_system_message(system_prompt)
            self.model_histories[name].add_user_message(user_input)

        for i in range(self.n_rounds + 1):
            model_outputs = {}
            for name, client in self.models.items():
                print(f"Sending to {name}...")
                model_outputs[name] = client.send_message(self.model_histories.get(name).get_history())
                self.model_histories[name].add_assistant_message(model_outputs[name])
            print("Asking aggregator model...")
            aggregated_response = self.aggregator.get_aggregated_message(user_input, model_outputs)

            for name, _ in self.models.items():
                self.model_histories[name].add_assistant_message(f"This is the aggregated response: {aggregated_response}")
                self.model_histories[name].add_user_message(self.improvement_prompt)

            aggregated_responses[i] = aggregated_response
            model_outputs_by_round[i] = model_outputs
        print("MODEL HISTORIES")
        for name, history in self.model_histories.items():
            print(f"{name}: {history.get_history()}")
            break
        return aggregated_responses, model_outputs_by_round # TODO: 


api_key = os.environ.get("OPEN_ROUTER_API_KEY")  
aggregator_prompt = "You have been provided with a set of responses from various open-source models to the latest user query. Your task is to synthesize these responses into a single, high-quality response. It is crucial to critically evaluate the information provided in these responses, recognizing that some of it may be biased or incorrect. Your response should not simply replicate the given answers but should offer a refined, accurate, and comprehensive reply to the instruction. Ensure your response is well-structured, coherent, and adheres to the highest standards of accuracy and reliability. Ensure that the length of your response is similar to that of the other responses."
improvement_prompt = "Based on the aggregated responses provided, refine your answer to the initial query by incorporating the most accurate market analysis, risk assessment, and profitability considerations. Ensure your response is well-structured, data-driven, and adheres strictly to the required JSON format. Your response should improve upon the aggregated insights by enhancing clarity, precision, and reasoning while avoiding redundancy or conflicting information. The response MUST be different from the aggregated responses - use the other responses provided and explain how you used them. In response reason JSON field also include, what changes from the other inputs influenced your decision"

models = {
    "gemini-1.5-flash": OpenRouterClient(api_key, "google/gemini-flash-1.5-8b", temperature=0.1),
    "gpt-3.5": OpenRouterClient(api_key, "openai/gpt-3.5-turbo", temperature=0.5),
    "claude": OpenRouterClient(api_key, "anthropic/claude-3-opus-20240229", temperature=0.1),
}


# Todo:  change these prompts
consensus_engine = ConsensusEngine(
    aggregator=Aggregator(api_key, "openai/gpt-4", system_message=aggregator_prompt),
    improvement_prompt=improvement_prompt,
    model_system_prompts={
        "gpt-3.5": "You are an AI model that provides financial advice. Your task is to analyze the user's query and provide a comprehensive response.",
        "claude": """You are an AI model that provides financial advice. Your task is to analyze the user's query and provide a comprehensive response.""",
        "gemini-1.5-flash": """You are an AI model that provides financial advice. Your task is to analyze the user's query and provide a comprehensive response."""
    },
    models=models
)

# user_input = "What's the best way to make money with FLR and USDC?"
# final_response = consensus_engine.handle_user_input(user_input)
# print(final_response)