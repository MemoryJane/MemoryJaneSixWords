// Load the environment variables for the DB.
require('dotenv').load();
var fs = require('fs-extra');

// Get the node-lambda module. Override a couple methods to get a callback when the app completes.
var nodeLambda = require("../node-lambda/lib/main");
nodeLambda.run = function (program, runWithTheseAttributes, callback) {
    this._createSampleFile('event.json');
    var splitHandler = program.handler.split('.');
    var filename = splitHandler[0] + '.js';
    var handlername = splitHandler[1];
    var handler = require(process.cwd() + '/' + filename)[handlername];
    var event = fs.readJSONSync(process.cwd() + '/event.json');

    // If there is a placeholder in the event for a random word, we'll load the adjectives and insert one.
    var eventString = JSON.stringify(event);
    if (eventString.search("%random%") != -1) {
        // There is a random to replace, let's go get our random words JSON.
        var adjectives = fs.readJSONSync(process.cwd() + '/tests/adjectives.json');
        var randomWord = adjectives[Math.floor(Math.random() * adjectives.length)];

        eventString = eventString.replace(/%random%/gi, randomWord);
        event = JSON.parse(eventString);
    }

    // If there are some attributes passed in, they're from the previous test, so add them to the event.
    if (runWithTheseAttributes) {
        event.session.attributes = runWithTheseAttributes;
    }

    // Log what you said to Alexa.
    if (event.userQuote) {
        console.log("(-) You Said:\t"+event.userQuote);
    }

    this._runHandler(handler, event, callback);
};
nodeLambda._runHandler = function (handler, event, callback) {
    var context = {
        succeed: function (result) {
            // Keep the session attributes alive, in case there is another test coming.
            var sessionAttributes = result.sessionAttributes;
            callback(true, sessionAttributes);
        },
        fail: function (error) {
            callback(false);
        }
    };
    handler(event, context);
};

// This is a recursive function to call nodeLambda run on a series of test files.
function runTests(filename, number, runWithTheseAttributes) {
    try {
        fs.copySync(filename.replace("#",number), './event.json');
        console.log("\nTest "+filename.replace("#",number));
        nodeLambda.run({"handler":"index.handler"}, runWithTheseAttributes, function(success, sessionAttributes) {
            // If this is a series, call this recursively until I run out of numbered files.
            if(filename.search("#") != -1) runTests(filename, number+1, sessionAttributes);
        });
    } catch (error) {
        console.log("\n No more tests.");
    }
}

// Get the name of the event.json to run.
var eventFileName = null;
for (i = 0; i < process.argv.length; i++) {
    if (process.argv[i].search(".json") != -1) {
        // Found one. Save it and drop out of the for loop.
        eventFileName = process.argv[i];
        i = process.argv.length;
    }
}

// Did I find a filename?
if (eventFileName) {
    // Yes, run the tests. If this is a series, it will automatically call recursively to run all of the tests.
    runTests(eventFileName, 1, null);
} else {
    // No file name provided, so no copy needed, just use the standard ./event.json.
    nodeLambda.run({"handler":"index.handler"});
}

