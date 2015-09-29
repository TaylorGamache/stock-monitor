var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var express = require('express');
var request = require('request');

var app = express();
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
    res.send("Welcome to Weather-Monitoring Server!");
});




app.listen(port);
