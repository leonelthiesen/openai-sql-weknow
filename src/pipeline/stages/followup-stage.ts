import type { AskFollowupArgs } from "../../types/tool-args.types";
import type { OpenAiItem } from "../../services/chat.service";
import type { StageResult } from "./table-stage";
import { handleAskFollowup } from "../../services/tool-handlers/ask-followup.handler";

export interface FollowupStageParams {
    parsedArgs: AskFollowupArgs;
    callId: string;
    openAiItems: OpenAiItem[];
}

export function runFollowupStage(params: FollowupStageParams): StageResult {
    const { parsedArgs, callId, openAiItems } = params;

    const result = handleAskFollowup(parsedArgs, callId);
    openAiItems.push(...result.openAiItems);

    return {
        structuredOutput: result.structuredOutput,
        openAiItems,
    };
}
