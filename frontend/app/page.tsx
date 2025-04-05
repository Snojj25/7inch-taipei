"use client";

import { useState, useId } from "react";
import { useEffect, useRef } from "react";

import { ethers } from "ethers";
import LoadingSpinner from "./components/LoadingSpinner";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Accordion } from "@radix-ui/react-accordion";

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
  const [awaitingTransaction, setAwaitingTransaction] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const messagesEndRef = useRef(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (text) => {
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

      if (data.model_outputs_by_round) {
        setAgents((prevAgents) =>
          prevAgents.map((agent) => ({
            ...agent,

            status: "active",

            contributions: [
              ...agent.contributions,
              {
                id: prevAgents.length + 1,
                iteration: 0,
                message: data.model_outputs_by_round[0][agent.model_id],
                timestamp: new Date().toISOString(),
              },
              {
                id: prevAgents.length + 2,
                iteration: 1,
                message: data.model_outputs_by_round[1][agent.model_id],
                timestamp: new Date().toISOString(),
              },
              // {
              //   id: prevAgents.length + 3,
              //   iteration: 2,
              //   message: JSON.parse(data.model_outputs_by_round)[2][agent.model_id],
              //   timestamp: new Date().toISOString(),
              // },
              // {
              //   id: prevAgents.length + 4,
              //   message: "ITERATION 3: (based on consensus) " + JSON.parse(data.response_data).iteration_3[agent.model_id],
              //   timestamp: new Date().toISOString()
              // }
            ],
          }))
        );
      }

      if (data.route == "TOKEN_BRIDGE_PLAN") {
        const bridgePlan = extractJsonFromMarkdown(data.response);

        const formattedBridgePlan = formatBridgePlan(bridgePlan);

        console.log("BRIDGE PLAN", bridgePlan);
        setAwaitingConfirmation(true);
        setPendingTransaction(bridgePlan);

        return {
          response: formattedBridgePlan,
          awaitingConfirmation: true,
        };
      }

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

  const handleExecuteBridgePlan = async (plan) => {
    try {
      const response = await fetch(BACKEND_ROUTE + "execute_bridge_plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: plan,
        }),
      });

      console.log("RESPONSE 2222:", response);

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
  

  const [error, setError] = useState(null);

  return (
    <main className="container mx-auto p-4 min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Consensus Learning Agents
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        <div className="lg:col-span-5">
        <Card className="h-[calc(100vh-150px)] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contributing Agents</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  {/* <Button className="bg-[#e61f57] hover:bg-[#e61f57]/90">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Model
                  </Button> */}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Model</DialogTitle>
                  </DialogHeader>
                
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    {/* <Button
                      className="bg-[#e61f57] hover:bg-[#e61f57]/90"
                      onClick={handleAddAgent}
                    >
                      Add Agent
                    </Button> */}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Accordion
                type="multiple"
                value={expandedAgents}
                className="space-y-4"
              >
              </Accordion>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-7">
        <div className="lg:col-span-7">
          <Card className="h-[calc(100vh-150px)] flex flex-col">
            <CardHeader>
              <CardTitle>Consensus Learning Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Start a conversation with the consensus learning system
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.type === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex gap-3 max-w-[80%] ${
                          message.type === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="h-8 w-8">
                          {message.type === "user" ? (
                            <>
                              {/* <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" /> */}
                              <AvatarFallback>
                                <b>U</b>
                              </AvatarFallback>
                            </>
                          ) : (
                            <>
                              {/* <AvatarImage src="/placeholder.svg?height=32&width=32" alt="System" /> */}
                              <AvatarFallback>
                                <b>S</b>
                              </AvatarFallback>
                            </>
                          )}
                        </Avatar>
                        <div
                          className={`rounded-lg p-3 ${
                            message.type === "user"
                              ? "bg-[#e61f57] text-white"
                              : "bg-muted"
                          }`}
                        >
                          <ReactMarkdown
                            components={MarkdownComponents}
                            className="text-md break-words whitespace-pre-wrap"
                          >
                            {message.text}
                          </ReactMarkdown>
                          {/* ============ CONFIRM TRANSACTION ============= */}
                          {message.type === "bot" &&
                            message.awaitingConfirmation && (
                              <>
                                {awaitingTransaction ? (
                                  <div>
                                    <LoadingSpinner />
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() => handleConfirmTransaction()}
                                    disabled={!awaitingConfirmation}
                                  >
                                    ✅ Confirm transaction
                                  </Button>
                                )}
                                <br />
                              </>
                            )}
                          {/* {message.text} */}
                          {message.timeElapsed && (
                            <span className="text-gray-500 inline">
                              Time elapsed:{" "}
                              {Number(message.timeElapsed).toFixed(2)}s{" "}
                            </span>
                          )}</div>
                      </div>
                    </div>
                  ))
                )}
                
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </main>
  );
}
