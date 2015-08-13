/*
 * This is a simple command like tool for approving new stories.
 */
require('dotenv').load();


// Get ready to use AWS and Dynamo DB.
var AWS = require("aws-sdk");
var dynamodb;
if (process.env.MEMJANE_USE_LOCAL_DB && process.env.MEMJANE_USE_LOCAL_DB == "true") {
    dynamodb = new AWS.DynamoDB({endpoint: new AWS.Endpoint('http://localhost:8000')});
    dynamodb.config.update({accessKeyId: "myKeyId", secretAccessKey: "secretKey", region: "us-east-1"});
    console.log("USING LOCAL");
} else {
    // Otherwise try to connect to the remote DB using the config file.
    dynamodb = new AWS.DynamoDB();
    console.log("USING AWS");
}

// Get the readline ready for accepting the user's input.
var readline = require('readline'),
    rl = readline.createInterface(process.stdin, process.stdout);

function askToRemove(storyData, preamble) {
    if (storyData.Items.length == 0) process.exit(0);

    var q = preamble+"\n\n"+storyData.Items[0].Story.S+"\n Enter to approve or \"R\" to reject?";
    rl.question(q, function(approveOrReject) {
        // Did they want to accept or reject.
        var nextPreamble = "Sorry, didn't understand that. Doing nothing to that story.";
        if (approveOrReject.toLowerCase() != "r" && approveOrReject == "" && approveOrReject.toLowerCase() == "a") {
            // Do nothing.
            storyData.Items.splice(0, 1);
            askToRemove(storyData, nextPreamble);
        }

        // Setup for the approval or rejection.
        var isApproved = true;
        nextPreamble = "Story is APPROVED.";
        if (approveOrReject.toLowerCase() == "r") {
            isApproved = false;
            nextPreamble = "Story is REJECTED.";
        }

        // Set the approved attribute and then call this function again.
        var scriptKey = storyData.Items[0].TimeStamp.N.toString();
        var updateItemParams = {
            TableName : "MemoryJaneSixWordStories",
            Key : { TimeStamp : { "N" : scriptKey } },
            UpdateExpression : "SET #approved = :isTrue",
            ExpressionAttributeNames : { "#approved" : "Approved" },
            ExpressionAttributeValues : { ":isTrue" : {"BOOL":isApproved} }
        };
        dynamodb.updateItem(updateItemParams, function(updateError, updateData) {
            // First item taken care of, remove it and send the array back in.
            storyData.Items.splice(0, 1);
            askToRemove(storyData, nextPreamble);
        });
    });
}

// Get all the stories from the DB that are not approved.
var tableParams = { TableName: "MemoryJaneSixWordStories",
    FilterExpression : "attribute_not_exists(Approved)"
};
dynamodb.scan(tableParams, function (tableStoryErr, tableStoryData) {
    if (tableStoryErr) console.log("_tableScan  ERROR " + tableStoryErr);
    else {
        if (tableStoryData.Count == 0) {
            rl.write("No stories need approval! Thanks!");
            process.exit(0);
        } else {
            askToRemove(tableStoryData, "\n\nYou have "+tableStoryData.Count+" stories to approve. Let's do it ..");
        }
    }
});


