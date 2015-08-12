/**
 * These are all of the responses for the Six Words app.
 * @type {{getScript}}
 */
var script = (function () {

    var script = {
        LaunchRequest_Reaction: "Welcome to Six Word Stories.",
        LaunchRequest_Instruction: "You can say tell me a story to hear an awesome little six word story.",

        ListenIntent_Instruction: "If you liked that story, you can say, plus one. " +
        "Or you can say tell me a story to hear another story.",

        BadState_Instruction: "You can say tell me a story to hear a story or publish to write your own. " +
        "Which would you like to do?",

        UpVoteIntentWithReaction_WithTheReaction: "with the reaction",
        UpVoteIntentWithReaction_Reaction: "Oops.",
        UpVoteIntentWithReaction_Instruction: "Reactions can only be one word, and I heard your reaction as %1. " +
        "Try saying, plus one with reaction, followed by your single word reaction.",

        UpVoteIntent_Reaction: "Great. I've given the story your plus one %1.",
        UpVoteIntent_Instruction: "You can say tell me a story to hear another story.",

        HearReactionsIntent_Reaction: "Here's the reactions: ",
        HearReactionsIntent_Instruction: "",
        HearReactionsIntentBadReaction_Reaction: "Sorry.",
        HearReactionsIntentBadReaction_Instruction: "There aren't any reactions for this story yet. " +
        "But you can be first, just say plus one with reaction, and then say your one word reaction.",

        CreateIntentNoStory_Reaction: [
            "Great, let's make a story.",
            "I love creating new stories, let's do it!",
            "Oooh, can't wait to hear your story." ],
        CreateIntentNoStory_Instruction: "Say publish followed by any six words.",

        CreateIntentBadStory_Reaction: [ "Oops.", "Shoot.", "Whoops." ],
        CreateIntentBadStory_Instruction: "I heard you try to publish the following story: %1. " +
        "But our stories require exactly 6 words. Try again. Say publish followed by your six words.",

        CreateIntentGoodStory_Reaction: [ "Cool!", "Sweet!", "Bingo!" ],
        CreateIntentGoodStory_Instruction: "I just want to confirm I heard it right. Did you say %1?",

        YesIntent_Reaction: [
            "Coolio! Your story is saved. I can't wait for other people to hear it.",
            "Coolio! I got your story and I'll share it with other users.",
            "Coolio! You're published." ],
        YesIntent_Instruction: "What would you like to do next? You can publish another story or say tell me a story.",

        NoIntent_Reaction: [
            "Oops, sorry about that. Let's try again.",
            "Rats. Give me another shot.",
            "Dang. Sorry, I must have misunderstood you. Let me try again." ],
        NoIntent_Instruction: "Say publish followed by any six words.",

        HelpIntentCreating_Instruction: "To create a story, say publish followed by any six words.",
        HelpIntentCreated_Instruction: "You just published the story %1. Did I hear you correctly",
        HelpIntentHeard_Instruction: "To hear another story say tell me a story.",
        HelpIntent_Reaction: "Welcome to Six Word Stories!",
        HelpIntent_Instruction: "You can say tell me a story to hear an awesome six word story " +
        "or say publish to write your own. What would you like to do?",

        QuitIntent_Instruction: [ "Goodbye.", "Okay, come back soon!", "Ciao!" ],

        Reprompt_Reaction: "Sorry, I didn't understand."
    };


    return {
        getScript: function(scriptKey, scriptPiece) {
            var scriptToReturn = script[scriptKey+"_"+scriptPiece];

            // If the script they're looking for is an array, then it has variation and we need to get a random
            // version of the script.
            if (script[scriptKey+"_"+scriptPiece] && Array.isArray(script[scriptKey+"_"+scriptPiece])) {
                var scriptArrayCount = script[scriptKey+"_"+scriptPiece].length;
                var randomIndex = (Math.floor(Math.random() * scriptArrayCount));
                scriptToReturn = script[scriptKey+"_"+scriptPiece][randomIndex];
            }

            return scriptToReturn;
        }
    }
}) ();

module.exports = script;