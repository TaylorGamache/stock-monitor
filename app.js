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
var pastAlert = "nothing";

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
	// Used to add data for id number
	/*var DATA = {"id":0};
	recipesDB.insert(DATA,'idCounter', function(err, body, header){
		//var response = {};
		if(err){
			res.send("Error adding recipe.");
		}
	})*/
})

app.get('/test', function(req, res){
	res.send("test page");
	// watchForTemperatureHelper(200, "LT", "http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "dummyID", "Storrs", "CT", 1000);
	watchForTemperature(200, "LT", "http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "dummyID", "Storrs", "CT");
})

// Current Weather Test
app.get('/CurWeatherTest', function(req, res) {
	res.send("The Make and Watch Current Weather Demo.");
	// need to find options for weather
	var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"weather":"cloudy","city":"Storrs","state":"CT", "relation":"currentWeather"}}};
	var relation = "currentWeather";
	var idNum = 0;
	
	recipesDB.get('idCounter', function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			data.id = data.id + 1;
			// converts to string for name
			idNum = data.id;
			recipesDB.insert(data,data.id, function(err,data2) {
				if (err) {
					console.log('Error updating ID number.\n'+err);
				} else {
					recipesDB.insert(request,idNum.toString(), function(err, body, header){
						//var response = {};
						if(err){
							res.send("Error adding recipe.");
						}else{
							//sets up if recipe is calling for temperature monitoring
							if (relation == "currentWeather") {
								// Runs watch for Temperature every 1 minute at the start of the minute
								var cronJob = cron.job("0 */1 * * * *", function(){
									watchCurWeather(idNum);
								});
							}
							cronJob.start();
						}
					})
				}
			})
			
		}
	})
	
});

// Weather Advisory Test
app.get('/AlertTest', function(req, res) {
	res.send("Alert Test Page");
	//makes a JSON
	var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"city":"Storrs","state":"CT", "relation":"Alert"}}};
	var relation = "Alert";
	var idNum = 0;
	
	recipesDB.get('idCounter', function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			data.id = data.id + 1;
			// converts to string for name
			idNum = data.id;
			recipesDB.insert(data,data.id, function(err,data2) {
				if (err) {
					console.log('Error updating ID number.\n'+err);
				} else {
					recipesDB.insert(request,idNum.toString(), function(err, body, header){
						//var response = {};
						if(err){
							res.send("Error adding recipe.");
						}else{
							//sets up if recipe is calling for temperature monitoring
							if (relation == "Alert") {
								// Runs watch for Temperature every 1 minute at the start of the minute
								var cronJob = cron.job("0 */1 * * * *", function(){
									if (noise == true) {
										watchAlert(idNum);
										console.info('cron job complete');
									} else {
										noise = true;
									}
								});
							}
							cronJob.start();
						}
					})
				}
			})
			
		}
	})
	
});

//Uses recipeID "8" from DB and watches in order to activate trigger
app.get('/WatchDemo', function(req, res){
	res.send("DEMO");
	console.log("The Watch Demo");
	var idNum = "8";
	// Finds out what the relation of the recipe is
	recipesDB.get(recipeIDNum, function(err, data) {
		if (err) {
			throw err;
		} else {
			var relation = data.recipe.trigger.relation;
			// Runs watch for Temperature every 1 minute at the start of the minute
			if (relation == "LT" || relation == "GT" || relation=="EQ") {
				// Runs watch for Temperature every 4 hours at the start of the hour
				var cronJob = cron.job("0 0 */4 * * *", function(){
					if (noise == true) {
						watchTemperature(idNum);
					} else {
						noise = true;
					}
				});
				cronJob.start();
			} else if (relation == "Alert") {
				// Runs watch for weather advisories every 1 minute at the start of the minute
				var cronJob = cron.job("0 */1 * * * *", function() {
					watchAlert(idNum);
				});
				cronJob.start();
			}
		}
	});
	cronJob.start();
	
})

//Tests watch function for current temperature without using curl and stores new recipe in DB
app.get('/MakeAndWatchDemo', function(req, res) {
	res.send("Demo Test Page");
	console.log("The Make and Watch Demo.");
	var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"temperature":32, "scale":"string", "city":"Storrs","state":"CT", "relation":"GT"}}};
	var relation = "GT";
	var idNum = 0;
	
	recipesDB.get('idCounter', function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			data.id = data.id + 1;
			// converts to string for name
			idNum = data.id;
			recipesDB.insert(data,data.id, function(err,data2) {
				if (err) {
					console.log('Error updating ID number.\n'+err);
				} else {
					recipesDB.insert(request,idNum.toString(), function(err, body, header){
						//var response = {};
						if(err){
							res.send("Error adding recipe.");
						}else{
							//sets up if recipe is calling for temperature monitoring
							if (relation == "LT" || relation == "GT" || relation=="EQ") {
								// Runs watch for Temperature every 1 minute at the start of the minute
								var cronJob = cron.job("0 */1 * * * *", function(){
									if (noise == true) {
										watchTemperature(idNum);
										console.info('cron job complete');
									} else {
										noise = true;
									}
								});
							}
							cronJob.start();
						}
					})
				}
			})
			
		}
	})
	
});

