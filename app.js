var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var bodyParser = require("body-parser");
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var Config = require('config-js');
var json = require('json');
const fs = require('fs');
var config = new Config('./stock_config.js');
var me = config.get('CLOUDANT_USERNAME');
var password = config.get('CLOUDANT_PW');
var cron = require('cron');

var app = express();

var cloudant = Cloudant({account:me, password:password});
var recipesDB = cloudant.db.use('recipes');

app.use(bodyParser.json());
// app.use(express.json());
app.use(express.static(__dirname + '/public'));

		/*************

			INIT

		*************/
		
var allDocs = {"selector": { "_id": { "$gt": 0}}};
recipesDB.find(allDocs ,function(err, result){
	if (err) {
		fs.appendFile('errorLog.txt', err, function (err) {

		});
	} 
	console.log('Found %d JSONs at startup.', result.docs.length);
	for (var i = 0; i < result.docs.length; i++) {
		//Finds all recipes and only runs weather recipes
		var idNum = result.docs[i]._id;
		var relation = result.docs[i].trigger.relation;
		if (relation == "stockGT" || relation == "stockLT") {
			watchStock(idNum);

		} else if (relation == "stockPerInc" || relation == "stockPerDec") {
			watchStockPercent(idNum);
				
		} else if (relation == "closePrice") {
			stockClosing(idNum);
		} 
	}
	console.log("The Stock Monitor is Up and Running.");
});

//temp
app.post('/temp2/:recipeid', function(req, res){
	console.log("Callback has been reached.");
	var rec_ID = req.params.recipeid;
	console.log(rec_ID);
	console.log(req.headers);
	console.log(req.body);
});
/***************

DELETE END POINT

****************/

app.delete('/api/v1/stock/:recipeid', function(req, res){
	//console.log("stockRecipe delete hit");
	var del_ID = req.params.recipeid;
	//console.log(del_ID);
	
	recipesDB.get(del_ID, function(err, data){
		if(err){
			res.json({success: false, msg: 'Failed to find the recipe in the database, please try again.'});
		} else {
			var rev = data._rev;
			recipesDB.destroy(del_ID, rev,  function(err) {
				if (!err) {
					res.json({success: true, msg: 'Successfully deleted the stock recipe from the database.'});
					console.log("Successfully deleted doc"+ del_ID);
				} else {
					res.json({success: false, msg: 'Failed to delete recipe from the database, please try again.'});
					//console.log("failed");
				}
			});
		}
	});
});

/*************************

STOCK TRIGGER END POINTS

*************************/

