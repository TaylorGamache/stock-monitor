var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var bodyParser = require("body-parser");
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var json = require('json');
var me = 'lukebelliveau';
var password = 'weathermonitor';
var weatherAPIKey = "02866fb0b72a03f9"
var triggerCallback = "http://nsds-api-stage.mybluemix.net/api/v1/trigger/"

var app = express();

var cloudant = Cloudant({account:me, password:password});

cloudant.db.list(function(err, allDbs){
	console.log("my dbs: %s", allDbs.join(','))
});

var recipesDB = cloudant.db.use('recipes');

app.use(bodyParser.json());
// app.use(express.json());
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
	res.send("Hello world!");
	// watchForTemperature();
})

app.get('/test', function(req, res){
	res.send("test page");
	// watchForTemperatureHelper(200, "LT", "http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "dummyID", "Storrs", "CT", 1000);
	watchForTemperature(200, "LT", "http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "dummyID", "Storrs", "CT");
})

app.post('/recipes', function(req, res){
	/**
	1.) Store recipe in DB and return response
	2.) start watchForTemperatureHelper
	*/
	var request = req.body;
	// console.log(request.recipe.trigger);
	recipesDB.insert(request, function(err, body, header){
		var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			var recipeID = body.id;
			response['success'] = true;
			response['message'] = "Recipe added to DB.";
			res.status(200).json(response);
			var targetTemp = request.recipe.trigger.temperature;
			var city = request.recipe.trigger.city;
			var state = request.recipe.trigger.state;
			var relation = request.recipe.trigger.relation;
			console.log(targetTemp + " " + city + " " + " " + state);
			watchForTemperature(targetTemp, relation, triggerCallback, recipeID, city, state);
		}
	})
	
})

function watchForTemperatureHelper(targetTemp, relation, callback, recipeID, city, state, timeout){
	setInterval(watchForTemperature(targetTemp, relation, callback, recipeID, city, state), timeout);
}

function watchForTemperature(targetTemp, relation, callback, recipeID, city, state){
	if(relation != "LT" || relation != "GT"){
		//this will be extended to also do equal to, greater than
		console.log("invalid comparison signal");
		return;
	}

	requestURL = "http://api.wunderground.com/api/"
	requestURL += weatherAPIKey + "/conditions/q/"
	requestURL += state + "/" + city + ".json";
	console.log(requestURL);

	request(requestURL, function(err, response, body){
		if(!err){
			var parsedbody = JSON.parse(body);
			var currentTemp = parsedbody.current_observation.temp_f;
			console.log("current temp: " + currentTemp);
			if(currentTemp < targetTemp){
				console.log("Target hit, calling callback URL...");
				callback += recipeID;
				request(callback, function(err, response, body){
					if(!err){
						console.log("successfully sent trigger, response body:");
						console.log(body);
					}else{
						console.log(response);
						throw err;
					}
				});
			}
			if (currentTemp > targetTemp){
				console.log("Target hit, calling callback URL...");
				callback += recipeID;
				request(callback, function(err, response, body){
					if(!err){
						console.log("successfully sent trigger, response body:");
						console.log(body);
					}else{
						console.log(response);
						throw err;
					}
				});
			}
		}else{
			console.log(response);
			throw err;
		}
		
	});
}
/* Function for getting weather alerts */
function watchForTemperatureAlert(targetTemp, relation, callback, recipeID, city, state){
	if(relation != "Alert"){
		//this will be extended to also do equal to, greater than
		console.log("invalid relation");
		return;
	}
	requestURL = "http://api.wunderground.com/api/"
	requestURL += weatherAPIKey + "/alerts/q/"
	requestURL += state + "/" + city + ".json";
	console.log(requestURL);

	request(requestURL, function(err, response, body){
		if(!err){
			//
			//Parse response, determine what relation will serve as trigger
			var parsedbody = JSON.parse(body);
			var currType = parsedbody.type;
			console.log("type of alert: " + type);
			
		}else{
			console.log(response);
			throw err;
		}
		
	});
}
app.listen(port);

