import type { AskFollowupArgs } from "../../types/tool-args.types";
import type { OpenAiItem } from "../chat.service";
import type { ToolCallResult } from "../open-ai.service";

export function handleAskFollowup(
    args: AskFollowupArgs,
    callId: string
): ToolCallResult {
    const openAiItems: OpenAiItem[] = [
        {
            type: "function_call_output",
            callId,
            output: "Message delivered to the user.",
        },
    ];

    return {
        structuredOutput: {
            action: "FOLLOWUP_NEEDED",
            message: args.message,
            userMessageSuggestions: args.userMessageSuggestions,
        },
        openAiItems,
    };
}
