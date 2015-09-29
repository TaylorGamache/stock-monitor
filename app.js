var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var express = require('express');
var request = require('request');

var app = express();
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.send("Welcome to Weather-Monitoring Server!");
});

request({
        url: 'https://482ce492-5318-4aa3-86fd-27cabcf1aac0-bluemix.cloudant.com/test/_all_docs?limit=100',
        method: 'POST',
        
        form: {
            "_id": "apple",
            "item": "Malus domestica",
            "prices": {
                "Fresh Mart": 1.59,
                "Price Max": 5.99,
                "Apples Express": 0.79
            }
        }
}, function(error, response, body){
        if(error){
            console.log(error);
        }else{
            console.log(response.statusCode, body);
        }
});



app.listen(port);
