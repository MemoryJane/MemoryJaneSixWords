/**
 * This is the data object, used for all communications with the DB.
 * It follows the Module pattern.
 */
var data = (function () {
    // Setup our DB connection.
    var AWS = require("aws-sdk");
    var dynamodb = getDynamoDB();

    // This is the module that contains all of the theme code.
    var dataTheme = require("./datatheme.js");

    /**
     * Get the database object, we can switch between AWS and local using environment variables.
     * This is a private function.
     */
    function getDynamoDB () {
        var DB;

        // We're checking the process variables to see if should go local. If the environment variables
        // are not set, we use AWS. These are typically set in the .env file.
        if (process.env.MEMJANE_USE_LOCAL_DB && process.env.MEMJANE_USE_LOCAL_DB == "true") {
            DB = new AWS.DynamoDB({endpoint: new AWS.Endpoint('http://localhost:8000')});
            DB.config.update({accessKeyId: "myKeyId", secretAccessKey: "secretKey", region: "us-east-1"});
        } else {
            // Otherwise try to connect to the remote DB using the .env config file.
            DB = new AWS.DynamoDB();
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
     * HACK: Enables us to record videos of specific stories that we're going to post to Twitter.
     * If there is a story that is waiting to go to Twitter, then we return that story, otherwise
     * we return null. Ideally this would also check to see if it was a specific person who was asking,
     * but since the get story functions don't give us any info about the user, it is possible that
     * we won't be the next person into the call and therefore the story will go to someone else.
     */
    function areWeInTwitterMode(twitterModeCallback) {
        // This is looking for any story that was tagged as being selected for Twitter.
        var twitterStoriesParams = {
            TableName : "MemoryJaneSixWordStories",
            FilterExpression : "#approved = :isTrue AND #selectedForTwitter = :isTrue",
            ExpressionAttributeNames : {
                "#approved" : "Approved",
                "#selectedForTwitter" : "SelectedForTwitter" },
            ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
        };
        dynamodb.scan(twitterStoriesParams, function (twitterStoriesError, twitterStoriesData) {
            if (twitterStoriesError) throw ("Data_areWeInTwitterMode_ERROR " + twitterStoriesError);
            else {
                if (twitterStoriesData.Count > 0) {
                    // We only return the first one (but there should never be more than one ..).
                    twitterModeCallback(twitterStoriesData.Items[0]);
                } else {
                    twitterModeCallback(null);
                }
            }
        });
    }

    /**
     * Private helper function that is used by all the public functions to get stories with more
     * specific purposes. Returns arrays of story texts, time stamps, and authors.
     */
    function getRandomStories(storyCountRequested, author, getRandomStoriesCallback) {
        // We're looking for any stories that are approved..
        var randomStoriesParams = {
            TableName: "MemoryJaneSixWordStories",
            FilterExpression : "#approved = :isTrue",
            ExpressionAttributeNames : { "#approved" : "Approved" },
            ExpressionAttributeValues : { ":isTrue" : {"BOOL":true} }
        };

        // If there's an author passed in, add the limitation to the params.
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

    // These are the public functions of the module.
    return {
        /**
         * This takes a userId and a scriptKey and increases by one the number of times the user has heard the
         * scriptKey. It then returns the number of times it's been heard in the callback.
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
         * Gets a random story from the database and returns it. This returns single string items for the
          * story text, time stamp and author, not arrays.
         */
        getRandomStory: function (getRandomStoryCallback) {
             // HACK: there is one time when we don't want to return a random story. If we just ran our
             // Tweet script to create the text for a tweet, then we want to play back the specific tweet
             // we picked in the Tweet script so we can record it.
             areWeInTwitterMode(function(twitterModeStory) {
                 if (twitterModeStory) {
                     // Remove the twitter mode flag, so we only get that story once.
                     var storyTwitterRemoveSelectedUpdateParams = {
                         TableName: 'MemoryJaneSixWordStories',
                         Key: {TimeStamp: {"N": twitterModeStory.TimeStamp.N.toString()}},
                         UpdateExpression: "SET #selectedForTwitter = :false",
                         ExpressionAttributeNames : { "#selectedForTwitter" : "SelectedForTwitter" },
                         ExpressionAttributeValues : { ":false" : {"BOOL":false} }
                     };
                     dynamodb.updateItem(storyTwitterRemoveSelectedUpdateParams, function (updateError, updateData) {
                         if (updateError) throw ("Data_getRandomStory_ERROR " + updateError);
                         else {
                             getRandomStoryCallback(twitterModeStory.Story.S,
                                 twitterModeStory.TimeStamp.N.toString(),
                                 twitterModeStory.Author.S);
                         }
                     });
                 } else {
                     // Not in twitter mode, so let's get a random story.
                     getRandomStories(1, null, function(stories, timeStamps, authors) {
                         getRandomStoryCallback(stories[0], timeStamps[0], authors[0]);
                     });
                 }
             });
        },

        /**
         * Gets "n" stories from a particular author
         */
        getStoriesByAuthor: function (storyCountRequested, author, authorStoriesCallback){
            getRandomStories(storyCountRequested, author, function(stories, timeStamps, authors) {
                authorStoriesCallback(stories, timeStamps, authors);
            });
        },

        /**
         * Gets a specific number of random stories and returns them.
         */
        getRandomStories: function (storyCountRequested, getRandomStoriesCallback){
            getRandomStories(storyCountRequested, null, function(stories, timeStamps, authors) {
                getRandomStoriesCallback(stories, timeStamps, authors);
            });
        },

        /**
         * Puts a user created story into the database. Returns the time stamp (index) of the story.
         */
        putNewStory: function (author, story, themeText, remixId, chainId, putStoryCallback){
            // Declare parameters for use in putItem. These put a new story into the database at an initial rating of
            // zero, a TimeStamp equal to the current time, Author as the user's userId and Story as the story that
            // they said to publish.
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

            // If the story is designated to be chained, put its TimeStamp in the ChainId
            if (chainId) newStoryParams.Item.ChainId = { "N" : chainId };

            dynamodb.putItem(newStoryParams, function (putStoryErr, putStoryData) {
                if (putStoryErr) throw ("Data_putNewStory_ERROR " + putStoryErr);
                else putStoryCallback(timeStamp);
            });
        },

        /*
         * Increment the story rating for a specific story.
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
         */
        addStoryReaction: function (reaction, storyId, userId, addStoryCallback) {
            // Declare parameters for use in putItem. These add a new reaction to the reactions table, based on the
            // story that is being reacted to, the current time, the reactor's userId, and the reaction.
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
         * Gets a specific story's rating from the database and returns it.
         */
        getStoryRating: function (storyId, getStoryRatingCallback){
            // Declare parameters for use in getItem. These retrieve the item with the specified TimeStamp.
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
         * Get reactions for the story that the user just listened to.
         */
        getLatestStoryReactions: function (storyId, storyReactionCallback){
            // Declare parameters for use in query. These find all reactions in the table associated with the specific
            // storyId.
            var storyReactionParams = {
                TableName: 'MemoryJaneSixWordReactions',
                KeyConditionExpression: '#hashkey = :hk_val',
                ExpressionAttributeNames: { '#hashkey': "storyId" },
                ExpressionAttributeValues: { ':hk_val': {N: storyId} },
                ScanIndexForward: true,
                Limit: 5
            };

            dynamodb.query(storyReactionParams, function (storyReactionErr, storyReactionData) {
                if (storyReactionErr) throw ("Data_getLatestStoryReactions_ERROR " + storyReactionErr);
                else {
                    // If no items were returned, the story had no reactions so return null. Otherwise, callback
                    // all of the reactions to the story in array format.
                    if (storyReactionData.Count == 0) {
                        storyReactionCallback(null);
                    } else{
                        var reactions = [];
                        for (i = 0; i < storyReactionData.Count; i++) {
                            reactions[i] = storyReactionData.Items[i].Reaction.S;
                        }
                        storyReactionCallback(reactions);
                    }
                }
            });
        },

        /**
         * Puts logs of what users do into the database
         * WARNING: This function is technically asynchronous because it calls the DB. Which means
         * it may not finish before the script does if the DB takes a long time. So, it's not 100%
         * certain that your activity will get recorded. I did this for simplicity sake, and because the
         * activity data is not app-critical.
         */
        putUserActivity: function (user, story, userAction){
            // Declare parameters for use in putItem. These enter information into the table when users take certain
            // actions.
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
            });
        },

        /**
         * Gets the latest news update based on the specific user
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
                else {
                    // Did we get any news items?
                    if (!newsQueryData.Items[0]){
                        // No, no news, return null.
                        getNewsCallback(null);
                    } else {
                        // Got news, is it read already?
                        if (newsQueryData.Items[0].Read.S == "true"){
                            // Yep, so return null, we're only looking for new news.
                            getNewsCallback(null);
                        }else {
                            // Alright, there is new news. Let's mark it read and return it.
                            var updateItemParams = {
                                TableName : "MemoryJaneSixWordNews",
                                Key : { userId : { "S" : user },
                                    TimeStamp : { "N": newsQueryData.Items[0].TimeStamp.N } },
                                UpdateExpression : "SET #approved = :isTrue",
                                ExpressionAttributeNames : { "#approved" : "Read" },
                                ExpressionAttributeValues : { ":isTrue" : {"S":"true"} }
                            };

                            dynamodb.updateItem(updateItemParams, function(newsUpdateErr, newsUpdateData) {
                                if (newsUpdateErr) throw ("Data_getNews_ERROR " + newsUpdateErr);
                                else getNewsCallback(newsQueryData.Items[0].News.S);
                            });
                        }
                    }
                }
            });
        },

        /**
         * Checks if a specific user has news.
         */
        hasNews: function(user, hasNewsCallback){
            // Declare parameters for use in query. These check if there is news associated with the userId.
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
                else {
                    // If the query returned no news items, return false. Otherwise, if the first item returned has
                    // already been read, return false. Otherwise, return true.
                    if (!newsQueryData.Items[0]){
                        hasNewsCallback(false);
                    } else {
                        if (newsQueryData.Items[0].Read.S == "true"){
                            hasNewsCallback(false);
                        } else {
                            hasNewsCallback(true);
                        }
                    }
                }
            });
        },

        /**
         * Adds a news item when a user's stories are reacted to
         */
        addNews: function (userId, news, addNewsCallback) {
            // Declare parameters for use in putItem. These put a new news item into the news database under the userId
            // of the user that the news is for and containing the piece of news for them to read.
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
                else addNewsCallback();
            });
        },

        /**
         * Determine if there is at least 1 remix associated with the given story.
         */
        areThereRemixes: function (storyId, areThereRemixesCallback){
            // We're looking for stories where the remix ID is the story ID passed in.
            var areThereRemixesParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#remixId = :storyId",
                ExpressionAttributeNames : { "#remixId" : "RemixId" },
                ExpressionAttributeValues : { ":storyId" : {"N":storyId} }
            };

            dynamodb.scan(areThereRemixesParams, function (remixesErr, remixesData) {
                if (remixesErr) throw ("Data_areThereRemixes_ERROR " + remixesErr);
                else areThereRemixesCallback(remixesData.Count > 0);
            });
        },

        /**
         * Get all remixes associated with the given story. Returns an array of strings, any and all
         * remixes.
         */
        getRemixes: function (storyId, getRemixesCallback){
            // We're looking for stories that have a remix ID of the story ID passed in.
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

                    // Turn the array of DB items into an array of story strings.
                    for(i = 0; i < remixCount; i ++){
                        remixes[i] = remixesData.Items[i].Story.S;
                    }

                    getRemixesCallback(remixes);
                }
            });
        },

        /**
         * Checks if the story is part of a chain of stories.
         */
        isPartOfChain: function (chainId, partOfChainCallback){
            // We're looking for stories where the chain ID is the story ID passed in.
            var isPartOfChainParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#chainId = :storyId",
                ExpressionAttributeNames : { "#chainId" : "ChainId" },
                ExpressionAttributeValues : { ":storyId" : {"N":chainId.toString()} }
            };

            dynamodb.scan(isPartOfChainParams, function (chainErr, chainData) {
                if (chainErr) throw ("Data_isPartOfChain_ERROR " + chainErr);
                else partOfChainCallback(chainData.Count > 1);
            });
        },

        /**
         * Assembles the chain of stories given the chainId. Returns a string that is all of the stories, in
         * order, separated by periods and spaces.
         */
        assembleChain: function (chainId, partOfChainCallback){
            // We're looking for all of the stories that are in a chain, by pulling all stories where the
            // chain ID is the chain ID passed in.
            var assembleChainParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#chainId = :storyId",
                ExpressionAttributeNames : { "#chainId" : "ChainId" },
                ExpressionAttributeValues : { ":storyId" : {"N":chainId.toString()} }
            };

            dynamodb.scan(assembleChainParams, function (chainErr, chainData) {
                if (chainErr) throw ("Data_assembleChain_ERROR " + chainErr);
                else {
                    // concatChain is the final string to return. concatChainArr is the array of indexes
                    // of the stories in the chain.
                    var concatChain = "";
                    var concatChainArr = [];

                    // Set the first item to the index 0, and then sort from there.
                    concatChainArr[0] = 0;

                    // Simple sort. Go down the list in the concatChainArr and find the position of the next
                    // item from the chainData array.
                    for (i = 1; i < chainData.Count; i++) {
                        for (k = 0; k < concatChainArr.length; k++) {
                            if (chainData.Items[i].TimeStamp.N < chainData.Items[concatChainArr[k]].TimeStamp.N){
                                // Found the position. Insert it, and go on to the next item in chainData.
                                concatChainArr.splice(k, 0, i);
                                k = concatChainArr.length;
                            }

                            if (k == concatChainArr.length-1) {
                                // We made it to the end of the list, this item is the last item.
                                concatChainArr.splice(k+1, 0, i);
                                k = concatChainArr.length;
                            }
                        }
                    }

                    // Sort complete, now create the string with the stories in the right order.
                    for (j = 0; j < chainData.Count; j++){
                        concatChain += chainData.Items[concatChainArr[j]].Story.S + ". ";
                    }

                    partOfChainCallback(concatChain);
                }
            });
        },

        /**
         * Checks if the story has been designated for chaining
         */
        canChain: function (storyId, canChainCallback){
            // We're looking for the story with the story ID passed in.
            var canChainParams = {
                TableName: "MemoryJaneSixWordStories",
                FilterExpression : "#chainId = :storyId",
                ExpressionAttributeNames : { "#chainId" : "TimeStamp" },
                ExpressionAttributeValues : { ":storyId" : {"N":storyId.toString()} }
            };

            dynamodb.scan(canChainParams, function (chainErr, chainData) {
                if (chainErr) throw ("Data_canChain_ERROR " + chainErr);
                else {
                    var canChain = false;

                    // A story is chainable if it's ChainID is the same as its TimeStamp.
                    if (chainData.Items[0].ChainId &&
                        (chainData.Items[0].TimeStamp.N == chainData.Items[0].ChainId.N)){
                        canChain = true;
                    }
                    canChainCallback(canChain);
                }
            });
        },

        /**
         * Sets a story up as the root of a chain of stories.
         */
        designateForChaining: function(storyId, designateForChainingCallback){
            // We're updating just the chain ID of the story to be chainable by setting it to
            // the story's story ID.
            var chainingParams = {
                TableName : "MemoryJaneSixWordStories",
                Key : { TimeStamp : { "N": storyId } },
                UpdateExpression : "SET #ChainId = :storyId",
                ExpressionAttributeNames : { "#ChainId" : "ChainId" },
                ExpressionAttributeValues : { ":storyId" : {"N":storyId.toString()} }
            };

            dynamodb.updateItem(chainingParams, function (chainingErr, chainingData) {
                if (chainingErr) throw ("Data_designateForChaining_ERROR " + chainingErr);
                else designateForChainingCallback();
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