var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var bodyParser = require("body-parser");
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var json = require('json');
var me = 'lukebelliveau';
var password = 'weathermonitor';
var weatherAPIKey = "02866fb0b0b72a03f9"

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
	watchForTemperature();
})

app.get('/hello', function(req, res){
	res.send("you're at hello");

	var job = {};
	job['hello'] = "hi";
	job['no'] = 'yes';
	console.log(job);
})

app.post('/recipes', function(req, res){
	var request = req.body;
	console.log(request.recipe);
	
})

function watchForTemperature(temp, relation, callback, recipeID){
	// if(compare != "<"){
	// 	//this will be extended to also do equal to, greater than
	// 	console.log("invalid comparison signal");
	// 	return;
	// }

	requestURL = "http://api.wunderground.com/api/02866fb0b72a03f9/conditions/q/CA/San_Francisco.json";
	var temp;
	request(requestURL, function(err, response, body){
		if(!err){
			var parsedbody = JSON.parse(body);
		temp = parsedbody.current_observation.temp_f;
		}else{
			console.log(response);
			throw err;
		}

	console.log("temp: " + temp);
		
	});

}



app.listen(port);