app.post('/api/v1/stock/priceGT', function(req, res){
	//console.log("A recipe for watching if a stock goes above a value has been received.");
	var request = req.body;
	request.trigger.relation = "stockGT";
	request.trigger.inThreshold = false;
	
	if(request.callbackURL == "") {
		res.json({success: false, msg: 'No callbackURL submitted.'});
	} else if (request.trigger.watchNum == null) {
		res.json({success: false, msg: 'No watchNum submitted.'});
	} else if (request.trigger.symbol == "") {
		res.json({success: false, msg: 'No symbol submitted.'});
	} else if (request.trigger.market == "") {
		res.json({success: false, msg: 'No market submitted.'});
	} else {

		recipesDB.insert(request, function(err, body, header){
			if(err){
				res.json({success:false, msg:'Error adding recipe.'});
			}else{
				var idNum = body.id;
				res.json({success: true, msg: 'Successfully added the stock recipe to database.'});
				// gets the relation of the trigger
				var relation = request.trigger.relation;
			
				// determines what stock watch method to use
				if (relation == "stockGT") {
					watchStock(idNum);
				} 
			}
		})
	}
});
app.post('/api/v1/stock/priceLT', function(req, res){
	//console.log("A recipe for watching if a stock goes below a value has been received.");
	var request = req.body;
	request.trigger.relation = "stockLT";
	request.trigger.inThreshold = false;
	
	if(request.callbackURL == "") {
		res.json({success: false, msg: 'No callbackURL submitted.'});
	} else if (request.trigger.watchNum == null) {
		res.json({success: false, msg: 'No watchNum submitted.'});
	} else if (request.trigger.symbol == "") {
		res.json({success: false, msg: 'No symbol submitted.'});
	} else if (request.trigger.market == "") {
		res.json({success: false, msg: 'No market submitted.'});
	} else {

		recipesDB.insert(request, function(err, body, header){
			if(err){
				res.json({success:false, msg:'Error adding recipe.'});
			}else{
				var idNum = body.id;
				res.json({success: true, msg: 'Successfully added the stock recipe to database.'});
				// gets the relation of the trigger
				var relation = request.trigger.relation;
			
				// determines what stock watch method to use
				if (relation == "stockLT") {
					watchStock(idNum);
				} 
			}
		})
	}
});
app.post('/api/v1/stock/percentInc', function(req, res){
	//console.log("A recipe for watching if a stock's percent increase goes above a value has been received.");
	var request = req.body;
	request.trigger.relation = "stockPerInc";
	request.trigger.inThreshold = false;
	
	if(request.callbackURL == "") {
		res.json({success: false, msg: 'No callbackURL submitted.'});
	} else if (request.trigger.watchNum == null) {
		res.json({success: false, msg: 'No watchNum submitted.'});
	} else if (request.trigger.symbol == "") {
		res.json({success: false, msg: 'No symbol submitted.'});
	} else if (request.trigger.market == "") {
		res.json({success: false, msg: 'No market submitted.'});
	} else {

		recipesDB.insert(request, function(err, body, header){
			if(err){
				res.json({success:false, msg:'Error adding recipe.'});
			}else{
				var idNum = body.id;
				res.json({success: true, msg: 'Successfully added the stock recipe to database.'});
				// gets the relation of the trigger
				var relation = request.trigger.relation;
			
				if (relation == "stockPerInc") {
					watchStockPercent(idNum);
				} 
			}
		})
	}
});

app.post('/api/v1/stock/percentDec', function(req, res){
	//console.log("A recipe for watching if a stock's percent increase goes below a value has been received.");
	var request = req.body;
	request.trigger.relation = "stockPerDec";
	request.trigger.inThreshold = false;
	
	if(request.callbackURL == "") {
		res.json({success: false, msg: 'No callbackURL submitted.'});
	} else if (request.trigger.watchNum == null) {
		res.json({success: false, msg: 'No watchNum submitted.'});
	} else if (request.trigger.symbol == "") {
		res.json({success: false, msg: 'No symbol submitted.'});
	} else if (request.trigger.market == "") {
		res.json({success: false, msg: 'No market submitted.'});
	} else {

		recipesDB.insert(request, function(err, body, header){
			if(err){
				res.json({success:false, msg:'Error adding recipe.'});
			}else{
				var idNum = body.id;
				res.json({success: true, msg: 'Successfully added the stock recipe to database.'});
				// gets the relation of the trigger
				var relation = request.trigger.relation;
			
				if (relation == "stockPerDec") {
					watchStockPercent(idNum);
				} 
			}
		})
	}
});

app.post('/api/v1/stock/closePrice', function(req, res){
	//console.log("A recipe for watching a stock's closing price has been received.");
	var request = req.body;
	request.trigger.relation = "closePrice";
		
	if(request.callbackURL == "") {
		res.json({success: false, msg: 'No callbackURL submitted.'});
	} else if (request.trigger.symbol == "") {
		res.json({success: false, msg: 'No symbol submitted.'});
	} else if (request.trigger.market == "") {
		res.json({success: false, msg: 'No market submitted.'});
	} else {

		recipesDB.insert(request, function(err, body, header){
			if(err){
				res.json({success:false, msg:'Error adding recipe.'});
			}else{
				var idNum = body.id;
				res.json({success: true, msg: 'Successfully added the stock recipe to database.'});
				// gets the relation of the trigger
				var relation = request.trigger.relation;
			
				if (relation == "closePrice") {
					stockClosing(idNum);
				} 
			}
		})
	}
});


