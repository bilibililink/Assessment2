// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
const express = require('express');
const app = express();
require('dotenv').config();
const axios = require('axios');
const sportRouter = require('./sport');
const { NlpManager } = require('node-nlp');
const { SpellCheck } = require('@nlpjs/similarity');
const { NGrams } = require('@nlpjs/utils');

// Set the region 
AWS.config.update({region: 'ap-southeast-2'});

// Create S3 service object
const s3 = new AWS.S3({ apiVersion: "2006-03-01",region:'ap-southeast-2' });
const bucketName = "n10533915-assignment-2"; 

//supplying the fields needed for a valid request
function createSentimentOptions() {
    const senti_options = {
        hostname: 'api.meaningcloud.com',
        port: 443,
        path: '/sentiment-2.1?',
        method: 'GET'
    }
    const senti_str = '&key=c1ec2418fb06b967149ea764d276049f';
    senti_options.path += senti_str;
    return senti_options;
}

app.get("/", (req, res) => { 

    
    const params = { Bucket: bucketName, Key: 'basketball'};
    s3.getObject(params) 
    .promise() 
    .then(async(result) => {
        // Serve from S3
        const resultJSON = JSON.parse(result.Body);
        const s = await createPage(resultJSON);
        res.write(s);
        res.end();
    })
    .catch((error) => {
        console.error(error);
    })
})

async function senti_analysis(rsp){

    const manager = new NlpManager({ languages: ['en'], forceNER: true });
    let s = "";
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;
    await manager.train();
    manager.save(); 
    
    for(let i = 0; i < rsp.length; i++){
        tweets = rsp[i].text;


        const lines = tweets.split(/\r?\n/);
        const ngrams = new NGrams({ byWord: true });
        const freqs = ngrams.getNGramsFreqs(lines, 1);
        const spellCheck = new SpellCheck({ features: freqs });
        const actual = spellCheck.check(['knowldge', 'thas', 'prejudize']);
        console.log(actual);

        const response = await manager.process('en', tweets);
        //console.log(response.sentiment.vote);

        if(response.sentiment.vote == "positive"){
            totalPositive++;
        }
        else if (response.sentiment.vote == "negative"){
            totalNegative++;
        }
        else{
            totalNeutral++;
        }
        
        s += '<center><div style="border: 1px solid black;padding: 15px;background-color:  #BFBFBF;width: 1000px;">' +
            `<p style="color:#BFBFBF"> ${tweets} </p>` +
            `<p style="color:#BFBFBF"> Sentiment Analysis: ${response.sentiment.vote} </p>` +
            '<script>d3.selectAll("p").transition().style("color","black").duration(3000);</script>' +
            '</center>';
        }
        s += `<p style="color:#7E7E7E"> Positive: ${totalPositive}   Negative: ${totalNegative}   Neutral: ${totalNeutral}</p>` +
        '<script>d3.selectAll("p").transition().style("color","black").duration(3000);</script>'
    return s;
}

async function createPage(rsp) {
    //Headers and opening body, then main content and close 
    const result = await senti_analysis(rsp);
    const str = '<!DOCTYPE html>' +
        '<meta charset="UTF-8">' +
        `<html>
        <head>
        <script type = "text/javascript" src = "https://d3js.org/d3.v4.min.js"></script>
        <style>
        body {
            background-color: #7E7E7E;
        }

        ul {
        margin: 0;
        padding: 0;
        }

        li {
            display: table-cell;
            height: 50;
            width: 800px;
            background: #BFBFBF;
        }

        li a {
        display: block;
        color: black;
        text-align: center;
        padding: 20px 16px;
        text-decoration: none;
        }

        li a:hover {
        background-color: gray;
        }
        </style>
        <title>AU News</title>
        </head>` +
        '<body>' +
        '<h1 style="text-align: center;font-size: 55px; color: #7E7E7E;font-family: Times New Roman", Times, serif;">' + `Sport Tweets` + '</h1>' +
        '<script>d3.selectAll("h1").transition().style("color","black").duration(3000);</script>' +
        '<ul>' + 
        '<li ><a style="color:#BFBFBF" href="/search/basketball">Basketball</a></li>' +
        '<li ><a style="color:#BFBFBF" href="/search/cricket">Cricket</a></li>' +
        '<li ><a style="color:#BFBFBF" href="/search/soccer">Soccer</a></li>' +
        '<li ><a style="color:#BFBFBF" href="/search/tennis">Tennis</a></li>' +
        '<li ><a style="color:#BFBFBF" href="/search/swimming">Swimming</a></li>' +
        '<script>d3.selectAll("a").transition().style("color","black").duration(3000);</script>' +
        '</ul>' +
        '<p style="color:#BFBFBF">' + result + '</p>' +
        '<script>d3.selectAll("p").transition().style("color","black").duration(3000);</script>' +
        '</body></html>';
    return str;
}

//redirect search requests to the external news router
app.use('/search?', sportRouter);

app.listen(3000, () => {
    console.log("Server listening on port: ", 3000);
});