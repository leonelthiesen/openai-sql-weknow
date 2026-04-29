import { randomUUID } from "node:crypto";
import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { MetadataField, MODEL_INSTRUCTIONS, OpenAIResponseSchema } from "../constants";
import { sql } from "../db";
import { PivotGridResponse } from "../types/pivot-grid-response.types";
import type { EChartsDatasetResult } from "../utils/to-echarts-dataset";

export interface ExecutionData {
  dimensions: string[];
  source: (string | number | null)[][];
}

export interface OpenAiItem {
  type: "message" | "reasoning" | "function_call" | "function_call_output";

  role?: "developer" | "user" | "assistant";
  content?: string;

  reasoningItem?: ResponseOutputItem;

  callId?: string;
  name?: string;
  arguments?: string;

  output?: string;
}

export interface AppMessage {
  id: string;
  role: "user" | "assistant";
  userId: string;
  content?: string;
  parsedContent?: OpenAIResponseSchema;
  executionData?: PivotGridResponse;
  datasetResult?: EChartsDatasetResult;
  errorResponse?: string | object;
  chartEchartsOption?: Record<string, unknown>;
  chartVegaLiteSpec?: Record<string, unknown>;
  openAiItems: OpenAiItem[];
  createdAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  metadataId: number;
  name: string;
  systemMessage: string;
  metadataFields: MetadataField[];
  ownerUserId: string;
  messages?: AppMessage[];
  firstMessage?: AppMessage | null;
  folderId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationShare {
  sharedWithUserId: string;
  permission: "READ_ONLY";
  createdAt: Date;
}

interface ConversationRow {
  id: string;
  metadata_id: number;
  name: string;
  system_message: string;
  metadata_fields: MetadataField[] | string | null;
  owner_user_id: string;
  folder_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AppMessageRow {
  id: string;
  role: "user" | "assistant";
  user_id: string;
  content: string | null;
  parsed_content: OpenAIResponseSchema | string | null;
  execution_data: PivotGridResponse | string | null;
  dataset_result: EChartsDatasetResult | string | null;
  error_response: string | object | null;
  chart_html: string | null;
  chart_vega_lite: string | null;
  open_ai_items: OpenAiItem[] | string | null;
  created_at: Date;
}

interface FolderRow {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: Date;
}

interface ConversationShareRow {
  shared_with_user_id: string;
  permission: "READ_ONLY";
  created_at: Date;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    metadataId: row.metadata_id,
    name: row.name,
    systemMessage: row.system_message,
    metadataFields: parseJsonObject<MetadataField[]>(row.metadata_fields) ?? [],
    ownerUserId: row.owner_user_id,
    folderId: row.folder_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseOpenAiItems(value: OpenAiItem[] | string | null): OpenAiItem[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as OpenAiItem[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseJsonObject<T>(value: T | string | null): T | undefined {
  if (value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed as T;
    } catch {
      return undefined;
    }
  }

  return value;
}

function parseErrorResponse(value: string | object | null): string | object | undefined {
  if (value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const parsed = parseJsonObject<object>(value);
    return parsed ?? value;
  }

  return value;
}

function mapAppMessage(row: AppMessageRow): AppMessage {
  return {
    id: row.id,
    role: row.role,
    userId: row.user_id,
    content: row.content ?? undefined,
    parsedContent: parseJsonObject<OpenAIResponseSchema>(row.parsed_content),
    executionData: parseJsonObject<PivotGridResponse>(row.execution_data),
    datasetResult: parseJsonObject<EChartsDatasetResult>(row.dataset_result),
    errorResponse: parseErrorResponse(row.error_response),
    chartEchartsOption: parseJsonObject<Record<string, unknown>>(row.chart_html),
    chartVegaLiteSpec: parseJsonObject<Record<string, unknown>>(row.chart_vega_lite),
    openAiItems: parseOpenAiItems(row.open_ai_items),
    createdAt: new Date(row.created_at),
  };
}

function mapFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: new Date(row.created_at),
  };
}

function mapConversationShare(row: ConversationShareRow): ConversationShare {
  return {
    sharedWithUserId: row.shared_with_user_id,
    permission: row.permission,
    createdAt: new Date(row.created_at),
  };
}

async function assertConversationOwner(conversationId: string, ownerUserId: string): Promise<void> {
  const rows = await sql<Array<{ owner_user_id: string }>>`
    select owner_user_id
    from conversations
    where id = ${conversationId}
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Conversa não encontrada.");
  }

  if (row.owner_user_id !== ownerUserId) {
    throw new AuthorizationError("Você não possui permissão para alterar esta conversa.");
  }
}

async function assertFolderOwner(folderId: string, ownerUserId: string): Promise<void> {
  const rows = await sql<Array<{ owner_user_id: string }>>`
    select owner_user_id
    from folders
    where id = ${folderId}
    limit 1
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Pasta não encontrada.");
  }

