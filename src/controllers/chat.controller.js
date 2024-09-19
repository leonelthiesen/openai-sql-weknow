import astToWeknowService from "../services/ast-to-weknow.service";
import { ObjectTypes, SYSTEM_MESSAGE } from "../constants";
import chatService from "../services/chat.service";
import openAiService from "../services/open-ai.service";

const startConversation = async (req, res) => {
    try {
        const { metadataId, userTextMessage, metadataFields } = req.body;
        const newConversation = await chatService.createConversation({ metadataId });
        const userMessage = await chatService.addMessageToConversation({ conversationId: newConversation.id, sender: 'user', text: userTextMessage });
        let completeNameList = metadataFields.map((field) => field.completeName);
        let completeNameStringList = completeNameList.join('\n');
        let systemMessage = SYSTEM_MESSAGE + completeNameStringList;

        console.log('Getting chat completion...');
        let completionSql = await openAiService.getChatCompletion(systemMessage, userMessage);
        let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(metadataId, ObjectTypes.Chart, completeNameList, completionSql);

        let botMessage = {
            sender: 'bot',
            text: 'Veja o resultado da sua consulta:',
            sql: completionSql,
            chartConfig: JSON.stringify(weknowConfig),
            timestamp: new Date()
        };
        // botMessage = await chatService.addMessageToConversation({ conversationId: newConversation.id, message: botMessage });

        // id: 2,
        // sender: 'bot',
        // // text: 'Entendi, você quer ver a contagem de vendas por empresa em ordem, segue', // TODO: fazer com que o bot responda um texto junto com o SQL
        // sql: `SELECT company_name, COUNT(*) AS total_vendas FROM data GROUP BY company_name ORDER BY total_vendas DESC;`,
        // chartConfig: '',
        // chartData: '',
        // gridConfig: '',
        // gridData: '',
        // timestamp: new Date()


        return res.status(201).json({ message: 'Usuário criado com sucesso!', data: botMessage });
    } catch (error) {
        return res.status(500).json({ message: 'Erro ao criar usuário.', error: error.message });
    }
};

export default {
    startConversation
};