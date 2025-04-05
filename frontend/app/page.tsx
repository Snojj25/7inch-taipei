"use client";

import { useState, useId } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";

import { CardFooter } from "@/components/ui/card";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";

import { ethers } from "ethers";
import LoadingSpinner from "./components/LoadingSpinner";

const BACKEND_ROUTE = "http://localhost:5000/api/";

function generateRandom20ByteHex() {
  const bytes = new Uint8Array(20);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Home() {
  // AGENTS STATE
  const [expandedAgents, setExpandedAgents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [newAgent, setNewAgent] = useState({
    name: "",
    address: "",
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dialogId = useId();

  // * ========================================================
  // * ========================================================

  const toggleAgent = (agentId) => {
    setExpandedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const fetchAgents = async () => {
    const agents = ["claude", "gpt-3.5", "gemini-1.5-flash"].map((agent) => ({
      id: agent,
      model_id: agent,
      address: generateRandom20ByteHex(),
      icon: "/placeholder.svg?height=40&width=40",
      contributions: [],
      status: "idle",
    }));
    setAgents(agents);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageText = inputText.trim();
    setInputText("");
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, text: messageText, type: "user" },
    ]);

    // Handle transaction confirmation
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false);
      setPendingTransaction(null);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: "Transaction cancelled. How else can I help you?",
          type: "bot",
        },
      ]);
    } else {
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
          awaitingConfirmation: response.awaitingConfirmation ?? false,
        },
      ]);
    }

    setIsLoading(false);
  };

  const handleExecuteBridgePlan = async (plan) => {
    try {
      console.log("PLAN", plan);

      // Extract the source tokens and destination from the plan
      const { source_tokens, destination } = plan;

      console.log("SOURCE TOKENS", source_tokens);

      // Create an array of promises for parallel execution
      const transferPromises = source_tokens.map(async (sourceToken) => {
        // Create a new plan with single source token
        const singleTokenPlan = {
          message: {
            source_tokens: [sourceToken],
            destination: destination,
          },
        };

        console.log("SINGLE TOKEN PLAN", singleTokenPlan);

        const response = await fetch(BACKEND_ROUTE + "execute_bridge_plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(singleTokenPlan),
        });

        if (!response.ok) {
          console.log(
            `Network response was not ok for token ${sourceToken.token}`
          );
        }

        alert(
          "Successfully executed transfer for " +
            sourceToken.token +
            " from " +
            sourceToken.chain +
            " to " +
            destination.token +
            " on " +
            destination.chain
        );

        return response.json();
      });

      // Execute all transfers in parallel
      const responses = await Promise.all(transferPromises);

      console.log("RESPONSES", responses);

      // Combine all responses into a single response format
      const combinedResponse = {
        execution_status: responses.every((r) =>
          r.execution_status.includes("success")
        )
          ? "All transfers executed successfully"
          : "Some transfers failed",
        response: {
          source_tokens,
          destination,
        },
        order_hashes: responses.flatMap((r) => r.order_hashes || []),
        time_elapsed: responses.reduce(
          (sum, r) => sum + (r.time_elapsed || 0),
          0
        ),
      };

      console.log("COMBINED RESPONSES", combinedResponse);
      return combinedResponse;
    } catch (error) {
      console.error("Error:", error);
      return {
        execution_status: "Failed to execute transfers",
        response: {
          sources: [],
          destination: plan.destination,
        },
        order_hashes: [],
        time_elapsed: 0,
      };
    }
  };

  const handleConfirmTransaction = async () => {
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false); // TODO: UNCOMMENT THIS

      setAwaitingTransaction(true);
      const response = await handleExecuteBridgePlan(pendingTransaction);
      setAwaitingTransaction(false);

      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          text: formatBridgeExecutionResponse(response),
          type: "bot",
          timeElapsed: response.time_elapsed,
          confidence: response.confidence_score,
        },
      ]);
    }
  };

  function formatBridgeExecutionResponse(response) {
    if (!response || !response.execution_status || !response.response) {
      return "❌ Sorry, there was an error processing the bridge transaction.";
    }

    const {
      execution_status,
      response: bridgeDetails,
      order_hashes,
    } = response;
    const { sources, destination } = bridgeDetails;

    // Format source transactions
    const sourcesList = sources
      .map((source) => {
        const amount = source.float_amount
          ? `${source.float_amount.toLocaleString()} `
          : "";
        return `- ${amount}**${source.token}** from ${source.chain}`;
      })
      .join("\n");

    // Format destination
    const destAmount = destination.amount
      ? `${destination.amount.toLocaleString()} `
      : "";

    // // Format order hashes in small gray text using markdown
    // console.log("ORDER HASHES", order_hashes);
    // const hashesText = order_hashes?.length ? `${order_hashes.join(", ")}` : "";

    return `
# 🌉 Bridge Transaction ${execution_status.includes("success") ? "✅" : "❌"}

## 📤 Source Transfers
${sourcesList}

## 📥 Destination
Received **${destination.token}** on ${destination.chain}

---
*${execution_status}*
`;
  }

  function extractJsonFromMarkdown(markdownString) {
    // Regex to match content between ```json and ``` markers
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;

    const match = markdownString.match(jsonRegex);

    if (match && match[1]) {
      try {
        // Parse the extracted JSON string
        return JSON.parse(match[1]);
      } catch (error) {
        console.error("Failed to parse extracted JSON:", error);
        return null;
      }
    }

    console.error("No JSON code block found in the markdown");
    return null;
  }

  function formatBridgePlan(bridgePlan) {
    // Extract data from the bridge plan
    const sourceTokens = bridgePlan.source_tokens || [];
    const destination = bridgePlan.destination || {};

    // Create markdown for source tokens
    const sourceMarkdown = sourceTokens
      .map((source) => `\n- **${source.token}** on ${source.chain}`)
      .join("");

    // Create the full markdown message
    return `
# 🌉 Token Bridge Plan  

## 📤 Source  
Swapping from ${sourceMarkdown}

## 📥 Destination  
Swapping to **${destination.token}** on ${destination.chain}

---  
*Your tokens will be bridged according to this plan. The process may take a few minutes to complete.* `;
  }

  // Custom components for ReactMarkdown
  const MarkdownComponents = {
    // Override paragraph to remove default margins
    p: ({ children }) => <span className="inline">{children}</span>,
    // Style code blocks
    code: ({ node, inline, className, children, ...props }) =>
      inline ? (
        <code className="bg-gray-200 rounded px-1 py-0.5 text-sm">
          {children}
        </code>
      ) : (
        <pre className="bg-gray-200 rounded p-2 my-2 overflow-x-auto">
          <code {...props} className="text-sm">
            {children}
          </code>
        </pre>
      ),
    // Style links
    a: ({ node, children, ...props }) => (
      <a {...props} className="text-pink-600 hover:underline" target="_blank">
        {children}
      </a>
    ),
  };

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
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor={`name-${dialogId}`}
                        className="text-right"
                      >
                        Name
                      </Label>
                      <Input
                        id={`name-${dialogId}`}
                        value={newAgent.name}
                        onChange={(e) =>
                          setNewAgent({ ...newAgent, name: e.target.value })
                        }
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor={`address-${dialogId}`}
                        className="text-right"
                      >
                        Address
                      </Label>
                      <Input
                        id={`address-${dialogId}`}
                        value={newAgent.address}
                        onChange={(e) =>
                          setNewAgent({ ...newAgent, address: e.target.value })
                        }
                        className="col-span-3"
                      />
                    </div>
                  </div>
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
                {agents.map((agent) => (
                  <AccordionItem
                    key={agent.id}
                    value={`agent-${agent.id}`}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center p-3">
                      <Avatar className="mr-3">
                        <AvatarFallback>
                          <b>{agent.model_id.substring(0, 2)}</b>
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{agent.model_id}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {agent.address.slice(0, 7)}...
                          {agent.address.slice(-7)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end mr-2">
                        <Badge
                          variant={
                            agent.status === "active" ? "default" : "secondary"
                          }
                          className={`mb-1 ${
                            agent.status === "active"
                              ? "bg-[#e61f57] hover:bg-[#e61f57]/90"
                              : ""
                          }`}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                      <AccordionTrigger
                        onClick={() => toggleAgent(`agent-${agent.id}`)}
                        className="p-0 hover:no-underline"
                      >
                        <span className="sr-only">Toggle</span>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent className="pt-0">
                      <div className="border-t p-3">
                        <h4 className="text-sm font-semibold mb-2">
                          Contributions
                        </h4>
                        <div className="space-y-3">
                          {agent.contributions.length > 0 ? (
                            agent.contributions.map((contribution) => (
                              <div
                                key={contribution.id}
                                className="bg-muted rounded-md p-2"
                              >
                                <span className="text-xs text-muted-foreground mb-2">
                                  Iteration {contribution.iteration}
                                </span>
                                <p className="text-sm mb-1">
                                  {" "}
                                  {contribution.message}
                                </p>
                                <time
                                  className="text-xs text-muted-foreground mb-2"
                                  dateTime={contribution.timestamp}
                                >
                                  {new Intl.DateTimeFormat("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }).format(new Date(contribution.timestamp))}
                                </time>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No contributions yet
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
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
                          )}
                          {message.confidence && (
                            <span className="text-gray-500 inline">
                              | Consensus confidence:{" "}
                              {Number(message.confidence).toFixed(2)}
                            </span>
                          )}
                          {/* ============ CREATE ACCOUNT ============= */}
                          {/*{message.text.includes("Account created with") &&
                            awaitingCreateAccount && (
                              <div>
                                <Button
                                  variant="outline"
                                  className="mt-2"
                                  onClick={() => {
                                    sendCreateAccountTransaction();
                                  }}
                                >
                                  ✅ Create and fund account
                                </Button>
                                <br />
                              </div>
                            )}
                          {message.text.includes("Account created with") &&
                            awaitingCreateAccount && (
                              <>
                                {isLoadingCreateAccount}
                                {isLoadingCreateAccount && <LoadingSpinner />}
                              </>
                            )}
                              */}

                          {/* ============ END CREATE ACCOUNT ============= */}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <Avatar className="h-8 w-8">
                        {/* <AvatarImage src="/placeholder.svg?height=32&width=32" alt="System" /> */}
                        <AvatarFallback>
                          <b>S</b>
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-lg p-3 bg-muted">
                        <div className="flex space-x-2">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"></div>
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce delay-75"></div>
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce delay-150"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <form onSubmit={handleSubmit} className="flex w-full gap-2">
                <Input
                  placeholder="Ask about consensus learning..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-[#e61f57] hover:bg-[#e61f57]/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
