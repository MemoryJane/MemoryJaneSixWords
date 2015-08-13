var data = (function () {
    var AWS = require("aws-sdk");
    var dynamodb = getDynamoDB();

    /**
     * Get the database object, either from AWS if it is there, or locally if it is not.
     * This is a private function.
     * @returns {AWS.DynamoDB}
     */
    function getDynamoDB () {
        var DB;

        if (process.env.MEMJANE_USE_LOCAL_DB && process.env.MEMJANE_USE_LOCAL_DB == "true") {
            DB = new AWS.DynamoDB({endpoint: new AWS.Endpoint('http://localhost:8000')});
            DB.config.update({accessKeyId: "myKeyId", secretAccessKey: "secretKey", region: "us-east-1"});
            console.log("USING LOCAL");
        } else {
            // Otherwise try to connect to the remote DB using the config file.
            DB = new AWS.DynamoDB();
            console.log("USING AWS");
        }
        return DB;
    }

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

    return {
        /**
         * This takes a userId and a scriptKey and increases by one the number of times the user has heard the
         * scriptKey. It then returns the number of times it's been heard in the callback.
         * @param userId
         * @param scriptKey
         * @param scriptListenCallback
         */
        incrementScriptListenCount: function(userId, scriptKey, scriptListenCallback) {
            var incrementScriptParams = {
                TableName : "MemoryJaneSixWordScriptListens",
                Key : { UserID : { "S" : userId }, ScriptKey : { "S" : scriptKey } },
                UpdateExpression : "ADD #listenCount :increment",
                ExpressionAttributeNames : { "#listenCount" : "ListenCount" },
                ExpressionAttributeValues : { ":increment" : {"N":"1"} }
            };

            dynamodb.updateItem(incrementScriptParams, function(incrementScriptError, incrementScriptData) {
                if (incrementScriptError) console.log("Data _ incrementScriptListenCount_updateItem_  ERROR " + incrementScriptError);
                else{
                    // Okay, now get the listen count to send back.
                    var getListenCountParams = { TableName: 'MemoryJaneSixWordScriptListens',
                        Key : { UserID : { "S" : userId }, ScriptKey : { "S" : scriptKey } }
                    };

                    dynamodb.getItem(getListenCountParams, function(listenError, listenData) {
                        if (listenError) console.log("Data _ incrementScriptListenCount_getItem_  ERROR " + listenError);
                        else{
                            scriptListenCallback(listenError, listenData.Item.ListenCount.N);
                        }
                    });
                }
            });
        },

         /**
         * Gets a random story from the database and returns it
         * @param randomStoryCallback
         */
        getRandomStory: function (randomStoryCallback){
            // Get all of the data from the MemoryJaneSixWordStories Table
            var tableParams = { TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#approved = :isTrue",
                ExpressionAttributeNames : { "#approved" : "Approved" },
                ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
            };
            dynamodb.scan(tableParams, function (tableStoryErr, tableStoryData) {
                if (tableStoryErr) console.log("Data _getRandomStory_  ERROR " + tableStoryErr);
                else {
                    var storyCount = tableStoryData.Count;
                    var randomStoryIndex = (Math.floor(Math.random() * storyCount));
                    var story = tableStoryData.Items[randomStoryIndex].Story.S;
                    var timeStamp = tableStoryData.Items[randomStoryIndex].TimeStamp.N.toString();
                    var author = tableStoryData.Items[randomStoryIndex].Author.S;

                    randomStoryCallback(story, timeStamp, author);
                }
            });
        },
        /**
         * Puts a user created story into the database
         * @param author
         * @param story
         * @param putStoryCallback
         */
        putNewStory: function (author, story, putStoryCallback){
            var timeStamp = getTimeStamp().toString();
            var newStoryParams = { TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": timeStamp },
                    Rating: {"N": "0"},
                    Story: {"S": story},
                    Author: {"S": author}
                }
            };

            dynamodb.putItem(newStoryParams, function (putStoryErr, putStoryData) {
                if (putStoryErr) console.log("Data _putNewStory_  ERROR " + putStoryErr);
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
            // Get the current rating.
            var incrementStoryParams = {
                TableName : "MemoryJaneSixWordStories",
                Key : { TimeStamp : { "N" : time } },
                UpdateExpression : "ADD #rating :increment",
                ExpressionAttributeNames : { "#rating" : "Rating" },
                ExpressionAttributeValues : { ":increment" : {"N":"1"} }
            };
            dynamodb.updateItem(incrementStoryParams, function(incrementStoryErr, updateData) {
                if (incrementStoryErr) console.log("Data _incrementStoryRating_  ERROR " + incrementStoryErr);
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
            var newReactionParams = { TableName: 'MemoryJaneSixWordReactions',
                Item: {
                    storyId: {"N": storyId},
                    TimeStamp: { "N": getTimeStamp().toString() },
                    ReactorId: {"S": userId},
                    Reaction: {"S": reaction}
                }
            };

            dynamodb.putItem(newReactionParams, function (reactionErr, reactionData) {
                if (reactionErr) console.log("Data _addStoryReaction_  ERROR " + reactionErr);
                else addStoryCallback();
            });
        },

        /**
         * Gets a specific story's rating from the database and returns it
         * @param storyId
         * @param callback
         */
        getStoryRating: function (storyId, callback){
            var storyRatingParams = { TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": storyId }
                }
            };
            dynamodb.getItem(storyRatingParams, function (tableStoryErr, tableStoryData) {
                if (tableStoryErr) console.log("Data _getStoryRating_  ERROR " + tableStoryErr);
                else {
                    var rating = tableStoryData.Rating;
                    callback(rating);
                }
            });
        },

        /**
         * Get reactions for the story that the user just listened to
         * @param storyId
         * @param callback
         */
        getLatestStoryReactions: function (storyId, callback){
            // Get the reactions for the specific story you are looking for
            var storyReactionParams = { TableName: 'MemoryJaneSixWordReactions',
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
                if (storyReactionErr) console.log("Data _getLatestStoryReactions_  ERROR " + storyReactionErr);
                else {
                    var count = storyReactionData.Count;
                    if (count == 0) {
                        callback(undefined);
                    }
                    else{
                        var reactions = [];
                        for (i = 0; i < count; i++) {
                            reactions[i] = storyReactionData.Items[i].Reaction.S;
                        }
                        callback(reactions);
                    }
                }
            });
        },

        /**
         * Puts logs of what users do into the database
         * @param user
         * @param story
         * @param userAction
         * @param errorCallback
         */
        putUserActivity: function (user, story, userAction, errorCallback){
            var activityParams = { TableName: 'MemoryJaneSixWordStoriesActivity',
                Item: {
                    TimeStamp: { "N": getTimeStamp().toString() },
                    User: {"S": user},
                    Story: {"S": story},
                    UserAction: {"S": userAction}
                }
            };

            dynamodb.putItem(activityParams, function (resultErr, data) {
                if (resultErr) errorCallback(resultErr);
                else errorCallback();
            });
        },

        /**
         * Gets the latest news update based on the specific user
         * @param user
         * @param callback
         */
        getNews: function(user, callback){
            var storyReactionParams = { TableName: 'MemoryJaneSixWordNews',
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
            dynamodb.query(storyReactionParams, function (newsQueryErr, newsQueryData) {
                if (newsQueryErr) console.log("Data _tableScan_  ERROR " + newsQueryErr);
                if (!newsQueryData.Items[0]){
                    callback(undefined);
                } else {
                    if (newsQueryData.Items[0].Read.S == "true"){
                        callback(undefined);
                    }else {
                        var updateItemParams = {
                            TableName : "MemoryJaneSixWordNews",
                            Key : { userId : { "S" : user }, TimeStamp : { "N": newsQueryData.Items[0].TimeStamp.N } },
                            UpdateExpression : "SET #approved = :isTrue",
                            ExpressionAttributeNames : { "#approved" : "Read" },
                            ExpressionAttributeValues : { ":isTrue" : {"S":"true"} }
                        };
                        dynamodb.updateItem(updateItemParams, function(newsQueryErr, newsData){
                            console.log(newsData);
                            callback(newsQueryData.Items[0].News.S);
                        });
                    }
                }
            });
        },

        /**
         * Adds a news item when a user's stories are reacted to
         * @param userId
         * @param news
         * @param callback
         */
        addNews: function (userId, news, callback) {
            var newNewsParams = { TableName: 'MemoryJaneSixWordNews',
                Item: {
                    userId: {"S": userId},
                    TimeStamp: { "N": getTimeStamp().toString() },
                    News: {"S": news},
                    Read: {"S": "false"}
                }
            };
            console.log("IN ADD NEWS");
            dynamodb.putItem(newNewsParams, function (reactionErr, reactionData) {
                if (reactionErr) callback(reactionErr);
                else console.log("ADDED NEWS");
                callback(reactionErr);
            });
        },

        /**
         * Call this to see if there are theme stories for this user to hear.
         * Returns a boolean if there are, and a string that is the theme of the day.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to hear the theme stories.
         */
        areThereThemeStoriesToHear: function(userId, areThereThemeStoriesCallback) {
            areThereThemeStoriesCallback(true, "starts with the word banana");
        },

        /**
         * Call this to see if there is a theme for the day. If there is, you'll get back true and the theme.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to create a theme story.
         */
        isThereAThemeToPromptFor: function(userId, isThereAThemeCallback) {
            isThereAThemeCallback(true, "starts with the word banana");
        },

        /**
         *
         */
        getThemeStories: function(getThemeStoriesCallback) {
            var themeStories = ["banana 2 3 4 5 6", "banana is the coolest thing ever", "banana plays trombone in the band"];
            var themeStoryIds = ["1", "2", "3"];
            var themeAuthors = ["Aaron_LOCAL", "Aaron_LOCAL", "Aaron_LOCAL"];

            getThemeStoriesCallback(themeStories, themeStoryIds, themeAuthors);
        }
    }
}) ();

module.exports = data;