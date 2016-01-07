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

var app = express();

var cloudant = Cloudant({account:me, password:password});

// lists all the databases on console

/* Use as example for set up.
db.find({selector:{name:'Alice'}}, function(er, result) {
  if (er) {
    throw er;
  }

  console.log('Found %d documents with name Alice', result.docs.length);
  for (var i = 0; i < result.docs.length; i++) {
    console.log('  Doc id: %s', result.docs[i]._id);
  }
});
*/

cloudant.db.list(function(err, allDbs){
	console.log("my dbs: %s", allDbs.join(','))
});


var recipesDB = cloudant.db.use('recipes');

app.use(bodyParser.json());
// app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Todays sunrise/sunset forecast Test
app.get('/todSunTest', function(req, res) {
	res.send("The Make and Watch Todays sun Demo.");
	var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{ "city":"Storrs","state":"CT", "relation":"todSunrise", "inThreshold":false}}};
	var relation = "todSunrise";
	recipesDB.insert(request, function(err, body, header){
		//var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			//sets up if recipe is calling for weather monitoring
			if (relation == "todSunrise" || relation == "todSunset") {
				// Runs watch every 1 minute at the start of the minute
				var cronJob = cron.job("0 */1 * * * *", function(){
					todaySun(body.id);
				});
			}
			cronJob.start();
		}
	})
});



