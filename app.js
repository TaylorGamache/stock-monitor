var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var bodyParser = require("body-parser");
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var json = require('json');
var me = 'lukebelliveau';
var password = 'weathermonitor';
var weatherAPIKey = "02866fb0b72a03f9";
var triggerCallback = "http://nsds-api-stage.mybluemix.net/api/v1/trigger/";
var cron = require('cron');
var noise = true;

var app = express();

var cloudant = Cloudant({account:me, password:password});

// lists all the databases on console

cloudant.db.list(function(err, allDbs){
	console.log("my dbs: %s", allDbs.join(','))
});


var recipesDB = cloudant.db.use('recipes');

app.use(bodyParser.json());
// app.use(express.json());
app.use(express.static(__dirname + '/public'));

// test function
app.get('/1', function(req, res){
	res.send("Hello world!");	
})

app.get('/test', function(req, res){
	res.send("test page");
	// watchForTemperatureHelper(200, "LT", "http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "dummyID", "Storrs", "CT", 1000);
	watchForTemperature(200, "LT", "http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "dummyID", "Storrs", "CT");
})

//Uses recipeID "recipeID1" from DB and watches in order to activate trigger
app.get('/test2', function(req, res){
	res.send("DEMO");
	console.log("The Watch Demo");
	// Runs watch for Temperature every 1 minute at the start of the minute
	var cronJob = cron.job("0 */1 * * * *", function(){
		if (noise == true) {
			//sets up if recipe is calling for temperature monitoring
			if (relation == "LT" || relation == "GT" || relation=="EQ") {
				watchTemperature("recipeID1");
			}
			console.info('cron job complete');
		} else {
			noise = true;
		}
	});
	cronJob.start();
	
})

//Tests watch function without using curl and stores new recipe in DB
app.get('/test1', function(req, res) {
	res.send("Demo Test Page");
	console.log("The Make and Watch Demo.");
	var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"temperature":32, "scale":"string", "city":"Storrs","state":"CT", "relation":"GT"}}};
	var relation = "GT";
	//edit so 'recipeID1' changes
	recipesDB.insert(request,'recipeID3', function(err, body, header){
		//var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			
			// Runs watch for Temperature every 1 minute at the start of the minute
			var cronJob = cron.job("0 */1 * * * *", function(){
				if (noise == true) {
					//sets up if recipe is calling for temperature monitoring
					if (relation == "LT" || relation == "GT" || relation=="EQ") {
						watchTemperature("recipeID1");
					}
					console.info('cron job complete');
				} else {
					noise = true;
				}
			});
			cronJob.start();
		}
	})
});

app.post('/recipes', function(req, res){
	/**
	1.) Store recipe in DB and return response
	2.) start cronJob
	*/
	var request = req.body;
	// console.log(request.recipe.trigger);
	//edit so "recipeID2" changes
	recipesDB.insert(request,'recipeID2', function(err, body, header){
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
			// Runs watch for Temperature every 4 hours at the start of the hour
			var cronJob = cron.job("0 0 */4 * * *", function(){
				if (noise == true) {
					//sets up if recipe is calling for temperature monitoring
					if (relation == "LT" || relation == "GT" || relation=="EQ") {
						watchTemperature('recipeID2');
					}
					console.info('cron job complete');
				} else {
					noise = true;
				}
			});
			cronJob.start();
		}
	})
	
})

/*
function watchForTemperatureHelper(targetTemp, relation, callback, recipeID, city, state, timeout){
	setInterval(watchForTemperature(targetTemp, relation, callback, recipeID, city, state), timeout);
}
*/

// May want to slim down this by making this multiple functions
// Takes recipe out of database with database key recipeIDnum
function watchTemperature(recipeIDNum){
	// gets recipe from database from the key recipeIDNum
	recipesDB.get(recipeIDNum, function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			var targetTemp = data.recipe.trigger.temperature;
			var city = data.recipe.trigger.city;
			var state = data.recipe.trigger.state;
			var relation = data.recipe.trigger.relation;
			var callback = data.recipe.callbackURL;
	
			// validates relation
			if(relation != "LT" && relation != "GT" && relation != "EQ"){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/conditions/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets the current temperature from response
					var parsedbody = JSON.parse(body);
					var currentTemp = parsedbody.current_observation.temp_f;
					console.log("current temp: " + currentTemp);
			
					// Does the appropriate comparison depending on the relation and stores a boolean
					// value in noise
					if (relation == "LT") {
						// does LT relation
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
							noise = false;
						} else {
							noise = true;
						}
					} else if (relation == "GT") {
						// does GT relation
						if(currentTemp > targetTemp){
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
							noise = false;
						} else {
							noise = true;
						}
					} else if (relation == "EQ") {
						// does EQ relation
						if(currentTemp == targetTemp){
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
							noise = false;
						} else {
							noise = true;
						}
					}
				}else{
					console.log(response);
					throw err;
				}
		
			});
		}
	});
}

/* Old version of watchTemperature 
function watchForTemperature(targetTemp, relation, callback, recipeID, city, state){
	
	if(relation != "LT" && relation != "GT" && relation != "EQ"){
		console.log("invalid comparison signal");
		return;
	}

	// Sets ups request from weather api
	requestURL = "http://api.wunderground.com/api/"
	requestURL += weatherAPIKey + "/conditions/q/"
	requestURL += state + "/" + city + ".json";
	// console.log(requestURL);

	// sends the request to the weather api and parses through the response 
	// for the wanted information and does the comparison
	request(requestURL, function(err, response, body){
		if(!err){
			// Gets the current temperature from response
			var parsedbody = JSON.parse(body);
			var currentTemp = parsedbody.current_observation.temp_f;
			console.log("current temp: " + currentTemp);
			
			// Does the appropriate comparison depending on the relation and stores a boolean
			// value in noise
			if (relation == "LT") {
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
					noise = false;
				} else {
					noise = true;
				}
			} else if (relation == "GT") {
				if(currentTemp > targetTemp){
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
					noise = false;
				} else {
					noise = true;
				}
			} else if (relation == "EQ") {
				if(currentTemp == targetTemp){
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
					noise = false;
				} else {
					noise = true;
				}
			}
		}else{
			console.log(response);
			throw err;
		}
		
	});
}*/

app.listen(port);

