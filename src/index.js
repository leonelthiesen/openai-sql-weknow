import OpenAI from 'openai';
import 'dotenv/config';


openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


let models = {
    gpt4: "gpt-4",
    gpt35Turbo: "gpt-3.5-turbo",
};

try {
    const chatCompletion = await this.openai.chat.completions.create({
        model: models.gpt4,
        messages: [{
            role: "system",
            content: `${systemMessage}`
        }, {
            role: "user",
            content: `${userMessage}`
        }],
        temperature: 0,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    }).catch((err) => {
        throw err;
    });

    const data = chatCompletion.choices[0].message.content;

    console.log(data);
} catch (error) {
    console.error(error);
}



