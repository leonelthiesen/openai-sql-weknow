import { type Request, type Response } from "express";
import { MetadataField, OpenAIResponseSchema } from "../constants";
import * as chatService from "../services/chat.service";
import * as openAiService from "../services/open-ai.service";
import * as weknowService from "../services/weknow.service";
import { transformLLMToComponentExecuteInput } from "../utils/llm-to-weknow-component-execute";
import type { LLMStructuredOutput } from "../models/llm-structured-output.models";
import type { ResponseInputItem } from "openai/resources/responses/responses";

interface FieldMetadata extends MetadataField {
  title?: string;
  formatOptions?: {
    options?: Array<{ value: any; text: string }>;
    [key: string]: any;
  };
  sampleData?: any[];
  [key: string]: any;
}

interface StartConversationBody {
  metadataId: number;
  userTextMessage: string;
  metadataFields: FieldMetadata[];
}

interface AddMessageBody {
  userTextMessage: string;
}

/**
 * Builds enriched field descriptions for the LLM prompt including titles, sample data, and enum options.
 * @param metadataFields - Array of field metadata objects
 * @returns Formatted field descriptions with sample data
 */
// const buildFieldDescriptions = (metadataFields: FieldMetadata[]): string => {
//   return metadataFields
//     .map((field) => {
//       let description = `${field.completeName}`;

//       // Add human-readable title if available
//       if (field.title) {
//         description += ` (${field.title})`;
//       }

//       // Prioritize formatOptions.options for enum fields (more complete)
//       if (field.formatOptions?.options && field.formatOptions.options.length > 0) {
//         const maxOptions = 5;
//         const optionSamples = field.formatOptions.options
//           .slice(0, maxOptions)
//           .map((opt) => `"${opt.value}"="${opt.text}"`)
//           .join(", ");
//         const moreText = field.formatOptions.options.length > maxOptions ? ", ..." : "";
//         description += ` [Options: ${optionSamples}${moreText}]`;
//       }
//       // Otherwise, use custom sampleData if provided
//       else if (field.sampleData && Array.isArray(field.sampleData) && field.sampleData.length > 0) {
//         const maxSamples = 5;
//         const samples = field.sampleData
//           .slice(0, maxSamples)
//           .map((val) => (typeof val === "string" ? `"${val}"` : val))
//           .join(", ");
//         const moreText = field.sampleData.length > maxSamples ? ", ..." : "";
//         description += ` [Examples: ${samples}${moreText}]`;
//       }

//       return description;
//     })
//     .join("\n");
// };

/**
 * Builds enriched field descriptions for the LLM prompt including titles, sample data, and enum options.
 * @param metadataFields - Array of field metadata objects
 * @returns Formatted field descriptions with sample data
 */
const buildFieldsJsonString = (metadataFields: FieldMetadata[]): string => {
  let outFields = metadataFields
    .map((field) => {
        let outField: any = {
            completeName: field.completeName,
            title: field.title,
        };

          // Prioritize formatOptions.options for enum fields (more complete)
      if (field.formatOptions?.options && field.formatOptions.options.length > 0) {
        const maxOptions = 5;
        outField.options = field.formatOptions.options.slice(0, maxOptions);
      }
      // Otherwise, use custom sampleData if provided
      else if (field.sampleData && Array.isArray(field.sampleData) && field.sampleData.length > 0) {
        const maxSamples = 5;
        outField.sampleData = field.sampleData.slice(0, maxSamples);
      }
      return outField;
    });
    return JSON.stringify(outFields, null, 2);
};


/**
 * Converts stored conversation messages into the proper OpenAI Responses API input format,
 * including function_call and function_call_output items for tool call history.
 */
