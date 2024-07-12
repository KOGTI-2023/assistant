import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { assistantTools, researchTools, talkerTools } from "./tools-openrouter";
import { AgentStateChannels, createAgent } from "./graph";

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0,
});

const researcherAgent = await createAgent(
  llm,
  researchTools,
  `You are a web researcher. You may use your tools to search the web for important information and provide useful insights.`
);

const assistantAgent = await createAgent(
  llm,
  assistantTools,
  `You are an assistant. You may use your tools to assist the human in their tasks, such as scheduling events or performing calculations.`
);

const talkerAgent = await createAgent(
  llm,
  talkerTools,
  `You are a talker. You may engage in conversation with the human in a friendly and helpful manner.`
);

export const researcherNode = async (
  state: AgentStateChannels,
  config?: RunnableConfig
) => {
  const result = await researcherAgent.invoke(state, config);
  return {
    messages: [
      new HumanMessage({ content: result.output, name: "Researcher" }),
    ],
  };
};

export const assistantNode = async (
  state: AgentStateChannels,
  config?: RunnableConfig
) => {
  const result = await assistantAgent.invoke(state, config);
  return {
    messages: [new HumanMessage({ content: result.output, name: "Assistant" })],
  };
};

export const talkerNode = async (
  state: AgentStateChannels,
  config?: RunnableConfig
) => {
  const result = await talkerAgent.invoke(state, config);
  return {
    messages: [new HumanMessage({ content: result.output, name: "Talker" })],
  };
};
