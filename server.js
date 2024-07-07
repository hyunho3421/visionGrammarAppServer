const express = require('express');
const bodyParser = require('body-parser');

const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 8080;

const OpenAIApi = require('openai');
require('dotenv').config();

const openai = new OpenAIApi({
    apiKey: process.env.OPENAK
});

// firestore
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require('firebase-admin/firestore');

var serviceAccount = require("./path/to/serviceAccountKey.json");

const config = {
    credential: cert(serviceAccount)
}

const firebaseApp = initializeApp(config);
const dbDevelop = getFirestore(firebaseApp, "vision-grammar-server");
// firestore

// 미들웨어 설정 
app.use(bodyParser.json());

async function callChatGpt(message) {
    try {
        const questionText = message + "1~5번중에 맞춤법, 뛰어쓰기, 문법이 맞는 말이 뭐야? 정답 번호와 문장만 알려줘. 설명은 하지마."

        const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages: [{ role: 'system', content: '당신은 한국어 문법 전문가입니다.' },{ role: 'user', content: questionText }],
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error(error);
    }
}

app.get('/', async (req, res) => {
    // const { sex } = req.body;
    // var resParam = "";
    // try {
    //     // const docRef = dbDevelop.collection("users").doc("hyunho");
    //     // const docRef = dbDevelop.collection("users").where("grant", "==", true).limit(1);
    //     // const doc = await docRef.get();
    //     // const querySnapshot = await docRef.get();

    //     // console.log("size = " + doc.size);

    //     // const appId = "";
    //     // querySnapshot.forEach((doc) => {
    //     //     console.log(doc.id, ' => ', doc.data());
    //     //     // appId = 
    //     // });
    //     // const doc = querySnapshot;
          

    //     // if (!doc.exists) {
    //     //     console.log("not exists");
    //     //   } else {
    //     //     console.log(doc.data());
    //     //     resParam = doc.data();
    //     //   }
    // } catch(error) {
    //     console.log("error is " + error.message);
    // }

    res.send("hello world ");

});

app.post('/vision/check', async (req, res) => {
    const { name, deviceId, model, manufacturer, release, sdkInt, grant, brand, ip } = req.body;

    try {
        const deviceRef = dbDevelop.collection("device").doc(deviceId);
        const doc = await deviceRef.get();

        if (!doc.exists) {
            res.json({
                result:"NOT_EXIST_USER",
                grant: false,
                name: ""
            });
        } else {
            if (doc.data().grant == true) {
                res.json({result:"SUCCESS_CHECK", grant: true,
                    name: doc.data().name});
            } else {
                // 권한 없음.
                res.json({result:"SUCCESS_CHECK", grant: false,
                    name: doc.data().name});
            }
        }

    } catch (err) {
        res.json({
            result:"SERVER_ERROR",
            grant: false
        });
    }
});

app.post('/vision/regist', async (req, res) => {
    const { name, deviceId, model, manufacturer, release, sdkInt, grant, brand, ip } = req.body;

    try {
        const deviceRef = dbDevelop.collection("device").doc(deviceId);
        const doc = await deviceRef.get();

        if (doc.exists) {
            res.json({
                result:"ALREADY_EXIST_USER",
                grant: doc.date().grant,
                name: doc.date().name
            });
        } else {
            // 한국 시간으로 설정 (Asia/Seoul)
            const moment = require('moment-timezone');
            const koreanTime = moment.tz(new Date(), 'Asia/Seoul');
            const joinDate = koreanTime.format('YYYY년 M월 D일 dddd HH시mm분');

            deviceRef.set({
                name: name,
                model: model,
                manufacturer: manufacturer,
                release: release,
                sdkInt: sdkInt,
                grant: false,
                brand: brand,
                ip: ip,
                joinDate: joinDate,
                useDate: '',
                useApi: 0
            });

            res.json({
                result:"SUCCESS_REGIT",
                grant: false,
                name: name
            });
        }

    } catch (err) {
        res.json({
            result:"SERVER_ERROR",
            grant: false,
            name: ""
        });
    }
});

