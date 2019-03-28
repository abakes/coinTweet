'use strict';

var AWS = require('aws-sdk');
var TwitterStreamProducer = require('./twitter-stream-producer');
var NlpScorer = require('./nlp-scorer');
var _ = require('lodash');

var localTwitterCreds = require('../../twitter-credentials.js');

function App() {
    var self = this;
    var config = {
        aws: {
            region: 'us-east-1',
            kinesisStreamName: process.env.STREAM_NAME || 'nlp-scored-tweets-production'
        },
        twitter: {
            consumer_key: process.env.TWITTER_CONSUMER_KEY || localTwitterCreds.consumer_key,
            consumer_secret: process.env.TWITTER_CONSUMER_SECRET || localTwitterCreds.consumer_secret,
            access_token: process.env.TWITTER_ACCESS_TOKEN || localTwitterCreds.access_token,
            access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET || localTwitterCreds.access_token_secret
        },
        crypto: {
            BTC: ['bitcoin', 'btc'],
            ETH: ['ethereum', 'etc']
        }
    };

    var twitter = new TwitterStreamProducer(config, handleTweet);
    var nlpScorer = new NlpScorer(config);
    var kinesis = new AWS.Kinesis({region: config.aws.region});

    function handleTweet(tweet) {
        var text = tweet.text;
        if (tweet.retweeted_status) {
            var retweet = tweet.retweeted_status;
            text = retweet.truncated ? retweet.extended_tweet.full_text : retweet.text;
        }
        else if (tweet.truncated) {
            text = tweet.extended_tweet.full_text;
        }

        Promise.all([
            nlpScorer.getSentimentScore(text, tweet.lang),
            getCurrencyCode(text)
        ]).then(function(results) {
            var record = results[0];
            // record.text = text; //TODO: do we want/need to store the tweet?
            record.type = results[1];
            record.time = Date.now();
            return save(record);
        }).then(function() {
            // done
            console.log('SUCCESS', text);
        }).catch(function(err) {
            console.log('ERROR', err);
        });
    }

    function getCurrencyCode(text) {
        return new Promise(function (resolve) {
            var searchText = _.lowerCase(text);
            var currencies = [];
            var currency = Object.keys(config.crypto);
            _.forEach(currency, function(key) {
                var keywords = config.crypto[key];
                var length = keywords.length;
                while(length--) {
                    if (searchText.indexOf(keywords[length]) !== -1) {
                        currencies.push(key);
                        break;
                    }
                }
            });
            resolve(currencies);
        });
    }

    function save(record) {
        return new Promise(function(resolve, reject) {
            var params = {
                StreamName: config.aws.kinesisStreamName,
                PartitionKey: 'all-coins',
                Data: JSON.stringify(record) + '\n'
            };
            kinesis.putRecord(params, function(err, data) {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
    }

    self.run = function() {
        twitter.start();
    };
}

module.exports = App;

new App().run();