app.post('/recipes', function(req, res){
	/**
	1.) Store recipe in DB and return response
	2.) start cronJob
	*/
	var idNum = 0;
	var request = req.body;
	// console.log(request.recipe.trigger);
	// gets idCounter increments it for new recipe ID and updates DB
	recipesDB.get('idCounter', function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			data.id = data.id + 1;
			idNum = data.id;
			recipesDB.insert(data,data.id, function(err,data2) {
				if (err) {
					console.log('Error updating ID number.\n'+err);
				} else {
					//If successfully updated it stores new recipe in DB 
					recipesDB.insert(request,idNum.toString(), function(err, body, header){
						var response = {};
						if(err){
							res.send("Error adding recipe.");
						}else{
							var recipeID = body.id;
							response['success'] = true;
							response['message'] = "Recipe added to DB.";
							res.status(200).json(response);
							var relation = request.recipe.trigger.relation;
							//sets up if recipe is calling for temperature monitoring
							if (relation == "LT" || relation == "GT" || relation=="EQ") {
								// Runs watch for Temperature every 4 hours at the start of the hour
								var cronJob = cron.job("0 0 */4 * * *", function(){
									if (noise == true) {
										watchTemperature(idNum);
									} else {
										noise = true;
									}
								});
								cronJob.start();
							} else if (relation == "Alert") {
								// Runs watch for weather advisories every 1 hour at the start of the minute
								var cronJob = cron.job("0 0 */1 * * *", function() {
									watchAlert(idNum);
								});
								cronJob.start();
							} else if (relation == "currentWeather") {
								// Runs watch for weather every 1 hour at the start of the minute
								var cronJob = cron.job("0 0 */1 * * *", function() {
									if (noise == true) {
										watchCurWeather(idNum);
									} else {
										noise = true;
									}
								});
								cronJob.start();
							}
							
						}
					})
				}
			})
		}
	})
	
})

/*
function watchForTemperatureHelper(targetTemp, relation, callback, recipeID, city, state, timeout){
	setInterval(watchForTemperature(targetTemp, relation, callback, recipeID, city, state), timeout);
}
*/


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
							callback += recipeIDNum;
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
							callback += recipeIDNum;
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
							callback += recipeIDNum;
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

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function watchAlert(recipeIDNum){
	// gets recipe from database from the key recipeIDNum
	recipesDB.get(recipeIDNum, function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			var city = data.recipe.trigger.city;
			var state = data.recipe.trigger.state;
			var relation = data.recipe.trigger.relation;
			var callback = data.recipe.callbackURL;
	
			// validates relation
			if(relation != "Alert" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/alerts/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets the current alert description from response
					var parsedbody = JSON.parse(body);
					var currentAlert = parsedbody.alerts.description;
					//console.log("current weather alerts: " + currentAlert);
					if (currentAlert === undefined) {
						//Do nothing if there is no alert description (meaning no alert)
						pastAlert = currentAlert;
					} else { 
					// if past alert is not the same as current alert set off trigger
						if ( pastAlert != currentAlert ) {
							pastAlert = currentAlert;
							// sets off trigger
							console.log("Target hit, calling callback URL...");
							callback += recipeIDNum;
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
					}
				}else{
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function watchCurWeather(recipeIDNum) {
	// gets recipe from database from the key recipeIDNum
	recipesDB.get(recipeIDNum, function(err, data) {
		if (err) {
			throw err;
		} else {
			// gets all of the variables from DB data
			var city = data.recipe.trigger.city;
			var state = data.recipe.trigger.state;
			var relation = data.recipe.trigger.relation;
			var callback = data.recipe.callbackURL;
			var weatherCond = data.recipe.weather;
	
			// validates relation
			if(relation != "currentWeather" ){
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
					// Gets the current alerts from response
					var parsedbody = JSON.parse(body);
					var curWeather = parsedbody.current_observation.weather;
					console.log("current weather: " + curWeather);
					// checks if the current weather string contains the string
					// of the wanted condition
					var check;
					if (weatherCond == "rain") {
						check = curWeather.search(/rain/i);
					} else if (weatherCond == "snow") {
						check = curWeather.search(/snow/i);
					} else if (weatherCond == "cloudy") {
						check = curWeather.search(/cloudy/i);
					} else if (weatherCond == "clear") {
						check = curWeather.search(/clear/i);
					}
					// if past alert is not the same as current alert set off trigger
					if ( check != (-1))  {
						console.log("Target hit, calling callback URL...");
						callback += recipeIDNum;
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

app.listen(port);
