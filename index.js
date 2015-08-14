/*
 * Module for the Six Words functionality, based on the Alexa spec.
 */
var sixWords = (function () {
    // This data object is our connection to the database.
    var data = require("./data.js");
    var script = require("./script.js");

    // When a new session starts, initialize anything that needs initializing.
    function onSessionStarted(sessionStartedRequest, session, context) {
        // If we don't have any attributes, initialize it..
        if (!session.attributes) session.attributes = {};
        session.attributes.timeStarted = new Date().toString();

        data.putUserActivity(session.user.userId, " ", "SessionStarted", function callback() { });
        // TODO Maybe fire up the DB here?
    }

    // Request handlers - launch, intent and ended.
    var requestHandlers = {
        LaunchRequest: function (event, context) {
            var userId = event.session.user.userId;
            // Let's see of the user has any news. If so, we want to give them a chance to hear it.
            data.hasNews(userId, function(news) {
                if (news == false){
                    // No news. Let's see if it's a theme day.
                    data.areThereThemeStoriesToHear(userId, function(areThereThemeStories, theTheme) {
                        if (!areThereThemeStories) {
                            // No news and no theme, so send a welcome message.
                            alexaSpeak("LaunchRequest", null, event.session, context, false);
                        } else {
                            // Ooh, we have theme stories for this user. Let's ask if the user wants
                            // to hear some stories from the theme.
                            event.session.attributes.storyState = "JustAskedHearThemeStories";
                            alexaSpeak("LaunchRequestThemePrompt", theTheme, event.session, context, false);
                        }
                    });
                } else {
                    // Ask the user if they want to receive their news.
                    event.session.attributes.storyState = "GivenNewsPrompt";
                    alexaSpeak("GivenNews", null, event.session, context, false);
                }
            });
        },

        IntentRequest: function (event, context) {
            // See if we have an intent to handle the intent we got. If so, call it.
            var intent = event.request.intent,
                intentName = event.request.intent.name,
                intentHandler = intentHandlers[intentName];
            if (intentHandler) {
                console.log('SixWords _onIntent dispatch intent = ' + intentName);
                intentHandler(intent, event.session, context);
            } else {
                throw 'SixWords ERROR Unsupported intent: ' + intentName;
            }
        },

        SessionEndedRequest: function (event, context) {
            // TODO maybe clean up any DB here?
        }
    };

    var intentHandlers = {
        ListenIntent: function (intent, session, context) {
            // Get a story from data.
            data.getRandomStory(function (nextStory, timeStamp, author) {
                // Save the story index to make sure we know which story was read.
                session.attributes.recentStoryIndex = timeStamp;
                session.attributes.storyState = "JustHeardAStory";
                session.attributes.Author = author;
                session.attributes.nextStory = nextStory;
                data.putUserActivity(session.user.userId, timeStamp, "Listen", function callback() { });

                // Read the story, Alexa, ask if they want to up vote it.
                alexaSpeak("ListenIntentAndBlank", nextStory, session, context, false);
            });
        },
        UpVoteIntent: function (intent, session, context) {
            // If we haven't just heard a story, then the user must be confused. Give them some help.
            if (session.attributes.storyState != "JustHeardAStory") {
                session.attributes.storyState = undefined;
                alexaSpeak("BadState", null, session, context, false);
            } else {
                // If we just heard a story, then we're ready to up vote.
                // First off, did we get a reaction in addition to the up vote?
                var reactionResponse = "";
                if (intent.slots && intent.slots.Reaction && intent.slots.Reaction.value) {
                    var reaction = intent.slots.Reaction.value;
                    if (reaction.split(" ").length == 1) {
                        // We got a valid reaction, so create a short reaction response.
                        reactionResponse = script.getScript("UpVoteIntentWithReaction", "WithTheReaction", 0)+" "+reaction;
                    } else {
                        // Dang, we got a reaction, but it's too too long or empty.
                        // Don't add the up vote, just tell the user to try again.
                        alexaSpeak("UpVoteIntentWithReactionAndBlank", reaction, session, context, false);
                        return;
                    }
                }

                data.putUserActivity(session.user.userId, session.attributes.recentStoryIndex, "Upvote", function callback() { });

                // Okay, now we can increment the story rating.
                data.incrementStoryRating(session.attributes.recentStoryIndex, function (incrementError) {
                    // Up vote done, now clear out the state and prepare the response.
                    session.attributes.storyState = undefined;

                    // If there was a reaction, add it to our DB.
                    if (reactionResponse != "") {
                        var userId = session.user.userId;
                        var storyId = session.attributes.recentStoryIndex;
                        data.addStoryReaction(reaction, storyId, userId, function() {
                            var news = script.getScript("NewsPreamble", "YouGotAComment", 0);
                            news = news.replace("%1", reactionResponse)+" "+session.attributes.nextStory;
                            data.addNews(session.attributes.Author, news, function(){
                                alexaSpeak("UpVoteIntentAndBlank", reactionResponse, session, context, false);
                            });
                        });
                    } else {
                        // No reaction? No problem, just send the up vote response. Have to include the insert
                        // text because this script key has an insert.
                        var news = script.getScript("NewsPreamble", "YouGotAnUpVote", 0);
                        news += " "+session.attributes.nextStory;
                        data.addNews(session.attributes.Author, news, function(){
                            alexaSpeak("UpVoteIntentAndBlank", " ", session, context, false);
                        });
                    }
                });
            }
        },
        HearReactionsIntent: function (intent, session, context) {
            // If we haven't just heard a story, then the user is confused. Give them some help.
            if (session.attributes.storyState != "JustHeardAStory") {
                session.attributes.storyState = undefined;
                alexaSpeak("BadState", null, session, context, false);
            } else {
                // The user wants to hear the reactions for the most recent story.
                data.getLatestStoryReactions(session.attributes.recentStoryIndex, function(reactions, getReactionsError){
                    // Were there any reactions for this story?
                    if (!reactions) {
                        // Nope, let the user down easy, and tell them how to be the first to react.
                        alexaSpeak("HearReactionsIntentBadReaction", null, session, context, false);
                    } else {
                        // Create a string of all the reactions, exclamation point separated.
                        var allReactions = "";
                        for (i = 0; i < reactions.length; i++) {
                            allReactions += reactions[i]+"! ";
                        }
                        alexaSpeak("HearReactionsIntentAndBlank", allReactions, session, context, false);
                    }
                });
            }
        },
        CreateIntent: function (intent, session, context) {
            // Let's create a story - did the user give us the 6 words we need?
            if (!intent.slots || !intent.slots.Story || !intent.slots.Story.value) {
                // No story. Set the state to thinking.
                session.attributes.storyState = "ThinkingAboutCreating";

                // If there is a theme today, let's prompt them for it.
                var userId = session.user.userId;
                data.isThereAThemeToPromptFor(userId, function (isThereAThemeToPromptFor, theTheme) {
                    if (isThereAThemeToPromptFor) {
                        // Yes! So, add the these to the prompt.
                        alexaSpeak("CreateIntentThemePrompt", theTheme, session, context, false);
                    } else {
                        // No theme, so just send the generic create prompt.
                        alexaSpeak("CreateIntentNoStory", null, session, context, false);
                    }
                });
            } else {
                // Get what the user said.
                var userStory = intent.slots.Story.value;
                var userStoryArray = userStory.split(" ");
                var userStoryWordCount = userStoryArray.length;

                // Let's see if the user included any punctuation.
                var userStoryArrayWithoutPunctuation = punctuationFixer(userStoryArray.splice(0));
                var userStoryArrayWithoutPunctuationCount = userStoryArrayWithoutPunctuation.length;
                if (userStoryWordCount != userStoryArrayWithoutPunctuationCount &&
                    userStoryArrayWithoutPunctuationCount == 6) {
                    // They did use punctuation, so use the punctuation corrected values.
                    userStoryWordCount = userStoryArrayWithoutPunctuationCount;
                    userStory = userStoryArrayWithoutPunctuation.join(" ");
                }

                if (userStoryWordCount > 6 || userStoryWordCount < 6) {
                    // Oops, they said too many or not enough words. Let's repeat what they said and tell
                    // them that they have to give us exactly 6 words.
                    session.attributes.storyState = "ThinkingAboutCreating";

                    alexaSpeak("CreateIntentBadStoryAndBlank", userStory, session, context, false);
                } else {
                    // They gave us 6 words, set the state.
                    session.attributes.storyState = "JustCreatedAStory";
                    session.attributes.userStory = userStory;

                    // Did the story match today's theme?
                    data.doesStoryMatchTheme(userStory, function (doesStoryMatchTheme) {
                        if (doesStoryMatchTheme) {
                            // They matched the theme - encourage that behaviour!
                            alexaSpeak("CreateIntentGoodStoryWithThemeAndBlank", userStory, session, context, false);
                        } else {
                            // No theme, just repeat the story back to them to confirm that we heard it correctly.
                            alexaSpeak("CreateIntentGoodStoryAndBlank", userStory, session, context, false);
                        }
                    });
                }
            }
        },
        YesIntent: function(intent, session, context) {
            var userId = session.user.userId;
            var storyState = session.attributes.storyState;
            var story = session.attributes.userStory;

            if (storyState == "GivenNewsPrompt"){
                //If the user was told that they have news and they said yes, give them the news
                data.getNews(userId, function(news){
                    alexaSpeak("GivingNews", session.attributes.News, session, context, false);
                });
            } else if (storyState == "JustCreatedAStory") {
                // We just heard a story and we heard it right, so store it in the DB
                data.putNewStory(userId, story, function(timeStamp, putStoryError) {
                    // Remove the story from the session attributes, reset to thinking about creating.
                    session.attributes.storyState = "ThinkingAboutCreating";
                    data.putUserActivity(userId, timeStamp, "Create", function callback() { });

                    // EASTER EGG - the six banana story gets a bad ass reaction.
                    if (story == "banana banana banana banana banana banana"){
                        alexaSpeak("YesIntentAllBananaStory", null, session, context, false);
                    }else{
                        alexaSpeak("YesIntent", null, session, context, false);
                    }
                });
            } else if (storyState == "JustAskedHearThemeStories") {
                // They want to hear the theme stories of the day, so let's get them and recite them.
                data.getThemeStories(function(themeStories, themeIds, themeAuthors) {
                    // Create a single string of all of the stories.
                    var storiesConcat = "";
                    for (i = 0; i < themeStories.length; i++) { storiesConcat += themeStories[i]+" . . "; }

                    alexaSpeak("YesIntentHearThemeStories", storiesConcat, session, context, false);
                });
            } else {
                // Oops, not sure why they were saying Yes. Reset the state and give them some instructions.
                session.attributes.storyState = undefined;
                alexaSpeak("BadState", null, session, context, false);
            }
        },
        NoIntent: function(intent, session, context) {
            if (session.attributes.storyState == "GivenNewsPrompt"){
                // User was prompted for news and said no, so we give them some generic instructions.
                session.attributes.storyState = undefined;
                alexaSpeak("NoIntentNews", null, session, context, false);
            }else if (session.attributes.storyState == "JustCreatedAStory") {
                // We didn't hear the story right, so ask them to tell it to us again.
                session.attributes.storyState = "ThinkingAboutCreating";
                alexaSpeak("NoIntent", null, session, context, false);
            }else if (session.attributes.storyState == "JustAskedHearThemeStories") {
                // User doesn't want to hear theme stories, so we give them some generic instructions.
                session.attributes.storyState = null;
                alexaSpeak("NoIntentHearThemeStories", null, session, context, false);
            } else {
                // If we didn't just create a story, then this intent is not valid, give them some instructions.
                session.attributes.storyState = undefined;
                alexaSpeak("BadState", null, session, context, false);
            }
        },
        HelpIntent: function(intent, session, context) {
            if (session.attributes.storyState == "ThinkingAboutCreating") {
                //If the user is thinking about creating a story, tell them exactly how to
                alexaSpeak("HelpIntentCreating", null, session, context, false);
                //TODO tell the user how to insert punctuation into their stories?
            } else if (session.attributes.storyState == "JustHeardAStory") {
                //If the user just heard a story, give them a help message helping them to listen to another
                alexaSpeak("HelpIntentHeard", null, session, context, false);
            } else if (session.attributes.storyState == "JustCreatedAStory") {
                //If the user just created a story, give them a help message asking them to confirm their story
                alexaSpeak("HelpIntentCreatedAndBlank", session.attributes.userStory, session, context, false);
            } else {
                //If the user just entered the session, give them a generic help message
                alexaSpeak("HelpIntent", null, session, context, false);
            }
        },
        QuitIntent: function(intent, session, context) {
            // All done. Goodnight!
            alexaSpeak("QuitIntent", null, session, context, true);
        }
    };

    /*
     * Helper function to build an Alexa response and send it to her via context.succeed.
     * This does not have a callback because it is the function responsible for calling context.succeed, and
     * therefore does not need to be async.
     */
    function alexaSpeak(scriptKey, insertText, session, context, endSession) {
        // Increment the user's verbosity level for this scriptKey, and get the count.
        data.incrementScriptListenCount(session.user.userId, scriptKey, function(incrementError, verbosityCount) {
            // Use the script key to get the reaction and the message.
            var scriptReaction = script.getScript(scriptKey, "Reaction", verbosityCount);
            var scriptMessage = script.getScript(scriptKey, "Instruction", verbosityCount);
            var fullScriptResponse = scriptReaction+" "+scriptMessage;

            // If there is some text to insert, do it.
            if (fullScriptResponse.search("%1") != -1 && insertText) {
                fullScriptResponse = fullScriptResponse.replace("%1", insertText);
                scriptMessage = scriptMessage.replace("%1", insertText);
            }

            // Log the response.
            console.log("(*) Alexa Says: "+fullScriptResponse);

            // Create a reprompt, which is just the message plus a short preamble.
            var repromptReaction = script.getScript("Reprompt", "Reaction", 0);

            // Create the response for Alexa.
            var alexaResponse = { version: "1.0",
                response: {
                    outputSpeech: { type: 'PlainText', text: fullScriptResponse },
                    // Reprompt with the same message, with the reprompt reaction.
                    reprompt: { outputSpeech: { type: 'PlainText', text: repromptReaction+" "+scriptMessage} },
                    shouldEndSession: endSession
                }
            };
            // Add the current session attributes to the response.
            alexaResponse.sessionAttributes = session.attributes;

            // Send it to Alexa.
            context.succeed(alexaResponse);
        });
    }

    /*
     * The fullStory parameter is an array of the words of a sentence. This function replaces all instances of
     * "period" and "comma" with the punctuation mark on the previous word. It discards any punctuation words
     * at the beginning of the sentence. It returns a new array with the updated words.
     */
    function punctuationFixer (storyArray) {
        for (i = 0; i < storyArray.length; i++) {
            if (storyArray[i].toLowerCase() == "period" || storyArray[i].toLowerCase() == "comma") {
                if (i != 0) {
                    // This is not the first item, so append the punctuation to the previous word.
                    var punctuation = ".";
                    if (storyArray[i].toLowerCase() == "comma") punctuation = ",";
                    storyArray[i-1] = storyArray[i-1].concat(punctuation);
                }

                // Remove the punctuation from the array. and stay on the current word.
                storyArray.splice(i, 1);
                i--;
            }
            if(i < storyArray.length &&
                (storyArray[i].toLowerCase() == "exclamation" && storyArray[i+1].toLowerCase() == "point") ||
                (storyArray[i].toLowerCase() == "question" && storyArray[i+1].toLowerCase() == "mark")) {
                if (i != 0) {
                    // This is not the first item, so append the punctuation to the previous word.
                    var exclamationPunctuation = "!";
                    if (storyArray[i].toLowerCase() == "question") exclamationPunctuation = "?";
                    storyArray[i-1] = storyArray[i-1].concat(exclamationPunctuation);
                }

                // Remove the punctuation from the array. and stay on the current word.
                storyArray.splice(i, 2);
                i--;
            }
        }
        return storyArray;
    }

    return {
        /*
         * The only public function of the module. Called by the handler, it executes the Alexa Skill.
         */
        execute: function(event, context) {
            // TODO do we want to check the AppID here?

            // If the session is new, initialize it.
            if (event.session.new) {
                onSessionStarted(event.request, event.session, context);
            }

            // Route the request to the right handler.
            requestHandlers[event.request.type](event, context);
        }
    }
}) ();

/**
 * This is what gets called by Lambda with each Alexa interaction.
 * @param event
 * @param context
 */
exports.handler = function (event, context) {
    console.log("SixWordsIndex _handler  START");

    // Create an instance of the SixWords skill and execute it.
    sixWords.execute(event, context);
    console.log("SixWordsIndex _handler  DONE");
};