  if (row.owner_user_id !== ownerUserId) {
    throw new AuthorizationError("Você não possui permissão para alterar esta pasta.");
  }
}

export async function getConversations(userId: string, folderId?: string | null): Promise<Conversation[]> {
  let rows: ConversationRow[];

  if (folderId === undefined) {
    rows = await sql<ConversationRow[]>`
      select c.id, c.metadata_id, c.name, c.system_message, c.metadata_fields, c.owner_user_id, c.folder_id, c.created_at, c.updated_at
      from conversations c
      where (
        c.owner_user_id = ${userId}
        or exists (
          select 1
          from conversation_shares cs
          where cs.conversation_id = c.id
            and cs.shared_with_user_id = ${userId}
        )
      )
      order by c.created_at desc
    `;
  } else if (folderId === null) {
    rows = await sql<ConversationRow[]>`
      select c.id, c.metadata_id, c.name, c.system_message, c.metadata_fields, c.owner_user_id, c.folder_id, c.created_at, c.updated_at
      from conversations c
      where c.folder_id is null
        and (
          c.owner_user_id = ${userId}
          or exists (
            select 1
            from conversation_shares cs
            where cs.conversation_id = c.id
              and cs.shared_with_user_id = ${userId}
          )
        )
      order by c.created_at desc
    `;
  } else {
    rows = await sql<ConversationRow[]>`
      select c.id, c.metadata_id, c.name, c.system_message, c.metadata_fields, c.owner_user_id, c.folder_id, c.created_at, c.updated_at
      from conversations c
      where c.folder_id = ${folderId}
        and (
          c.owner_user_id = ${userId}
          or exists (
            select 1
            from conversation_shares cs
            where cs.conversation_id = c.id
              and cs.shared_with_user_id = ${userId}
          )
        )
      order by c.created_at desc
    `;
  }

  return rows.map(mapConversation);
}

export async function getConversation(id: string, userId: string): Promise<Conversation | undefined> {
  const rows = await sql<ConversationRow[]>`
    select c.id, c.metadata_id, c.name, c.system_message, c.metadata_fields, c.owner_user_id, c.folder_id, c.created_at, c.updated_at
    from conversations c
    where c.id = ${id}
      and (
        c.owner_user_id = ${userId}
        or exists (
          select 1
          from conversation_shares cs
          where cs.conversation_id = c.id
            and cs.shared_with_user_id = ${userId}
        )
      )
    limit 1
  `;

  return rows[0] ? mapConversation(rows[0]) : undefined;
}

export async function createConversation(
  metadataId: number,
  metadataFields: MetadataField[],
  ownerUserId: string,
  folderId?: string | null
): Promise<Conversation> {
  if (folderId) {
    await assertFolderOwner(folderId, ownerUserId);
  }

  const rows = await sql<ConversationRow[]>`
    insert into conversations (metadata_id, name, system_message, metadata_fields, owner_user_id, folder_id)
    values (
      ${metadataId},
      ${"Conversa"},
      ${MODEL_INSTRUCTIONS},
      ${JSON.stringify(metadataFields)}::jsonb,
      ${ownerUserId},
      ${folderId ?? null}
    )
    returning id, metadata_id, name, system_message, metadata_fields, owner_user_id, folder_id, created_at, updated_at
  `;

  const createdConversation = rows[0];
  if (!createdConversation) {
    throw new Error("Falha ao criar conversa.");
  }

  return mapConversation(createdConversation);
}

export async function addAppMessage(
  conversationId: string,
  authorUserId: string,
  appMessage: AppMessage
): Promise<void> {
  await sql`
    insert into app_messages (
      id,
      conversation_id,
      role,
      user_id,
      content,
      parsed_content,
      execution_data,
      dataset_result,
      error_response,
      chart_html,
      chart_vega_lite,
      open_ai_items,
      created_at
    )
    values (
      ${appMessage.id},
      ${conversationId},
      ${appMessage.role},
      ${authorUserId},
      ${appMessage.content ?? null},
      ${appMessage.parsedContent === undefined ? null : JSON.stringify(appMessage.parsedContent)}::jsonb,
      ${appMessage.executionData === undefined ? null : JSON.stringify(appMessage.executionData)}::jsonb,
      ${appMessage.datasetResult === undefined ? null : JSON.stringify(appMessage.datasetResult)}::jsonb,
      ${appMessage.errorResponse === undefined ? null : JSON.stringify(appMessage.errorResponse)}::jsonb,
      ${appMessage.chartEchartsOption === undefined ? null : JSON.stringify(appMessage.chartEchartsOption)},
      ${appMessage.chartVegaLiteSpec === undefined ? null : JSON.stringify(appMessage.chartVegaLiteSpec)},
      ${JSON.stringify(appMessage.openAiItems)}::jsonb,
      ${appMessage.createdAt}
    )
  `;

  await sql`
    update conversations
    set updated_at = now()
    where id = ${conversationId}
  `;
}

export async function getConversationById(id: string, userId: string): Promise<Conversation | undefined> {
  return getConversation(id, userId);
}

export async function getMessagesByConversationId(
  conversationId: string,
  userId: string
): Promise<AppMessage[]> {
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    return [];
  }

