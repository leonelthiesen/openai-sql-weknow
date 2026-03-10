import { MetadataField, MODEL_INSTRUCTIONS, OpenAIResponseSchema } from "../constants";


export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
}

export interface Message {
  id?: number;
  role: "developer" | "user" | "assistant";
  content: string | OpenAIResponseSchema;
  toolCall?: ToolCallInfo;
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
  messages?: Message[];
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
  messages: Message[] = [],
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

  if (messages.length > 0) {
    messages.forEach((msg) => {
      createMessage(newConversation.id, msg);
    });
  }

  return newConversation;
}

export function addMessage(conversationId: number, message: Message): void {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (conversation) {
    if (!conversation.messages) {
      conversation.messages = [];
    }
    conversation.messages.push(message);
  }
}

export function getConversationById(id: number): Conversation | undefined {
  return conversations.find((c) => c.id === id);
}

export function getMessagesByConversationId(conversationId: number): Message[] {
  const conversation = conversations.find((c) => c.id === conversationId);
  return conversation?.messages || [];
}

export function createMessage(conversationId: number, message: Message) {
  message.id = Date.now();
  addMessage(conversationId, message);

  const conversation = conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.updatedAt = new Date();
  }

  return { ...message };
}

export function updateMessage(
  conversationId: number,
  messageId: number,
  content: string | OpenAIResponseSchema
): Message | undefined {
  const conversation = conversations.find((c) => c.id === conversationId);
  if (!conversation || !conversation.messages) {
    return undefined;
  }

  const message = conversation.messages.find((m) => m.id === messageId);
  if (!message) {
    return undefined;
  }

  message.content = content;
  conversation.updatedAt = new Date();

  return { ...message };
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
    // Delete all conversations in this folder
    conversations = conversations.filter((c) => c.folderId !== id);
  } else {
    // Move conversations to no folder (null)
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
    conversation.messages.forEach((message) => {
      if (typeof message.content === "string") {
        parts.push(message.content);
      } else {
        const schema = message.content as OpenAIResponseSchema;
        parts.push(schema.message || "");
        // parts.push(schema.query || "");
        if (schema.userMessageSuggestions) {
          parts.push(...schema.userMessageSuggestions);
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
    // Filter by folder if specified
    if (folderId !== undefined && conversation.folderId !== folderId) {
      return false;
    }

    // Search in all fields
    const searchableText = normalizeDiacritics(extractSearchableText(conversation));
    return searchableText.includes(normalizedQuery);
  });

  // Sort by newest first
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
