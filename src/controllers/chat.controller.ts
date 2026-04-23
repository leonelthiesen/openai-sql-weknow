import { type Request, type Response } from "express";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { MetadataField } from "../constants";
import * as chatService from "../services/chat.service";
import { generateConversationNameSuggestion } from "../services/open-ai.service";
import { logger } from "../utils/logger";
import { jobStore } from "../pipeline/job-store";
import { runPipeline } from "../pipeline/pipeline-orchestrator";

interface FieldMetadata extends MetadataField {
  title?: string;
  formatOptions?: {
    options?: Array<{ value: unknown; text: string }>;
    [key: string]: unknown;
  };
  sampleData?: unknown[];
  [key: string]: unknown;
}

interface StartConversationBody {
  metadataId: number;
  userTextMessage: string;
  metadataFields: FieldMetadata[];
  folderId?: string | null;
}

interface AddMessageBody {
  userTextMessage: string;
}

interface ShareConversationBody {
  sharedWithUserId: string;
}

type NonReasoningOpenAiItem = chatService.OpenAiItem & {
  type: "message" | "function_call" | "function_call_output";
};

function isNonReasoningOpenAiItem(
  item: chatService.OpenAiItem
): item is NonReasoningOpenAiItem {
  return item.type !== "reasoning";
}

const buildFieldsJsonString = (metadataFields: FieldMetadata[]): string => {
  const outFields = metadataFields.map((field) => {
    const outField: Record<string, unknown> = {
      completeName: field.completeName,
      title: field.title,
    };

    if (field.formatOptions?.options && field.formatOptions.options.length > 0) {
      const maxOptions = 5;
      outField.options = field.formatOptions.options.slice(0, maxOptions);
    } else if (field.sampleData && Array.isArray(field.sampleData) && field.sampleData.length > 0) {
      const maxSamples = 5;
      outField.sampleData = field.sampleData.slice(0, maxSamples);
    }

    return outField;
  });

  return JSON.stringify(outFields, null, 2);
};

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

function getAuthenticatedUserId(req: Request, res: Response): string | undefined {
  if (!req.authenticatedUserId) {
    res.status(401).json({ message: "Usuário não autenticado." });
    return undefined;
  }

  return req.authenticatedUserId;
}

function handleControllerError(res: Response, error: unknown, defaultMessage: string): Response {
  if (error instanceof chatService.AuthorizationError) {
    return res.status(403).json({ message: error.message });
  }

  if (error instanceof Error && /não encontrada|nao encontrada/i.test(error.message)) {
    return res.status(404).json({ message: error.message });
  }

  if (error instanceof Error) {
    return res.status(500).json({ message: defaultMessage, error: error.message });
  }

  return res.status(500).json({ message: defaultMessage });
}