//DOESN"T GET USED
app.post('/api/v1/stock/exReport', function(req, res){
	console.log("A recipe for watching a stock has been received.");

	var request = req.body;

	recipesDB.insert(request, function(err, body, header){
		if(err){
			res.json({success:false, msg:'Error adding recipe.'});
		}else{
			var idNum = body.id;
			res.json({success: true, msg: 'Successfully added the stock recipe to database.'});
			// gets the relation of the trigger
			var relation = request.trigger.relation;
			
			if (relation == "ExchangeReport") {
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
	// Runs every hour
	//var cronJob = cron.job("0 0 */1 * * *", function(){
	var cronJob = cron.job("0 */1 * * * *", function(){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			fs.appendFile('errorLog.txt', err, function (err) {

			});
		}else{
			console.log("watching stock");
			var stockSymbol = data.trigger.symbol;
			var stockMarket = data.trigger.market;
			var stockTriggerValue = data.trigger.watchNum;
			var thresh = data.trigger.inThreshold;
			var callbackURL = data.callbackURL;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol="
			requestURL += stockSymbol;

			request(requestURL, function(err, response, body){
				if(err){
					fs.appendFile('errorLog.txt', err, function (err) {

					});
				} else {
					console.log("successful response from stock API!");
					// var parsedbody = JSON.parse(body);
					var parsedbody = JSON.parse(body);
					var stockPrice = parsedbody.LastPrice;
					var percentChange = parsedbody.ChangePercent;
					var ingredients = {
						"ingredients_data":{
						"stock_symbol": stockSymbol,
						"stock_market": stockMarket,
						"stock_price": stockPrice,
						"change_ratio": percentChange
						}

					}	
					var nsdsApiKey = config.get('NSDS_API_KEY_STAGING');
					var headers = {
						'Content-Type':'application/json',
						'nsds-api-key' : nsdsApiKey
					}

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
										fs.appendFile('errorLog.txt', err, function (err) {

										});
									}
								});
								console.log("stock trigger hit!");
								callbackURL = callbackURL + "/" + recipeIDNum;
								request.post(callback, { 'headers': headers, 'body': JSON.stringify(ingred)}, function(eRR,httpResponse,body) {
									if(eRR) {
										fs.appendFile('errorLog.txt', eRR, function (eRR) {

										});
									}
								});
							}
						} else if(thresh == true) {
							// if thresh = true than if difference percent is > 7.5 than threshold = false
							var Diff = stockTriggerValue - stockPrice;
							var perc = Diff / stockPrice * 100;
							if (perc > 7.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										fs.appendFile('errorLog.txt', err, function (err) {

										});
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
										fs.appendFile('errorLog.txt', err, function (err) {

										});
									}
								});
								console.log("stock trigger hit!");
								callbackURL = callbackURL + "/" + recipeIDNum;
								request.post(callback, { 'headers': headers, 'body': JSON.stringify(ingred)}, function(eRR,httpResponse,body) {
									if(eRR) {
										fs.appendFile('errorLog.txt', eRR, function (eRR) {

										});
									}
								});
							}
						} else if(thresh == true) {
							// if thresh = true than if difference percent is > 7.5 than threshold = false
							var Diff = stockPrice - stockTriggerValue;
							var perc = Diff / stockPrice * 100;
							if (Diff > 7.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										fs.appendFile('errorLog.txt', err, function (err) {

										});
									}
								});
							} 
						}
					}
				}
			});
		}
	});
	});
	cronJob.start();
}

