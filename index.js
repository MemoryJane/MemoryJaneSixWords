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

        // TODO Maybe fire up the DB here?
    }

    // Request handlers - launch, intent and ended.
    var requestHandlers = {
        LaunchRequest: function (event, context) {
            // Send a welcome message. Ask if the user wants to listen to a story.
            var reactionMessage = script.getScript("LaunchRequest","Reaction");
            var instructionMessage = script.getScript("LaunchRequest","Instruction");
            alexaSpeak(reactionMessage, instructionMessage, event.session, context, false);
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
            data.getRandomStory(function (nextStory, timeStamp) {
                // Save the story index to make sure we know which story was read.
                session.attributes.recentStoryIndex = timeStamp;
                session.attributes.storyState = "JustHeardAStory";

                // Read the story, Alexa, ask if they want to up vote it.
                var ratingInstruction = script.getScript("ListenIntent", "Instruction");
                alexaSpeak(nextStory+" . ", ratingInstruction, session, context, false);
            });
        },
        UpVoteIntent: function (intent, session, context) {
            // If we haven't just heard a story, then the user must be confused. Give them some help.
            if (session.attributes.storyState != "JustHeardAStory") {
                session.attributes.storyState = undefined;
                var oopsResponse = script.getScript("BadState", "Instruction");
                alexaSpeak("", oopsResponse, session, context, false);
            } else {
                // If we just heard a story, then we're ready to up vote.
                // First off, did we get a reaction in addition to the up vote?
                var reactionResponse = "";
                if (intent.slots && intent.slots.Reaction && intent.slots.Reaction.value) {
                    var reaction = intent.slots.Reaction.value;
                    if (reaction.split(" ").length == 1) {
                        // We got a valid reaction, so create a short reaction response.
                        reactionResponse = script.getScript("UpVoteIntentWithReaction", "WithTheReaction")+" "+reaction;
                    } else {
                        // Dang, we got a reaction, but it's too too long or empty.
                        // Don't add the up vote, just tell the user to try again.
                        var retryUpVoteReaction = script.getScript("UpVoteIntentWithReaction", "Reaction");
                        var retryUpVoteResponse = script.getScript("UpVoteIntentWithReaction", "Instruction");
                        retryUpVoteResponse = retryUpVoteResponse.replace("%1", reaction);
                        alexaSpeak(retryUpVoteReaction, retryUpVoteResponse, session, context, false);
                        return;
                    }
                }

                // Okay, now we can increment the story rating.
                data.incrementStoryRating(session.attributes.recentStoryIndex, function (incrementError) {
                    if (incrementError) { console.log("SixWords _upVoteIntent incrementRating  ERROR "+incrementError);
                    } else {
                        // Up vote done, now clear out the state and prepare the response.
                        session.attributes.storyState = undefined;
                        var upVoteReaction = script.getScript("UpVoteIntent", "Reaction");
                        upVoteReaction = upVoteReaction.replace("%1", reactionResponse);
                        var upVoteResponse = script.getScript("UpVoteIntent", "Instruction");

                        // If there was a reaction, add it to our DB.
                        if (reactionResponse != "") {
                            var userId = session.user.userId;
                            var storyId = session.attributes.recentStoryIndex;
                            data.addStoryReaction(reaction, storyId, userId, function(addReactionError) {
                                if (addReactionError) {
                                    console.log("SixWords _upVoteIntent addReaction  ERROR " + addReactionError);
                                } else {
                                    alexaSpeak(upVoteReaction, upVoteResponse, session, context, false);
                                }
                            });
                        } else {
                            // No reaction? No problem, just send the up vote response.
                            alexaSpeak(upVoteReaction, upVoteResponse, session, context, false);
                        }
                    }
                });
            }
        },
        HearReactionsIntent: function (intent, session, context) {
            // If we haven't just heard a story, then the user is confused. Give them some help.
            if (session.attributes.storyState != "JustHeardAStory") {
                session.attributes.storyState = undefined;
                var oopsResponse = script.getScript("BadState", "Instruction");
                alexaSpeak("", oopsResponse, session, context, false);
            } else {
                // The user wants to hear the reactions for the most recent story.
                data.getLatestStoryReactions(session.attributes.recentStoryIndex, function(reactions, getReactionsError){
                    if (getReactionsError) {
                        console.log("SixWords _hearReactionsIntent getReactions  ERROR " + error);
                    } else {
                        var reactionsReaction = script.getScript("HearReactionsIntent", "Reaction")+" ";
                        var reactionsResponse = script.getScript("HearReactionsIntent", "Instruction");

                        // Were there any reactions for this story?
                        if (!reactions) {
                            // Nope, let the user down easy, and tell them how to be the first to react.
                            reactionsReaction = script.getScript("HearReactionsIntentBadReaction", "Reaction");
                            reactionsResponse = script.getScript("HearReactionsIntentBadReaction", "Instruction");
                        } else {
                            // Tell the user the reactions.
                            for (i = 0; i < reactions.length; i++) {
                                reactionsResponse += reactions[i]+"! ";
                            }
                        }
                        alexaSpeak(reactionsReaction, reactionsResponse, session, context, false);
                    }
                });
            }
        },
        CreateIntent: function (intent, session, context) {
            // Let's create a story - did the user give us the 6 words we need?
            if (!intent.slots || !intent.slots.Story || !intent.slots.Story.value) {
                // No Story. Let's tell them how to create.
                session.attributes.storyState = "ThinkingAboutCreating";
                var noStoryReaction = script.getScript("CreateIntentNoStory", "Reaction");
                var noStoryResponse = script.getScript("CreateIntentNoStory", "Instruction");
                alexaSpeak(noStoryReaction, noStoryResponse, session, context, false);
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

                    var oopsReaction = script.getScript("CreateIntentBadStory", "Reaction");
                    var oopsResponse = script.getScript("CreateIntentBadStory", "Instruction");
                    oopsResponse = oopsResponse.replace("%1", userStory);
                    alexaSpeak(oopsReaction, oopsResponse, session, context, false);
                } else {
                    // They gave us 6 words, set the state.
                    session.attributes.storyState = "JustCreatedAStory";
                    session.attributes.userStory = userStory;

                    // And repeat it back to them to confirm that we heard them correctly.
                    var validWordsReaction = script.getScript("CreateIntentGoodStory", "Reaction");
                    var validWordsResponse = script.getScript("CreateIntentGoodStory", "Instruction");
                    validWordsResponse = validWordsResponse.replace("%1", userStory);
                    alexaSpeak(validWordsReaction, validWordsResponse, session, context, false);
                }
            }
        },
        YesIntent: function(intent, session, context) {
            // If we didn't just create a story, then this intent is not valid, give them some instructions.
            if (session.attributes.storyState != "JustCreatedAStory") {
                session.attributes.storyState = undefined;
                var oopsResponse = script.getScript("BadState", "Instruction");
                alexaSpeak("", oopsResponse, session, context, false);
            } else {
                // We heard the story right, so store it in the DB
                data.putNewStory(session.user.userId, session.attributes.userStory, function(putStoryError) {
                    if (putStoryError) console.log("SixWords _yesIntent  ERROR "+putStoryError);
                    else {
                        // Remove the story from the session attributes.
                        session.attributes.storyState = "ThinkingAboutCreating";

                        // And ask them to write or listen to another one.
                        var confirmationReaction = script.getScript("YesIntent", "Reaction");
                        var confirmationResponse = script.getScript("YesIntent", "Instruction");
                        alexaSpeak(confirmationReaction, confirmationResponse, session, context, false);
                    }
                });
            }
        },
        NoIntent: function(intent, session, context) {
            // If we didn't just create a story, then this intent is not valid, give them some instructions.
            if (session.attributes.storyState != "JustCreatedAStory") {
                session.attributes.storyState = undefined;
                var oopsResponse = script.getScript("BadState", "Instruction");
                alexaSpeak("", oopsResponse, session, context, false);
            } else {
                // We didn't hear the story right, so ask them to tell it to us again.
                session.attributes.storyState = "ThinkingAboutCreating";

                var confirmationReaction = script.getScript("NoIntent", "Reaction");
                var confirmationResponse = script.getScript("NoIntent", "Instruction");
                alexaSpeak(confirmationReaction, confirmationResponse, session, context, false);
            }
        },
        HelpIntent: function(intent, session, context) {
            if (session.attributes.storyState == "ThinkingAboutCreating") {
                //If the user is thinking about creating a story, tell them exactly how to
                var helpCreatingMessage = script.getScript("HelpIntentCreating", "Instruction");
                alexaSpeak("", helpCreatingMessage, session, context, false);
                //TODO tell the user how to insert punctuation into their stories?
            } else if (session.attributes.storyState == "JustHeardAStory") {
                //If the user just heard a story, give them a help message helping them to listen to another
                var helpHeardMessage = script.getScript("HelpIntentHeard", "Instruction");
                alexaSpeak("", helpHeardMessage, session, context, false);
            } else if (session.attributes.storyState == "JustCreatedAStory") {
                //If the user just created a story, give them a help message asking them to confirm their story
                var helpCreatedMessage = script.getScript("HelpIntentCreated", "Instruction");
                helpCreatedMessage = helpCreatedMessage.replace("%1", session.attributes.userStory);
                alexaSpeak("", helpCreatedMessage, session, context, false);
            } else {
                //If the user just entered the session, give them a generic help message
                var helpReaction = script.getScript("HelpIntent", "Reaction");
                var helpMessage = script.getScript("HelpIntent", "Instruction");
                alexaSpeak(helpReaction, helpMessage, session, context, false);
            }
        },
        QuitIntent: function(intent, session, context) {
            // All done. Goodnight!
            var goodbyeMessage = script.getScript("QuitIntent", "Instruction");
            alexaSpeak("", goodbyeMessage, session, context, true);
        }
    };

    /*
     * Helper function to build an Alexa response and send it to her via context.succeed.
     */
    function alexaSpeak(reactionMessage, instructionMessage, session, context, endSession) {
        console.log("(*) Alexa Says: "+reactionMessage+" "+instructionMessage);

        // Create a reprompt, which is just the message plus a short preamble.
        var repromptReaction = script.getScript("Reprompt", "Reaction");

        // Create the response for Alexa.
        var alexaResponse = { version: "1.0",
            response: {
                outputSpeech: { type: 'PlainText', text: reactionMessage+" "+instructionMessage },
                // for now, just reprompt with the same message. TODO make this accept a unique reprompt?
                reprompt: { outputSpeech: { type: 'PlainText', text: repromptReaction+instructionMessage} },
                shouldEndSession: endSession
            }
        };
        // Add the current session attributes to the response.
        alexaResponse.sessionAttributes = session.attributes;

        // Send it to Alexa.
        context.succeed(alexaResponse);
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