  const rows = await sql<AppMessageRow[]>`
    select id, role, user_id, content, parsed_content, execution_data, dataset_result, error_response, chart_html, chart_vega_lite, open_ai_items, created_at
    from app_messages
    where conversation_id = ${conversationId}
    order by created_at asc
  `;

  return rows.map(mapAppMessage);
}

export async function createAppMessage(
  conversationId: string,
  currentUserId: string,
  appMessage: Omit<AppMessage, "id" | "createdAt" | "userId">
): Promise<AppMessage> {
  await assertConversationOwner(conversationId, currentUserId);

  const newMessage: AppMessage = {
    ...appMessage,
    id: randomUUID(),
    userId: currentUserId,
    createdAt: new Date(),
  };

  await addAppMessage(conversationId, currentUserId, newMessage);
  return newMessage;
}

export interface FolderWithCount extends Folder {
  conversationCount: number;
}

export async function createFolder(name: string, ownerUserId: string): Promise<Folder> {
  const rows = await sql<FolderRow[]>`
    insert into folders (name, owner_user_id)
    values (${name}, ${ownerUserId})
    returning id, name, owner_user_id, created_at
  `;

  const createdFolder = rows[0];
  if (!createdFolder) {
    throw new Error("Falha ao criar pasta.");
  }

  return mapFolder(createdFolder);
}