// For watching if a stock price goes above or below a number
function watchStockPercent(recipeIDNum){
	// Runs every hour
	//var cronJob = cron.job("0 0 */1 * * *", function(){
	var cronJob = cron.job("0 */1 * * * *", function(){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			fs.appendFile('errorLog.txt', err, function (err) {

			});
		}else{
			console.log("watching stock");
			var stockSymbol = data.trigger.symbol;
			var stockMarket = data.trigger.market;
			var stockTriggerValue = data.trigger.watchNum;
			var thresh = data.trigger.inThreshold;
			var callbackURL = data.callbackURL;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol="
			requestURL += stockSymbol;

			request(requestURL, function(err, response, body){
				if(err){
					fs.appendFile('errorLog.txt', err, function (err) {

					});
				} else {
					console.log("successful response from stock API!");
					var parsedbody = JSON.parse(body);
					var changePercent = parsedbody.ChangePercent;
					var ingredients = {
									"ingredients_data":{
										"stock_symbol": stockSymbol,
										"stock_market": stockMarket,
										"stock_trigger_value": stockTriggerValue,
										"change_percent": changePercent
									}

								}
					var nsdsApiKey = config.get('NSDS_API_KEY_STAGING');
					var headers = {
									'Content-Type':'application/json',
									'nsds-api-key' : nsdsApiKey
								}

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
										fs.appendFile('errorLog.txt', err, function (err) {

										});
									}
								});
								console.log("stock trigger hit!");
								callbackURL = callbackURL + "/" + recipeIDNum;
								request.post(callback, { 'headers': headers, 'body': JSON.stringify(ingred)}, function(eRR,httpResponse,body) {
									if(eRR) {
										fs.appendFile('errorLog.txt', eRR, function (eRR) {

										});
									}
								});
							}
						} else if(thresh == true) {
							// if thresh = true than if difference is > -1.5 than threshold = false
							var Diff = changePercent - stockTriggerValue;
							if (Diff > -1.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										fs.appendFile('errorLog.txt', err, function (err) {

										});
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
										fs.appendFile('errorLog.txt', err, function (err) {

										});
									}
								});
								console.log("stock trigger hit!");

								callbackURL = callbackURL + "/" + recipeIDNum;
								request.post(callback, { 'headers': headers, 'body': JSON.stringify(ingred)}, function(eRR,httpResponse,body) {
									if(eRR) {
										fs.appendFile('errorLog.txt', eRR, function (eRR) {

										});
									}
								});
							}
						} else if(thresh == true) {
							// if thresh = true than if difference is > 1.5 than threshold = false
							var Diff = changePercent - stockTriggerValue;
							if (Diff > 1.5) {
								data.trigger.inThreshold = false;
								recipesDB.insert(data, recipeIDNum, function(err, body, header){
									if(err){
										fs.appendFile('errorLog.txt', err, function (err) {

										});
									}
								});
							} 
						}
					}
				}
			});
		}
	});
	});
	cronJob.start();
}

// Get closing price of stock
function stockClosing(recipeIDNum){
	// Runs every day at 4
	//var cronJob = cron.job("0 0 4 */1 * *", function(){
	var cronJob = cron.job("0 */1 * * * *", function(){
	//get recipe from DB using ID num
	recipesDB.get(recipeIDNum, function(err, data){
		if(err){
			fs.appendFile('errorLog.txt', err, function (err) {

			});
		}else{
			console.log("watching stock");
			var stockSymbol = data.trigger.symbol;
			var stockMarket = data.trigger.market;
			requestURL = "http://dev.markitondemand.com/MODApis/Api/v2/Quote/json?symbol="
			requestURL += stockSymbol;

			request(requestURL, function(err, response, body){
				if(err){
					fs.appendFile('errorLog.txt', err, function (err) {

					});
				} else {
					console.log("successful response from stock API!");
					var parsedbody = JSON.parse(body);
					var closing = parsedbody.LastPrice;

					if(data.trigger.relation === "closePrice"){
						console.log(stockSymbol +" stock's closing price: " + closing);
						console.log("Stock trigger hit!");
						var ingredients = {
							"ingredients_data":{
								"stock_symbol": stockSymbol,
								"stock_market": stockMarket,
								"stock_closing_price" : closing
							}

						}
						var nsdsApiKey = config.get('NSDS_API_KEY_STAGING');
						var headers = {
							'Content-Type':'application/json',
							'nsds-api-key' : nsdsApiKey
						}

						callbackURL = callbackURL + "/" + recipeIDNum;
						request.post(callback, { 'headers': headers, 'body': JSON.stringify(ingred)}, function(eRR,httpResponse,body) {
							if(eRR) {
								fs.appendFile('errorLog.txt', eRR, function (eRR) {

								});
							}
						});

					} 
				}
			});
		}
	});
	});
	cronJob.start();
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
					var parsedbody = JSON.parse(body);
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

