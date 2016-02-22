var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var bodyParser = require("body-parser");
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var Config = require('config-js');
var json = require('json');
var config = new Config('./stock_config.js');
var me = config.get('CLOUDANT_USERNAME');
var password = config.get('CLOUDANT_PW');
var triggerCallback = "http://nsds-api-stage.mybluemix.net/api/v1/trigger/";
var cron = require('cron');

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


//Tests all watch functions for current recipe without using curl and stores new recipe in DB
app.get('/MakeAndWatchDemo', function(req, res) {
	res.send("Stock Demo Test Page");
	console.log("The Make and Watch Stock Demo.");

	/***    STOCK RECIPES    ***/
	// watch a Stock price
	var request = {"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/","trigger":{"symbol":"IBM","market":"NYSE","watchNum":100,"relation":"stockGT","inThreshold":false}};
	
	// watch a Stock's percent change 
	// var request = {"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/","trigger":{"symbol":"IBM","market":"NYSE","watchNum":15,"relation":"stockPerInc","inThreshold":false}};
	
	// watch a Stock at closing
	// var request = {"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/","trigger":{"symbol":"IBM","market":"NYSE","watchNum":0,"relation":"closePrice","inThreshold":false}};
	
	// NOT IMPLEMENTED YET
	// watch a the exchange rate report at a time
	// var request = {"callbackURL":"http://nsds-api-stage.mybluemix.net/api/v1/trigger/","trigger":{"time":"12:00","currency1":"none","currency2":"none","relation":"ExchangeReport"}};
	
	recipesDB.insert(request, function(err, body, header){
		var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			var idNum = body.id;
			var relation = request.trigger.relation;
			//sets up if recipe is calling for temperature monitoring
			if (relation == "stockLT" || relation == "stockGT") {
				// Runs every hour
				//var cronJob = cron.job("0 0 */1 * * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchStock(idNum);
				});
				cronJob.start();
			} else if (relation == "stockPerInc" || relation == "stockPerDec") {
				// Runs every hour
				//var cronJob = cron.job("0 0 */1 * * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchStockPercent(idNum);
				});
				cronJob.start();
			} else if (relation == "closePrice") {
				// Runs every day at 4
				//var cronJob = cron.job("0 0 4 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					stockClosing(idNum);
				});
				cronJob.start();
			} else if (relation == "ExchangeReport") {
				// Runs every minute
				var cronJob = cron.job("0 */1 * * * *", function(){
					exReport(idNum);
				});
				cronJob.start();
			}		
		}
	})	
});
/*
app.delete('/recipes/:recipeid', function(req, res){
	console.log("stockRecipe delete hit");

	var request = req.body;
	
	response['success'] = true;
	response['message'] = "Recipe added to DB.";
});*/

app.post('/api/v1/stock', function(req, res){
	console.log("stockRecipe hit");

	var request = req.body;

	recipesDB.insert(request, function(err, body, header){
		var response = {};
		if(err){
			res.send("Error adding recipe.");
		}else{
			var idNum = body.id;
			response['success'] = true;
			response['message'] = "Recipe added to DB.";
			res.status(200).json(response);
			// gets the relation of the trigger
			var relation = request.trigger.relation;
			
			// determines what stock watch method to use
			if (relation == "stockLT" || relation == "stockGT") {
				// Runs every hour
				//var cronJob = cron.job("0 0 */1 * * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchStock(idNum);
				});
				cronJob.start();
			} else if (relation == "stockPerInc" || relation == "stockPerDec") {
				// Runs every hour
				//var cronJob = cron.job("0 0 */1 * * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					watchStockPercent(idNum);
				});
				cronJob.start();
			} else if (relation == "closePrice") {
				// Runs every day at 4
				//var cronJob = cron.job("0 0 4 */1 * *", function(){
				var cronJob = cron.job("0 */1 * * * *", function(){
					stockClosing(idNum);
				});
				cronJob.start();
			} else if (relation == "ExchangeReport") {
				// Runs every minute
				var cronJob = cron.job("0 */1 * * * *", function(){
					exReport(idNum);
				});
				cronJob.start();
			}
		}
	})
});


/***********************

WATCH STOCK FUNCTIONS

***********************/

