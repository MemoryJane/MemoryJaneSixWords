var data = (function () {
    var AWS = require("aws-sdk");
    var dynamodb = getDynamoDB(true);

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
        }
    }
}) ();

module.exports = data;