/*
 * Module for the Six Words functionality, based on the Alexa spec.
 */
var sixWords = (function () {

    var requestHandlers = {
        LaunchRequest: function (event, context) {
            eventHandlers.onLaunch(event.request, event.session);
        },
        IntentRequest: function (event, context) {
            eventHandlers.onIntent(event.request, event.session);
        },
        SessionEndedRequest: function (event, context) {
            eventHandlers.onSessionEnded(event.request, event.session);
        }
    };

    var eventHandlers = {
        onSessionStarted: function (sessionStartedRequest, session) {
            // TODO Maybe fire up the DB here?
        },

        onLaunch: function (launchRequest, session) {
            // TODO Welcome message.
        },

        onIntent: function (intentRequest, session) {
            // TODO handle the intent
            var intent = intentRequest.intent,
                intentName = intentRequest.intent.name,
                intentHandler = intentHandlers[intentName];
            if (intentHandler) {
                console.log('SixWords _onIntent dispatch intent = ' + intentName);
                intentHandler(intent, session);
            } else {
                throw 'SixWords ERROR Unsupported intent: ' + intentName;
            }
        },
        onSessionEnded: function (sessionEndedRequest, session) {
            // TODO maybe clean up any DB here?
        }
    };

    var intentHandlers = {
        ListenIntent: function (intent, session) {
            var data = require("./data.js");
            data.getRandomStory(function(story){
                console.log(story)
            });
        }
    };

    return {
        execute: function(event, context) {
            // TODO: Do we want to check out AppID here?

            // If the session is new, initialize it.
            if (event.session.new) {
                eventHandlers.onSessionStarted(event.request, event.session);
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
