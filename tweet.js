// Use the Twit module to send tweets ...
require('dotenv').load();
var Twit = require('twit');

var twitterConfig = {
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN_SXWRD,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET_SXWRD
};

var T = new Twit(twitterConfig);



T.post('statuses/update', { status: "Hello World!" }, function(err, data, response) {
    console.log(data)
});