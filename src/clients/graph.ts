import { BaseMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { Runnable } from "@langchain/core/runnables";
import { END, StateGraphArgs } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { START, StateGraph } from "@langchain/langgraph";
import { assistantNode, researcherNode, talkerNode } from "./agents-langgraph";
import { members, supervisorChain } from "./agent-supervisor";

export interface AgentStateChannels {
  messages: BaseMessage[];
  // The agent node that last performed work
  next: string;
}

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
});

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
  llm: ChatOpenAI,
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

// 1. Create the graph
const workflow = new StateGraph<AgentStateChannels, unknown, string>({
  channels: agentStateChannels,
}) // 2. Add the nodes; these will do the work
  .addNode("researcher", researcherNode)
  .addNode("assistant", assistantNode)
  .addNode("supervisor", supervisorChain)
  .addNode("talker", talkerNode);
// 3. Define the edges. We will define both regular and conditional ones
// After a worker completes, report to supervisor
members.forEach((member) => {
  workflow.addEdge(member, "supervisor");
});

workflow.addConditionalEdges("supervisor", (x: AgentStateChannels) => x.next);

workflow.addEdge(START, "supervisor");

export const graph = workflow.compile();
