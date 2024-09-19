// Mock data for demonstration purposes
let conversations = [
    {
        id: 1,
        metadataId: 8,
        messages: [{
            id: 1,
            sender: 'user',
            text: 'contagem de vendas por empresa em ordem',
            timestamp: new Date()
        }, {
            id: 2,
            sender: 'bot',
            // text: 'Entendi, você quer ver a contagem de vendas por empresa em ordem, segue', // TODO: fazer com que o bot responda um texto junto com o SQL
            sql: `SELECT company_name, COUNT(*) AS total_vendas FROM data GROUP BY company_name ORDER BY total_vendas DESC;`,
            chartConfig: '',
            chartData: '',
            gridConfig: '',
            gridData: '',
            timestamp: new Date()
        }]
    },
    { id: 2, metadataId: 8, messages: [] }
];

async function getConversations() {
    return conversations;
}

async function getConversationById({ id }) {
    return conversations.find(c => c.id === parseInt(id));
}

async function createConversation({ metadataId }) {
    const newConversation = {
        id: conversations.length + 1,
        metadataId,
        messages: []
    };
    conversations.push(newConversation);
    return newConversation;
}

async function addMessageToConversation({ id, sender, text, sql, chartConfig, chartData, gridConfig, gridData }) {
    const conversation = conversations.find(c => c.id === parseInt(id));
    if (!conversation) { 
        return 'Conversation not found';
    }

    const newMessage = {
        id: conversation.messages.length + 1,
        sender,
        text,
        sql,
        chartConfig,
        chartData,
        gridConfig,
        gridData,
        timestamp: new Date()
    };
    conversation.messages.push(newMessage);
    return newMessage;
}


export default {
    getConversations,
    getConversationById,
    createConversation,
    addMessageToConversation
};