export async function getAllFolders(userId: string): Promise<FolderWithCount[]> {
  const rows = await sql<Array<FolderRow & { conversation_count: number }>>`
    select f.id, f.name, f.owner_user_id, f.created_at, count(c.id)::int as conversation_count
    from folders f
    left join conversations c on c.folder_id = f.id and c.owner_user_id = ${userId}
    where f.owner_user_id = ${userId}
    group by f.id, f.name, f.owner_user_id, f.created_at
    order by f.created_at asc
  `;

  return rows.map((row) => ({
    ...mapFolder(row),
    conversationCount: row.conversation_count,
  }));
}

export async function getFolderById(id: string, userId: string): Promise<Folder | undefined> {
  const rows = await sql<FolderRow[]>`
    select id, name, owner_user_id, created_at
    from folders
    where id = ${id}
      and owner_user_id = ${userId}
    limit 1
  `;

  return rows[0] ? mapFolder(rows[0]) : undefined;
}

export async function updateFolder(
  id: string,
  name: string,
  userId: string
): Promise<Folder | undefined> {
  const rows = await sql<FolderRow[]>`
    update folders
    set name = ${name}
    where id = ${id}
      and owner_user_id = ${userId}
    returning id, name, owner_user_id, created_at
  `;

  return rows[0] ? mapFolder(rows[0]) : undefined;
}

export async function deleteFolder(
  id: string,
  userId: string,
  deleteConversations: boolean = false
): Promise<boolean> {
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as typeof sql;

    const folderRows = await tx<{ id: string }[]>`
      select id
      from folders
      where id = ${id}
        and owner_user_id = ${userId}
      limit 1
    `;

    if (folderRows.length === 0) {
      return false;
    }

    if (deleteConversations) {
      await tx`
        delete from conversations
        where folder_id = ${id}
          and owner_user_id = ${userId}
      `;
    } else {
      await tx`
        update conversations
        set folder_id = null, updated_at = now()
        where folder_id = ${id}
          and owner_user_id = ${userId}
      `;
    }

    await tx`
      delete from folders
      where id = ${id}
        and owner_user_id = ${userId}
    `;

    return true;
  });
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
    ...conversation.metadataFields.map((field) => field.completeName),
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