export const startConversation = async (req: Request<{}, {}, StartConversationBody>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { metadataId, userTextMessage, metadataFields, folderId } = req.body;

    const fieldDescriptions = buildFieldsJsonString(metadataFields);

    const newConversation = await chatService.createConversation(
      metadataId,
      metadataFields,
      userId,
      folderId
    );

    const userAppMessage = await chatService.createAppMessage(newConversation.id, userId, {
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

    const [allMessages, conversationName] = await Promise.all([
      chatService.getMessagesByConversationId(newConversation.id, userId),
      generateConversationNameSuggestion(userTextMessage),
    ]);
    const input = buildOpenAIInput(allMessages);

    if (conversationName) {
      await chatService.updateConversationName(newConversation.id, conversationName, userId);
      newConversation.name = conversationName;
    }

    const job = jobStore.createJob({
      conversationId: newConversation.id,
      userId,
      metadataId,
      input,
      options: {
        availableFieldNames: metadataFields
          .map((field) => field.completeName)
          .filter(
            (fieldName): fieldName is string =>
              typeof fieldName === "string" && fieldName.length > 0
          ),
        conversationName,
      },
    });
    job.userMessageId = userAppMessage.id;

    jobStore.emitEvent(job.id, {
      type: "job_created",
      payload: { jobId: job.id, conversationId: newConversation.id },
    });

    // Fire pipeline — not awaited
    runPipeline(job).catch((error) => {
      logger.error("chat.controller", "Pipeline failed unexpectedly", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return res.status(202).json({
      jobId: job.id,
      newConversation,
      userMessage: userAppMessage,
    });
  } catch (error: unknown) {
    logger.error("chat.controller", "Error initiating conversation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleControllerError(res, error, "Erro ao iniciar conversa.");
  }
};

export const getConversations = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (search.length > 0) {
      const results = await chatService.searchConversations(search, userId);
      return res.json(results);
    }

    const conversations = await chatService.getConversations(userId);
    return res.json(conversations);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao buscar conversas.");
  }
};

export const getMessagesByConversationId = async (req: Request<{ id: string }>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const conversation = await chatService.getConversationById(id, userId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversa não encontrada." });
    }

    const messages = await chatService.getMessagesByConversationId(id, userId);
    return res.json(messages);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao buscar mensagens.");
  }
};

export const addUserMessageToConversation = async (
  req: Request<{ id: string }, {}, AddMessageBody>,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const { userTextMessage } = req.body;

    const conversation = await chatService.getConversationById(id, userId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversa não encontrada." });
    }

    const conversationId = id;

    const userAppMessage = await chatService.createAppMessage(conversationId, userId, {
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

    const allMessages = await chatService.getMessagesByConversationId(conversationId, userId);
    const input = buildOpenAIInput(allMessages);

    const job = jobStore.createJob({
      conversationId,
      userId,
      metadataId: conversation.metadataId,
      input,
      options: {
        availableFieldNames: conversation.metadataFields
          .map((field) => field.completeName)
          .filter(
            (fieldName): fieldName is string =>
              typeof fieldName === "string" && fieldName.length > 0
          ),
      },
    });
    job.userMessageId = userAppMessage.id;

    jobStore.emitEvent(job.id, {
      type: "job_created",
      payload: { jobId: job.id, conversationId },
    });

    // Fire pipeline — not awaited
    runPipeline(job).catch((error) => {
      logger.error("chat.controller", "Pipeline failed unexpectedly", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return res.status(202).json({
      jobId: job.id,
      userMessage: userAppMessage,
    });
  } catch (error: unknown) {
    logger.error("chat.controller", "Error adding message to conversation", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleControllerError(res, error, "Erro ao adicionar mensagem à conversa.");
  }
};

export const getAllFolders = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const folders = await chatService.getAllFolders(userId);
    return res.json(folders);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao buscar pastas.");
  }
};

export const createFolder = async (req: Request<{}, {}, { name: string }>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Nome da pasta é obrigatório." });
    }

    const newFolder = await chatService.createFolder(name.trim(), userId);
    return res.status(201).json(newFolder);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao criar pasta.");
  }
};

export const updateFolder = async (
  req: Request<{ id: string }, {}, { name: string }>,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Nome da pasta é obrigatório." });
    }

    const updatedFolder = await chatService.updateFolder(id, name.trim(), userId);
    if (!updatedFolder) {
      return res.status(404).json({ message: "Pasta não encontrada." });
    }

    return res.json(updatedFolder);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao atualizar pasta.");
  }
};

export const deleteFolder = async (req: Request<{ id: string }>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const deleteConversations = req.query.deleteConversations === "true";

    const success = await chatService.deleteFolder(id, userId, deleteConversations);
    if (!success) {
      return res.status(404).json({ message: "Pasta não encontrada." });
    }

    return res.json({ message: "Pasta excluída com sucesso." });
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao excluir pasta.");
  }
};

export const getConversationsByFolder = async (req: Request<{ id: string }>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const folderId = id === "null" ? null : id;
    const conversations = await chatService.getConversationsByFolder(folderId, userId);
    return res.json(conversations);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao buscar conversas da pasta.");
  }
};

export const moveConversationToFolder = async (
  req: Request<{ id: string }, {}, { folderId: string | null }>,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const { folderId } = req.body;

    const conversation = await chatService.moveConversationToFolder(id, folderId, userId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversa não encontrada." });
    }

    return res.json(conversation);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao mover conversa.");
  }
};

export const deleteConversation = async (req: Request<{ id: string }>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;

    const removed = await chatService.deleteConversation(id, userId);
    if (!removed) {
      return res.status(404).json({ message: "Conversa não encontrada." });
    }

    return res.json({ message: "Conversa excluída com sucesso." });
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao excluir conversa.");
  }
};

export const searchConversations = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const query = (req.query.q as string) || "";
    const folderIdParam = req.query.folderId as string | undefined;

    let folderId: string | null | undefined;
    if (folderIdParam !== undefined) {
      folderId = folderIdParam === "null" ? null : folderIdParam;
    }

    const results = await chatService.searchConversations(query, userId, folderId);
    return res.json(results);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao buscar conversas.");
  }
};

export const getConversationShares = async (req: Request<{ id: string }>, res: Response) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const shares = await chatService.getConversationShares(id, userId);
    return res.json(shares);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao buscar compartilhamentos da conversa.");
  }
};

export const shareConversation = async (
  req: Request<{ id: string }, {}, ShareConversationBody>,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id } = req.params;
    const { sharedWithUserId } = req.body;

    if (!sharedWithUserId || !sharedWithUserId.trim()) {
      return res.status(400).json({ message: "Usuário para compartilhamento é obrigatório." });
    }

    const share = await chatService.shareConversation(id, userId, sharedWithUserId);
    return res.status(201).json(share);
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao compartilhar conversa.");
  }
};

export const revokeConversationShare = async (
  req: Request<{ id: string; sharedWithUserId: string }>,
  res: Response
) => {
  const userId = getAuthenticatedUserId(req, res);
  if (!userId) {
    return;
  }

  try {
    const { id, sharedWithUserId } = req.params;

    const removed = await chatService.revokeConversationShare(id, userId, sharedWithUserId);
    if (!removed) {
      return res.status(404).json({ message: "Compartilhamento não encontrado." });
    }

    return res.json({ message: "Compartilhamento removido com sucesso." });
  } catch (error: unknown) {
    return handleControllerError(res, error, "Erro ao remover compartilhamento da conversa.");
  }
};