//Tests all watch functions for current recipe without using curl and stores new recipe in DB
app.get('/MakeAndWatchDemo', function(req, res) {
	res.send("Demo Test Page");
	console.log("The Make and Watch Demo.");
	// Temperature request
	//var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"temperature":32, "tempType":"F", "city":"Storrs","state":"CT", "relation":"GT", "inThreshold":false}}};
	
	// Weather Advisory request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"city":"Storrs","state":"CT", "relation":"Alert", "inThreshold":"none"}}};
	
	// Current Weather request for specific weather conditions
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"weather":"clear","city":"Storrs","state":"CT", "relation":"currentWeather", "inThreshold":false}}};
	
	// Current Weather request for change in weather conditions
	 var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"city":"Storrs","state":"CT", "relation":"weatherChange", "inThreshold":"none"}}};
	
	// Current Weather forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"type": "US","city":"Storrs","state":"CT", "relation":"curForecast"}}};
	
	// Tomorrows Weather forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"type": "US", "city":"Storrs","state":"CT", "relation":"tomForecast"}}};
	
	// Todays max humidity forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"humidity":90, "city":"Storrs","state":"CT", "relation":"todHumid"}}};
	
	// Todays max wind forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"wind":90, "type":"US", "city":"Storrs","state":"CT", "relation":"todWind"}}};
	
	// Current UV request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"UV":10, "city":"Storrs","state":"CT", "relation":"todUV"}}};
	
	// Tomorrows Low temp forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"temperature":90, "tempType":"F", "city":"Storrs","state":"CT", "relation":"tomLtemp"}}};
	
	// Tomorrows High temp forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{"temperature":0, "tempType":"F", "city":"Storrs","state":"CT", "relation":"tomHtemp"}}};
	
	// Todays sunrise/sunset forecast request
	// var request = {"recipe":{"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/", "trigger":{ "city":"Storrs","state":"CT", "relation":"todSunrise"}}};
	
	recipesDB.insert(request, function(err, body, header){
		var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			var idNum = body.id;
			var relation = request.recipe.trigger.relation;
			//sets up if recipe is calling for temperature monitoring
			if (relation == "LT" || relation == "GT" || relation=="EQ") {
				// Runs watch for Temperature every minute
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchTemperature(idNum);
				});
				cronJob.start();
			} else if (relation == "Alert") {
				// Runs watch for weather advisories every mintue
				var cronJob = cron.job("0 */1 * * * *", function() {
					watchAlert(idNum);
				});
				cronJob.start();
			} else if (relation == "currentWeather") {
				// Runs watch for weather every minute
				var cronJob = cron.job("0 */1 * * * *", function() {
					watchCurWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "weatherChange") {
				// Runs watch for weather every minute
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "curForecast") {
				// Runs every day at 4 am
				var cronJob = cron.job("0 0 4 */1 * *", function(){
					todaysWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "tomForecast") {
				// Runs every day at noon
				var cronJob = cron.job("0 0 12 */1 * *", function(){
					tomWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "tomHtemp") {
				// Runs every day at noon
				var cronJob = cron.job("0 0 12 */1 * *", function(){
					tomHighTemp(idNum);
				});
				cronJob.start();
			} else if (relation == "tomLtemp") {
				// Runs every day at noon
				var cronJob = cron.job("0 0 12 */1 * *", function(){
					tomLowTemp(idNum);
				});
				cronJob.start();
			} else if (relation == "todHumid") {
				// Runs every day at 5 am
				var cronJob = cron.job("0 0 5 */1 * *", function(){
					todayHumid(idNum);
				});
				cronJob.start();
			} else if (relation == "todWind") {
				// Runs every day at 5 am
				var cronJob = cron.job("0 0 5 */1 * *", function(){
					todayWind(idNum);
				});
				cronJob.start();
			} else if (relation == "todUV") {
				// Runs every day at noon
				var cronJob = cron.job("0 0 12 */1 * *", function(){
					todayUV(idNum);
				});
				cronJob.start();
			} else if (relation == "todSunrise" || relation == "todSunset") {
				// Runs every day at noon
				var cronJob = cron.job("0 0 12 */1 * *", function(){
					todaySun(idNum);
				});
				cronJob.start();
			}					
		}
	})	
});

app.post('/testluke', function(req, res){
	res.send("lukes test was successful")
});

app.post('/recipes', function(req, res){
	console.log("recipes was hit")
	/**
	1.) Store recipe in DB and return response
	2.) start cronJob
	*/
	var request = req.body;
	// console.log(request.recipe.trigger);

	recipesDB.insert(request, function(err, body, header){
		var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			var idNum = body.id;
			response['success'] = true;
			response['message'] = "Recipe added to DB.";
			res.status(200).json(response);
			var relation = request.recipe.trigger.relation;
			//sets up if recipe is calling for temperature monitoring
			if (relation == "LT" || relation == "GT" || relation=="EQ") {
				// Runs watch for Temperature every 4 hours at the start of the hour
				//var cronJob = cron.job("0 0 */4 * * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchTemperature(idNum);
				});
				cronJob.start();
			} else if (relation == "Alert") {
				//console.log("in alert")
				// Runs watch for weather advisories every 1 hour at the start of the hour
				//var cronJob = cron.job("0 0 */1 * * *", function() {
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchAlert(idNum);
				});
				cronJob.start();
			} else if (relation == "currentWeather") {
				// Runs watch for weather every 1 hour at the start of the hour
				//var cronJob = cron.job("0 0 */1 * * *", function() {
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchCurWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "weatherChange") {
				// Runs watch for weather every 1 hour at the start of the hour
				//var cronJob = cron.job("0 0 */1 * * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "curForecast") {
				// Runs every day at 4 am
				//var cronJob = cron.job("0 0 4 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					todaysWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "tomForecast") {
				// Runs every day at noon
				//var cronJob = cron.job("0 0 12 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					tomWeather(idNum);
				});
				cronJob.start();
			} else if (relation == "tomHtemp") {
				// Runs every day at noon
				//var cronJob = cron.job("0 0 12 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					tomHighTemp(idNum);
				});
				cronJob.start();
			} else if (relation == "tomLtemp") {
				// Runs every day at noon
				//var cronJob = cron.job("0 0 12 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					tomLowTemp(idNum);
				});
				cronJob.start();
			} else if (relation == "todHumid") {
				// Runs every day at 5 am
				//var cronJob = cron.job("0 0 5 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					todayHumid(idNum);
				});
				cronJob.start();
			} else if (relation == "todWind") {
				// Runs every day at 5 am
				//var cronJob = cron.job("0 0 5 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					todayWind(idNum);
				});
				cronJob.start();
			} else if (relation == "todUV") {
				// Runs every day at noon
				//var cronJob = cron.job("0 0 12 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					todayUV(idNum);
				});
				cronJob.start();
			} else if (relation == "todSunrise" || relation == "todSunset") {
				// Runs every day at noon
				//var cronJob = cron.job("0 0 12 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					todaySun(idNum);
				});
				cronJob.start();
			}					
		}
	})	
});

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
			var type = data.recipe.trigger.tempType;
			var thresh = data.recipe.trigger.inThreshold;
	
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
					var currentTemp;
					if (type == "F") {
						currentTemp = parsedbody.current_observation.temp_f;
						console.log("current temp: " + currentTemp);
					} else {
						currentTemp = parsedbody.current_observation.temp_c;
						console.log("current temp: " + currentTemp);
					}
					// Does the appropriate comparison depending on the relation and stores a boolean
					// value in noise
					if (relation == "LT") {
						// does LT relation
						if(currentTemp < targetTemp){
							if(thresh == false) {
								// changes threshold value to true
								data.recipe.trigger.inThreshold = true;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
								// calls callback url
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
						} else if(thresh == true) {
							// if thresh = true than if temp difference is > 3 than threshold = false
							var tempDiff = currentTemp - targetTemp;
							if (tempDiff > 3) {
								data.recipe.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
							} 
						}
					} else if (relation == "GT") {
						// does GT relation
						if(currentTemp > targetTemp){
							if(thresh == false) {
								// changes threshold value to true
								data.recipe.trigger.inThreshold = true;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
								// calls callback url
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
						} else if(thresh == true) {
							// if thresh = true than if temp difference is > 3 than threshold = false
							var tempDiff = targetTemp - currentTemp;
							if (tempDiff > 3) {
								data.recipe.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
							} 
						}
					} /*else if (relation == "EQ") {
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
					}*/
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
			var thresh = data.recipe.trigger.inThreshold;
	
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
						if (thresh != "none") {
							// changes threshold value to undefined
							data.recipe.trigger.inThreshold = "none";
							recipesDB.insert(data, recipeIDNum, function(err, body, header){
								if(err){
									res.send("Error adding recipe.");
								}
							});
						}
					} else { 
					// if past alert is not the same as current alert set off trigger
						if ( thresh != currentAlert ) {
							//store new alert in json
							data.recipe.trigger.inThreshold = currentAlert;
							recipesDB.insert(data, recipeIDNum, function(err, body, header){
								if(err){
									res.send("Error adding recipe.");
								}
							});
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
			var weatherCond = data.recipe.trigger.weather;
			var thresh = data.recipe.trigger.inThreshold;
	
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
					console.log("current weather: " + curWeather + "\n" + "Weather Condition: " + weatherCond);
					// checks if the current weather string contains the string
					// of the wanted condition
					var check = -1;
					if (weatherCond == "rain") {
						check = curWeather.search(/rain/i);
					} else if (weatherCond == "snow") {
						check = curWeather.search(/snow/i);
					} else if (weatherCond == "cloudy") {
						check = curWeather.search(/cloudy/i);
					} else if (weatherCond == "clear") {
						check = curWeather.search(/clear/i);
					}
					// if there is a match than set off trigger
					if ( check != (-1))  {
						if ( thresh == false) {
							// changes threshold value to true
							data.recipe.trigger.inThreshold = true;
							recipesDB.insert(data, recipeIDNum, function(err, body, header){
								if(err){
									res.send("Error adding recipe.");
								}
							});
							//calls callback url
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
					} else if (thresh == true){
						// changes threshold value to false
						data.recipe.trigger.inThreshold = false;
						recipesDB.insert(data, recipeIDNum, function(err, body, header){
							if(err){
								res.send("Error adding recipe.");
							}
						});
					}
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function watchWeather(recipeIDNum) {
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
			var thresh = data.recipe.trigger.inThreshold;
	
			// validates relation
			if(relation != "weatherChange" ){
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
					
					// if the current weather is different from the past weather set off trigger
					if ( curWeather != thresh)  {
						//update threshold with current weather for next check
						data.recipe.trigger.inThreshold = curWeather;
						recipesDB.insert(data, recipeIDNum, function(err, body, header){
							if(err){
								res.send("Error adding recipe.");
							}
						});
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function todaysWeather(recipeIDNum) {
	console.log("RECIPE ID:")
	console.log(recipeIDNum)
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
			var type = data.recipe.trigger.type;
	
			// validates relation
			if(relation != "curForecast" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/forecast10day/q/"
			requestURL += state + "/" + city + ".json";
			console.log("request URL:")
			console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets todays weather forecast
					var parsedbody = JSON.parse(body);
					var curWeather;
					if (type == "US") {
						curWeather = parsedbody.forecast.txt_forecast.forecastday[0].fcttext;
					} else {
						curWeather = parsedbody.forecast.txt_forecast.forecastday[0].fcttext_metric;
					}
					//Always sets off trigger
					console.log(curWeather);
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
				} else {
					console.log("ERROR:");
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function tomWeather(recipeIDNum) {
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
			var type = data.recipe.trigger.type;
	
			// validates relation
			if(relation != "tomForecast" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/forecast10day/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets tomorrows weather forecast
					var parsedbody = JSON.parse(body);
					var tomWeather;
					if (type == "US") {
						tomWeather = parsedbody.forecast.txt_forecast.forecastday[2].fcttext;
					} else {
						tomWeather = parsedbody.forecast.txt_forecast.forecastday[2].fcttext_metric;
					}
					//Always sets off trigger
					console.log(tomWeather);
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function tomHighTemp(recipeIDNum) {
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
			var temp = data.recipe.trigger.temperature;
			var type = data.recipe.trigger.tempType;
	
			// validates relation
			if(relation != "tomHtemp" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/forecast10day/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets tomorrows weather 
					var parsedbody = JSON.parse(body);
					var tomHigh;
					if (type == "F") {
						tomHigh = parsedbody.forecast.simpleforecast.forecastday[1].high.fahrenheit;
					} else {
						tomHigh = parsedbody.forecast.simpleforecast.forecastday[1].high.celsius;
					}
					// If tomorrows High > x than set off trigger
					if (temp < tomHigh) {
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function tomLowTemp(recipeIDNum) {
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
			var temp = data.recipe.trigger.temperature;
			var type = data.recipe.trigger.tempType;
	
			// validates relation
			if(relation != "tomLtemp" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/forecast10day/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets tomorrows weather forecast
					var parsedbody = JSON.parse(body);
					var tomLow;
					if (type == "F") {
						tomLow = parsedbody.forecast.simpleforecast.forecastday[1].low.fahrenheit;
					} else {
						tomLow = parsedbody.forecast.simpleforecast.forecastday[1].low.celsius;
					}
					// If tomorrows Low < x than set off trigger
					if (temp > tomLow) {
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function todayWind(recipeIDNum) {
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
			var windSpeed = data.recipe.trigger.wind;
			var type = data.recipe.trigger.type;
	
			// validates relation
			if(relation != "todWind" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/forecast10day/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets tomorrows weather forecast
					var parsedbody = JSON.parse(body);
					var maxWind;
					if (type == "US") {
						maxWind = parsedbody.forecast.simpleforecast.forecastday[1].maxwind.mph;
					} else {
						maxWind = parsedbody.forecast.simpleforecast.forecastday[1].maxwind.kph;
					}
					//direction is "".maxwind.dir if needed;
					// If tomorrows Low < x than set off trigger
					if (maxWind > windSpeed) {
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function todayHumid(recipeIDNum) {
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
			var humid = data.recipe.trigger.humidity;
	
			// validates relation
			if(relation != "todHumid" ){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/forecast10day/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);

			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets tomorrows weather forecast
					var parsedbody = JSON.parse(body);
					var maxHumid = parsedbody.forecast.simpleforecast.forecastday[1].maxhumidity;
					//var tomLow = parsedbody.forecast.simpleforecast.forecastday[1].maxwind.mph;
					// If tomorrows Low < x than set off trigger
					if (maxHumid > humid) {
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function todayUV(recipeIDNum) {
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
			var uv = data.recipe.trigger.UV;
	
			// validates relation
			if(relation != "todUV" ){
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
					// Gets tomorrows weather forecast
					var parsedbody = JSON.parse(body);
					var curUV = parsedbody.current_observation.UV;
					// If tomorrows Low < x than set off trigger
					console.log(curUV);
					if (curUV > uv) {
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}

// Takes recipe out of database with database key recipeIDnum and sends a get request to
// api and potentially sets off a trigger
function todaySun(recipeIDNum) {
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
			if(relation != "todSunrise" && relation != "todSunset"){
				console.log("invalid comparison signal");
				return;
			}

			// Sets ups request from weather api
			requestURL = "http://api.wunderground.com/api/"
			requestURL += weatherAPIKey + "/astronomy/q/"
			requestURL += state + "/" + city + ".json";
			// console.log(requestURL);
			
			// sends the request to the weather api and parses through the response 
			// for the wanted information and does the comparison
			request(requestURL, function(err, response, body){
				if(!err){
					// Gets todays sunrise or sunset
					var parsedbody = JSON.parse(body);
					var todaySunHour;
					var todaySunMin;
					if ("todSunrise" == relation) {
						todaySunHour = parsedbody.moon_phase.sunrise.hour;
						todaySunMin = parsedbody.moon_phase.sunrise.minute;
					} else {
						todaySunHour = parsedbody.moon_phase.sunset.hour;
						todaySunMin = parsedbody.moon_phase.sunset.minute;
					}
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
				} else {
					console.log(response);
					throw err;
				}
			});
		}
	});
}


app.listen(port);
