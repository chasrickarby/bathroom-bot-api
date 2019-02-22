require('dotenv').config();
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;
const fetch = require("node-fetch");

var BATHROOMS_COLLECTION = "bathrooms";

var BATHROOMS = [
  {
    "5c5dcc98aa6c3e001790f844":
    {
      name: "LEFT",
      lastUpdated: null,
    }
  },
  {
    "5c5dea87b3ab79e53642272f":
    {
      name: "RIGHT",
      lastUpdated: null,
    }
  }
]

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
// BATHROOMS API ROUTES BELOW
// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({ "error": message });
}
/*  "/bathrooms"
 *    GET: finds all bathrooms
 *    POST: creates a new bathroom
 */
app.get("/bathrooms", function (req, res) {
  db.collection(BATHROOMS_COLLECTION).find({}).toArray(function (err, docs) {
    if (err) {
      handleError(res, err.message, "Failed to get bathrooms.");
    } else {
      res.status(200).json(docs);
    }
  });
});
app.post("/bathrooms", function (req, res) {
  var newBathroom = req.body;
  newBathroom.createDate = new Date();
  if (!(req.body.name)) {
    handleError(res, "Invalid user input", "Must provide a name.", 400);
  }
  db.collection(BATHROOMS_COLLECTION).insertOne(newBathroom, function (err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to create new bathroom.");
    } else {
      res.status(201).json(doc.ops[0]);
    }
  });
});
/*  "/bathrooms/:id"
 *    GET: find bathroom by id
 *    PUT: update bathroom by id
 *    DELETE: deletes bathroom by id
 */
app.get("/bathrooms/:id", function (req, res) {
  db.collection(BATHROOMS_COLLECTION).findOne({ _id: new ObjectID(req.params.id) }, function (err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to get bathroom");
    } else {
      res.status(200).json(doc);
    }
  });
});
app.put("/bathrooms/:id", function (req, res) {
  var updateDoc = req.body;
  delete updateDoc._id;
  updateSlackChannel(req.params.id, updateDoc.vacant);
  db.collection(BATHROOMS_COLLECTION).updateOne({ _id: new ObjectID(req.params.id) }, updateDoc, function (err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to update bathroom");
    } else {
      res.status(204).end();
    }
  });
});

function updateSlackChannel(id, state) {
  // Get pretty room info
  let roomName, lastTimestamp, index;
  for (var i = 0; i < BATHROOMS.length; i++) {
    room = BATHROOMS[i];
    if (Object.keys(room)[0] === id) {
      index = i;
      roomName = Object.values(room)[0].name;
      lastTimestamp = Object.values(room)[0].lastUpdated;
      break;
    }
  }
  // Delete last message by timestamp
  if (lastTimestamp) {
    url = 'https://slack.com/api/chat.delete?token=' + process.env.API_TOKEN + '&channel=GGEEVQ5H9&ts=' + lastTimestamp
    fetch(url, { method: 'POST' })
      .catch(error => console.error(error));
  }

  // Post new message
  stateText = state ? "vacant" : "occupied";
  postUrl = 'https://slack.com/api/chat.postMessage?token=' + process.env.API_TOKEN + '&channel=GGEEVQ5H9&text=The%20' + roomName + '%20bathroom%20is%20' + stateText

  fetch(postUrl)
    .then(response => response.json())
    .then(data => {
      timestamp = data['message']['ts'];
      updatedRoom = {
        [id]: {
          name: roomName,
          lastUpdated: timestamp
        }
      }
      BATHROOMS[index] = updatedRoom;
    })
    .catch(error => console.error(error))
}

app.delete("/bathrooms/:id", function (req, res) {
  db.collection(BATHROOMS_COLLECTION).deleteOne({ _id: new ObjectID(req.params.id) }, function (err, result) {
    if (err) {
      handleError(res, err.message, "Failed to delete bathroom");
    } else {
      res.status(204).end();
    }
  });
});


/* Slack stuff */
// Bot responses
app.post("/slack", function (req, res) {
  var request = req.body;
  var text = request.event.text;
  var type = request.event.type;
  var channelName = request.event.channel;
  var message = "";
  if ("app_mention" === type && text.toLowerCase().indexOf("status") !== -1) {
    var promise1 = new Promise(function (resolve, reject) {
      db.collection(BATHROOMS_COLLECTION).find().toArray(function (err, result) {
        result.forEach(function (bathroom) {
          if (bathroom.vacant) {
            message += ":awyeah: :partyparrot: The " + bathroom.name + " bathroom is vacant! :partyparrot: :awyeah:\n";
          } else {
            message += ":awkwardseal: :nicmoji_sad: Uh oh, the " + bathroom.name + " bathroom is occupied :nicmoji_sad: :awkwardseal:\n";
          }
        });
        resolve(message);
      })
    });
    promise1.then(function (value) {
      var xmlHttp = new XMLHttpRequest();
      theUrl = "https://slack.com/api/chat.postMessage?token=" + process.env.API_TOKEN + "&channel=" + channelName + "&text=" + message + "&pretty=1%20[1]%2013207";
      xmlHttp.open("GET", theUrl, false); // false for synchronous request
      xmlHttp.send(null);
    })
  }
  res.status(200).send();
});

// Slash command
app.post("/slash", function (req, res) {
  var request = req.body;
  // respond within 3000ms with status 200 that the request was received
  // in order to respond with pretty text we send a response_url
  var attachments = []
  var promise = new Promise(function (resolve, reject) {
    db.collection(BATHROOMS_COLLECTION).find().toArray(function (err, result) {
      result.forEach(function (bathroom) {
        if (bathroom.vacant) {
          attachments.push(
            {
              "color": "good",
              "text": `:awyeah: :partyparrot: The ${bathroom.name} bathroom is vacant! :partyparrot: :awyeah:\n`
            }
          )
        } else {
          attachments.push(
            {
              "color": "danger",
              "text": `:awkwardseal: :nicmoji_sad: Uh oh, the ${bathroom.name} bathroom is occupied :nicmoji_sad: :awkwardseal:\n`
            }
          )
        }
      });
      resolve(attachments);
    });
  });
  promise.then((attachments) => {
    var body =
    {
      "response_type": "ephemeral", // they call responses only visible to original users ephemeral
      "text": ":poop:Here's the inside poop:poop:",
      "attachments": attachments
    }
    res.status(200).send(body);
  });

});
