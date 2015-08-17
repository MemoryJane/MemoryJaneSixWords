function sortDescending(arrayToSort, propertyToSortBy) {
    var sortedIndexArray= [0];

    for (i = 1; i < arrayToSort.length; i++){
        for (k = 0; k < sortedIndexArray.length; k++){
            if (arrayToSort[i][propertyToSortBy].N < arrayToSort[sortedIndexArray[k]][propertyToSortBy].N){
                sortedIndexArray.splice(k, 0, i);
                k = sortedIndexArray.length;
            }
            if (k == sortedIndexArray.length-1){
                sortedIndexArray.splice(k+1, 0, i);
                k = sortedIndexArray.length;
            }
        }
    }

    var sortedArray = [];
    for (j = sortedIndexArray.length-1; j >= 0; j--){
        sortedArray.push(arrayToSort[sortedIndexArray[j]]);
    }
    return sortedArray;
}

// Get the readline ready for accepting the user's input.
var readline = require('readline'),
    rl = readline.createInterface(process.stdin, process.stdout);

// File system for uploading images and videos.
var fs = require('fs-extra');

// Use the Twit module to send tweets ...
require('dotenv').load();
var Twit = require('twit');
var twitterConfig = {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN_SXWRD,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET_SXWRD
};
var T = new Twit(twitterConfig);

// Create the Twitter-Video module.
var twitterVideo = require('twitter-video');

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

// We're looking for any stories that are approved, not from us, not already published to Twitter.
var tweetableStoriesParams = {
    TableName: "MemoryJaneSixWordStories",
    FilterExpression : "#approved = :isTrue " +
    "AND #selectedForTwitter <> :isTrue " +
    "AND #selectedForTwitter <> :isFalse",
    ExpressionAttributeNames : {
        "#approved" : "Approved",
        "#selectedForTwitter": "SelectedForTwitter" },
    ExpressionAttributeValues : {
        ":isTrue" : {"BOOL":true},
        ":isFalse" : {"BOOL":false} }
};

