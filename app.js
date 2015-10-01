var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var http = require('http');
require('dotenv').load();

var app = express();

var time = "";
var weather = "";
var weatherDescription = "";
var total = "";
var location = "";

function timeRequest(){
request("http://api.geonames.org/timezoneJSON?lat=41.83&lng=-72.256&username=demo", function(error, response, body){
	if (!error && response.statusCode == 200){
		var bodyParse = JSON.parse(body);
		time = bodyParse.time;
		console.log("time: " + time);

	}else{
		console.log(response);
		throw error;
	}
})

request("http://api.openweathermap.org/data/2.5/weather?q=Storrs,ct", function(error, response, body){
	if (!error && response.statusCode == 200){
		var bodyParse = JSON.parse(body);
		weather = bodyParse.weather[0].main;
		weatherDescription = bodyParse.weather[0].description;
		location = bodyParse.name;
	}else{
		console.log(response);
		throw error;
	}
})

};

var myVar = setInterval(timeRequest, 10000);
timeRequest();

app.get('/', function(req, res){
	total = location + ":\n" +
		"Time: " + time + "\n" +
		"Weather: " + weather + "\n" +
		"Details: " + weatherDescription;
	res.send(total);
})

app.listen(port);