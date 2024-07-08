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

const moment_timezone = require('moment-timezone');

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

function getNowTime() {
    // 한국 시간으로 설정 (Asia/Seoul)
    const koreanTime = moment_timezone.tz(Date.now(), 'Asia/Seoul');
    const nowTime = koreanTime.format('YYYY년 M월 D일 HH시mm분');

    return nowTime;
}

function getNowTimeLog() {
    // 한국 시간으로 설정 (Asia/Seoul)
    const koreanTime = moment_timezone.tz(Date.now(), 'Asia/Seoul');
    const nowTime = koreanTime.format('YYYY.M/D HH:mm');

    return nowTime;
}

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

app.get('/health/check', async (req, res) => {
    res.send("hello world ");
});

app.post('/vision/check', async (req, res) => {
    console.time("[TIME][VISION][CHECK]");
    const { name, deviceId, model, manufacturer, release, sdkInt, grant, brand, ip } = req.body;
    console.log("[REQ][VISION][CHECK][" + deviceId + "]:"+ getNowTimeLog());

    try {
        const deviceRef = dbDevelop.collection("device").doc(deviceId);
        const doc = await deviceRef.get();

        if (!doc.exists) {
            res.send({
                "result":"NOT_EXIST_USER",
                "grant": false,
                "name": ""
            });
            console.log("[RES][VISION][CHECK][" + deviceId + "] {result: NOT_EXIST_USER, grant: false, name: }");
            console.timeEnd("[TIME][VISION][CHECK]");
        } else {
            if (doc.data().grant == true) {
                res.send({"result":"SUCCESS_CHECK", "grant": true,
                    "name": doc.data().name});
                console.log("[RES][VISION][CHECK][" + deviceId + "] {result: SUCCESS_CHECK, grant: true, name: "+doc.data().name+"}");
                console.timeEnd("[TIME][VISION][CHECK]");
            } else {
                // 권한 없음.
                res.send({"result":"SUCCESS_CHECK", "grant": false,
                    "name": doc.data().name});
                console.log("[RES][VISION][CHECK][" + deviceId + "] {result: SUCCESS_CHECK, grant: false, name: "+doc.data().name+"}");
                console.timeEnd("[TIME][VISION][CHECK]");
            }
        }

    } catch (err) {
        res.send({
            "result":"SERVER_ERROR",
            "grant": false,
            "name": ""
        });
        console.log("error is " + err);    
        console.log("[RES][VISION][CHECK][" + deviceId + "][ERROR] {result: SERVER_ERROR, grant: false, name: }");
        console.timeEnd("[TIME][VISION][CHECK]");
    }

});

app.post('/vision/regist', async (req, res) => {
    console.time("[TIME][VISION][REGIST]");
    const { name, deviceId, model, manufacturer, release, sdkInt, grant, brand, ip } = req.body;
    console.log("[REQ][VISION][REGIST][" + deviceId + "]:"+ getNowTimeLog() + ": {name: " + name + ", model: " + model + ", manufacturer: " + manufacturer 
    + ", release: " + release + ", sdkInt: " + sdkInt + ", brand: " + brand + ", ip: " + ip + "}"); 

    try {
        const deviceRef = dbDevelop.collection("device").doc(deviceId);
        const doc = await deviceRef.get();

        if (doc.exists) {
            res.send({
                "result":"ALREADY_EXIST_USER",
                "grant": doc.data().grant,
                "name": doc.data().name
            });
            console.log("[RES][VISION][REGIST][" + deviceId + "] {result: ALREADY_EXIST_USER, grant: " + doc.data().grant + ", name: " + doc.data().name+"}");
            console.timeEnd("[TIME][VISION][REGIST]");
        } else {
            const joinDate = getNowTime();

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

            res.send({
                "result":"SUCCESS_REGIT",
                "grant": false,
                "name": name
            });
            console.log("[RES][VISION][REGIST][" + deviceId + "] {result: SUCCESS_REGIT, grant: false, name: " + name + "}");
            console.timeEnd("[TIME][VISION][REGIST]");
        }

    } catch (err) {
        res.send({
            "result":"SERVER_ERROR",
            "grant": false,
            "name": ""
        });
        console.log("error is " + err);    
        console.log("[RES][VISION][REGIST][" + deviceId + "][ERROR] {result: SERVER_ERROR, grant: false, name: }");
        console.timeEnd("[TIME][VISION][REGIST]");
    }
});

app.post('/vision/grammar', async (req, res) => {
    console.time("[TIME][VISION][GRAMMAR]");
    const { deviceId, questionText } = req.body;
    console.log("[REQ][VISION][GRAMMAR][" + deviceId + "]:"+ getNowTimeLog() + ": {questionText: " + questionText + "}");

    // 등록된 계정 정보 가져오기
    try {
        const docRef = dbDevelop.collection("device").doc(deviceId);
        console.log(docRef==null ?  "null": "" );
        const doc = await docRef.get();

        if (!doc.exists) {
            // 계정 없음
            res.send({"result":"NOT_EXIST_USER", "grant" : false, "message" : ""});

            console.log("[RES][VISION][GRAMMAR][" + deviceId + "] {result: NOT_EXIST_USER, grant: false, message: }");
            console.timeEnd("[TIME][VISION][GRAMMAR]");
        } else {
            if (doc.data().grant == true) {
                const chatGptRes = await callChatGpt(questionText);

                res.send({
                    "message" : chatGptRes,
                    "grant" : true,
                    "result" : "SUCCESS"
                });

                console.log("[RES][VISION][GRAMMAR][" + deviceId + "] {result: SUCCESS, grant: true, message: " + chatGptRes + "}");
                console.timeEnd("[TIME][VISION][GRAMMAR]");

                const useDate = getNowTime();
                const useApi = doc.data().useApi + 1;
                docRef.update({useApi:useApi, useDate: useDate});
            } else {
                // 권한 없음.
                res.send({
                    "message" : "",
                    "grant" : false,
                    "result" : "NOT_GRANT"
                });
                console.log("[RES][VISION][GRAMMAR][" + deviceId + "] {result: NOT_GRANT, grant: false, message: }");
                console.timeEnd("[TIME][VISION][GRAMMAR]");
            }
        }
    } catch (err) {
        res.send({
            "result":"SERVER_ERROR",
            "grant": false,
            "message": ""
        });
        console.log("error is " + err);    
        console.log("[RES][VISION][GRAMMAR][" + deviceId + "][ERROR] {result: SERVER_ERROR, grant: false, message: }");
        console.timeEnd("[TIME][VISION][GRAMMAR]");
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
    console.log(`Node.js version: ${process.version}`);
});