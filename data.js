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

        putNewStory: function (author, story, errorCallback){
            var rightNow = new Date();
            var dateToday = Number(rightNow.getUTCFullYear())
                +((rightNow.getUTCMonth()+1)*10000)
                +((rightNow.getUTCDate()+1)*1000000);
            var timeNow = Number(rightNow.getUTCMilliseconds())
                +(rightNow.getUTCSeconds()*1000)
                +(rightNow.getUTCMinutes()*100000)
                +(rightNow.getUTCHours()*10000000);
            var resultParams = { TableName: 'MemoryJaneSixWordStories',
                Item: {
                    DateStamp: { "N": dateToday.toString() },
                    TimeStamp: { "N": timeNow.toString() },
                    Story: {"S": story},
                    Author: {"S": author}
                }
            };

            dynamodb.putItem(resultParams, function (resultErr, data) {
                if (resultErr) errorCallback(resultErr);
                else errorCallback();
            });
        }
    }
}) ();

module.exports = data;