import requests

import os
from dotenv import load_dotenv  
load_dotenv() 




class ConversationHistory:
    def __init__(self):
        self.history = []

    def add_user_message(self, content: str):
        self.history.append({"role": "user", "content": content})

    def add_system_message(self, content: str):
        self.history.append({"role": "system", "content": content})

    def add_assistant_message(self, content: str):
        self.history.append({"role": "assistant", "content": content})

    def get_history(self):
        return self.history


class OpenRouterClient:
    def __init__(self, api_key: str, model: str = "openai/gpt-3.5-turbo", temperature: float = 0.1,
                 max_tokens: int = 200):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.temperature = temperature
        self.max_tokens = max_tokens

    def send_message(self, history: list):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://yourdomain.com",  # required by OpenRouter
            "X-Title": "OpenRouter Chat Integration"
        }

        payload = {
            "model": self.model,
            "messages": history,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        response = requests.post(self.api_url, headers=headers, json=payload)
        response.raise_for_status()

        data = response.json()
        return data.get("choices", [])[0].get("message", {}).get("content", "")



api_key = os.environ.get("OPEN_ROUTER_API_KEY")  
models = {
    "gemini-1.5-flash": OpenRouterClient(api_key, "google/gemini-flash-1.5-8b", temperature=0.1),
    "gpt-3.5": OpenRouterClient(api_key, "openai/gpt-3.5-turbo", temperature=0.5),
    "claude": OpenRouterClient(api_key, "anthropic/claude-3-opus-20240229", temperature=0.1),
}


