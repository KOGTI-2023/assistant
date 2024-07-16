import { HumanMessage } from "@langchain/core/messages";
import { Message } from "whatsapp-web.js";
import { createGraph } from "../../clients/graph";
import { BOT_PREFIX, TRANSCRIPTION_ENABLED } from "../../constants";
import { getChatFor } from "../../crud/chat";
import { handleAudioMessage } from "../audio-message";

export async function getCompletionWithOpenRouter(
  message: Message,
  context: string,
  streamingReply: Message
) {
  let tokenBuffer: string[] = ["..."];

  const chat = await message.getChat();
  const waChat = await getChatFor(chat.id._serialized);
  let imageBase64: string | undefined;
  /* const conversation = await getOpenRouterConversationFor(chat.id._serialized);
  const executor = await createExecutorForOpenRouter(
    context,
    chat.id._serialized
  ); */

  if (message.hasMedia) {
    const media = await message.downloadMedia();
    const mimetype = media.mimetype;

    const isImage = mimetype?.includes("image");
    const isAudio = mimetype?.includes("audio");

    if (isImage) imageBase64 = media.data;
    if (isAudio) {
      if (TRANSCRIPTION_ENABLED === "true") {
        message.body = await handleAudioMessage(media, message);
      } else {
        // Handle the case when transcription is not enabled
        message.reply(BOT_PREFIX + "Transcription not enabled");
        throw new Error("Transcription not enabled");
      }
    }
  }

  const graph = await createGraph(chat.id._serialized);

  let streamResults = graph.stream(
    {
      messages: [
        new HumanMessage({
          content: message.body,
        }),
      ],
    },
    { recursionLimit: 10, streamMode: "updates" }
  );

  let finalAnswer = "";

  for await (const output of await streamResults) {
    if (!output?.__end__) {
      console.dir(output, { depth: null });
      console.log("----");

      let txt = "";

      if (output.supervisor) {
        txt = `supervisor: ${output.supervisor.next}\n\n`;
      } else if (output.talker && output.talker.messages.length > 0) {
        txt = `${output.talker.messages[0].content}\n\n`;
        finalAnswer = txt;
      } else if (output.researcher && output.researcher.messages.length > 0) {
        txt = `${output.researcher.messages[0].content}\n\n`;
        finalAnswer = txt;
      } else if (output.asssistant && output.assistant.messages.length > 0) {
        txt = `${output.assistant.messages[0].content}\n\n`;
        finalAnswer = txt;
      }

      console.log("txt: ", txt);
      tokenBuffer.push(txt);
      const updatedMessage = tokenBuffer.join("");
      await streamingReply.edit(updatedMessage);
    }
  }

  /*  const response = await executor.invoke(
    {
      input: message.body,
      ASSISTANT_NAME: ASSISTANT_NAME,
      context: context,
    },
    {
      callbacks: [
        {
          async handleLLMNewToken(token: string) {
            if (STREAM_RESPONSES !== "true") return;

            // Buffer the token
            tokenBuffer.push(token);

            // Update streamingReply with buffered tokens
            const updatedMessage = tokenBuffer.join("");

            // Edit the streamingReply with the updated message
            await streamingReply.edit(updatedMessage);
          },
        },
      ],
    }
  );

  if (!waChat) await createChat(chat.id._serialized); // Creates the chat if it doesn't exist yet

  if (OPENROUTER_MEMORY_TYPE === "summary") {
    let currentSummaryRaw = await executor.memory?.loadMemoryVariables({});
    let currentSummary = currentSummaryRaw?.chat_history;

    let currentSummaryArray = currentSummary.map((message: any) => {
      return {
        [message.constructor.name]: message.content,
      };
    });

    if (DEBUG_SUMMARY === "true") {
      console.log("Current summary: ", currentSummaryArray);
    }

    if (conversation) {
      await updateOpenRouterConversation(
        chat.id._serialized,
        JSON.stringify(currentSummaryArray)
      ); // Updates the conversation
    } else {
      await createOpenRouterConversation(
        chat.id._serialized,
        JSON.stringify(currentSummaryArray)
      ); // Creates the conversation
    }
  } else {
    let chatHistoryRaw = await executor.memory?.loadMemoryVariables({});
    let chatHistory: any[] = chatHistoryRaw?.chat_history;

    let chatHistoryArray = chatHistory.map((message) => {
      return {
        [message.constructor.name]: message.content,
      };
    });

    if (conversation) {
      await updateOpenRouterConversation(
        chat.id._serialized,
        JSON.stringify(chatHistoryArray)
      ); // Updates the conversation
    } else {
      await createOpenRouterConversation(
        chat.id._serialized,
        JSON.stringify(chatHistoryArray)
      ); // Creates the conversation
    }
  }*/
  /* console.log("response: ", response);
  return response.output; */

  return finalAnswer;
}
