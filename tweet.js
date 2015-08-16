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

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

// We're looking for any stories that are approved, not from us, not already published to Twitter.
var tweetableStoriesParams = {
    TableName: "MemoryJaneSixWordStories",
    FilterExpression : "#approved = :isTrue AND #publishedToTwitter <> :isTrue", //AND #author <> :us AND #publishedToTwitter <> :isTrue",
    ExpressionAttributeNames : {
        "#approved" : "Approved",
        //"#author": "Author",
        "#publishedToTwitter": "PublishedToTwitter" },
    ExpressionAttributeValues : {
        ":isTrue" : {"BOOL":true}}//,
        //":us" : {"S":"amzn1.account.AFM2SDUDN23KH6MJHROQVWCIW3IA"} }
};

// Get the stories.
dynamodb.scan(tweetableStoriesParams, function (tweetableStoriesErr, tweetableStoriesData) {
    if (tweetableStoriesErr) throw ("Data_getRandomStories_ERROR " + tweetableStoriesErr);
    else {
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
                rawStoryText = timeSortedStories[numberSelectedNumber-1].Story.S;
                selectedStoryTimeStamp = timeSortedStories[numberSelectedNumber-1].TimeStamp.N;
            } else if (numberSelectedNumber > 5 && numberSelectedNumber <= 10) {
                rawStoryText = ratingSortedStories[numberSelectedNumber-6].Story.S;
                selectedStoryTimeStamp = ratingSortedStories[numberSelectedNumber-6].TimeStamp.N;
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
                if (i == rawStoryWordArray.length-1) {
                    var lastCharacter = rawStoryWordArray[i].charAt(rawStoryWordArray[i].length-1);
                    if (lastCharacter != "." && lastCharacter != "?" && lastCharacter != "!") {
                        rawStoryWordArray[i] += ".";
                    }
                }
            }

            rawStoryText = "";
            for (i = 0; i < rawStoryWordArray.length; i++) {
                rawStoryText += rawStoryWordArray[i];
                if (i != rawStoryWordArray.length-1) rawStoryText += " ";
            }
            var tweetText = '"'+rawStoryText+'"';


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
                    // Are there any reactions?
                    if (storyReactionData.Count > 0) {
                        // Yes! Add them to the tweet text.
                        tweetText += "\n\nReactions:\n";
                        for (i = 0; i < storyReactionData.Count; i++) {
                            // Make sure adding the reaction won't put us over 140 characters.
                            var reactionToAdd = '"'+storyReactionData.Items[i].Reaction.S+'"\n';
                            if (tweetText.length + reactionToAdd.length < 140) {
                                tweetText += reactionToAdd;
                            }
                        }
                    }

                    console.log("\n\n"+tweetText+"\n\nCharacter Count: "+tweetText.length);
                    process.exit(0);
                }
            });
        });


        //T.post('statuses/update', { status: "Hello World!" }, function(err, data, response) {
        //    console.log(data)
        //});
    }
});

