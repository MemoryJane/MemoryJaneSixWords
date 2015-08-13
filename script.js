/**
 * These are all of the responses for the Six Words app.
 * @type {{getScript}}
 */
var script = (function () {

    var script = {
        LaunchRequest_Reaction: "Welcome to Six Word Stories.",
        LaunchRequest_Instruction: "You can say tell me a story to hear an awesome little six-word story.",

        LaunchRequestThemePrompt_Reaction: "Welcome to Six Word Stories.",
        LaunchRequestThemePrompt_Instruction: "We have a theme to our stories today. We're encouraging fans to " +
        "publish a story that %1. Would you like to hear a few of these stories?",

        GivenNews_Reaction: "Welcome back! You have news.",
        GivenNews_Instruction: "Would you like to hear your news?",
        GivingNews_Reaction: "%1.",
        GivingNews_Instruction: "You can say tell me a story to hear a story or publish to write your own. " +
        "Which would you like to do?",
        NewsPreamble_YouGotAComment: "You received a comment. %1. On your story.",
        NewsPreamble_YouGotAnUpVote: "You received a plus one on your story.",

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
        CreateIntentNoStory_Instruction: [
            "Say publish followed by any six words.",
            "Just say publish followed by six words",
            "Say publish then any six words"],

        CreateIntentThemePrompt_Reaction: [
            "Oooh, good news. We have a theme today. You should make a theme story!",
            "We have a theme today! Help us make more theme stories.",
            "It's a theme story day."],
        CreateIntentThemePrompt_Instruction: "Say publish followed by any six words. And if you want to follow the" +
        "theme, make sure your story %1.",

        CreateIntentBadStoryAndBlank_Reaction: [ "Oops.", "Shoot.", "Whoops.", "Darn" ],
        CreateIntentBadStoryAndBlank_Instruction: "I heard you try to publish the following story: %1. " +
        "But our stories require exactly 6 words. Try again. Say publish followed by your six words.",

        CreateIntentGoodStoryAndBlank_Reaction: [ "Cool!", "Sweet!", "Bingo!", "Great story!" ],
        CreateIntentGoodStoryAndBlank_Instruction:[
            "I just want to confirm I heard it right. Did you say %1?",
            "I just want to make sure I heard that right. Did you say %1?",
            "Just to confirm, did you say %1?"],

        CreateIntentGoodStoryWithThemeAndBlank_Reaction: [
            "Nice! You matched our theme for the day. Good job!",
            "Very cool! You even matched our theme for the day. Well done."],
        CreateIntentGoodStoryWithThemeAndBlank_Instruction: [
            "I just want to confirm I heard it right. Did you say %1?",
            "I just want to make sure I heard that right. Did you say %1?",
            "Just to confirm, did you say %1?"],

        YesIntent_VerbosityKey: { "NOVICE": 5, "MEDIUM": 20 },
        YesIntent_Reaction: [
            "Coolio! Your story is saved. I can't wait for other people to hear it.",
            "Coolio! I got your story and I'll share it with other users.",
            "Coolio! You're published." ],
        YesIntent_NOVICE_Instruction: "What would you like to do next? You can say publish to publish a story " +
        "or say tell me a story to hear a story.",
        YesIntent_MEDIUM_Instruction: "What would you like to do next? You can publish another story or say tell me a story.",
        YesIntent_EXPERT_Instruction: "What do you want to do next?",

        YesIntentHearThemeStories_VerbosityKey: { "NOVICE": 5, "MEDIUM": 20 },
        YesIntentHearThemeStories_Reaction: "Excellent, here's some theme stories for you. . %1",
        YesIntentHearThemeStories_NOVICE_Instruction: "What would you like to do next? You can say publish to publish a story " +
        "or say tell me a story to hear a story.",
        YesIntentHearThemeStories_MEDIUM_Instruction: "What would you like to do next? You can publish another story or say tell me a story.",
        YesIntentHearThemeStories_EXPERT_Instruction: "What do you want to do next?",

        YesIntentAllBananaStory_Reaction: "Oh. My. That story was righteous. Gnarly. Most certainly off of any sort "+
        "of chain. It will be praised through out the ages. You, " +
        "my good friend, are a genius, a scholar, a writer unrivaled in creativity and style. You are without " +
        "question a fancy cat. I am proud to say that you are now a member of. Wait for it. The. Notorious. Banana. " +
        "Bandits. Congratulations, I bow down to you. What ever could I do to serve one as great as yourself?",
        YesIntentAllBananaStory_Instruction: "Would you like to create another story?",

        NoIntent_Reaction: [
            "Oops, sorry about that. Let's try again.",
            "Rats. Give me another shot.",
            "Dang. Sorry, I must have misunderstood you. Let me try again.",
            "My bad, I must have misheard you. Let me try again."],
        NoIntent_Instruction: "Say publish followed by any six words.",
        NoIntentNews_Reaction: [
            "No problem.",
            "I agree, who needs news?",
            "Okay, no news for you."],
        NoIntentNews_Instruction: "You can say tell me a story to hear a story or publish to write your own. " +
        "Which would you like to do?",
        NoIntentHearThemeStories_Reaction: [
            "Bummer, that's a cool theme bro.",
            "Okay, no problem, check back tomorrow. Maybe you'll like that theme better.",
            "Alright, no theme stories."],
        NoIntentHearThemeStories_Instruction: "You can say tell me a story to hear a story or publish to write your own. " +
        "Which would you like to do?",

        HelpIntentCreating_Instruction: "To create a story, say publish followed by any six words.",
        HelpIntentCreatedAndBlank_Instruction: "You just published the story %1. Did I hear you correctly",
        HelpIntentHeard_Instruction: "To hear another story say tell me a story.",
        HelpIntent_Reaction: "Welcome to Six Word Stories!",
        HelpIntent_Instruction: "You can say tell me a story to hear an awesome six word story " +
        "or say publish to write your own. What would you like to do?",

        QuitIntent_Instruction: [
            "Goodbye.",
            "Okay, come back soon!",
            "Ciao!",
            "See you later alligator!",
            "Smell you later!" ],

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