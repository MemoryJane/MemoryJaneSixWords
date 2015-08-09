/*
 * Module for the Six Words functionality, based on the Alexa spec.
 */
var sixWords = (function () {

    var eventHandlers = {
        onSessionStarted: function (sessionStartedRequest, session) {
            // TODO
            console.log("SESSION STARTED");
        }
    };

    var requestHandlers = {
        LaunchRequest: function (event, context) {
            // TODO
            console.log("LAUNCH REQUEST");
        }
    };

    return {
        execute: function(event, context) {
            console.log("MADE IT INTO THE EXECUTE");

            // TODO: Do we want to check out AppID here?

            // If the session is new, initialize it.
            if (event.session.new) {
                eventHandlers.onSessionStarted(event.request, event.session);
            }

            // Route the request to the right handler.
            var requestHandler = requestHandlers[event.request.type];
            requestHandler.call(this, event, context);
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
