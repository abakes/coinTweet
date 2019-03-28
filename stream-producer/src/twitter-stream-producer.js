'use strict';

var Twit = require('twit');
var _ = require('lodash');

function TwitterStreamProducer(config, callback) {
    var self = this;
    var T = new Twit(config.twitter);

    self.start = function() {
        var keywords = _.flatMap(Object.keys(config.crypto), function(cur) {
            return config.crypto[cur];
        });
        console.log('filter:', keywords);
        var filters = {
            track: keywords
        };
        var stream = T.stream('statuses/filter', filters);
        stream.on('tweet', function (tweet) {
            callback(tweet);
        });
    };
}

module.exports = TwitterStreamProducer;