app.post('/vision/grammar', async (req, res) => {
    const { deviceId, questionText } = req.body;

    // console.log("questionText is " + questionText);

    // 등록된 계정 정보 가져오기
    const docRef = dbDevelop.collection("device").doc(deviceId);
    const doc = await docRef.get();

    if (!doc.exists) {
        // 계정 없음
        res.send({"result":"NOT_EXIST_USER", "grant" : false, "message" : ""});
    } else {
        if (doc.data().grant == true) {
            const chatGptRes = await callChatGpt(questionText);

            res.send({
                "message" : chatGptRes,
                "grant" : true,
                "result" : "SUCCESS"
            });

            // 한국 시간으로 설정 (Asia/Seoul)
            const moment = require('moment-timezone');
            const koreanTime = moment.tz(new Date(), 'Asia/Seoul');
            const useDate = koreanTime.format('YYYY년 M월 D일 dddd HH시mm분');
            const useApi = doc.data().useApi + 1;
            console.log(useApi);
            docRef.update({useApi:useApi, useDate: useDate});
        } else {
            // 권한 없음.
            res.send({"result":"NOT_GRANT", "grant" : false, "message" : ""});
        }
    }
});

/**
 * app에 certify 저장안되어있을때 호출
 * req : appId, brand, modelName, manufacturer
 * res : certifyId (appId:uuid)
 */
app.post('/app/first', async (req, res) => {
    // const { certifyId, questionText } = req.body;
    const { name, brand, modelName, manufacturer } = req.body;

    // appId 생성
    const appId = uuidv4();

    let today = new Date();   
    const date = today.getMonth + today.getDate + today.getHours() + today.getMinutes();

    const createResult = await dbDevelop.collection("users").doc(appId).set({
        name: name,
        brand: brand,
        modelName: modelName,
        manufacturer: manufacturer,
        date: today,
        grant: false,
        useApi: 0
    });

    res.json({
        result:"FIRST_SAVE",
        appId: appId
    });

});

/**
 * app에 appId (deviceId) 호출 받아서 DB에서 certify 가져오기
 * req : appId (deviceId)
 * res : certifyId (appId:uuid)
 */
app.post('/app/certify', async (req, res) => {
    const { appId } = req.body;

    // 등록된 계정 정보 가져오기
    const docRef = dbDevelop.collection("users").doc(appId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
        // 계정 없음
        res.json({"result":"NO_USER"});
    } else {
        if (doc.data().grant == true) {
            res.json({"result":"PERMISION_GRANT"});
        } else {
            // 권한 없음.
            res.json({"result":"NO_GRANT"});
        }
    }
});

app.post('/grammar/check', async (req, res) => {
    const { appId, questionText } = req.body;

    // console.log("questionText is " + questionText);

    // 등록된 계정 정보 가져오기
    const docRef = dbDevelop.collection("users").doc(appId);
    const doc = await docRef.get();

    if (!doc.exists) {
        // 계정 없음
        res.json({"result":"NO_USER"});
    } else {
        if (doc.data().grant == true) {
            const chatGptRes = await callChatGpt(questionText);

            res.send({
                "correct" : chatGptRes,
                "result" : "SUCCESS"
            });

            const useApi = doc.data().useApi + 1;
            console.log(useApi)
            docRef.update({useApi:useApi});
        } else {
            // 권한 없음.
            res.json({"result":"NO_GRANT"});
        }
    }

    //const res = callChatGpt("1번:\'놀랄 첩 호통을 뺀다.\'\n2번:\'다섯 나눌 구한다.\'\n3번:\'물건이 변조되다.\'\n4번:\'같아 맑고 동원한다.\'\n5번:\'밥 평소 그러한 세웠다.\'\n1~5번중에 맞춤법, 뛰어쓰기, 문법이 맞는 말이 뭐야? 정답 번호와 문장만 알려줘. 설명은 하지마.");
    //const chatGptRes = callChatGpt();
    
    //res.send(chatGptRes);
});

// 서버 시작
app.listen(port, () => {
    console.log('Server is running on');
});