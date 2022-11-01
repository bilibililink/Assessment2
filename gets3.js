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
const needle = require('needle');

// Set the region 
AWS.config.update({region: 'ap-southeast-2'});

// Create S3 service object
const s3 = new AWS.S3({ apiVersion: "2006-03-01",region:'ap-southeast-2' });
const bucketName = "n10533915-assignment-2"; 

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

//Twitter
const token = "AAAAAAAAAAAAAAAAAAAAAMlKggEAAAAAfYFr4k5UGb97ZKxcyWq9klt7798%3DX94wLbkAkfZ3z5CJMpPQetxFyKq5FeullOvkvutFLVJCiXImoX";
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';

async function getAllRules() {
    console.log("clicked");

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

async function senti_analysis(rsp){

    const manager = new NlpManager({ languages: ['en'], forceNER: true });
    let s = "";
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;
    let totalTweets = 0;

    await manager.train();
    manager.save(); 

    for(let j = 0; j < rsp.length; j++){
        tweets = rsp[j].text;
        const response = await manager.process('en', tweets);
        //console.log(response.sentiment.vote);
        totalTweets++;

        if(response.sentiment.vote == "positive"){
            totalPositive++;
        }
        else if (response.sentiment.vote == "negative"){
            totalNegative++;
        }
        else{
            totalNeutral++;
        }
    }

    s = 
        `<!doctype html>
        <html>
        <head>
            <style>
                .bar {
                    fill: red;
                }
            </style>
            <script src="https://d3js.org/d3.v4.min.js"></script>
        </head>
        <body>
        <svg width="500" height="400"></svg>
        <script>
        var dataset1 = [${totalPositive}, ${totalNegative}, ${totalNeutral}]
        
        var svg = d3.select("svg"),
                    margin = 200,
                    width = svg.attr("width") - margin,
                    height = svg.attr("height") - margin
        
        
        var xScale = d3.scaleBand().range([0, width]).padding(0.5),
            yScale = d3.scaleLinear().range([height, 0]);
        
        var g = svg.append("g")
                    .attr("transform", "translate(" + 100 + "," + 100 + ")");
        
            
                xScale.domain(dataset1);
                yScale.domain([0, 50]);
        
                g.append("g")
                 .attr("transform", "translate(0," + height + ")")
                 .call(d3.axisBottom(xScale).tickFormat(function(d){
                   return "" + d;
                 })
                 );
        
                g.append("g")
                 .call(d3.axisLeft(yScale).tickFormat(function(d){
                     return "" + d;
                 }).ticks(4));
        
        
               g.selectAll(".bar")
                 .data(dataset1)
                 .enter().append("rect")
                 .attr("class", "bar")
                 .attr("x", function(d) { return xScale(d); })
                 .attr("y", function(d) { return yScale(d); })
                 .attr("width", xScale.bandwidth())
                 .attr("height", function(d) { return height - yScale(d); });
          
        </script>
        </body>
        </html>` +
        `<p> Positive: ${totalPositive}   Negative: ${totalNegative}   Neutral: ${totalNeutral}   Total Tweets: ${totalTweets}</p>`

    for(let i = 0; i < rsp.length; i++){
        tweets = rsp[i].text;
        const response = await manager.process('en', tweets);

        const lines = tweets.split(/\r?\n/);
        const ngrams = new NGrams({ byWord: true });
        const freqs = ngrams.getNGramsFreqs(lines, 1);
        const spellCheck = new SpellCheck({ features: freqs });
        const actual = spellCheck.check(['knowldge', 'thas', 'prejudize']);
        console.log(actual);
        
        s += '<center><div style="border: 1px solid black;padding: 15px;background-color: white;width: 1000px;">' +
            `<p> ${tweets} </p>` +
            `<p> Sentiment Analysis: ${response.sentiment.vote} </p>` +
            '</center>'
        }
        return s;
}

function deleteRules(){
    let currentRules;
    currentRules = getAllRules();

    try {
        // Gets the complete list of rules currently applied to the stream
        currentRules = getAllRules();

        // Delete all rules. Comment the line below if you want to keep your existing rules.
        deleteAllRules(currentRules);
        console.log("Rules Deleted");

    } catch (e) {
        console.error(e);
    }
}


async function createPage(rsp) {
    //Headers and opening body, then main content and close 
    const result = await senti_analysis(rsp);
    
    const str = '<!DOCTYPE html>' +
        '<meta charset="UTF-8">' +
        `<html>
        <head>
        <style>
        body {
            background-color: #E9E9E9;
        }

        ul {
        margin: 0;
        padding: 0;
        }

        li {
            display: table-cell;
            height: 50;
            width: 800px;
            background: lightgrey;
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
        '<h1 style="text-align: center;font-size: 55px;font-family: Times New Roman", Times, serif;>' + `Sport Tweets` + '</h1>' +
        `<script type = "text/javascript" src="gets3.js"></script>` +
        `<button name="button" type="button" onclick="getAllRules()">Stop Stream</button>` +
        '<ul>' + 
        '<li><a href="/search/basketball">Basketball</a></li>' +
        '<li><a href="/search/cricket">Cricket</a></li>' +
        '<li><a href="/search/football">Football</a></li>' +
        '<li><a href="/search/tennis">Tennis</a></li>' +
        '<li><a href="/search/swimming">Swimming</a></li>' +
        '</ul>' +
        '<p>' + result + '</p>' +
        '</body></html>';
    return str;
}

//redirect search requests to the external news router
app.use('/search?', sportRouter);

app.listen(3000, () => {
    console.log("Server listening on port: ", 3000);
});
