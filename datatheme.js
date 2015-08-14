/**
 * THis is the data object for the theme functions, used for all communications with the DB around themes.
 * It follows the Module pattern.
 */
var dataTheme = ( function () {
    return {
        /**
         * Checks to see if a story matches the current theme. Returns a boolean and the theme, if it matched.
         */
        doesStoryMatchTheme: function(data, dynamodb, story, doesStoryMatchThemeCallback) {
            // We're looking for any themes where now is between the start and end times.
            var themeParams= { TableName: 'MemoryJaneSixWordThemes',
                FilterExpression: '#startTime <= :now AND #endTime >= :now',
                ExpressionAttributeNames: {
                    '#startTime': "TimeStart",
                    '#endTime': "TimeEnd"
                },
                ExpressionAttributeValues: {
                    ':now': { N: data.getTimeStamp().toString() }
                }
            };

            // Do the scan to find the theme.
            dynamodb.scan(themeParams, function (themeError, themeData) {
                if (themeError) throw("DataTheme_doesStoryMatchTheme_ERROR "+themeError);
                else {
                    // Did we even get a theme?
                    if (themeData.Count == 0) {
                        // Nope. Return false.
                        doesStoryMatchThemeCallback(false, null);
                    } else {
                        // Yep. Let's check to see if the rule is met.
                        var ruleWords = themeData.Items[0].ThemeRule.S.split(" ");
                        var storyWords = story.split(" ");

                        var success = true;
                        var themeText = themeData.Items[0].ThemeText.S;
                        for (i = 0; i < storyWords.length; i++) {
                            // If the ruleWord isn't a wild card, and it's not equal to the storyWord, we fail.
                            if (ruleWords[i] != "*" && ruleWords[i] != storyWords[i]) {
                                success = false;
                                themeText = null;
                                i = storyWords.length;
                            }
                        }
                        doesStoryMatchThemeCallback(success, themeText);
                    }
                }
            });
        },

        /**
         * Get the stories that match the current theme.
         * Returns at most 5 stories.
         */
        getThemeStories: function(data, dynamodb, getThemeStoriesCallback) {
            // First, check to see if it's a theme day.
            // We're looking for any themes where now is between the start and end times.
            var themeParams= { TableName: 'MemoryJaneSixWordThemes',
                FilterExpression: '#startTime <= :now AND #endTime >= :now',
                ExpressionAttributeNames: {
                    '#startTime': "TimeStart",
                    '#endTime': "TimeEnd"
                },
                ExpressionAttributeValues: {
                    ':now': { N: data.getTimeStamp().toString() }
                }
            };

            // Do the scan, find the theme.
            dynamodb.scan(themeParams, function (themeError, themeData) {
                if (themeError) throw("DataTheme_getThemeStories_themes_ERROR " + themeError);
                else {
                    // Did we get a theme?
                    if (themeData.Count == 0) {
                        // Nope. Return nulls.
                        getThemeStoriesCallback(null, null, null);
                    } else {
                        // Okay, now see if there are stories for that theme.
                        var themeText = themeData.Items[0].ThemeText.S;
                        var themeStoriesParams = {
                            TableName: "MemoryJaneSixWordStories",
                            FilterExpression : "#approved = :isTrue AND #theme = :theme",
                            ExpressionAttributeNames : { "#approved" : "Approved", "#theme" : "ThemeText" },
                            ExpressionAttributeValues : { ":isTrue" : {"BOOL":true}, ":theme" : { "S" : themeText } }
                        };

                        // Do the scan, find the stories.
                        dynamodb.scan(themeStoriesParams, function (themeStoriesErr, themeStoriesData) {
                            if (themeStoriesErr) throw ("DataTheme_getThemeStories_stories_ERROR " + themeStoriesErr);
                            else {
                                // Are there any stories that matched?
                                if (themeStoriesData.Count == 0) {
                                    // There is a theme, but no stories match. Return nulls.
                                    getThemeStoriesCallback(null, null, null);
                                } else {
                                    // We got stories. Format them and return them.
                                    var stories = [];
                                    var storyIds = [];
                                    var authors = [];

                                    for (i = 0; i < themeStoriesData.Count && i < 5; i++) {
                                        stories.push(themeStoriesData.Items[i].Story.S);
                                        storyIds.push(themeStoriesData.Items[i].TimeStamp.N.toString());
                                        authors.push(themeStoriesData.Items[i].Author.S);
                                    }

                                    getThemeStoriesCallback(stories, storyIds, authors);
                                }
                            }
                        });
                    }
                }
            });
        },

        /**
         * Call this to see if there is a theme for the day. If there is, you'll get back true and the theme.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to create a theme story.
         */
        isThereAThemeToPromptFor: function(data, dynamodb, userId, isThereAThemeCallback) {
            // We're looking for any themes where now is between the start and end times.
            var themeParams= { TableName: 'MemoryJaneSixWordThemes',
                FilterExpression: '#startTime <= :now AND #endTime >= :now',
                ExpressionAttributeNames: {
                    '#startTime': "TimeStart",
                    '#endTime': "TimeEnd"
                },
                ExpressionAttributeValues: {
                    ':now': { N: data.getTimeStamp().toString() }
                }
            };

            dynamodb.scan(themeParams, function (themeError, themeData) {
                if (themeError) throw("DataTheme_isThereAThemeToPromptFor_ERROR "+themeError);
                else {
                    // Did we get a theme?
                    if (themeData.Count == 0) {
                        // Nope. Return false.
                        isThereAThemeCallback(false, null);
                    } else {
                        // Yep, now let's see if this user has heard this prompt already.
                        var alreadyHeardUsers = "";
                        if (themeData.Items[0].UsersHeardPrompt) {
                            alreadyHeardUsers = themeData.Items[0].UsersHeardPrompt.S;
                        }

                        if (alreadyHeardUsers && alreadyHeardUsers.search(userId) != -1) {
                            // Yes, the user has already heard it, so we return false.
                            isThereAThemeCallback(false, null);
                        } else {
                            // Nope, hasn't heard it. So update the record with that fact and send back the theme.
                            var userList = alreadyHeardUsers + userId + " ";
                            var updateToHeardParams = {
                                TableName : "MemoryJaneSixWordThemes",
                                Key : { TimeStart : { "N" : themeData.Items[0].TimeStart.N.toString() },
                                    TimeEnd : { "N" : themeData.Items[0].TimeEnd.N.toString() } },
                                UpdateExpression : "SET #usersHeard = :userList",
                                ExpressionAttributeNames : { "#usersHeard" : "UsersHeardPrompt" },
                                ExpressionAttributeValues : { ":userList" : { "S" : userList } }
                            };

                            dynamodb.updateItem(updateToHeardParams, function(updateToHeardError, updateToheardData) {
                                isThereAThemeCallback(true, themeData.Items[0].ThemeText.S);
                            });
                        }
                    }
                }
            });
        },

        /**
         * Call this to see if there are theme stories for this user to hear.
         * Returns true if there are, and a string that is the theme of the day.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to hear the theme stories.
         */
        areThereThemeStoriesToHear: function(data, dynamodb, userId, areThereThemeStoriesCallback) {
            // First, check to see if it's a theme day.
            // We're looking for any themes where now is between the start and end times.
            var themeParams= { TableName: 'MemoryJaneSixWordThemes',
                FilterExpression: '#startTime <= :now AND #endTime >= :now',
                ExpressionAttributeNames: {
                    '#startTime': "TimeStart",
                    '#endTime': "TimeEnd"
                },
                ExpressionAttributeValues: {
                    ':now': { N: data.getTimeStamp().toString() }
                }
            };

            // Do the scan, get the themes.
            dynamodb.scan(themeParams, function (themeError, themeData) {
                if (themeError) throw("Data_areThereThemeStoriesToHear_themes_ERROR "+themeError);
                else {
                    // Did we get a theme?
                    if (themeData.Count == 0) {
                        // Nope. Return false.
                        areThereThemeStoriesCallback(false, null);
                    } else {
                        // Yes, there is a theme. Has this user heard the stories for it?
                        var alreadyHeardUsers = "";
                        if (themeData.Items[0].UsersHeardStories) {
                            alreadyHeardUsers = themeData.Items[0].UsersHeardStories.S;
                        }

                        if (alreadyHeardUsers && alreadyHeardUsers.search(userId) != -1) {
                            // Yes, the user has already heard it, so we return false.
                            areThereThemeStoriesCallback(false, null);
                        } else {
                            // User hasn't heard the stories, let's see if there are stories now that match the theme.
                            var themeText = themeData.Items[0].ThemeText.S;
                            var themeStoriesParams = {
                                TableName: "MemoryJaneSixWordStories",
                                FilterExpression : "#approved = :isTrue AND #theme = :theme",
                                ExpressionAttributeNames : { "#approved" : "Approved", "#theme" : "ThemeText" },
                                ExpressionAttributeValues : { ":isTrue" : {"BOOL":true}, ":theme" : { "S" : themeText } }
                            };

                            // Get the stories that match.
                            dynamodb.scan(themeStoriesParams, function (themeStoriesErr, themeStoriesData) {
                                if (themeStoriesErr) throw ("Data_areThereTheseStoriesToHear_stories_ERROR " + themeStoriesErr);
                                else {
                                    // Are there any stories that matched?
                                    if (themeStoriesData.Count == 0) {
                                        // There is a theme, but no stories match. Return false.
                                        areThereThemeStoriesCallback(false, null);
                                    } else {
                                        // There are stories to hear! Record that this user heard them.
                                        var userList = alreadyHeardUsers + userId + " ";
                                        var updateToHeardParams = {
                                            TableName : "MemoryJaneSixWordThemes",
                                            Key : { TimeStart : { "N" : themeData.Items[0].TimeStart.N.toString() },
                                                TimeEnd : { "N" : themeData.Items[0].TimeEnd.N.toString() } },
                                            UpdateExpression : "SET #usersHeard = :userList",
                                            ExpressionAttributeNames : { "#usersHeard" : "UsersHeardStories" },
                                            ExpressionAttributeValues : { ":userList" : { "S" : userList } }
                                        };

                                        dynamodb.updateItem(updateToHeardParams, function(updateToHeardError, updateToheardData) {
                                            areThereThemeStoriesCallback(true, themeText);
                                        });
                                    }
                                }
                            });
                        }
                    }
                }
            });
        }
    }
}) ();

module.exports = dataTheme;