var useOursQuestion = "Would you like to include ours? (y or n) ";
rl.question(useOursQuestion, function(useOursYOrN) {
    if(useOursYOrN == "n") {
        tweetableStoriesParams.FilterExpression += " AND #author <> :us";
        tweetableStoriesParams.ExpressionAttributeNames["#author"] = "Author";
        tweetableStoriesParams.ExpressionAttributeValues[":us"] = {"S":"amzn1.account.AFM2SDUDN23KH6MJHROQVWCIW3IA"};
    }

    // Get the stories.
    dynamodb.scan(tweetableStoriesParams, function (tweetableStoriesErr, tweetableStoriesData) {
        if (tweetableStoriesErr) throw ("Data_getRandomStories_ERROR " + tweetableStoriesErr);
        else {
            console.log(tweetableStoriesData);
            var timeSortedStories = sortDescending(tweetableStoriesData.Items, "TimeStamp");
            var ratingSortedStories = sortDescending(tweetableStoriesData.Items, "Rating");

            // Show the top 5 most recent and top 5 highest rated.
            var timeStoriesTable = "";
            var ratingStoriesTable = "";
            for (i = 0; i < 5; i++) {
                timeStoriesTable += (i+1)+")  ";
                var timePublished = timeSortedStories[i].TimeStamp.N.toString();
                timeStoriesTable += " (Published: "+timePublished+") \t";
                timeStoriesTable += timeSortedStories[i].Story.S+"\n";
                ratingStoriesTable += (i+6)+")  ";
                var storyRating = ratingSortedStories[i].Rating.N.toString();
                ratingStoriesTable += " (Rating: "+storyRating+") \t";
                ratingStoriesTable += ratingSortedStories[i].Story.S+"\n";
            }

            var q = "\n\nStories to choose from:\n"+timeStoriesTable+ratingStoriesTable+"\n> ";
            rl.question(q, function(numberSelected) {
                var numberSelectedNumber = Number(numberSelected);

                var rawStoryText = "";
                var selectedStoryTimeStamp = 0;
                if (numberSelectedNumber > 0 && numberSelectedNumber <= 5) {
                    rawStoryText = timeSortedStories[numberSelectedNumber - 1].Story.S;
                    selectedStoryTimeStamp = timeSortedStories[numberSelectedNumber - 1].TimeStamp.N;
                } else if (numberSelectedNumber > 5 && numberSelectedNumber <= 10) {
                    rawStoryText = ratingSortedStories[numberSelectedNumber - 6].Story.S;
                    selectedStoryTimeStamp = ratingSortedStories[numberSelectedNumber - 6].TimeStamp.N;
                } else {
                    // Out of bounds, tell the user and quit.
                    console.log("Oops. Looking for a number 1 - 10.");
                    process.exit(0);
                }

                // Massage the text. Capitalize, and add punctuation where needed.
                var rawStoryWordArray = rawStoryText.split(" ");
                for (i = 0; i < rawStoryWordArray.length; i++) {
                    // If the first word isn't capitalized, or an "i" isn't, do it.
                    if (i == 0 || rawStoryWordArray[i] == "i") {
                        var upperCaseFirstLetter = rawStoryWordArray[i].charAt(0).toUpperCase();
                        rawStoryWordArray[i] = upperCaseFirstLetter + rawStoryWordArray[i].substr(1);
                    }
                    // If it's the last word, put a period at the end, if there isn't another punctuation.
                    if (i == rawStoryWordArray.length - 1) {
                        var lastCharacter = rawStoryWordArray[i].charAt(rawStoryWordArray[i].length - 1);
                        if (lastCharacter != "." && lastCharacter != "?" && lastCharacter != "!") {
                            rawStoryWordArray[i] += ".";
                        }
                    }
                }

                rawStoryText = "";
                for (i = 0; i < rawStoryWordArray.length; i++) {
                    rawStoryText += rawStoryWordArray[i];
                    if (i != rawStoryWordArray.length - 1) rawStoryText += " ";
                }
                var tweetText = '"' + rawStoryText + '"';

                // We need to set the SelectedForTwitter attribute on that story so we can record the video of it.
                var storyTwitterSelectedUpdateParams = {
                    TableName: 'MemoryJaneSixWordStories',
                    Key: {TimeStamp: {"N": selectedStoryTimeStamp}},
                    UpdateExpression: "SET #selectedForTwitter = :true",
                    ExpressionAttributeNames : { "#selectedForTwitter" : "SelectedForTwitter" },
                    ExpressionAttributeValues : { ":true" : {"BOOL":true} }
                };
                dynamodb.updateItem(storyTwitterSelectedUpdateParams, function (updateError, updateData) {
                    if (updateError) throw ("Data_incrementStoryRating_ERROR " + updateError);
                    else {
                        // Let's see if there are any reactions.
                        var storyReactionParams = {
                            TableName: 'MemoryJaneSixWordReactions',
                            KeyConditionExpression: '#hashkey = :hk_val',
                            ExpressionAttributeNames: {
                                '#hashkey': "storyId"
                            },
                            ExpressionAttributeValues: {
                                ':hk_val': {N: selectedStoryTimeStamp}
                            },
                            ScanIndexForward: true,
                            Limit: 5
                        };

                        dynamodb.query(storyReactionParams, function (storyReactionErr, storyReactionData) {
                            if (storyReactionErr) throw ("Data_getLatestStoryReactions_ERROR " + storyReactionErr);
                            else {
                                // Are there any reactions to add to the text?
                                if (storyReactionData.Count > 0) {
                                    // Yes! Add them to the tweet text.
                                    tweetText += "\n\nReactions: ";
                                    for (i = 0; i < storyReactionData.Count; i++) {
                                        // Make sure adding the reaction won't put us over 140 characters.
                                        var reactionToAdd = '#' + storyReactionData.Items[i].Reaction.S + ' ';
                                        if (tweetText.length + reactionToAdd.length < 140) {
                                            tweetText += reactionToAdd;
                                        }
                                    }
                                }

                                // Ask if the tweet has a video, and upload it if it does.
                                q = "Enter the Vine URL: ?  ";
                                rl.question(q, function(videoURL) {

                                    tweetText += "\n"+videoURL;

                                    T.post('statuses/update', { status: tweetText }, function(err, data, response) {
                                        console.log("\n\n" + tweetText + "\n\nCharacter Count: " + tweetText.length);
                                        process.exit(0);
                                    });


                                    /*
                                     twitterVideo.fromFile(videoFileName, twitterConfig, function (err, media_id) {
                                     console.log(media_id);

                                     var tweetParams= { status: tweetText, media_ids: [media_id] };

                                     T.post('statuses/update', tweetParams, function (err, data, response) {
                                     console.log(data);
                                     console.log("\n\n" + tweetText + "\n\nCharacter Count: " + tweetText.length);
                                     process.exit(0);
                                     });
                                     });




                                     /*

                                     var b64content = fs.readFileSync(videoFileName, { encoding: 'binary' });

                                     // first we must post the media to Twitter
                                     T.post('media/upload', { media: b64content }, function (err, data, response) {
                                     if (err) console.log(err);

                                     // now we can reference the media and post a tweet (media will attach to the tweet)
                                     var mediaIdStr = data.media_id_string;
                                     var tweetParams= { status: tweetText, media_ids: [mediaIdStr] };

                                     T.post('statuses/update', tweetParams, function (err, data, response) {
                                     console.log(data)
                                     console.log("\n\n" + tweetText + "\n\nCharacter Count: " + tweetText.length);
                                     process.exit(0);
                                     });
                                     });
                                     */
                                });
                            }
                        });
                    }
                });

            });


            //T.post('statuses/update', params, function (err, data, response) {
            //    console.log(data)
            //})
            //T.post('statuses/update', { status: "Hello World!" }, function(err, data, response) {
            //    console.log(data)
            //});
        }
    });
});


