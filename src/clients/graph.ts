import { BaseMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { Runnable } from "@langchain/core/runnables";
import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import {
  DEFAULT_MODEL,
  MODEL_TEMPERATURE,
  OPENROUTER_API_KEY,
} from "../constants";
import { getLLMModel } from "../crud/conversation";
import { createSupervisorChain, members } from "./agent-supervisor";
import {
  createAssistantAgentNode,
  createResearchAgentNode,
  createTalkerAgentNode,
} from "./agents-langgraph";

export interface AgentStateChannels {
  messages: BaseMessage[];
  // The agent node that last performed work
  next: string;
}

// This defines the object that is passed between each node
// in the graph. We will create different nodes for each agent and tool
// @ts-ignore
const agentStateChannels: StateGraphArgs["channels"] = {
  messages: {
    value: (x?: BaseMessage[], y?: BaseMessage[]) => (x ?? []).concat(y ?? []),
    default: () => [],
  },
  next: {
    value: (x?: string, y?: string) => y ?? x ?? END,
    default: () => END,
  },
};

export async function createAgent(
  llm: any,
  tools: any[],
  systemPrompt: string
): Promise<Runnable> {
  // Each worker node will be given a name and some tools.
  const prompt = await ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("messages"),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
  const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools });
}

export async function createGraph(chat: string) {
  let llmModel = await getLLMModel(chat);

  if (!llmModel) {
    llmModel = DEFAULT_MODEL;
  }

  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    streaming: false,
    temperature: MODEL_TEMPERATURE,
  });

  const utilitiesLlm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: false,
    temperature: 0,
  });

  // 1. Create the graph
  const workflow = new StateGraph<AgentStateChannels, unknown, string>({
    channels: agentStateChannels,
  }) // 2. Add the nodes; these will do the work
    .addNode("researcher", await createResearchAgentNode(utilitiesLlm))
    .addNode("assistant", await createAssistantAgentNode(utilitiesLlm))
    .addNode("talker", await createTalkerAgentNode(utilitiesLlm))
    .addNode("supervisor", await createSupervisorChain(llm));

  // 3. Define the edges. We will define both regular and conditional ones
  // After a worker completes, report to supervisor
  members.forEach((member) => {
    workflow.addEdge(member, "supervisor");
  });

  workflow.addConditionalEdges("supervisor", (x: AgentStateChannels) => x.next);

  workflow.addEdge(START, "supervisor");

  return workflow.compile();
}
