// Open a realtime stream of Tweets, filtered according to rules
// https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/quick-start

const needle = require('needle');
const AWS = require('aws-sdk');
const express = require('express');
const { response } = require('express');
const app = express();
require('dotenv').config();
const redis = require('redis');

// Cloud Services Set-up
// Create unique bucket name
const bucketName = "n10533915-assignment-2"; 
const s3 = new AWS.S3({ apiVersion: "2006-03-01",region:'ap-southeast-2' });
var s3Key = "";
s3.createBucket({ Bucket: bucketName })
  .promise()
  .then(() => console.log(`Created bucket: ${bucketName}`)) 
  .catch((err) => {
      // We will ignore 409 errors which indicate that the bucket already exists
    if (err.statusCode !== 409) {
        console.log(`Error creating bucket: ${err}`);
    } 
});

// Redis setup
const redisClient = redis.createClient(); 
redisClient.connect()
.catch((err) => { console.log(err);
});

// The code below sets the bearer token from your environment variables
// To set environment variables on macOS or Linux, run the export command below from the terminal:
// export BEARER_TOKEN='YOUR-TOKEN'
const token = "AAAAAAAAAAAAAAAAAAAAAMlKggEAAAAAfYFr4k5UGb97ZKxcyWq9klt7798%3DX94wLbkAkfZ3z5CJMpPQetxFyKq5FeullOvkvutFLVJCiXImoX";
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream';

// this sets up two rules - the value is the search terms to match on, and the tag is an identifier that
// will be applied to the Tweets return to show which rule they matched
// with a standard project with Basic Access, you can add up to 25 concurrent rules to your stream, and
// each rule can be up to 512 characters long

// Edit rules as desired below
const rules = [
    {
        'value': 'basketball lang:en',
        'tag': 'basketball',
    },
    {
        'value': 'football lang:en',
        'tag': 'football',
    },
    {
        'value': 'cricket lang:en',
        'tag': 'cricket',
    },
    {
        'value': 'swimming lang:en',
        'tag': 'swimming',
    },
    {
        'value': 'tennis lang:en',
        'tag': 'tennis',
    },
];

async function getAllRules() {

    const response = await needle('get', rulesURL, {
        headers: {
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        console.log("Error:", response.statusMessage, response.statusCode)
        throw new Error(response.body);
    }

    return (response.body);
}

async function deleteAllRules(rules) {

    if (!Array.isArray(rules.data)) {
        return null;
    }

    const ids = rules.data.map(rule => rule.id);

    const data = {
        "delete": {
            "ids": ids
        }
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 200) {
        throw new Error(response.body);
    }

    return (response.body);

}

async function setRules() {

    const data = {
        "add": rules
    }

    const response = await needle('post', rulesURL, data, {
        headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
        }
    })

    if (response.statusCode !== 201) {
        throw new Error(response.body);
    }
    return (response.body);
}

function streamConnect(retryAttempt) {

    const stream = needle.get(streamURL, {
        headers: {
            "User-Agent": "v2FilterStreamJS",
            "Authorization": `Bearer ${token}`
        },
        timeout: 20000
    });

    stream.on('data', data => {
        try {
            const json = JSON.parse(data);
            const tags = json.matching_rules[0].tag;
            //const responseJSON = json.data; 
            console.log(json);
            s3Key = `${tags}`;

            // Check S3
            const params = { Bucket: bucketName, Key: s3Key };
            s3.getObject(params) 
            .promise() 
            .then((result) => {
                const resultJSON = JSON.parse(result.Body);
                const body = JSON.stringify([json.data, ...resultJSON]);

                const objectParams = { Bucket: bucketName, Key: s3Key, Body: body}; 
                s3.putObject(objectParams)
                .promise()
                .then(() => {                
                    console.log(`Successfully uploaded data to ${bucketName}/${s3Key}`);
                });

                //also store it in the cache
                redisClient.setEx(
                    s3Key,
                    3600,
                    JSON.stringify([json.data, ...resultJSON])
                )
            })
            .catch((err) =>{
                if(err.statusCode==404){
                    const body = JSON.stringify([json.data]);    
                    const objectParams = { Bucket: bucketName, Key: s3Key, Body: body}; 
                    s3.putObject(objectParams)
                    .promise()
                    .then(() => {      
                        console.log(`Successfully create a key: ${s3Key}`);
                        });
                    }
                    
                    //also store it in the cache
                    redisClient.setEx(
                    s3Key,
                    3600,
                    JSON.stringify([json.data])
                    )
                })

            // A successful connection resets retry count.
            retryAttempt = 0;
        } catch (e) {
            if (data.detail === "This stream is currently at the maximum allowed connection limit.") {
                console.log(data.detail)
                process.exit(1)
            } else {
                // Keep alive signal received. Do nothing.
            }
        }
    }).on('err', error => {
        if (error.code !== 'ECONNRESET') {
            console.log(error.code);
            process.exit(1);
        } else {
            // This reconnection logic will attempt to reconnect when a disconnection is detected.
            // To avoid rate limits, this logic implements exponential backoff, so the wait time
            // will increase if the client cannot reconnect to the stream. 
            setTimeout(() => {
                console.warn("A connection error occurred. Reconnecting...")
                streamConnect(++retryAttempt);
            }, 2 ** retryAttempt)
        }
    });

    return stream;
}

(async () => {
    let currentRules;

    try {
        // Gets the complete list of rules currently applied to the stream
        currentRules = await getAllRules();

        // Delete all rules. Comment the line below if you want to keep your existing rules.
        await deleteAllRules(currentRules);

        // Add rules to the stream. Comment the line below if you don't want to add new rules.
        await setRules();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    // Listen to the stream.
    streamConnect(0);
})();










