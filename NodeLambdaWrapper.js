// Load the environment variables for the DB.
require('dotenv').load();

console.log(process.env);

// Get the node-lambda module.
var nodeLambda = require("../node-lambda/lib/main");

// Run it with index.handler.
nodeLambda.run({"handler":"index.handler"});
