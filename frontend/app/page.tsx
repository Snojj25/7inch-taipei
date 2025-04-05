"use client";

import { useState, useId } from "react";
import { useEffect, useRef } from "react";

import { ethers } from "ethers";
import LoadingSpinner from "./components/LoadingSpinner";

const BACKEND_ROUTE = "http://localhost:5000/api/";



export default function Home() {
 
  // * ========================================================
  // * ========================================================

  // CHAT STATE
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi, I'm 7Inch! 👋 I'm your Copilot for automating complex defi tasks. Powered by 1Inch and consensus learning. \n\n⚠️",
      type: "bot",
      timeElapsed: "0.0",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const messagesEndRef = useRef(null);


  const handleSendMessage = async (text: any) => {
    try {
      const response = await fetch(BACKEND_ROUTE + "chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();

      console.log("RESPONSES", data);

      return data;
    } catch (error) {
      console.error("Error:", error);
      return "Sorry, there was an error processing your request. Please try again.";
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageText = inputText.trim();
    setInputText("");
    setIsLoading(true);

    // Handle transaction confirmation
  
      const response = await handleSendMessage(messageText);
      console.log("RESPONSE", response);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: response.response,
          type: "bot",
          timeElapsed: response.time_elapsed,
          confidence: response.confidence_score,
        },
      ]);

    setIsLoading(false);
  };


  

  const [error, setError] = useState(null);

  return (
    <main className="container mx-auto p-4 min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Consensus Learning Agents
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        <div className="lg:col-span-5">
          
        </div>
        <div className="lg:col-span-7">
        
        </div>
      </div>
    </main>
  );
}