function buildOpenAIInput(messages: chatService.Message[]): ResponseInputItem[] {
  const input: ResponseInputItem[] = [];

  for (const msg of messages) {
    if (msg.role === "user" || msg.role === "developer") {
      input.push({
        role: msg.role === "developer" ? "developer" : "user",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      } as ResponseInputItem);
    } else if (msg.role === "assistant") {
      if (msg.toolCall) {
        // Reasoning models require reasoning items to be passed back before the function_call
        if (msg.reasoningItems) {
          for (const item of msg.reasoningItems) {
            input.push(item as unknown as ResponseInputItem);
          }
        }
        // Replay the function call from the assistant
        input.push({
          type: "function_call",
          call_id: msg.toolCall.id,
          name: msg.toolCall.name,
          arguments: msg.toolCall.arguments,
        } as ResponseInputItem);
        // Provide a confirmation output (data is NOT returned to the LLM)
        input.push({
          type: "function_call_output",
          call_id: msg.toolCall.id,
          output: msg.toolCall.name === "execute_query"
            ? "Query executed successfully. Results rendered to the user."
            : "Message delivered to the user.",
        } as ResponseInputItem);
      } else {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        input.push({ role: "assistant", content } as ResponseInputItem);
      }
    }
  }

  return input;
}

function transformExecuteResult(data: any): chatService.ExecutionData {
  let dimensions: string[] = [];
  let source: (string | number | null)[][] = [];
  if (data && data.cols && data.rows) {
    dimensions = data.cols.map((col: any) => col.completeName);
    source = data.rows.map((row: any) => row.cells.map((cell: any) => cell.value));
  }
  return { dimensions, source };
}

export const startConversation = async (req: Request<{}, {}, StartConversationBody>, res: Response) => {
  try {
    const { metadataId, userTextMessage, metadataFields } = req.body;

    const fieldDescriptions = buildFieldsJsonString(metadataFields);

    const initialMessages: chatService.Message[] = [
      {
        role: "developer",
        content: `Os campos disponíveis para considerar na tabela virtual são: \n${fieldDescriptions}`,
      },
      {
        role: "user",
        content: userTextMessage,
      },
    ];

    const newConversation = chatService.createConversation(
      metadataId,
      metadataFields,
      initialMessages
    );

    const input = buildOpenAIInput(initialMessages);
    const { structuredOutput, toolCallId, toolCallName, toolCallArguments, reasoningItems } = await openAiService.createModelResponse(input);

    let executionData: chatService.ExecutionData | undefined;
    let errorResponse: string | Object | undefined;
    if (structuredOutput.action === "EXECUTE_QUERY") {
      let executeInput = transformLLMToComponentExecuteInput(structuredOutput as LLMStructuredOutput, metadataId);
      if (executeInput) {
        try {
          const accessToken = await weknowService.getAccessToken();
          executeInput.accessToken = accessToken;
          const executeResult = await weknowService.executeComponent(JSON.stringify(executeInput));
          console.log("Resultado da execução no Weknow:", executeResult);
          executionData = transformExecuteResult(executeResult);
        } catch (error: any) {
          errorResponse = error;
          console.error("Erro ao executar componente no Weknow:", error);
        }
      }
    }

    console.log("Execution error: ", errorResponse);

    const newBotMessage = chatService.createMessage(newConversation.id, {
      role: "assistant",
      content: structuredOutput,
      toolCall: {
        id: toolCallId,
        name: toolCallName,
        arguments: toolCallArguments,
      },
      reasoningItems,
      executionData,
      errorResponse,
    });

    return res.status(201).json({
      newConversation,
      newUserMessage: initialMessages[1],
      newBotMessage,
    });
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao iniciar conversa.", error: error.message });
  }
};

export const getConversations = async (_req: Request, res: Response) => {
  try {
    const conversations = chatService.getConversations();
    return res.json(conversations);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao buscar conversas.", error: error.message });
  }
};

export const getMessagesByConversationId = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const messages = chatService.getMessagesByConversationId(parseInt(id));
    return res.json(messages);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao buscar mensagens.", error: error.message });
  }
};

