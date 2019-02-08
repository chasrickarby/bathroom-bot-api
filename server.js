var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;

var BATHROOMS_COLLECTION = "bathrooms";

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// CONTACTS API ROUTES BELOW
// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}

/*  "/bathrooms"
 *    GET: finds all bathrooms
 *    POST: creates a new bathroom
 */

app.get("/bathrooms", function(req, res) {
});

app.post("/bathrooms", function(req, res) {
  var newBathroom = req.body;
  newBathroom.createDate = new Date();

  if (!(req.body.name)) {
    handleError(res, "Invalid user input", "Must provide a name", 400);
  }

  db.collection(BATHROOMS_COLLECTION).insertOne(newBathroom, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to create new bathroom.");
    } else {
      res.status(201).json(doc.ops[0]);
    }
  });
});
});

/*  "/bathrooms/:id"
 *    GET: find bathroom by id
 *    PUT: update bathroom by id
 *    DELETE: deletes bathroom by id
 */

app.get("/bathrooms/:id", function(req, res) {
});

app.put("/bathrooms/:id", function(req, res) {
});

app.delete("/bathrooms/:id", function(req, res) {
});
