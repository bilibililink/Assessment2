const { NlpManager } = require('node-nlp');
const { SpellCheck } = require('@nlpjs/similarity');
const { NGrams } = require('@nlpjs/utils');
const needle = require('needle');

// Set the region 
AWS.config.update({region: 'ap-southeast-2'});
@@ -16,22 +17,8 @@ AWS.config.update({region: 'ap-southeast-2'});
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
@@ -47,29 +34,73 @@ app.get("/", (req, res) => {
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

    for(let i = 0; i < rsp.length; i++){
        tweets = rsp[i].text;


        const lines = tweets.split(/\r?\n/);
        const ngrams = new NGrams({ byWord: true });
        const freqs = ngrams.getNGramsFreqs(lines, 1);
        const spellCheck = new SpellCheck({ features: freqs });
        const actual = spellCheck.check(['knowldge', 'thas', 'prejudize', 'pig', 'university', 'brackish', 'nature', 'slyvan', 'intellectual']);
        console.log(actual);

    for(let j = 0; j < rsp.length; j++){
        tweets = rsp[j].text;
        const response = await manager.process('en', tweets);
        //console.log(response.sentiment.vote);
        totalTweets++;

        if(response.sentiment.vote == "positive"){
            totalPositive++;
@@ -80,26 +111,114 @@ async function senti_analysis(rsp){
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
        `<p style="color:#7E7E7E"> Positive: ${totalPositive}   Negative: ${totalNegative}   Neutral: ${totalNeutral}   Total Tweets: ${totalTweets}</p>`
        '<script>d3.selectAll("p").transition().style("color","black").duration(3000);</script>'

    for(let i = 0; i < rsp.length; i++){
        tweets = rsp[i].text;
        const response = await manager.process('en', tweets);

        const lines = tweets.split(/\r?\n/);
        const ngrams = new NGrams({ byWord: true });
        const freqs = ngrams.getNGramsFreqs(lines, 1);
        const spellCheck = new SpellCheck({ features: freqs });
        const actual = spellCheck.check(['knowldge', 'thas', 'prejudize']);
        console.log(actual);

        s += '<center><div style="border: 1px solid black;padding: 15px;background-color:  #BFBFBF;width: 1000px;">' +
            `<p style="color:#BFBFBF"> ${tweets} </p>` +
            `<p style="color:#BFBFBF"> Sentiment Analysis: ${response.sentiment.vote} </p>` +
            '<script>d3.selectAll("p").transition().style("color","black").duration(3000);</script>' +
            '</center>';
        }
        s += `<p style="color:#7E7E7E"> Positive: ${totalPositive}   Negative: ${totalNegative}   Neutral: ${totalNeutral}</p>` +
        '<script>d3.selectAll("p").transition().style("color","black").duration(3000);</script>'
    return s;
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
        <script type = "text/javascript" src = "https://d3js.org/d3.v4.min.js"></script>
        <style>
        body {
            background-color: #7E7E7E;
@@ -134,6 +253,8 @@ async function createPage(rsp) {
        '<body>' +
        '<h1 style="text-align: center;font-size: 55px; color: #7E7E7E;font-family: Times New Roman", Times, serif;">' + `Sport Tweets` + '</h1>' +
        '<script>d3.selectAll("h1").transition().style("color","black").duration(3000);</script>' +
        `<script type = "text/javascript" src="gets3.js"></script>` +
        //`<button name="button" type="button" onclick="getAllRules()">Stop Stream</button>` +
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
