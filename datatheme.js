/**
 * THis is the data object for the theme functions, used for all communications with the DB around themes.
 * It follows the Module pattern.
 */
var dataTheme = ( function () {
    /**
     * Private function of this module.
     * Looks in the themes DB for any themes that match the time to match, and returns either a single item
     * from the DB that matches, or null if there are none.
     */
    function getThemeForTime (dynamodb, timeToMatch, getThemeForTimeCallback) {
        // We're looking for any themes where now is between the start and end times.
        var themeParams= { TableName: 'MemoryJaneSixWordThemes',
            FilterExpression: '#startTime <= :now AND #endTime >= :now',
            ExpressionAttributeNames: {
                '#startTime': "TimeStart",
                '#endTime': "TimeEnd"
            },
            ExpressionAttributeValues: {
                ':now': { N: timeToMatch }
            }
        };

        // Do the scan to find the theme.
        dynamodb.scan(themeParams, function (themeError, themeData) {
            if (themeError) throw("DataTheme_getThemeForTime_ERROR "+themeError);
            else {
                // Did we get a theme?
                if (themeData.Count == 0) {
                    // Nope. Return null;
                    getThemeForTimeCallback(null);
                } else {
                    // There was at least one match, return the first one.
                    getThemeForTimeCallback(themeData.Items[0]);
                }
            }
        });
    }

    /**
     * Private function for this module.
     * Looks in the stories DB for any stories that were labeled as being with the theme, and returns either an
     * array of the items from the DB, or null if there were none.
     */
    function getStoriesForTheme (dynamodb, themeText, getStoriesForThemeCallback) {
        // Searching to find stories that have been labeled with the given theme.
        var themeStoriesParams = {
            TableName: "MemoryJaneSixWordStories",
            FilterExpression : "#approved = :isTrue AND #theme = :theme",
            ExpressionAttributeNames : { "#approved" : "Approved", "#theme" : "ThemeText" },
            ExpressionAttributeValues : { ":isTrue" : {"BOOL":true}, ":theme" : { "S" : themeText } }
        };

        // Do the scan, find the stories.
        dynamodb.scan(themeStoriesParams, function (themeStoriesErr, themeStoriesData) {
            if (themeStoriesErr) throw ("DataTheme_getStoriesForTheme_ERROR " + themeStoriesErr);
            else {
                // Did we get stories?
                if (themeStoriesData.Count == 0) {
                    // Nope. Return null;
                    getStoriesForThemeCallback(null);
                } else {
                    // There was at least one match, return all of the items.
                    getStoriesForThemeCallback(themeStoriesData.Items);
                }
            }
        });
    }

    /**
     * This updates the DB to record that a user has heard the prompt for a particular theme. This prevents us from
     * give them that prompt more than once.
     */
    function updateThemeWithUserHeard(dynamodb, theme, heardIndex, userId, updateThemeWithUserHeardCallback) {
        // Prep the new user list.
        var userList = userId + " ";
        if (theme[heardIndex]) {
            userList = theme[heardIndex].S + userList;
        }

        // This is the updated theme with the updated user list.
        var updateToHeardParams = {
            TableName: "MemoryJaneSixWordThemes",
            Key: {
                TimeStart: {"N": theme.TimeStart.N.toString()},
                TimeEnd: {"N": theme.TimeEnd.N.toString()}
            },
            UpdateExpression: "SET #usersHeard = :userList",
            ExpressionAttributeNames: {"#usersHeard": heardIndex},
            ExpressionAttributeValues: {":userList": {"S": userList}}
        };

        dynamodb.updateItem(updateToHeardParams, function (updateToHeardError, updateToHeardData) {
            if (updateToHeardError) throw ("DataTheme_updateThemeWithUserHeard_ERROR " + updateToHeardError);
            else {
                updateThemeWithUserHeardCallback();
            }
        });
    }

    // These are the module's public functions ..
    return {
        /**
         * Checks to see if a story matches the current theme. Returns a boolean and the theme, if it matched.
         */
        doesStoryMatchTheme: function(data, dynamodb, story, doesStoryMatchThemeCallback) {
            // Do we have a theme today?
            getThemeForTime(dynamodb, data.getTimeStamp().toString(), function(todaysTheme) {
                if (!todaysTheme) {
                    // Nope. Return false.
                    doesStoryMatchThemeCallback(false, null);
                } else {
                    // Yep. We have two kinds of rules - has to have the word(s) and has to have the word(s)
                    // in a certain position. Let's see which one it is.
                    var success = true;
                    var themeText = todaysTheme.ThemeText.S;
                    var ruleWords = todaysTheme.ThemeRule.S.split(" ");
                    var storyWords = story.split(" ");

                    // If it has an asterisk, than it is words in a specific order.
                    if (todaysTheme.ThemeRule.S.indexOf("*") != -1) {
                        // Look through each story word and match it with the rule words.
                        for (i = 0; i < storyWords.length; i++) {
                            // If the ruleWord isn't a wild card, and it's not equal to the storyWord, we fail.
                            if (ruleWords[i] != "*" && ruleWords[i] != storyWords[i]) {
                                success = false;
                                themeText = null;
                                i = storyWords.length;
                            }
                        }
                    } else {
                        // No asterisk, so it's words in any order. Assume we're going to fail.
                        success = false;
                        themeText = null;

                        // Loop through both the story and rule words to see how many matches we have.
                        for (i = 0; i < storyWords.length; i++) {
                            for (j = 0; j < ruleWords.length; j++) {
                                if (storyWords[i] == ruleWords[j]) {
                                    // If we have a match, remove the rule word from the rule words array
                                    // and move on to the next story word.
                                    ruleWords.splice(j, 1);
                                    j = ruleWords.length;
                                }
                            }
                            // If ruleWords is empty, then we're done, and it was a success.
                            if (ruleWords.length == 0) {
                                i = storyWords.length;
                                success = true;
                                themeText = todaysTheme.ThemeText.S;
                            }
                        }
                    }

                    doesStoryMatchThemeCallback(success, themeText);
                }
            });
        },

        /**
         * Get the stories that match the current theme.
         * Returns at most 5 stories.
         */
        getThemeStories: function(data, dynamodb, getThemeStoriesCallback) {
            // First see if there's a theme.
            getThemeForTime(dynamodb, data.getTimeStamp().toString(), function(todaysTheme) {
                // Did we get a theme?
                if (!todaysTheme) {
                    // Nope, no theme. Return nulls.
                    getThemeStoriesCallback(null, null, null);
                } else {
                    // Okay, now see if there are stories for that theme.
                    getStoriesForTheme(dynamodb, todaysTheme.ThemeText.S, function(themeStories) {
                        // Are there any stories that matched?
                        if (!themeStories) {
                            // There was a theme, but no stories matched. Return nulls.
                            getThemeStoriesCallback(null, null, null);
                        } else {
                            // We got stories. Format them and return them.
                            var stories = [];
                            var storyIds = [];
                            var authors = [];

                            for (i = 0; i < themeStories.length && i < 5; i++) {
                                stories.push(themeStories[i].Story.S);
                                storyIds.push(themeStories[i].TimeStamp.N.toString());
                                authors.push(themeStories[i].Author.S);
                            }

                            getThemeStoriesCallback(stories, storyIds, authors);
                        }
                    });
                }
            });
        },

        /**
         * Call this to see if there is a theme for the day. If there is, you'll get back true and the theme.
         * This function only returns true once per day, to ensure users don't get overwhelmed with
         * requests to create a theme story.
         */
        isThereAThemeToPromptFor: function(data, dynamodb, userId, isThereAThemeCallback) {
            // Is there a theme for right now?
            getThemeForTime(dynamodb, data.getTimeStamp().toString(), function(todaysTheme) {
                // Did we get a theme?
                if (!todaysTheme) {
                    // Nope, no theme. Return false.
                    isThereAThemeCallback(false, null);
                } else {
                    // Yep, there's a theme, now let's see if this user has heard this prompt already.
                    var alreadyHeardUsers = "";
                    if (todaysTheme.UsersHeardPrompt) {
                        alreadyHeardUsers = todaysTheme.UsersHeardPrompt.S;
                    }

                    if (alreadyHeardUsers && alreadyHeardUsers.search(userId) != -1) {
                        // Yes, the user has already heard it, so we return false.
                        isThereAThemeCallback(false, null);
                    } else {
                        // Nope, hasn't heard it. So update the record with that fact and send back the theme.
                        updateThemeWithUserHeard(dynamodb, todaysTheme, "UsersHeardPrompt", userId, function() {
                            isThereAThemeCallback(true, todaysTheme.ThemeText.S);
                        });
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
            getThemeForTime(dynamodb, data.getTimeStamp().toString(), function(todaysTheme) {
                // Did we get a theme?
                if (!todaysTheme) {
                    // Nope, no theme. Return false.
                    areThereThemeStoriesCallback(false, null);
                } else {
                    // Yes, there is a theme. Has this user heard the stories for it?
                    var alreadyHeardUsers = "";
                    if (todaysTheme.UsersHeardStories) {
                        alreadyHeardUsers = todaysTheme.UsersHeardStories.S;
                    }

                    if (alreadyHeardUsers && alreadyHeardUsers.search(userId) != -1) {
                        // Yes, the user has already heard it, so we return false.
                        areThereThemeStoriesCallback(false, null);
                    } else {
                        var themeText = todaysTheme.ThemeText.S;
                        getStoriesForTheme(dynamodb, themeText, function(themeStories) {
                            if (!themeStories) {
                                // There is a theme, but no stories match. Return false.
                                areThereThemeStoriesCallback(false, null);
                            } else {
                                // There are stories to hear! Record that this user heard them.
                                var heardIndex = "UsersHeardStories";
                                updateThemeWithUserHeard(dynamodb, todaysTheme, heardIndex, userId, function() {
                                    areThereThemeStoriesCallback(true, themeText);
                                });
                            }
                        });
                    }
                }
            });
        }
    }
}) ();

module.exports = dataTheme;