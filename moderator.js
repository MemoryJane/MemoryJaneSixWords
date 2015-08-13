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

function getTimeStamp (){
    var rightNow = new Date();
    return timeStamp = Number(rightNow.getUTCMilliseconds()+1)
        +((rightNow.getUTCSeconds()+1)*10000)
        +((rightNow.getUTCMinutes()+1)*1000000)
        +((rightNow.getUTCHours()+1)*100000000)
        +(rightNow.getUTCDate()*10000000000)
        +((rightNow.getUTCMonth()+1)*1000000000000)
        +(rightNow.getUTCFullYear()*10000000000000);
}

function askToRemove(storyData, preamble) {
    if (storyData.Items.length == 0) process.exit(0);

    // If this is not one of our stories, call it out.
    var q = preamble+"\n\n";
    var isUs = true;
    if (storyData.Items[0].Author.S != "amzn1.account.AFM2SDUDN23KH6MJHROQVWCIW3IA") {
        isUs = false;
        q += "***  NOT ONE OF OURS ***\n";
    }
    q += storyData.Items[0].Story.S+"\n Enter to approve or \"R\" to reject?";

    rl.question(q, function(approveOrReject) {
        // Did they want to accept or reject.
        var nextPreamble = "Sorry, didn't understand that. Doing nothing to that story.";
        if (approveOrReject.toLowerCase() != "r" && approveOrReject != "" && approveOrReject.toLowerCase() != "a") {
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
            if (isApproved) {
                var addAReaction = nextPreamble+"\nIf you want to add a reaction, type it now, or hit enter to not react.";
                rl.question(addAReaction, function(reaction) {
                    if (reaction != "") {
                        var newReactionParams = { TableName: 'MemoryJaneSixWordReactions',
                            Item: {
                                storyId: {"N": storyData.Items[0].TimeStamp.N.toString()},
                                TimeStamp: { "N": getTimeStamp().toString() },
                                ReactorId: {"S": "amzn1.account.AFM2SDUDN23KH6MJHROQVWCIW3IA"},
                                Reaction: {"S": reaction}
                            }
                        };

                        dynamodb.putItem(newReactionParams, function (reactionErr, reactionData) {
                            if (reactionErr) console.log("Data _addStoryReaction_  ERROR " + reactionErr);

                            // Put the item in the news table too, so they get notified.
                            var news = "You received a comment. "+reaction+". On your story.";
                            news += " "+storyData.Items[0].Story.S;
                            var newNewsParams = { TableName: 'MemoryJaneSixWordNews',
                                Item: {
                                    userId: {"S": storyData.Items[0].Author.S},
                                    TimeStamp: { "N": getTimeStamp().toString() },
                                    News: {"S": news},
                                    Read: {"S": "false"}
                                }
                            };
                            dynamodb.putItem(newNewsParams, function (reactionErr, reactionData) {
                                nextPreamble = "Saved your reaction.";
                                storyData.Items.splice(0, 1);
                                askToRemove(storyData, nextPreamble);
                            });
                        });
                    } else {
                        nextPreamble = "No reaction saved.";
                        storyData.Items.splice(0, 1);
                        askToRemove(storyData, nextPreamble);
                    }
               });
            } else {
                // First item taken care of, remove it and send the array back in.
                storyData.Items.splice(0, 1);
                askToRemove(storyData, nextPreamble);
            }
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


