// Load the environment variables for the DB.
require('dotenv').load();

// Get the node-lambda module. Override a couple methods to get a callback when the app completes.
var nodeLambda = require("../node-lambda/lib/main");
nodeLambda.run = function (program, callback) {
    this._createSampleFile('event.json');
    var splitHandler = program.handler.split('.');
    var filename = splitHandler[0] + '.js';
    var handlername = splitHandler[1];
    var handler = require(process.cwd() + '/' + filename)[handlername];
    var event = require(process.cwd() + '/event.json');
    this._runHandler(handler, event, callback);
};
nodeLambda._runHandler = function (handler, event, callback) {
    var context = {
        succeed: function (result) {
            callback(true);
        },
        fail: function (error) {
            callback(false);
        }
    };
    handler(event, context);
};

// This is a recursive function to call nodeLambda run on a series of test files.
function runTests(filename, number) {
    console.log("\n");
    var fs = require('fs-extra');
    try {
        fs.copySync(filename.replace("#",number), './event.json');
        nodeLambda.run({"handler":"index.handler"}, function(success) {
            // If this is a series, call this recursively until I run out of numbered files.
            if(filename.search("#") != -1) runTests(filename, number+1);
        });
    } catch (error) {
        console.log("\n No more tests.");
        console.log(error);
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
    runTests(eventFileName, 1);
} else {
    // No file name provided, so no copy needed, just use the standard ./event.json.
    nodeLambda.run({"handler":"index.handler"});
}

