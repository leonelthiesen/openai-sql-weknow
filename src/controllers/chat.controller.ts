import { type Request, type Response } from "express";
import { MetadataField } from "../constants";
import * as chatService from "../services/chat.service";
import * as openAiService from "../services/open-ai.service";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { logger } from "../utils/logger";

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

type NonReasoningOpenAiItem = chatService.OpenAiItem & {
  type: "message" | "function_call" | "function_call_output";
};

function isNonReasoningOpenAiItem(
  item: chatService.OpenAiItem
): item is NonReasoningOpenAiItem {
  return item.type !== "reasoning";
}

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
 * Converts stored AppMessages into the proper OpenAI Responses API input format.
 * Iterates over all AppMessages and flatMaps their openAiItems into ResponseInputItems.
 */
function buildOpenAIInput(messages: chatService.AppMessage[]): ResponseInputItem[] {
  return messages.flatMap((appMessage) =>
    appMessage.openAiItems
      .filter(isNonReasoningOpenAiItem)
      .map((item) => {
        switch (item.type) {
          case "message":
            return {
              role: item.role,
              content: item.content,
            } as ResponseInputItem;
          case "function_call":
            return {
              type: "function_call",
              call_id: item.callId,
              name: item.name,
              arguments: item.arguments,
            } as ResponseInputItem;
          case "function_call_output":
            return {
              type: "function_call_output",
              call_id: item.callId,
              output: item.output,
            } as ResponseInputItem;
        }
      })
  );
}

export const startConversation = async (req: Request<{}, {}, StartConversationBody>, res: Response) => {
  try {
    const { metadataId, userTextMessage, metadataFields } = req.body;

    const fieldDescriptions = buildFieldsJsonString(metadataFields);

    const newConversation = chatService.createConversation(
      metadataId,
      metadataFields
    );

    // Create user AppMessage with developer + user openAiItems
    const userAppMessage = chatService.createAppMessage(newConversation.id, {
      role: "user",
      content: userTextMessage,
      openAiItems: [
        {
          type: "message",
          role: "developer",
          content: `Available fields of "VIRTUAL_DATA_TABLE" to use in query: \n${fieldDescriptions}`,
        },
        {
          type: "message",
          role: "user",
          content: userTextMessage,
        },
      ],
    });

    const allMessages = chatService.getMessagesByConversationId(newConversation.id);
    const input = buildOpenAIInput(allMessages);
    const { structuredOutput, openAiItems, executionData, errorResponse } =
      await openAiService.createModelResponse(input, metadataId, {
        suggestConversationName: true,
        userTextMessage,
        availableFieldNames: metadataFields
          .map((field) => field.completeName)
          .filter((fieldName): fieldName is string => typeof fieldName === "string" && fieldName.length > 0),
      });

    if (structuredOutput.conversationNameSuggestion) {
      chatService.updateConversationName(newConversation.id, structuredOutput.conversationNameSuggestion);
    }

    // Create assistant AppMessage with all openAiItems from the response
    const assistantAppMessage = chatService.createAppMessage(newConversation.id, {
      role: "assistant",
      parsedContent: structuredOutput,
      executionData,
      errorResponse,
      openAiItems,
    });

    return res.status(201).json({
      newConversation,
      newMessages: [userAppMessage, assistantAppMessage],
    });
  } catch (error: any) {
    logger.error("Error initiating conversation:", error);
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

    const conversationId = parseInt(id);

    // Create user AppMessage with single user openAiItem
    const userAppMessage = chatService.createAppMessage(conversationId, {
      role: "user",
      content: userTextMessage,
      openAiItems: [
        {
          type: "message",
          role: "user",
          content: userTextMessage,
        },
      ],
    });

    const allMessages = chatService.getMessagesByConversationId(conversationId);
    const input = buildOpenAIInput(allMessages);

    console.log("Input para LLM:", JSON.stringify(input, null, 2));

    const { structuredOutput, openAiItems, executionData, errorResponse } =
      await openAiService.createModelResponse(input, conversation.metadataId, {
        availableFieldNames: conversation.metadataFields
          .map((field) => field.completeName)
          .filter((fieldName): fieldName is string => typeof fieldName === "string" && fieldName.length > 0),
      });

    // Create assistant AppMessage with all openAiItems from the response
    const assistantAppMessage = chatService.createAppMessage(conversationId, {
      role: "assistant",
      parsedContent: structuredOutput,
      executionData,
      errorResponse,
      openAiItems,
    });

    return res.status(201).json({ newMessages: [userAppMessage, assistantAppMessage] });
  } catch (error: any) {
    logger.error("Error adding message to conversation:", error);
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
