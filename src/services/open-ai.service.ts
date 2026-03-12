import OpenAI from "openai";
import { faker } from "@faker-js/faker";
import { MODEL_INSTRUCTIONS, type OpenAIResponseSchema } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import TOOL_DEFINITIONS from "../../data/llm-tool-definitions.json";

const OpenAiModels = {
  gpt4: "gpt-4",
  gpt41Nano: "gpt-4.1-nano-2025-04-14",
  gpt35Turbo: "gpt-3.5-turbo",
  gpt5Nano: "gpt-5-nano-2025-08-07",
  gpt5Mini: "gpt-5-mini-2025-08-07",
} as const;

const CHART_TOOL_DEFINITION = TOOL_DEFINITIONS.find((t) => t.name === "generate_chart_config")!;
const FIRST_CALL_TOOLS = TOOL_DEFINITIONS.filter((t) => t.name !== "generate_chart_config");

export interface ToolCallResult {
  structuredOutput: OpenAIResponseSchema;
  toolCallId: string;
  toolCallName: string;
  toolCallArguments: string;
}

/**
 * Generates fake tabular data (max 10 rows) based on query column definitions.
 * Column type is inferred from the column name and measureFunction.
 */
function generateFakeData(query: any): Record<string, unknown>[] {
  const columns: Array<{ completeName: string; measureFunction: number }> =
    query?.columns ?? [];

  return Array.from({ length: 10 }, () => {
    const row: Record<string, unknown> = {};

    for (const col of columns) {
      const name = (col.completeName ?? "").toLowerCase();
      const isNumericAggregation = col.measureFunction !== 0;

      if (isNumericAggregation) {
        row[col.completeName] = faker.number.float({ min: 100, max: 100_000, fractionDigits: 2 });
      } else if (/data|date|dt_|_dt/.test(name)) {
        row[col.completeName] = faker.date.recent({ days: 365 }).toISOString().split("T")[0];
      } else if (/valor|value|preco|price|total|qtd|qty|amount|custo|cost/.test(name)) {
        row[col.completeName] = faker.number.float({ min: 10, max: 10_000, fractionDigits: 2 });
      } else if (/id$|_id/.test(name)) {
        row[col.completeName] = faker.number.int({ min: 1, max: 9999 });
      } else {
        row[col.completeName] = faker.company.name();
      }
    }

    return row;
  });
}

export async function createModelResponse(
  input: ResponseInputItem[]
): Promise<ToolCallResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const sharedOptions = {
    model: OpenAiModels.gpt5Mini,
    reasoning: { effort: "minimal" as const },
    include: ["reasoning.encrypted_content" as const],
  };

  // ── First call: execute_query or ask_followup ────────────────────────────
  const firstResponse = await openai.responses.create({
    ...sharedOptions,
    instructions: MODEL_INSTRUCTIONS,
    input,
    tools: FIRST_CALL_TOOLS as OpenAI.Responses.Tool[],
    tool_choice: "required",
  });

  const firstCall = firstResponse.output.find(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
      item.type === "function_call"
  );

  if (!firstCall) {
    console.error("[openai] 1st call: no function_call in output", JSON.stringify(firstResponse.output, null, 2));
    throw new Error("Model did not return a function call.");
  }

  const firstArgs = JSON.parse(firstCall.arguments);
  console.log(`[openai] 1st call → ${firstCall.name}`, JSON.stringify(firstArgs, null, 2));

  // ── ask_followup: nothing more to do ────────────────────────────────────
  if (firstCall.name === "ask_followup") {
    return {
      structuredOutput: {
        action: "FOLLOWUP_NEEDED",
        message: firstArgs.message,
        userMessageSuggestions: firstArgs.userMessageSuggestions,
      },
      toolCallId: firstCall.call_id,
      toolCallName: firstCall.name,
      toolCallArguments: firstCall.arguments,
    };
  }

  // ── execute_query: generate fake data and feed back to LLM ──────────────
  const fakeData = generateFakeData(firstArgs.query);

  let chartConfig: object | undefined;

  if (firstArgs.renderType === "CHART") {
    // ── Second call: generate_chart_config ──────────────────────────────
    const secondResponse = await openai.responses.create({
      ...sharedOptions,
      previous_response_id: firstResponse.id,
      input: [
        {
          type: "function_call_output",
          call_id: firstCall.call_id,
          output: JSON.stringify({
            columns: firstArgs.query.columns ?? [],
            rows: fakeData,
          }),
        } as ResponseInputItem,
      ],
      tools: [CHART_TOOL_DEFINITION] as OpenAI.Responses.Tool[],
      tool_choice: "required",
    });

    const chartCall = secondResponse.output.find(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
        item.type === "function_call"
    );

    console.log("chartCall", chartCall)

    if (chartCall) {
      chartConfig = JSON.parse(chartCall.arguments).chartConfig;
      console.log("[openai] 2nd call → generate_chart_config", JSON.stringify(chartCall, null, 2));
    } else {
      console.error("[openai] 2nd call: no function_call in output", JSON.stringify(secondResponse.output, null, 2));
    }
  }

  const structuredOutput: OpenAIResponseSchema = {
    action: "EXECUTE_QUERY",
    message: firstArgs.message,
    userMessageSuggestions: firstArgs.userMessageSuggestions,
    renderType: firstArgs.renderType,
    query: firstArgs.query,
    chartConfig,
  };

  return {
    structuredOutput,
    toolCallId: firstCall.call_id,
    toolCallName: firstCall.name,
    toolCallArguments: firstCall.arguments,
  };
}
