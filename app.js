var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
var bodyParser = require("body-parser");
var express = require('express');
var request = require('request');
var Cloudant = require('cloudant');
var json = require('json');
var me = 'lukebelliveau';
var password = 'bell123!@#';


var app = express();

var cloudant = Cloudant({account:me, password:password});

cloudant.db.list(function(err, allDbs){
	console.log("my dbs: %s", allDbs.join(','))
});

var recipesDB = cloudant.db.use('recipes');

app.use(bodyParser.json());
// app.use(express.json());

app.get('/', function(req, res){
	res.send("Hello world!");
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
	console.log(request.recipe.name);
	var newRecipe = {};
	newRecipe['recipe'] = request.recipe;
	newRecipe.recipe['date_created'] = Date();
	newRecipe.recipe['trigger_count'] = 0;
	newRecipe.recipe['last_triggered'] = "never";
	recipesDB.insert(newRecipe, function(err, body, header){
		var response = {};
		
		if(err){
			res.send("Error adding recipe.");
		}else{
			response['success'] = true;
			response['message'] = "Recipe " + request.recipe.name + " added to DB.";
			response['recipe'] = request.recipe;
			response.recipe['id'] = body.id;
			response.recipe['rev'] = body.rev;
			response.recipe['date_created'] = Date();
			response.recipe['trigger_count'] = 0;
			response.recipe['last_triggered'] = "never"
			res.status(200).json(response);
			watchTrigger(body.id); //write method to watch trigger for recipe at this ID
		}
		
	})


})



app.listen(port);

