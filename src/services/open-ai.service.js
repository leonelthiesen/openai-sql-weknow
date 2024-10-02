import OpenAI from 'openai';

const OpenAiModels = {
    gpt4: "gpt-4",
    gpt35Turbo: "gpt-3.5-turbo",
};

async function getChatCompletion (systemMessage, messages) {
    let openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    let completionMessages = [{
        role: "system",
        content: systemMessage
    }];

    completionMessages = completionMessages.concat(messages.map((message) => {
        return {
            role: message.sender === 'bot' ? 'assistant' : 'user',
            content: message.text
        };
    }));

    const chatCompletion = await openai.chat.completions.create({
        model: OpenAiModels.gpt35Turbo,
        messages: completionMessages,
        temperature: 0,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    });

    return chatCompletion.choices[0].message.content;
}

export default {
    getChatCompletion
};
