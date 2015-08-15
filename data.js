/**
 * THis is the data object, used for all communications with the DB.
 * It follows the Module pattern.
 */
var data = (function () {
    var AWS = require("aws-sdk");
    var dataTheme = require("./datatheme.js");
    var dynamodb = getDynamoDB();

    /**
     * Get the database object, either from AWS if it is there, or locally if it is not.
     * This is a private function.
     * @returns {AWS.DynamoDB}
     */
    function getDynamoDB () {
        var DB;

        // We're checking the process variables to see if should go local. If the envirnment variables
        // are not set, we use AWS.
        if (process.env.MEMJANE_USE_LOCAL_DB && process.env.MEMJANE_USE_LOCAL_DB == "true") {
            DB = new AWS.DynamoDB({endpoint: new AWS.Endpoint('http://localhost:8000')});
            DB.config.update({accessKeyId: "myKeyId", secretAccessKey: "secretKey", region: "us-east-1"});
            console.log("Data_getDynamoDB_USING_LOCAL");
        } else {
            // Otherwise try to connect to the remote DB using the config file.
            DB = new AWS.DynamoDB();
            console.log("Data_getDynamoDB_USING_AWS");
        }
        return DB;
    }

    /**
     * Private helper function (with a separate public exposure function). Returns the current time
     * as a number time stamp.
     */
    function getTimeStamp () {
        var rightNow = new Date();
        return timeStamp = Number(rightNow.getUTCMilliseconds()+1)
            +((rightNow.getUTCSeconds()+1)*1000)
            +((rightNow.getUTCMinutes()+1)*100000)
            +((rightNow.getUTCHours()+1)*10000000)
            +(rightNow.getUTCDate()*1000000000)
            +((rightNow.getUTCMonth()+1)*100000000000)
            +(rightNow.getUTCFullYear()*10000000000000);
    }

    /**
     *
     */
    function getRandomStories(storyCountRequested, author, getRandomStoriesCallback) {
        // We're looking for any stories that are approved..
        var randomStoriesParams = {
            TableName: "MemoryJaneSixWordStories",
            FilterExpression : "#approved = :isTrue",
            ExpressionAttributeNames : { "#approved" : "Approved" },
            ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
        };

        // If there's an author passed in, add the limitation tot he params.
        if(author) {
            randomStoriesParams.FilterExpression += " AND #thisauthor = :author";
            randomStoriesParams.ExpressionAttributeNames["#thisauthor"] = "Author";
            randomStoriesParams.ExpressionAttributeValues[":author"] = { "S" : author };
        }

        // Get the stories.
        dynamodb.scan(randomStoriesParams, function (randomStoriesErr, randomStoriesData) {
            if (randomStoriesErr) throw ("Data_getRandomStories_ERROR " + randomStoriesErr);
            else {
                // Declare empty arrays for the story indexes, stories, timeStamps, and authors.
                var stories = [];
                var timeStamps = [];
                var authors = [];

                // If there are more stories available than were requested, we need to do a
                // quick shuffling of the stories. We can do it directly in the Items array.
                if (randomStoriesData.Items.length > storyCountRequested) {
                    // We only need to shuffle to storyCount since we're only going to take that many
                    // items when we return the array..
                    for (i = 0; i < storyCountRequested; i++) {
                        var randomIndex = Math.floor(Math.random() * randomStoriesData.Items.length);
                        var tempItem = randomStoriesData.Items[i];
                        randomStoriesData.Items[i] = randomStoriesData.Items[randomIndex];
                        randomStoriesData.Items[randomIndex] = tempItem;
                    }

                    // Now, slice the array so that only the right number of items get returned.
                    randomStoriesData.Items = randomStoriesData.Items.slice(0, storyCountRequested);
                }

                // Now put all the items into the data arrays for passback.
                for (i = 0; i < randomStoriesData.Items.length; i++) {
                    stories.push(randomStoriesData.Items[i].Story.S);
                    timeStamps.push(randomStoriesData.Items[i].TimeStamp.N.toString());
                    authors.push(randomStoriesData.Items[i].Author.S);
                }

                getRandomStoriesCallback(stories, timeStamps, authors);
            }
        });
    }

    return {
        /**
         * This takes a userId and a scriptKey and increases by one the number of times the user has heard the
         * scriptKey. It then returns the number of times it's been heard in the callback.
         * @param userId
         * @param scriptKey
         * @param scriptListenCallback
         */
        incrementScriptListenCount: function(userId, scriptKey, scriptListenCallback) {
            //Declare parameters for use in updateItem. These increment the listen count by one.
            var incrementScriptParams = {
                TableName : "MemoryJaneSixWordScriptListens",
                Key : { UserID : { "S" : userId }, ScriptKey : { "S" : scriptKey } },
                UpdateExpression : "ADD #listenCount :increment",
                ExpressionAttributeNames : { "#listenCount" : "ListenCount" },
                ExpressionAttributeValues : { ":increment" : {"N":"1"} }
            };

            dynamodb.updateItem(incrementScriptParams, function(incrementScriptError, incrementScriptData) {
                if (incrementScriptError) throw ("Data_incrementScriptListenCount_ERROR_ " + incrementScriptError);
                else{
                    // Okay, now get the listen count to send back.
                    var getListenCountParams = { TableName: 'MemoryJaneSixWordScriptListens',
                        Key : { UserID : { "S" : userId }, ScriptKey : { "S" : scriptKey } }
                    };
                    dynamodb.getItem(getListenCountParams, function(listenError, listenData) {
                        if (listenError) throw("Data_incrementScriptListenCount_ERROR_ " + listenError);
                        else{
                            scriptListenCallback(listenData.Item.ListenCount.N);
                        }
                    });
                }
            });
        },

         /**
         * Gets a random story from the database and returns it
         * @param getRandomStoryCallback
         */
        getRandomStory: function (getRandomStoryCallback){
             getRandomStories(1, null, function(stories, timeStamps, authors) {
                 getRandomStoryCallback(stories[0], timeStamps[0], authors[0]);
             });
        },

        /**
         * Gets "n" stories from a particular author
         * @param storyCountRequested
         * @param author
         * @param authorStoriesCallback
         */
        getStoriesByAuthor: function (storyCountRequested, author, authorStoriesCallback){
            getRandomStories(storyCountRequested, author, function(stories, timeStamps, authors) {
                authorStoriesCallback(stories, timeStamps, authors);
            });
        },

        /**
         * Gets a specific number of random stories and returns them.
         * @param storyCountRequested
         * @param getRandomStoriesCallback
         */
        getRandomStories: function (storyCountRequested, getRandomStoriesCallback){
            getRandomStories(storyCountRequested, function(stories, timeStamps, authors) {
                getRandomStoriesCallback(stories, timeStamps, authors);
            });
        },

        /**
         * Puts a user created story into the database
         * @param author
         * @param story
         * @param themeText
         * @param remixId
         * @param putStoryCallback
         */
        putNewStory: function (author, story, themeText, remixId, putStoryCallback){
            //Declare parameters for use in putItem. These put a new story into the database at an initial rating of
            //zero, a TimeStamp equal to the current time, Author as the user's userId and Story as the story that
            //they said to publish.
            var timeStamp = getTimeStamp().toString();
            var newStoryParams = {
                TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": timeStamp },
                    Rating: {"N": "0"},
                    Story: {"S": story},
                    Author: {"S": author}
                }
            };

            // If we got a themeText, add it to the record.
            if (themeText) newStoryParams.Item.ThemeText = { "S" : themeText };

            // If the story is a remix, add the storyId of the story it remixed to the record.
            if (remixId) newStoryParams.Item.RemixId = { "S" : remixId };

            dynamodb.putItem(newStoryParams, function (putStoryErr, putStoryData) {
                if (putStoryErr) throw ("Data_putNewStory_ERROR " + putStoryErr);
                else putStoryCallback(timeStamp);
            });
        },

        /*
         * Increment the story rating for a specific story.
         * @param date
         * @param time
         * @param incrementStoryCallback
         */
        incrementStoryRating: function (time, incrementStoryCallback) {
            //Declare parameters for use in updateItem. These increment the rating count by one.
            var incrementStoryParams = {
                TableName : "MemoryJaneSixWordStories",
                Key : { TimeStamp : { "N" : time } },
                UpdateExpression : "ADD #rating :increment",
                ExpressionAttributeNames : { "#rating" : "Rating" },
                ExpressionAttributeValues : { ":increment" : {"N":"1"} }
            };

            dynamodb.updateItem(incrementStoryParams, function(incrementStoryErr, updateData) {
                if (incrementStoryErr) throw ("Data_incrementStoryRating_ERROR " + incrementStoryErr);
                else incrementStoryCallback();
            });
        },

        /**
         * Adds a reaction to a current story
         * @param reaction
         * @param storyId
         * @param userId
         * @param addStoryCallback
         */
        addStoryReaction: function (reaction, storyId, userId, addStoryCallback) {
            //Declare parameters for use in putItem. These add a new reaction to the reactions table, based on the
            //story that is being reacted to, the current time, the reactor's userId, and the reaction.
            var newReactionParams = {
                TableName: 'MemoryJaneSixWordReactions',
                Item: {
                    storyId: {"N": storyId},
                    TimeStamp: { "N": getTimeStamp().toString() },
                    ReactorId: {"S": userId},
                    Reaction: {"S": reaction}
                }
            };

            dynamodb.putItem(newReactionParams, function (reactionErr, reactionData) {
                if (reactionErr) throw ("Data_addStoryReaction_ERROR " + reactionErr);
                else addStoryCallback();
            });
        },

        /**
         * Gets a specific story's rating from the database and returns it
         * @param storyId
         * @param getStoryRatingCallback
         */
        getStoryRating: function (storyId, getStoryRatingCallback){
            //Declare parameters for use in getItem. These retrieve the item with the specified TimeStamp.
            var storyRatingParams = {
                TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": storyId }
                }
            };

            dynamodb.getItem(storyRatingParams, function (storyRatingErr, storyRatingData) {
                if (storyRatingErr) throw ("Data_getStoryRating_ERROR " + storyRatingErr);
                else {
                    var rating = storyRatingData.Rating.N;
                    getStoryRatingCallback(rating);
                }
            });
        },

        /**
         * Get reactions for the story that the user just listened to
         * @param storyId
         * @param storyReactionCallback
         */
        getLatestStoryReactions: function (storyId, storyReactionCallback){
            //Declare parameters for use in query. These find all reactions in the table associated with the specific
            //storyId.
            var storyReactionParams = {
                TableName: 'MemoryJaneSixWordReactions',
                KeyConditionExpression: '#hashkey = :hk_val',
                ExpressionAttributeNames: {
                    '#hashkey': "storyId"
                },
                ExpressionAttributeValues: {
                    ':hk_val': {N: storyId}
                },
                ScanIndexForward: true,
                Limit: 5
            };

            dynamodb.query(storyReactionParams, function (storyReactionErr, storyReactionData) {
                if (storyReactionErr) throw ("Data_getLatestStoryReactions_ERROR " + storyReactionErr);
                else {
                    //Declare count as the number of items returned by the query
                    var count = storyReactionData.Count;

                    //If no items were returned, the story had no reactions so return undefined. Otherwise, callback
                    //all of the reactions to the story in array format.
                    if (count == 0) {
                        storyReactionCallback(undefined);
                    }
                    else{
                        var reactions = [];
                        for (i = 0; i < count; i++) {
                            reactions[i] = storyReactionData.Items[i].Reaction.S;
                        }
                        storyReactionCallback(reactions);
                    }
                }
            });
        },

        /**
         * Puts logs of what users do into the database
         * @param user
         * @param story
         * @param userAction
         * @param putUserActivityCallback
         */
        putUserActivity: function (user, story, userAction, putUserActivityCallback){
            //Declare parameters for use in putItem. These enter information into the table when users take certain
            //actions.
            var activityParams = {
                TableName: 'MemoryJaneSixWordStoriesActivity',
                Item: {
                    TimeStamp: { "N": getTimeStamp().toString() },
                    User: {"S": user},
                    Story: {"S": story},
                    UserAction: {"S": userAction}
                }
            };

            dynamodb.putItem(activityParams, function (putUserActivityErr, putUserActivityData) {
                if (putUserActivityErr) throw ("Data_putUserActivity_ERROR " + putUserActivityErr);
                else putUserActivityCallback();
            });
        },

        /**
         * Gets the latest news update based on the specific user
         * @param user
         * @param getNewsCallback
         */
        getNews: function(user, getNewsCallback){
            //Declare parameters for use in query. These retrieve all pieces of news associated with a userId.
            var getNewsParams = {
                TableName: 'MemoryJaneSixWordNews',
                KeyConditionExpression: '#hashkey = :hk_val AND #rangekey >= :rk_val',
                ExpressionAttributeNames: {
                    '#hashkey': "userId",
                    '#rangekey': "TimeStamp"
                },
                ExpressionAttributeValues: {
                    ':hk_val': {S: user},
                    ':rk_val': {N: "0"}
                },
                ScanIndexForward: false,
                Limit: 1
            };

            dynamodb.query(getNewsParams, function (newsQueryErr, newsQueryData) {
                if (newsQueryErr) throw ("Data_getNews_ERROR " + newsQueryErr);

                //If the query returned no news items, return undefined. Otherwise, if the first item returned has
                //already been read, return undefined. Otherwise, return the most recent piece of news and mark it
                //as read.
                if (!newsQueryData.Items[0]){
                    getNewsCallback(undefined);
                } else {
                    if (newsQueryData.Items[0].Read.S == "true"){
                        getNewsCallback(undefined);
                    }else {
                        var updateItemParams = {
                            TableName : "MemoryJaneSixWordNews",
                            Key : { userId : { "S" : user }, TimeStamp : { "N": newsQueryData.Items[0].TimeStamp.N } },
                            UpdateExpression : "SET #approved = :isTrue",
                            ExpressionAttributeNames : { "#approved" : "Read" },
                            ExpressionAttributeValues : { ":isTrue" : {"S":"true"} }
                        };
                        dynamodb.updateItem(updateItemParams, function(newsQueryErr, newsData){
                            getNewsCallback(newsQueryData.Items[0].News.S);
                        });
                    }
                }
            });
        },

        /**
         * Checks if a specific user has news
         * @param user
         * @param hasNewsCallback
         */
        hasNews: function(user, hasNewsCallback){
            //Declare parameters for use in query. These check if there is news associated with the userId.
            var getNewsParams = {
                TableName: 'MemoryJaneSixWordNews',
                KeyConditionExpression: '#hashkey = :hk_val AND #rangekey >= :rk_val',
                ExpressionAttributeNames: {
                    '#hashkey': "userId",
                    '#rangekey': "TimeStamp"
                },
                ExpressionAttributeValues: {
                    ':hk_val': {S: user},
                    ':rk_val': {N: "0"}
                },
                ScanIndexForward: false,
                Limit: 1
            };

            dynamodb.query(getNewsParams, function (newsQueryErr, newsQueryData) {
                if (newsQueryErr) throw ("Data_hasNews_ERROR " + newsQueryErr);

                //If the query returned no news items, return false. Otherwise, if the first item returned has
                //already been read, return false. Otherwise, return true.
                if (!newsQueryData.Items[0]){
                    hasNewsCallback(false);
                } else {
                    if (newsQueryData.Items[0].Read.S == "true"){
                        hasNewsCallback(false);
                    }else {
                        hasNewsCallback(true);
                    }
                }
            });
        },

        /**
         * Adds a news item when a user's stories are reacted to
         * @param userId
         * @param news
         * @param addNewsCallback
         */
        addNews: function (userId, news, addNewsCallback) {
            //Declare parameters for use in putItem. These put a new news item into the news database under the userId
            //of the user that the news is for and containing the piece of news for them to read.
            var newNewsParams = {
                TableName: 'MemoryJaneSixWordNews',
                Item: {
                    userId: {"S": userId},
                    TimeStamp: { "N": getTimeStamp().toString() },
                    News: {"S": news},
                    Read: {"S": "false"}
                }
            };

            dynamodb.putItem(newNewsParams, function (addNewsErr, addNewsData) {
                if (addNewsErr) throw ("Data_addNews_ERROR " + addNewsErr);
                addNewsCallback();
            });
        },

        /**
         * Determine if there is at least 1 remix associated with the given story.
         * @param storyId
         * @param areThereRemixesCallback
         */
        areThereRemixes: function (storyId, areThereRemixesCallback){
            var areThereRemixesParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#remixId = :storyId",
                ExpressionAttributeNames : { "#remixId" : "RemixId" },
                ExpressionAttributeValues : { ":storyId" : {"N":storyId} }
            };
            dynamodb.scan(areThereRemixesParams, function (remixesErr, remixesData) {
                if (remixesErr) throw ("Data_areThereRemixes_ERROR " + remixesErr);
                else {
                    var remix;
                    if (remixesData.Count > 0){
                        remix = true;
                    }else{
                        remix = false;
                    }
                    areThereRemixesCallback(remix);
                }
            });
        },

        /**
         * Get all remixes associated with the given story.
         * @param storyId
         * @param getRemixesCallback
         */
        getRemixes: function (storyId, getRemixesCallback){
            var areThereRemixesParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#remixId = :storyId",
                ExpressionAttributeNames : { "#remixId" : "RemixId" },
                ExpressionAttributeValues : { ":storyId" : {"N":storyId} }
            };
            dynamodb.scan(areThereRemixesParams, function (remixesErr, remixesData) {
                if (remixesErr) throw ("Data_getRemixes_ERROR " + remixesErr);
                else {
                    var remixCount = remixesData.Count;
                    var remixes = [];
                    for(i = 0; i < remixCount; i ++){
                        remixes[i] = remixesData.Items[i].Story.S;
                    }
                    getRemixesCallback(remixes);
                }
            });
        },

        /**
         * Call this to see if there are theme stories for this user to hear.
         * Returns true if there are, and a string that is the theme of the day.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to hear the theme stories.
         * Uses the dataTheme module.
         */
        areThereThemeStoriesToHear: function(userId, areThereThemeStoriesCallback) {
            dataTheme.areThereThemeStoriesToHear(this, dynamodb, userId, areThereThemeStoriesCallback);
        },

        /**
         * Call this to see if there is a theme for the day. If there is, you'll get back true and the theme.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to create a theme story.
         * Uses the dataTheme module.
         */
        isThereAThemeToPromptFor: function(userId, isThereAThemeCallback) {
            dataTheme.isThereAThemeToPromptFor(this, dynamodb, userId, isThereAThemeCallback);
        },

        /**
         * Get the stories that match the current theme.
         * Returns at most 5 stories.
         * Uses the dataTheme module.
         */
        getThemeStories: function(getThemeStoriesCallback) {
            dataTheme.getThemeStories(this, dynamodb, getThemeStoriesCallback);
        },

        /**
         * Checks to see if a story matches the current theme. Returns a boolean and the theme, if it matched.
         * Uses the dataTheme module.
         */
        doesStoryMatchTheme: function(story, doesStoryMatchThemeCallback) {
            dataTheme.doesStoryMatchTheme(this, dynamodb, story, doesStoryMatchThemeCallback);
        },

        /**
         * Exposes the helper function to the outside world. This is used by the modules that implement the various
         * parts of data to make sure we're all handling time stamping the same.
         */
        getTimeStamp: function() { return getTimeStamp(); }
    }
}) ();

module.exports = data;