// For watching if a stock price goes above or below a number
function watchStock(recipeIDNum){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			throw err;
		}else{
			console.log("watching stock");
			var stockSymbol = data.trigger.symbol;
			var stockTriggerValue = data.trigger.watchNum;
			var thresh = data.trigger.inThreshold;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol="
			requestURL += stockSymbol;

			request(requestURL, function(err, response, body){
				if(!err){
					console.log("successful response from stock API!");
					// var parsedbody = JSON.parse(body);
					console.log(body);
					var parsedbody = JSON.parse(body);
					console.log("printed full body")
					console.log(parsedbody.Symbol);
					var stockPrice = parsedbody.LastPrice;

					if(data.trigger.relation === "stockGT"){
						console.log("checking if the stock price is GT trigger value");
						console.log("Actual stock price: " + stockPrice);
						console.log("trigger value: " + stockTriggerValue);
						if(stockPrice > stockTriggerValue){
							if(thresh == false) {
								// changes threshold value to true bc trigger hit
								data.trigger.inThreshold = true;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
								console.log("stock trigger hit!");
							}
						} else if(thresh == true) {
							// if thresh = true than if difference percent is > 7.5 than threshold = false
							var Diff = stockTriggerValue - stockPrice;
							var perc = Diff / stockPrice * 100;
							if (perc > 7.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
							} 
						}
					} else if(data.trigger.relation === "stockLT"){
						console.log("checking if the stock price is LT trigger value");
						console.log("Actual stock price: " + stockPrice);
						console.log("trigger value: " + stockTriggerValue);
						if(stockPrice < stockTriggerValue){
							if(thresh == false) {
								// changes threshold value to true bc trigger hit
								data.trigger.inThreshold = true;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
								console.log("stock trigger hit!");
							}
						} else if(thresh == true) {
							// if thresh = true than if difference percent is > 7.5 than threshold = false
							var Diff = stockPrice - stockTriggerValue;
							var perc = Diff / stockPrice * 100;
							if (Diff > 7.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
							} 
						}
					}
				}
			});
		}
	});
}

// For watching if a stock price goes above or below a number
function watchStockPercent(recipeIDNum){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			throw err;
		}else{
			console.log("watching stock");
			var stockSymbol = data.trigger.symbol;
			var stockTriggerValue = data.trigger.watchNum;
			var thresh = data.trigger.inThreshold;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol="
			requestURL += stockSymbol;

			request(requestURL, function(err, response, body){
				if(!err){
					console.log("successful response from stock API!");
					console.log(body);
					var parsedbody = JSON.parse(body);
					console.log("printed full body")
					console.log(parsedbody.Symbol);
					var changePercent = parsedbody.ChangePercent;

					if(data.trigger.relation === "stockPerInc"){
						console.log("checking if the percent change is GT trigger value");
						console.log("Stocks Percent Change: " + changePercent);
						console.log("trigger value: " + stockTriggerValue);
						if(changePercent > stockTriggerValue){
							if(thresh == false) {
								// changes threshold value to true bc trigger hit
								data.trigger.inThreshold = true;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
								console.log("stock trigger hit!");
							}
						} else if(thresh == true) {
							// if thresh = true than if difference is > -1.5 than threshold = false
							var Diff = changePercent - stockTriggerValue;
							if (Diff > -1.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
							} 
						}
					} else if(data.trigger.relation === "stockPerDec"){
						console.log("checking if the percent change is LT trigger value");
						console.log("Stocks Percent Change: " + changePercent);
						console.log("trigger value: " + stockTriggerValue);
						if(changePercent < stockTriggerValue){
							if(thresh == false) {
								// changes threshold value to true bc trigger hit
								data.trigger.inThreshold = true;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
								console.log("stock trigger hit!");
							}
						} else if(thresh == true) {
							// if thresh = true than if difference is > 1.5 than threshold = false
							var Diff = changePercent - stockTriggerValue;
							if (Diff > 1.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										res.send("Error adding recipe.");
									}
								});
							} 
						}
					}
				}
			});
		}
	});
}

// Get closing price of stock
function stockClosing(recipeIDNum){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			throw err;
		}else{
			console.log("watching stock");
			var stockSymbol = data.trigger.symbol;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol="
			requestURL += stockSymbol;

			request(requestURL, function(err, response, body){
				if(!err){
					console.log("successful response from stock API!");
					console.log(body);
					var parsedbody = JSON.parse(body);
					console.log("printed full body")
					console.log(parsedbody.Symbol);
					var closing = parsedbody.LastPrice;

					if(data.trigger.relation === "closePrice"){
						console.log(stockSymbol +" stock's closing price: " + closing);
						console.log("Stock trigger hit!");
					} 
				}
			});
		}
	});
}

// vvv  NOT FINISHED!!!!  vvv
// Get exchange rate report at a certain time
function exReport(recipeIDNum){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			throw err;
		}else{
			console.log("watching the exchange rate report");
			var cur1 = data.trigger.currency1;
			var cur2 = data.trigger.currency2;
			var t = data.trigger.time;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/ElementData/json?Symbol="
			requestURL += cur1;

			request(requestURL, function(err, response, body){
				if(!err){
					console.log("successful response from stock API!");
					console.log(body);
					var parsedbody = JSON.parse(body);
					console.log("printed full body")
					console.log(parsedbody.Symbol);
					var closing = parsedbody.LastPrice;

					if(data.trigger.relation === "ExchangeReport"){
						console.log(stockSymbol +" stock's closing price: " + closing);
						console.log("Stock trigger hit!");
					} 
				}
			});
		}
	});
}


app.listen(port);

