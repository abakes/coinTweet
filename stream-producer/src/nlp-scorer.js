'use strict';

var AWS = require('aws-sdk');
var _ = require('lodash');

function NlpScorer(config) {
    var self = this;
    var awsComprehend = new AWS.Comprehend({region: config.aws.region});

    self.getSentimentScore = function(text, language) {
        return new Promise(function(resolve, reject) {
            var params = {
                LanguageCode: language,
                Text: text
            };
            awsComprehend.detectSentiment(params, function(err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(transformScore(data));
                }
            });
        });
    };

    function transformScore(awsSentiment) {
        return {
            sentiment: awsSentiment.Sentiment,
            positive: parseFloat((awsSentiment.SentimentScore.Positive * 100).toFixed(2)),
            negative: parseFloat((awsSentiment.SentimentScore.Negative * 100).toFixed(2)),
            neutral: parseFloat((awsSentiment.SentimentScore.Neutral * 100).toFixed(2)),
            mixed: parseFloat((awsSentiment.SentimentScore.Mixed * 100).toFixed(2))
        };
    }
}

module.exports = NlpScorer;
