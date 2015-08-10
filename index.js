/*
 * Module for the Six Words functionality, based on the Alexa spec.
 */
var sixWords = (function () {
    // This data object is our connection to the database.
    var data = require("./data.js");

    // When a new session starts, initialize anything that needs initializing.
    function onSessionStarted(sessionStartedRequest, session, context) {
        // TODO Maybe fire up the DB here?
    }

    // Request handlers - launch, intent and ended.
    var requestHandlers = {
        LaunchRequest: function (event, context) {
            // Send a welcome message. Ask if the user wants to listen to a story.
            var welcomeMessage = "Welcome to Six Word Stories. ";
            welcomeMessage += "You can say listen to hear an awesome little six word story.";
            alexaSpeak(welcomeMessage, event.session, context, false);
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
            data.getRandomStory(function (nextStory) {
                // Read the story, Alexa.
                alexaSpeak(nextStory, session, context, false);
            });
        },
        CreateIntent: function (intent, session, context) {
            console.log(intent.slots);

            // Let's create a story - did the user give us the 6 words we need?
            if (!intent.slots || !intent.slots.Story || !intent.slots.Story.value) {
                // No Story. Let's tell them how to create.
                var noStoryResponse = "Great, let's make a story. Say create followed by your six words.";
                alexaSpeak(noStoryResponse, session, context, false);
            } else {
                // Here's the story they said.
                var userStory = intent.slots.Story.value;
                var userStoryWordCount = userStory.split(" ").length;

                if (userStoryWordCount > 6 || userStoryWordCount < 6) {
                    // Oops, they said too many or not enough words. Let's repeat what they said and tell
                    // them that they have to give us exactly 6 words.
                    var oopsResponse = "Oops. I heard you try to create the following story: "+userStory;
                    oopsResponse += " . But our stories require exactly 6 words. ";
                    oopsResponse += "Try again, say create followed by your six words.";
                    alexaSpeak(oopsResponse, session, context, false);
                } else {
                    // They gave us 6 words, so now we save it to the session attributes.
                    if (!session.attributes) session.attributes = {};
                    session.attributes.userStory = userStory;

                    // And repeat it back to them to confirm that we heard them correctly.
                    var validWordsResponse = "Cool story! I just want to confirm I heard it right. Did you say ";
                    validWordsResponse += userStory+"?";
                    alexaSpeak(validWordsResponse, session, context, false);
                }
            }
        },
        YesIntent: function(intent, session, context) {
            // If there isn't a story in the attributes, then this intent is not valid, give them some instructions.
            if (!session.attributes.userStory || session.attributes.userStory.length == 0) {
                var oopsResponse = "You can say listen to hear a story or create to write your own. ";
                oopsResponse += "Which would you like?";
                alexaSpeak(oopsResponse, session, context, false);
            } else {
                // We heard the story right, so store it in the DB
                data.putNewStory(session.user.userId, session.attributes.userStory, function(putStoryError) {
                    if (putStoryError) console.log("SixWords _yesIntent  ERROR "+putStoryError);
                    else {
                        // Remove the story from the session attributes.
                        session.attributes.userStory = undefined;

                        // And ask them to write or listen to another one.
                        var confirmationResponse = "Coolio! Your story is saved. I can't wait to tell it. ";
                        confirmationResponse += "What would you like to do next. "
                        confirmationResponse += "Create another story or listen to one?";
                        alexaSpeak(confirmationResponse, session, context, false);
                    }
                });
            }
        },
        NoIntent: function(intent, session, context) {
            // If there isn't a story in the attributes, then this intent is not valid, give them some instructions.
            if (!session.attributes.userStory || session.attributes.userStory.length == 0) {
                var oopsResponse = "You can say listen to hear a story or create to write your own. ";
                oopsResponse += "Which would you like?";
                alexaSpeak(oopsResponse, session, context, false);
            } else {
                // We didn't hear the story right, so ask them to tell it to us again.
                session.attributes.userStory = undefined;

                var confirmationResponse = "Oops, sorry about that. Let's try again. ";
                confirmationResponse += "Say create followed by your six words.";
                alexaSpeak(confirmationResponse, session, context, false);
            }
        },
        QuitIntent: function(intent, session, context) {
            alexaSpeak("Goodbye", session, context, true);
        },
        LikeIntent: function(intent, session, context) {
            data.modifyRating(session.attributes.TimeStamp, session.attributes.DateStamp, session.attributes.givenRating, function(callback)
            {
                alexaSpeak("Glad you liked it! Would you like to listen to more stories or create one?", session, context, false);
            });
        }
    };

    /*
     * Helper function to build an Alexa response and send it to her via context.succeed.
     */
    function alexaSpeak(message, session, context, endSession) {
        console.log("(*) Alexa Says: "+message);

        // Create the response for Alexa.
        var alexaResponse = { version: "1.0",
            response: {
                outputSpeech: { type: 'PlainText', text: message },
                // for now, just reprompt with the same message. TODO make this accept a unique reprompt?
                reprompt: { type: 'PlainText', text: message },
                shouldEndSession: endSession
            }
        };

        // Add the session attributes to the response.
        alexaResponse.sessionAttributes = session.attributes;

        // Send it to Alexa.
        context.succeed(alexaResponse);
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