export const addUserMessageToConversation = async (
  req: Request<{ id: string }, {}, AddMessageBody>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { userTextMessage } = req.body;

    const conversation = chatService.getConversationById(parseInt(id));
    if (!conversation) {
      throw new Error("Conversa não encontrada.");
    }

    const newUserMessage = chatService.createMessage(parseInt(id), {
      role: "user",
      content: userTextMessage,
    });

    const messages = chatService.getMessagesByConversationId(parseInt(id));
    const input = buildOpenAIInput(messages);

    console.log("Input para LLM:", JSON.stringify(input, null, 2));

    const { structuredOutput, toolCallId, toolCallName, toolCallArguments, reasoningItems } =
      await openAiService.createModelResponse(input);

    let executionData: chatService.ExecutionData | undefined;
    let errorResponse: string | Object | undefined;
    if (structuredOutput.action === "EXECUTE_QUERY") {
      let executeInput = transformLLMToComponentExecuteInput(structuredOutput as LLMStructuredOutput, conversation.metadataId);
      console.log("Execute input para Weknow:", JSON.stringify(executeInput, null, 2));
      if (executeInput) {
        try {
          const accessToken = await weknowService.getAccessToken();
          executeInput.accessToken = accessToken;
          const executeResult = await weknowService.executeComponent(JSON.stringify(executeInput));
          executionData = transformExecuteResult(executeResult);
        } catch (error: any) {
          errorResponse = error;
          console.error("Erro ao executar componente no Weknow:", error);
        }
      }
    }

    const newBotMessage = chatService.createMessage(parseInt(id), {
      role: "assistant",
      content: structuredOutput,
      toolCall: {
        id: toolCallId,
        name: toolCallName,
        arguments: toolCallArguments,
      },
      reasoningItems,
      executionData,
      errorResponse
    });

    return res.status(201).json({ newUserMessage, newBotMessage });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: "Erro ao adicionar mensagem à conversa.", error: error.message });
  }
};

export const getAllFolders = async (_req: Request, res: Response) => {
  try {
    const folders = chatService.getAllFolders();
    return res.json(folders);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao buscar pastas.", error: error.message });
  }
};

export const createFolder = async (req: Request<{}, {}, { name: string }>, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Nome da pasta é obrigatório." });
    }
    const newFolder = chatService.createFolder(name.trim());
    return res.status(201).json(newFolder);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao criar pasta.", error: error.message });
  }
};

export const updateFolder = async (
  req: Request<{ id: string }, {}, { name: string }>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Nome da pasta é obrigatório." });
    }
    const updatedFolder = chatService.updateFolder(parseInt(id), name.trim());
    if (!updatedFolder) {
      return res.status(404).json({ message: "Pasta não encontrada." });
    }
    return res.json(updatedFolder);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao atualizar pasta.", error: error.message });
  }
};

export const deleteFolder = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const deleteConversations = req.query.deleteConversations === "true";

    const success = chatService.deleteFolder(parseInt(id), deleteConversations);
    if (!success) {
      return res.status(404).json({ message: "Pasta não encontrada." });
    }
    return res.json({ message: "Pasta excluída com sucesso." });
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao excluir pasta.", error: error.message });
  }
};

export const getConversationsByFolder = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const folderId = id === "null" ? null : parseInt(id);
    const conversations = chatService.getConversationsByFolder(folderId);
    return res.json(conversations);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao buscar conversas da pasta.", error: error.message });
  }
};

export const moveConversationToFolder = async (
  req: Request<{ id: string }, {}, { folderId: number | null }>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;

    const conversation = chatService.moveConversationToFolder(parseInt(id), folderId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversa não encontrada." });
    }
    return res.json(conversation);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao mover conversa.", error: error.message });
  }
};

export const searchConversations = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    const folderIdParam = req.query.folderId as string | undefined;

    let folderId: number | null | undefined = undefined;
    if (folderIdParam !== undefined) {
      folderId = folderIdParam === "null" ? null : parseInt(folderIdParam);
    }

    const results = chatService.searchConversations(query, folderId);
    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao buscar conversas.", error: error.message });
  }
};

export const updateMessage = async (
  req: Request<{ conversationId: string; messageId: string }, {}, { content: string | OpenAIResponseSchema }>,
  res: Response
) => {
  try {
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Conteúdo da mensagem é obrigatório." });
    }

    const updatedMessage = chatService.updateMessage(
      parseInt(conversationId),
      parseInt(messageId),
      content
    );

    if (!updatedMessage) {
      return res.status(404).json({ message: "Conversa ou mensagem não encontrada." });
    }

    return res.json(updatedMessage);
  } catch (error: any) {
    return res.status(500).json({ message: "Erro ao atualizar mensagem.", error: error.message });
  }
};

