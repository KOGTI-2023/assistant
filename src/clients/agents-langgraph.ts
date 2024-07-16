import { HumanMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { assistantTools, researchTools, talkerTools } from "./tools-openrouter";
import { AgentStateChannels, createAgent } from "./graph";

export async function createResearchAgentNode(llm: any) {
  const researcherAgent = await createAgent(
    llm,
    researchTools,
    `You are a web researcher. You may use the Search tool to find information on the web, the Wikipedia tool to find information on Wikipedia, or the web browser tool to browse a website.`
  );
  const researcherNode = async (
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
  return researcherNode;
}

export async function createAssistantAgentNode(llm: any) {
  const assistantAgent = await createAgent(
    llm,
    assistantTools,
    `You are an assistant. You may use the calendar tool to create or view events on Google Calendar, the DallE tool to generate images, or the Calculator tool to perform calculations.`
  );
  const assistantNode = async (
    state: AgentStateChannels,
    config?: RunnableConfig
  ) => {
    const result = await assistantAgent.invoke(state, config);
    return {
      messages: [
        new HumanMessage({ content: result.output, name: "Assistant" }),
      ],
    };
  };
  return assistantNode;
}

export async function createTalkerAgentNode(llm: any) {
  const talkerAgent = await createAgent(
    llm,
    talkerTools,
    `You are the main talker, you are the one who will be talking to the user in a straightforward manner.`
  );
  const talkerNode = async (
    state: AgentStateChannels,
    config?: RunnableConfig
  ) => {
    const result = await talkerAgent.invoke(state, config);
    return {
      messages: [new HumanMessage({ content: result.output, name: "Talker" })],
    };
  };
  return talkerNode;
}
