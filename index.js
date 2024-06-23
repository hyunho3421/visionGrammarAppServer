const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

const OpenAIApi = require('openai');
require('dotenv').config();

const openai = new OpenAIApi({
    apiKey: process.env.OPENAK
});

// 미들웨어 설정
app.use(bodyParser.json());

async function callChatGpt(message) {
    try {
        console.log("[GPT][REQ][PARAM]" + message);

        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [{ role: 'system', content: '당신은 한국어 문법 전문가입니다.' },{ role: 'user', content: message }],
        });

        console.log("[GPT][RES][PARAM]" + response.choices[0].message.content);

        return response.choices[0].message.content;
    } catch (error) {
        console.error(error);
    }
}

app.get('/', (req, res) => {
    res.send("hello world");
});
    
app.get('/grammar/check', (req, res) => {
    const { certifyId, questionText } = req.body;
    console.log("[]");

    //const res = callChatGpt("1번:\'놀랄 첩 호통을 뺀다.\'\n2번:\'다섯 나눌 구한다.\'\n3번:\'물건이 변조되다.\'\n4번:\'같아 맑고 동원한다.\'\n5번:\'밥 평소 그러한 세웠다.\'\n1~5번중에 맞춤법, 뛰어쓰기, 문법이 맞는 말이 뭐야? 정답 번호와 문장만 알려줘. 설명은 하지마.");
    const chatGptRes = callChatGpt();
    
    res.send(chatGptRes);
});

// 서버 시작
app.listen(port, () => {
    console.log('Server is running on http://localhost:${port}');
});