export async function searchConversations(
  query: string,
  userId: string,
  folderId?: string | null
): Promise<Conversation[]> {
  const conversations = await getConversations(userId, folderId);

  if (!query.trim()) {
    return conversations;
  }

  const normalizedQuery = normalizeDiacritics(query.trim());
  const conversationIds = conversations.map((conversation) => conversation.id);

  if (conversationIds.length === 0) {
    return [];
  }

  const messageRows = await sql<Array<AppMessageRow & { conversation_id: string }>>`
    select id, conversation_id, role, user_id, content, parsed_content, execution_data, dataset_result, error_response, open_ai_items, created_at
    from app_messages
    where conversation_id in ${sql(conversationIds)}
    order by created_at asc
  `;

  const messagesByConversation = new Map<string, AppMessage[]>();
  for (const row of messageRows) {
    const mapped = mapAppMessage(row);
    const existing = messagesByConversation.get(row.conversation_id);
    if (existing) {
      existing.push(mapped);
    } else {
      messagesByConversation.set(row.conversation_id, [mapped]);
    }
  }

  const withMessages = conversations.map((conversation) => ({
    ...conversation,
    messages: messagesByConversation.get(conversation.id) ?? [],
  }));

  return withMessages
    .filter((conversation) => {
      const searchableText = normalizeDiacritics(extractSearchableText(conversation));
      return searchableText.includes(normalizedQuery);
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getConversationsByFolder(
  folderId: string | null,
  userId: string
): Promise<Conversation[]> {
  const conversations = await getConversations(userId, folderId);

  if (conversations.length === 0) {
    return conversations;
  }

  const conversationIds = conversations.map((c) => c.id);

  const firstMessageRows = await sql<Array<AppMessageRow & { conversation_id: string }>>`
    select distinct on (conversation_id)
      id, conversation_id, role, user_id, content, parsed_content, execution_data, dataset_result, error_response, open_ai_items, created_at
    from app_messages
    where conversation_id in ${sql(conversationIds)}
      and role = 'user'
    order by conversation_id, created_at asc
  `;

  const firstMessageByConversation = new Map<string, AppMessage>();
  for (const row of firstMessageRows) {
    firstMessageByConversation.set(row.conversation_id, mapAppMessage(row));
  }

  return conversations.map((conversation) => ({
    ...conversation,
    firstMessage: firstMessageByConversation.get(conversation.id) ?? null,
  }));
}

export async function moveConversationToFolder(
  conversationId: string,
  folderId: string | null,
  userId: string
): Promise<Conversation | undefined> {
  await assertConversationOwner(conversationId, userId);

  if (folderId) {
    await assertFolderOwner(folderId, userId);
  }

  const rows = await sql<ConversationRow[]>`
    update conversations
    set folder_id = ${folderId}, updated_at = now()
    where id = ${conversationId}
      and owner_user_id = ${userId}
    returning id, metadata_id, name, system_message, metadata_fields, owner_user_id, folder_id, created_at, updated_at
  `;

  return rows[0] ? mapConversation(rows[0]) : undefined;
}

export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    delete from conversations
    where id = ${conversationId}
      and owner_user_id = ${userId}
    returning id
  `;

  return rows.length > 0;
}

export async function updateConversationName(
  conversationId: string,
  name: string,
  userId: string
): Promise<Conversation | undefined> {
  await assertConversationOwner(conversationId, userId);

  const trimmedName = name.trim();
  if (!trimmedName) {
    return getConversationById(conversationId, userId);
  }

  const rows = await sql<ConversationRow[]>`
    update conversations
    set name = ${trimmedName}, updated_at = now()
    where id = ${conversationId}
      and owner_user_id = ${userId}
    returning id, metadata_id, name, system_message, metadata_fields, owner_user_id, folder_id, created_at, updated_at
  `;

  return rows[0] ? mapConversation(rows[0]) : undefined;
}

export async function shareConversation(
  conversationId: string,
  ownerUserId: string,
  sharedWithUserId: string
): Promise<ConversationShare> {
  const targetUserId = sharedWithUserId.trim();

  if (!targetUserId) {
    throw new Error("Usuário para compartilhamento é obrigatório.");
  }

  if (targetUserId === ownerUserId) {
    throw new Error("Não é possível compartilhar a conversa com o próprio usuário.");
  }

  await assertConversationOwner(conversationId, ownerUserId);

  await sql`
    insert into app_users (id)
    values (${targetUserId})
    on conflict (id) do nothing
  `;

  const rows = await sql<ConversationShareRow[]>`
    insert into conversation_shares (conversation_id, shared_with_user_id, permission)
    values (${conversationId}, ${targetUserId}, ${"READ_ONLY"})
    on conflict (conversation_id, shared_with_user_id)
    do update set permission = excluded.permission
    returning shared_with_user_id, permission, created_at
  `;

  const createdShare = rows[0];
  if (!createdShare) {
    throw new Error("Falha ao compartilhar conversa.");
  }

  return mapConversationShare(createdShare);
}

export async function revokeConversationShare(
  conversationId: string,
  ownerUserId: string,
  sharedWithUserId: string
): Promise<boolean> {
  await assertConversationOwner(conversationId, ownerUserId);

  const rows = await sql<Array<{ shared_with_user_id: string }>>`
    delete from conversation_shares
    where conversation_id = ${conversationId}
      and shared_with_user_id = ${sharedWithUserId}
    returning shared_with_user_id
  `;

  return rows.length > 0;
}

export async function getConversationShares(
  conversationId: string,
  ownerUserId: string
): Promise<ConversationShare[]> {
  await assertConversationOwner(conversationId, ownerUserId);

  const rows = await sql<ConversationShareRow[]>`
    select shared_with_user_id, permission, created_at
    from conversation_shares
    where conversation_id = ${conversationId}
    order by created_at asc
  `;

  return rows.map(mapConversationShare);
}
