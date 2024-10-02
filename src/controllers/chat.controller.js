import astToWeknowService from "../services/ast-to-weknow.service.js";
import { ObjectTypes, SYSTEM_MESSAGE } from "../constants.js";
import chatService from "../services/chat.service.js";
import openAiService from "../services/open-ai.service.js";

const startConversation = async (req, res) => {
    try {
        const { metadataId, userTextMessage, metadataFields } = req.body;

        let completeNameList = metadataFields.map((field) => field.completeName);
        let completeNameStringList = completeNameList.join('\n');
        let systemMessage = SYSTEM_MESSAGE + completeNameStringList;

        let name = userTextMessage;

        const newConversation = await chatService.createConversation({ metadataId, name, systemMessage, metadataFields });
        let newUserMessage = await chatService.createMessage({ conversationId: newConversation.id, sender: 'user', text: userTextMessage });
        let messages = await chatService.getMessagesByConversationId(newConversation.id);

        let completionSql = await openAiService.getChatCompletion(systemMessage, messages);

        let tableConfigs = astToWeknowService.createWeknowConfigFromSql(metadataId, ObjectTypes.Table, completeNameList, completionSql);
        let weknowGridConfig = tableConfigs.weknowConfig;

        let allowChart = astToWeknowService.gridConfigAllowChartRender(weknowGridConfig);

        let weknowChartConfig;
        if (allowChart) {
            let chartConfigs = astToWeknowService.createWeknowConfigFromSql(metadataId, ObjectTypes.Chart, completeNameList, completionSql);
            weknowChartConfig = chartConfigs.weknowConfig;
        }

        let botMessage = {
            sender: 'bot',
            text: completionSql,
            gridConfig: weknowGridConfig,
            chartConfig: weknowChartConfig
        };
        let newBotMessage = await chatService.createMessage({ conversationId: newConversation.id, ...botMessage });

        return res.status(201).json({
            newConversation,
            newUserMessage,
            newBotMessage,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao iniciar conversa.', error: error.message });
    }
};

const getConversations = async (req, res) => {
    try {
        const conversations = await chatService.getConversations();
        return res.json(conversations);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao buscar conversas.', error: error.message });
    }
}

const getMessagesByConversationId = async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await chatService.getMessagesByConversationId(id);
        return res.json(messages);
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao buscar mensagens.', error: error.message });
    }
}

const addUserMessageToConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const { userTextMessage } = req.body;

        let conversation = await chatService.getConversationById(id);
        if (!conversation) {
            throw new Error('Conversa não encontrada.');
        }

        let newUserMessage = await chatService.createMessage({ conversationId: id, sender: 'user', text: userTextMessage });
        let messages = await chatService.getMessagesByConversationId(id);

        let completeNameList = conversation.metadataFields.map((field) => field.completeName);

        let completionSql = await openAiService.getChatCompletion(conversation.systemMessage, messages);

        let tableConfigs = astToWeknowService.createWeknowConfigFromSql(conversation.metadataId, ObjectTypes.Table, completeNameList, completionSql);
        let weknowGridConfig = tableConfigs.weknowConfig;

        let allowChart = astToWeknowService.gridConfigAllowChartRender(weknowGridConfig);

        let weknowChartConfig;
        if (allowChart) {
            let chartConfigs = astToWeknowService.createWeknowConfigFromSql(conversation.metadataId, ObjectTypes.Chart, completeNameList, completionSql);
            weknowChartConfig = chartConfigs.weknowConfig;
        }

        let botMessage = {
            sender: 'bot',
            text: completionSql,
            gridConfig: weknowGridConfig,
            chartConfig: weknowChartConfig
        };

        let newBotMessage = await chatService.createMessage({ conversationId: id, ...botMessage });

        return res.status(201).json({ newUserMessage, newBotMessage });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao adicionar mensagem à conversa.', error: error.message });
    }
};

export default {
    startConversation,
    getConversations,
    getMessagesByConversationId,
    addUserMessageToConversation
};