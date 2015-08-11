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

        if (false) {
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
        return timeStamp = Number(rightNow.getUTCFullYear())
            +((rightNow.getUTCMonth()+1)*10000)
            +((rightNow.getUTCDate()+1)*1000000)
            +(rightNow.getUTCHours()*100000000)
            +(rightNow.getUTCMinutes()*10000000000)
            +(rightNow.getUTCSeconds()*1000000000000)
            +(rightNow.getUTCMilliseconds()*10000000000000);
    }

    return {
         /**
         * Gets a random story from the database and returns it
         * @param callback
         */
        getRandomStory: function (callback){
            // Get all of the data from the MemoryJaneSixWordStories Table
            var tableParams = { TableName: "MemoryJaneSixWordStories"};
            dynamodb.scan(tableParams, function (tableStoryErr, tableStoryData) {
                if (tableStoryErr) console.log("Data _tableScan_  ERROR " + tableStoryErr);
                else {
                    var storyCount = tableStoryData.Count;
                    var randomStoryIndex = (Math.floor(Math.random() * storyCount));
                    var story = tableStoryData.Items[randomStoryIndex].Story.S;
                    var timeStamp = tableStoryData.Items[randomStoryIndex].TimeStamp.N.toString();

                    console.log("Data _gettingStory_ " + story);
                    callback(story, timeStamp);
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
            var newStoryParams = { TableName: 'MemoryJaneSixWordStories',
                Item: {
                    TimeStamp: { "N": getTimeStamp().toString() },
                    Rating: {"N": "0"},
                    Story: {"S": story},
                    Author: {"S": author}
                }
            };

            dynamodb.putItem(newStoryParams, function (resultErr, data) {
                if (resultErr) errorCallback(resultErr);
                else errorCallback();
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

        addStoryReaction: function (reaction, storyId, userId, callback) {
            var newReactionParams = { TableName: 'MemoryJaneSixWordReactions',
                Item: {
                    TimeStamp: { "N": getTimeStamp().toString() },
                    StoryId: {"N": storyId},
                    UserId: {"S": userId},
                    Reaction: {"S": reaction}
                }
            };

            dynamodb.putItem(newReactionParams, function (reactionErr, reactionData) {
                if (reactionErr) errorCallback(reactionErr);
                else callback();
            });
        },

        /**
         * Gets a random story's rating from the database and returns it
         * @param storyId
         * @param callback
         */
        getStoryRating: function (storyId, callback){
            // Get all of the data for the specific story you are looking for
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

        },

        /**
         * Puts logs of what users do into the database
         * @param author
         * @param story
         * @param userAction
         * @param errorCallback
         */
        putUserActivity: function (author, story, userAction, errorCallback){
            var activityParams = { TableName: 'MemoryJaneSixWordStoriesActivity',
                Item: {
                    TimeStamp: { "N": getTimeStamp().toString() },
                    Story: {"S": story},
                    Author: {"S": author},
                    UserAction: {"S": userAction}
                }
            };

            dynamodb.putItem(activityParams, function (resultErr, data) {
                if (resultErr) errorCallback(resultErr);
                else errorCallback();
            });
        }
    }
}) ();

module.exports = data;