/**
 * These are all of the responses for the Six Words app.
 * @type {{getScript}}
 */
var script = (function () {

    var script = {
        LaunchRequest_Reaction: "Welcome to Six Word Stories.",
        LaunchRequest_Instruction: "You can say tell me a story to hear an awesome little six-word story.",

        GivenNews_Reaction: "You have one piece of news.",
        GivenNews_Instruction: "To hear it say yes, to not hear it say no",
        GivingNews_Reaction: "Your news is: %1.",
        GivingNews_Instruction: "You can say tell me a story to hear a story or publish to write your own. " +
        "Which would you like to do?",

        ListenIntentAndBlank_VerbosityKey: { "NOVICE": 5, "MEDIUM": 10 },
        ListenIntentAndBlank_Reaction: "%1 .",
        ListenIntentAndBlank_NOVICE_Instruction: "If you liked that story, you can say, plus one. " +
        "Or you can say tell me a story to hear another story.",
        ListenIntentAndBlank_MEDIUM_Instruction: "Say plus one with reaction, then say your one word reaction. " +
        "Or say publish to create or tell me a story to hear more.",
        ListenIntentAndBlank_EXPERT_Instruction: [
            "What's next?",
            "Now what?",
            "What would you like to do now?"],

        BadState_Instruction: "You can say tell me a story to hear a story or publish to write your own. " +
        "Which would you like to do?",

        UpVoteIntentWithReaction_WithTheReaction: "with the reaction",
        UpVoteIntentWithReactionAndBlank_Reaction: "Oops.",
        UpVoteIntentWithReactionAndBlank_Instruction: "Reactions can only be one word," +
        "and I heard your reaction as %1. " +
        "Try saying, plus one with reaction, followed by your single word reaction.",

        UpVoteIntentAndBlank_Reaction: "Great. I've given the story your plus one %1.",
        UpVoteIntentAndBlank_Instruction: "You can say tell me a story to hear another story.",

        HearReactionsIntentAndBlank_Reaction: "Here's the reactions: %1",
        HearReactionsIntentAndBlank_Instruction: "",
        HearReactionsIntentBadReaction_Reaction: "Sorry.",
        HearReactionsIntentBadReaction_Instruction: "There aren't any reactions for this story yet. " +
        "But you can be first, just say plus one with reaction, and then say your one word reaction.",

        CreateIntentNoStory_Reaction: [
            "Great, let's make a story.",
            "I love creating new stories, let's do it!",
            "Oooh, can't wait to hear your story." ],
        CreateIntentNoStory_Instruction: "Say publish followed by any six words.",

        CreateIntentBadStoryAndBlank_Reaction: [ "Oops.", "Shoot.", "Whoops." ],
        CreateIntentBadStoryAndBlank_Instruction: "I heard you try to publish the following story: %1. " +
        "But our stories require exactly 6 words. Try again. Say publish followed by your six words.",

        CreateIntentGoodStoryAndBlank_Reaction: [ "Cool!", "Sweet!", "Bingo!" ],
        CreateIntentGoodStoryAndBlank_Instruction: "I just want to confirm I heard it right. Did you say %1?",

        YesIntent_Reaction: [
            "Coolio! Your story is saved. I can't wait for other people to hear it.",
            "Coolio! I got your story and I'll share it with other users.",
            "Coolio! You're published." ],
        YesIntent_Instruction: "What would you like to do next? You can publish another story or say tell me a story.",

        YesIntentAllBananaStory_Reaction: "Oh. My. That story was righteous. Gnarly. Most certainly off of any sort ",
        YesIntentAllBananaStory_Instruction: "Of chain. It will be praised through out the ages. You, " +
        "my good friend, are a genius, a scholar, a writer unrivaled in creativity and style. You are without " +
        "question a fancy cat. I am proud to say that you are now a member of. Wait for it. The. Banana. Bandits. " +
        "Congratulations, I bow down to you. What ever could I do to serve one as great as yourself?",

        NoIntent_Reaction: [
            "Oops, sorry about that. Let's try again.",
            "Rats. Give me another shot.",
            "Dang. Sorry, I must have misunderstood you. Let me try again." ],
        NoIntent_Instruction: "Say publish followed by any six words.",

        HelpIntentCreating_Instruction: "To create a story, say publish followed by any six words.",
        HelpIntentCreatedAndBlank_Instruction: "You just published the story %1. Did I hear you correctly",
        HelpIntentHeard_Instruction: "To hear another story say tell me a story.",
        HelpIntent_Reaction: "Welcome to Six Word Stories!",
        HelpIntent_Instruction: "You can say tell me a story to hear an awesome six word story " +
        "or say publish to write your own. What would you like to do?",

        QuitIntent_Instruction: [ "Goodbye.", "Okay, come back soon!", "Ciao!" ],

        Reprompt_Reaction: "Sorry, I didn't understand."
    };


    return {
        /*
         * Gets a piece of script. Returns the script if it is there, or "" if it is not.
         * The verbosityLevel is a number, representing the number of times a user has heard the specific scriptKey,
         * which is used to reduce the verbosity of a key as the user hears it more. This way, the  script controls
         * at which point each script element transitions from one verbosity level to the next.
         */
        getScript: function (scriptKey, scriptPiece, verbosityLevel) {
            // If this scriptKey has a verbosity, we have to check that first.
            if (scriptKey+"_VerbosityKey" in script) {
                if (verbosityLevel <= script[scriptKey+"_VerbosityKey"].NOVICE &&
                    scriptKey+"_NOVICE_"+scriptPiece in script) {
                    scriptKey += "_NOVICE";
                } else if (verbosityLevel <= script[scriptKey+"_VerbosityKey"].MEDIUM &&
                    scriptKey+"_MEDIUM_"+scriptPiece in script) {
                    scriptKey += "_MEDIUM";
                } else if (scriptKey+"_EXPERT_"+scriptPiece in script) {
                    scriptKey += "_EXPERT";
                }
            }

            // If we don't have that key, return an empty string.
            if (!(scriptKey+"_"+scriptPiece in script)) {
                return "";
            }

            var scriptToReturn = script[scriptKey+"_"+scriptPiece];
            // If the script they're looking for is an array, then it has variation and we need to get a random
            // version of the script.
            if (Array.isArray(script[scriptKey+"_"+scriptPiece])) {
                var scriptArrayCount = script[scriptKey+"_"+scriptPiece].length;
                var randomIndex = (Math.floor(Math.random() * scriptArrayCount));
                scriptToReturn = script[scriptKey+"_"+scriptPiece][randomIndex];
            }

            return scriptToReturn;
        }
    }
}) ();

module.exports = script;