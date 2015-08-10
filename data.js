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
            // Get the number of stories by doing a COUNT scan.
            var dateTimeParams = { TableName: "MemoryJaneSixWordStories", Select: 'COUNT'};
            dynamodb.scan(dateTimeParams, function (dateTimeErr, dateTimeData) {
                if (dateTimeErr) console.log("Data _tableCount_  ERROR " + dateTimeErr);

                var date = "09082015";
                var time = "0930348493049";

                //console.log(dateTimeData.DateStamp.N);

                console.log(date);
                console.log(time);

                var tableParams = {TableName: "MemoryJaneSixWordStories", Key: { DateStamp: {"N": date}, TimeStamp: {"N": time} } };
                dynamodb.getItem(tableParams, function (tableStoryErr, tableStoryData) {
                    if (tableStoryErr) console.log("Data _getRandomStory  ERROR " + tableStoryErr);
                    else {
                        var story = tableStoryData.Item.Story.S;
                        console.log("Data _gettingStory_ " + story);
                        callback(story);
                    }
                });
            });
        }
    }
}) ();

module.exports = data;