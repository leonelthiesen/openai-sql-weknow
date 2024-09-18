import { createWeknowConfigFromSql } from "../astToWeknowConfig";
import { convertTreeViewInList } from "../utils/utils";

const startConversation = async (req, res) => {
    try {
        const { metadataId, message } = req.body;
        const newConversation = await conversationService.createConversation({ metadataId });
        const userMessage = await messageService.createMessage({ conversationId: newConversation.id, message });
        let metadataSummary = await weknow.getMetadataSummary(metadataId, auth.accessToken);
        let fields = convertTreeViewInList(metadataSummary.fields || []);
        let completeNameList = fields.map((field) => field.completeName);
        let completeNameStringList = completeNameList.join('\n');
        let systemMessage = SYSTEM_MESSAGE + completeNameStringList;

        console.log('Getting chat completion...');
        let completionSql = await openAiChatService.getChatCompletion(systemMessage, userMessage);
        let { weknowConfig } = createWeknowConfigFromSql(metadataId, ObjectTypes.Chart, completeNameList, completionSql);

        let botMessage = {
            sender: 'bot',
            text: 'Veja o resultado da sua consulta:',
            sql: completionSql,
            chartConfig: JSON.stringify(weknowConfig),
            timestamp: new Date()
        };
        botMessage = await messageService.createMessage({ conversationId: newConversation.id, message: botMessage });

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