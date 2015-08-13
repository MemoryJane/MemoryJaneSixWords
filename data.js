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
            +((rightNow.getUTCSeconds()+1)*1000)
            +((rightNow.getUTCMinutes()+1)*100000)
            +((rightNow.getUTCHours()+1)*10000000)
            +(rightNow.getUTCDate()*1000000000)
            +((rightNow.getUTCMonth()+1)*100000000000)
            +(rightNow.getUTCFullYear()*100000000000000);
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
         * @param randomStoryCallback
         */
        getRandomStory: function (randomStoryCallback){
            //Declare parameters for use in scan. These scan for all stories in the database that have been approved.
            var getRandomStoryParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#approved = :isTrue",
                ExpressionAttributeNames : { "#approved" : "Approved" },
                ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
            };

            dynamodb.scan(getRandomStoryParams, function (randomStoryErr, randomStoryData) {
                if (randomStoryErr) throw ("Data_getRandomStory_ERROR " + randomStoryErr);
                else {
                    //Count the total number of stories and then pick a random index between 0 and count-1.
                    var storyCount = randomStoryData.Count;
                    var randomStoryIndex = (Math.floor(Math.random() * storyCount));

                    //Set information for the story, timeStamp and author to the information for the story at the
                    //random index. Then callback the story, timeStamp and author.
                    var story = randomStoryData.Items[randomStoryIndex].Story.S;
                    var timeStamp = randomStoryData.Items[randomStoryIndex].TimeStamp.N.toString();
                    var author = randomStoryData.Items[randomStoryIndex].Author.S;
                    randomStoryCallback(story, timeStamp, author);
                }
            });
        },

        /**
         * Gets "n" stories from a particular author
         * @param numStories
         * @param author
         * @param authorStoriesCallback
         */
        getStoriesByAuthor: function (numStories, author, authorStoriesCallback){
            //Declare parameters for use in scan. These scan for all stories in the database that are by the author
            //given and have also been approved.
            var getStoriesByAuthorParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#thisauthor = :author AND #approved = :is_true",
                ExpressionAttributeNames : { "#thisauthor" : "Author" , "#approved" : "Approved"},
                ExpressionAttributeValues : { ":author" : {"S": author} , ":is_true" : {"BOOL": true}}
            };

            dynamodb.scan(getStoriesByAuthorParams, function (authorStoryErr, authorStoryData) {
                if (authorStoryErr) throw ("Data_getStoriesByAuthor_ERROR " + authorStoryErr);
                else {
                    //Declare empty arrays for the story indexes, stories, timeStamps, and authors for population
                    //in the for loops.
                    var authorStoryIndexes = [];
                    var stories = [];
                    var timeStamps = [];
                    var authors = [];

                    //Fill the indexes array with unique random numbers between 0 and count-1.
                    for (i = 0; i < numStories; i++){
                        authorStoryIndexes[i] = (Math.floor(Math.random() *authorStoryData.Count));
                        //Check the random number that was just inserted into the array to confirm that it is different
                        //than all previous values. If not, decrement i to get a new value.
                        for (j = 0; j < i; j++){
                            if (authorStoryIndexes[i] == authorStoryIndexes[j]){
                                i--;
                            }
                        }
                    }

                    //Once the index array has been filled, use it to fill the other three arrays with the stories,
                    //timeStamps and authors at those indexes. Then callback the three arrays.
                    for (i = 0; i < numStories; i++) {
                        stories[i] = authorStoryData.Items[authorStoryIndexes[i]].Story.S;
                        timeStamps[i] = authorStoryData.Items[authorStoryIndexes[i]].TimeStamp.N.toString();
                        authors[i] = authorStoryData.Items[authorStoryIndexes[i]].Author.S;
                    }
                    authorStoriesCallback(stories, timeStamps, authors);
                }
            });
        },

        /**
         * Gets "n" stories from the database and returns them
         * @param numStories
         * @param randomStoriesCallback
         */
        getRandomStories: function (numStories, randomStoriesCallback){
            //Declare parameters for use in scan. These scan for all stories in the database that have been approved.
            var randomStoriesParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#approved = :isTrue",
                ExpressionAttributeNames : { "#approved" : "Approved" },
                ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
            };

            dynamodb.scan(randomStoriesParams, function (randomStoriesErr, randomStoriesData) {
                if (randomStoriesErr) throw ("Data_getRandomStory_ERROR " + randomStoriesErr);
                else {
                    //Declare empty arrays for the story indexes, stories, timeStamps, and authors for population
                    //in the for loops.
                    var randomStoryIndexes = [];
                    var stories = [];
                    var timeStamps = [];
                    var authors = [];

                    //Fill the indexes array with unique random numbers between 0 and count-1.
                    for (i = 0; i < numStories; i++){
                        randomStoryIndexes[i] = (Math.floor(Math.random() *randomStoriesData.Count));
                        //Check the random number that was just inserted into the array to confirm that it is different
                        //than all previous values. If not, decrement i to get a new value.
                        for (j = 0; j < i; j++){
                            if (randomStoryIndexes[i] == randomStoryIndexes[j]){
                                i--;
                            }
                        }
                    }

                    //Once the index array has been filled, use it to fill the other three arrays with the stories,
                    //timeStamps and authors at those indexes. Then callback the three arrays.
                    for (i = 0; i < numStories; i++) {
                        stories[i] = randomStoriesData.Items[randomStoryIndexes[i]].Story.S;
                        timeStamps[i] = randomStoriesData.Items[randomStoryIndexes[i]].TimeStamp.N.toString();
                        authors[i] = randomStoriesData.Items[randomStoryIndexes[i]].Author.S;
                    }
                    randomStoriesCallback(stories, timeStamps, authors);
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
         * @param callback
         */
        getLatestStoryReactions: function (storyId, callback){
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
                            getNewsCallback(newsQueryData.Items[0].News.S);
                        });
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
        },

        /**
         *
         */
        doesStoryMatchTheme: function(story, getThemeStoriesCallback) {
            getThemeStoriesCallback(true);
        }
    }
}) ();

module.exports = data;