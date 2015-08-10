var data = (function () {
    var AWS = require("aws-sdk");
    var dynamodb = getDynamoDB(false);

    /**
     * Get the database object, either from AWS if it is there, or locally if it is not.
     * This is a private function.
     * @returns {AWS.DynamoDB}
     */
    function getDynamoDB (local) {
        var DB;
        if (local) {
            DB = new AWS.DynamoDB({endpoint: new AWS.Endpoint('http://localhost:8000')});
            DB.config.update({accessKeyId: "myKeyId", secretAccessKey: "secretKey", region: "us-east-1"});
        } else {
            // Otherwise try to connect to the remote DB using the config file.
            DB = new AWS.DynamoDB();
        }
        return DB;
    }

    function getDateToday (){
        var rightNow = new Date();
        return dateToday = Number(rightNow.getUTCFullYear())
            +((rightNow.getUTCMonth()+1)*10000)
            +((rightNow.getUTCDate()+1)*1000000);
    }

    function getTimeNow (){
        var rightNow = new Date();
        return timeNow = Number(rightNow.getUTCMilliseconds())
            +(rightNow.getUTCSeconds()*1000)
            +(rightNow.getUTCMinutes()*100000)
            +(rightNow.getUTCHours()*10000000);
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
                    console.log("Data _gettingStory_ " + story);
                    callback(story);
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
                    DateStamp: { "N": getDateToday().toString() },
                    TimeStamp: { "N": getTimeNow().toString() },
                    Story: {"S": story},
                    Author: {"S": author}
                }
            };

            dynamodb.putItem(newStoryParams, function (resultErr, data) {
                if (resultErr) errorCallback(resultErr);
                else errorCallback();
            });
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
                    DateStamp: { "N": getDateToday().toString() },
                    TimeStamp: { "N": getTimeNow().toString() },
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