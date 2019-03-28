'use strict';

var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB.DocumentClient();
var s3 = new AWS.S3();
var readline = require('readline');
var _ = require('lodash');

exports.handler = function(event, context, callback) {
    var  srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey    = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    return download(srcBucket, srcKey)
        .then(calculate)
        .then(saveToDynamo)
        .then(callback.bind(null, null))
        .catch(function(err) {
            console.log(`Failed to process ${srcBucket}/${srcKey} due to: ${err}`);
            callback(err);
        });
};

function download(bucket, key) {
    return new Promise(function(resolve, reject) {
        var list = [];
        var s3Stream = s3.getObject({Bucket: bucket, Key: key}).createReadStream();
        s3Stream.on('error', reject);
        var reader = readline.createInterface({input: s3Stream});
        console.log('beginning download from s3');
        reader.on('line', function (stringLine) {
            list.push(JSON.parse(stringLine));
        }).on('close', function () {
            resolve(list);
        });
    });
}

function calculate(tweetScores) {
    console.log('calculating average');
    var coins = _(tweetScores).map('type').flatten().uniq().value();
    return _.map(coins, function(coin) {
        var coinScores = _.filter(tweetScores, function(score) {
            return _.includes(score.type, coin);
        });

        var results = {
            coin: coin,
            startTime: _.minBy(coinScores, 'time').time,
            endTime: _.maxBy(coinScores, 'time').time,
            count: coinScores.length,
            positiveAvg: _.meanBy(coinScores, 'positive'),
            negativeAvg: _.meanBy(coinScores, 'negative'),
            neutralAvg: _.meanBy(coinScores, 'neutral'),
            mixedAvg: _.meanBy(coinScores, 'mixed')
        };
        console.log(results);
        return results;
    });
}

function saveToDynamo(records) {
    console.log('saving to dynamo');
    return Promise.all(_.map(records, function(record) {
        return new Promise(function(resolve, reject) {
            var putParams = {
                TableName: process.env.DYNAMO_TABLE_NAME,
                Item: record,
                ConditionExpression: 'attribute_not_exists(coin) AND attribute_not_exists(startTime)'
            };
            dynamo.put(putParams, function(putError) {
                if (putError) {
                    reject(putError);
                }
                else {
                    resolve();
                }
            });
        });
    })) ;
}
