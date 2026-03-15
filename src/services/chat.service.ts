import { MetadataField, MODEL_INSTRUCTIONS, OpenAIResponseSchema } from "../constants";
import type { ResponseOutputItem } from "openai/resources/responses/responses";

export interface ExecutionData {
  dimensions: string[];
  source: (string | number | null)[][];
}

export interface OpenAiItem {
  type: "message" | "reasoning" | "function_call" | "function_call_output";

  // Para type "message"
  role?: "developer" | "user" | "assistant";
  content?: string;

  // Para type "reasoning"
  reasoningItem?: ResponseOutputItem;

  // Para type "function_call"
  callId?: string;
  name?: string;
  arguments?: string;

  // Para type "function_call_output"
  output?: string;
}

export interface AppMessage {
  id: number;
  role: "user" | "assistant";

  // Dados para exibição no frontend
  content?: string;
  parsedContent?: OpenAIResponseSchema;
  executionData?: ExecutionData;
  errorResponse?: string | Object;

  // Mensagens internas trocadas com a OpenAI
  openAiItems: OpenAiItem[];

  createdAt: Date;
}

export interface Folder {
  id: number;
  name: string;
  createdAt: Date;
}

export interface Conversation {
  id: number;
  metadataId: number;
  name: string;
  systemMessage: string;
  metadataFields: MetadataField[];
  messages?: AppMessage[];
  folderId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

let conversations: Conversation[] = [];
let folders: Folder[] = [];

export function getConversations(folderId?: number | null): Conversation[] {
  if (folderId !== undefined) {
    return conversations.filter((c) => c.folderId === folderId);
  }
  return conversations;
}

export function getConversation(id: number): Conversation | undefined {
  return conversations.find((conversation) => conversation.id === id);
}

export function createConversation(
  metadataId: number,
  metadataFields: MetadataField[],
  folderId?: number | null
): Conversation {
  const now = new Date();
  const newConversation: Conversation = {
    id: conversations.length + 1,
    metadataId,
    name: `Conversa ${conversations.length + 1}`,
    systemMessage: MODEL_INSTRUCTIONS,
    metadataFields,
    folderId: folderId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  conversations.push(newConversation);
  return newConversation;
}

export function addAppMessage(conversationId: number, appMessage: AppMessage): void {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (conversation) {
    if (!conversation.messages) {
      conversation.messages = [];
    }
    conversation.messages.push(appMessage);
    conversation.updatedAt = new Date();
  }
}

export function getConversationById(id: number): Conversation | undefined {
  return conversations.find((c) => c.id === id);
}

export function getMessagesByConversationId(conversationId: number): AppMessage[] {
  const conversation = conversations.find((c) => c.id === conversationId);
  return conversation?.messages || [];
}

export function createAppMessage(
  conversationId: number,
  appMessage: Omit<AppMessage, "id" | "createdAt">
): AppMessage {
  const newMessage: AppMessage = {
    ...appMessage,
    id: Date.now(),
    createdAt: new Date(),
  };
  addAppMessage(conversationId, newMessage);
  return newMessage;
}

export interface FolderWithCount extends Folder {
  conversationCount: number;
}

export function createFolder(name: string): Folder {
  const newFolder: Folder = {
    id: folders.length + 1,
    name,
    createdAt: new Date(),
  };
  folders.push(newFolder);
  return newFolder;
}

export function getAllFolders(): FolderWithCount[] {
  return folders.map((folder) => ({
    ...folder,
    conversationCount: conversations.filter((c) => c.folderId === folder.id).length,
  }));
}

export function getFolderById(id: number): Folder | undefined {
  return folders.find((f) => f.id === id);
}

export function updateFolder(id: number, name: string): Folder | undefined {
  const folder = folders.find((f) => f.id === id);
  if (folder) {
    folder.name = name;
    return folder;
  }
  return undefined;
}

export function deleteFolder(id: number, deleteConversations: boolean = false): boolean {
  const folderIndex = folders.findIndex((f) => f.id === id);
  if (folderIndex === -1) {
    return false;
  }

  if (deleteConversations) {
    conversations = conversations.filter((c) => c.folderId !== id);
  } else {
    conversations.forEach((c) => {
      if (c.folderId === id) {
        c.folderId = null;
        c.updatedAt = new Date();
      }
    });
  }

  folders.splice(folderIndex, 1);
  return true;
}

function normalizeDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractSearchableText(conversation: Conversation): string {
  const parts: string[] = [
    conversation.name,
    conversation.systemMessage,
    ...conversation.metadataFields.map((f) => f.completeName),
  ];

  if (conversation.messages) {
    conversation.messages.forEach((appMessage) => {
      if (appMessage.content) {
        parts.push(appMessage.content);
      }
      if (appMessage.parsedContent) {
        parts.push(appMessage.parsedContent.message || "");
        if (appMessage.parsedContent.userMessageSuggestions) {
          parts.push(...appMessage.parsedContent.userMessageSuggestions);
        }
      }
    });
  }

  return parts.join(" ");
}

export function searchConversations(
  query: string,
  folderId?: number | null
): Conversation[] {
  if (!query.trim()) {
    return folderId !== undefined
      ? conversations.filter((c) => c.folderId === folderId)
      : conversations;
  }

  const normalizedQuery = normalizeDiacritics(query.trim());

  let filtered = conversations.filter((conversation) => {
    if (folderId !== undefined && conversation.folderId !== folderId) {
      return false;
    }

    const searchableText = normalizeDiacritics(extractSearchableText(conversation));
    return searchableText.includes(normalizedQuery);
  });

  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function getConversationsByFolder(folderId: number | null): Conversation[] {
  return conversations
    .filter((c) => c.folderId === folderId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function moveConversationToFolder(
  conversationId: number,
  folderId: number | null
): Conversation | undefined {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.folderId = folderId;
    conversation.updatedAt = new Date();
    return conversation;
  }
  return undefined;
}
