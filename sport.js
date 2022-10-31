const express = require('express');
const https = require('https');
const router = express.Router();
const axios = require('axios');
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
const { NlpManager } = require('node-nlp');
const { SpellCheck } = require('@nlpjs/similarity');
const { NGrams } = require('@nlpjs/utils');

// Set the region 
AWS.config.update({region: 'ap-southeast-2'});

// Create S3 service object
const s3 = new AWS.S3({ apiVersion: "2006-03-01",region:'ap-southeast-2' });
const bucketName = "n10533915-assignment-2"; 

router.get('/:Key', (req, res) => {

    const params = { Bucket: bucketName, Key: req.params.Key};
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
});

async function senti_analysis(rsp){
    const manager = new NlpManager({ languages: ['en'], forceNER: true });
    let s = "";
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
        
        s += '<center><div style="border: 1px solid black;padding: 15px;background-color: #BFBFBF;width: 1000px;">' +
            `<p style="color:#BFBFBF"> ${tweets} </p>` +
            `<p style="color:#BFBFBF"> Sentiment Analysis: ${response.sentiment.vote} </p>` +
            '<script>d3.selectAll("p").transition().style("color","black").duration(2000);</script>' +
            '</center>';
         }
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
        '<h1 style="text-align: center;font-size: 55px;color: #7E7E7E;font-family: Times New Roman", Times, serif;">' + `Sport Tweets` + '</h1>' +
        '<script>d3.selectAll("h1").transition().style("color","black").duration(2000);</script>' +
        `<a style = "text-decoration: none;color:#7E7E7E" href="/"> <-Home Page </a>` + 
        '<script>d3.selectAll("a").transition().style("color","black").duration(2000);</script>' +
        '<p>' + result + '</p>' +
        '</body></html>';
    return str;
}

module.exports = router;
