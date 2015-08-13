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
         */
        incrementScriptListenCount: function(userId, scriptKey, scriptListenCallback) {
            var updateItemParams = {
                TableName : "MemoryJaneSixWordScriptListens",
                Key : { UserID : { "S" : userId }, ScriptKey : { "S" : scriptKey } },
                UpdateExpression : "ADD #listenCount :increment",
                ExpressionAttributeNames : { "#listenCount" : "ListenCount" },
                ExpressionAttributeValues : { ":increment" : {"N":"1"} }
            };

            dynamodb.updateItem(updateItemParams, function(updateError, updateData) {
                // Okay, now get the listen count to send back.
                var getListenCountParams = { TableName: 'MemoryJaneSixWordScriptListens',
                    Key : { UserID : { "S" : userId }, ScriptKey : { "S" : scriptKey } }
                };

                dynamodb.getItem(getListenCountParams, function(listenError, listenData) {
                    scriptListenCallback(listenError, listenData.Item.ListenCount.N);
                });
            });
        },

         /**
         * Gets a random story from the database and returns it
         * @param callback
         */
        getRandomStory: function (callback){
            // Get all of the data from the MemoryJaneSixWordStories Table
            var tableParams = { TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#approved = :isTrue",
                ExpressionAttributeNames : { "#approved" : "Approved" },
                ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
            };
            dynamodb.scan(tableParams, function (tableStoryErr, tableStoryData) {
                if (tableStoryErr) console.log("Data _tableScan_  ERROR " + tableStoryErr);
                else {
                    var storyCount = tableStoryData.Count;
                    var randomStoryIndex = (Math.floor(Math.random() * storyCount));
                    var story = tableStoryData.Items[randomStoryIndex].Story.S;
                    var timeStamp = tableStoryData.Items[randomStoryIndex].TimeStamp.N.toString();
                    var author = tableStoryData.Items[randomStoryIndex].Author.S;

                    console.log("Data _gettingStory_ " + story);
                    callback(story, timeStamp, author);
                }
            });
        },
        /**
         * Puts a user created story into the database
         * @param author
         * @param story
         * @param errorCallback
         */
        putNewStory: function (author, story, errorCallback){
            var timeStamp = getTimeStamp().toString();
            var newStoryParams = { TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": timeStamp },
                    Rating: {"N": "0"},
                    Story: {"S": story},
                    Author: {"S": author}
                }
            };

            dynamodb.putItem(newStoryParams, function (resultErr, data) {
                if (resultErr) errorCallback(timeStamp, resultErr);
                else errorCallback(timeStamp);
            });
        },

        /*
         * Increment the story rating for a specific story.
         * @param date
         * @param time
         * @param callback
         */
        incrementStoryRating: function (time, callback) {
            // Get the current rating.
            console.log(time);
            var updateItemParams = {
                TableName : "MemoryJaneSixWordStories",
                Key : { TimeStamp : { "N" : time } },
                UpdateExpression : "ADD #rating :increment",
                ExpressionAttributeNames : { "#rating" : "Rating" },
                ExpressionAttributeValues : { ":increment" : {"N":"1"} }
            };
            dynamodb.updateItem(updateItemParams, function(updateError, updateData) {
                callback(updateError);
            });
        },

        /**
         * Adds a reaction to a current story
         * @param reaction
         * @param storyId
         * @param userId
         * @param callback
         */
        addStoryReaction: function (reaction, storyId, userId, callback) {
            var newReactionParams = { TableName: 'MemoryJaneSixWordReactions',
                Item: {
                    storyId: {"N": storyId},
                    TimeStamp: { "N": getTimeStamp().toString() },
                    ReactorId: {"S": userId},
                    Reaction: {"S": reaction}
                }
            };

            dynamodb.putItem(newReactionParams, function (reactionErr, reactionData) {
                if (reactionErr) callback(reactionErr);
                else callback();
            });
        },

        /**
         * Gets a random story's rating from the database and returns it
         * @param storyId
         * @param callback
         */
        getStoryRating: function (storyId, callback){
            // Get the rating for the specific story you are looking for
            var storyRatingParams = { TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": storyId }
                }
            };
            dynamodb.getItem(storyRatingParams, function (tableStoryErr, tableStoryData) {
                if (tableStoryErr) console.log("Data _tableScan_  ERROR " + tableStoryErr);
                else {
                    var rating = tableStoryData.Rating;
                    callback(rating);
                }
            });
        },

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
                if (storyReactionErr) console.log("Data _tableScan_  ERROR " + storyReactionErr);
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
                    console.log(newsQueryData);
                    callback(newsQueryData.Items[0].News.S);
                }
            });
        },

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
        }
    }
}) ();

module.exports = data;