const dbConfig = require("../config/db.config.js");

const mongodb = require("mongodb");
mongodb.Promise = global.Promise;

const db = {};
db.mongodb = mongodb;
db.url = dbConfig.url;
db.tutorials = require("./tutorial.model.js")(mongodb);

module.exports = db;
