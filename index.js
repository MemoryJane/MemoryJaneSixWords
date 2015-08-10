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

    // Request handlers just pass off the
    var requestHandlers = {
        LaunchRequest: function (event, context) {
            // Send a welcome message. Ask if the user wants to listen to a story.
            var welcomeMessage = "Welcome to Six Word Stories. ";
            welcomeMessage += "You can say listen to hear a sweet little six word story.";
            alexaAsk(welcomeMessage, context);
        },
        IntentRequest: function (event, context) {
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
                alexaAsk(nextStory, context);
            });
        }
    };

    function alexaAsk(message, context) {
        console.log("(*) Alexa Says: "+message);

        // Create the response for Alexa.
        var alexaResponse = { version: "1.0",
            response: {
                outputSpeech: { type: 'PlainText', text: message },
                // for now, just reprompt with the same message. TODO make this accept a unique reprompt
                reprompt: { type: 'PlainText', text: message },
                shouldEndSession: false
            }
        };

        /*  TODO do I need to store the session attributes here to get them back later?
        if (options.session && options.session.attributes) {
            returnResult.sessionAttributes = options.session.attributes;
        }
        */

        context.succeed(alexaResponse);
    }


    return {
        /*
         * The only public function of the module. Called by the handler, it executes the Alexa Skill.
         */
        execute: function(event, context) {
            // TODO: Do we want to check the AppID here?

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
    console.log("6WordsIndex _handler  START");

    // Create an instance of the SixWords skill and execute it.
    sixWords.execute(event, context);
    console.log("6WordsIndex _handler  DONE");
};
