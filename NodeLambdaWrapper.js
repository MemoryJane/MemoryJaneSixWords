// Get the node-lambda module.
var nodeLambda = require("../node-lambda/lib/main");

// Run it with index.handler.
nodeLambda.run({"handler":"index.handler"});
