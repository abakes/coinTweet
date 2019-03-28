'use strict';

var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB.DocumentClient();
var _ = require('lodash');
var moment = require('moment');

exports.handler = function(event, context, callback) {
    console.log('starting');
    var tweetScores = _.map(event.Records, function(record) {
        try {
            return JSON.parse(new Buffer(record.kinesis.data, 'base64').toString('ascii').slice(0, -1));
        }
        catch (e) {
            return undefined;
        }
    });
    return handleRecords(tweetScores)
        .then(shouldSendAlerts)
        .then(callback.bind(null, null))
        .catch(function(err) {
            console.log('Error handling records.', err);
            callback(); // don't block on errors
        });
};

function handleRecords(tweetScores) {
    console.log('handling records', tweetScores);
    var coins = _(tweetScores).map('type').flatten().uniq().value();
    console.log('coins:', coins);
    return Promise.all(_.map(coins, function(coin) {
        var coinScores = _.filter(tweetScores, function(score) {
            return _.includes(score.type, coin);
        });
        if (coinScores.length === 0) {
            console.log('no tweets for coin:', coin);
            return;
        }

        var startTime = _.minBy(coinScores, 'time').time;

        return Promise.all([
            getLiveAverage(coinScores),
            getLastHour(coin, startTime)
        ]).then(function(results) {
            return calculateChange(coin, results[0], results[1]);
        });
    }));
}

function getLiveAverage(coinScores) {
    var results = {
        count: coinScores.length,
        positiveAvg: _.meanBy(coinScores, 'positive'),
        negativeAvg: _.meanBy(coinScores, 'negative'),
        neutralAvg: _.meanBy(coinScores, 'neutral'),
        mixedAvg: _.meanBy(coinScores, 'mixed')
    };
    console.log('live average:', results);
    return Promise.resolve(results);
}

function getLastHour(coin, liveTime) {
    return new Promise(function(resolve, reject) {
        var endTime = moment.utc(liveTime).valueOf();
        var startTime = moment.utc(liveTime).subtract(1, 'hour').valueOf();
        var params = {
            TableName: process.env.DYNAMO_TABLE_NAME,
            KeyConditionExpression: '#key = :coin and #time between :startTime and :endTime',
            ExpressionAttributeNames: {
                '#time': 'startTime',
                '#key': 'coin'
            },
            ExpressionAttributeValues: {
                ':startTime': startTime,
                ':endTime': endTime,
                ':coin': coin
            }
        };
        dynamo.query(params, function(err, data) {
            if (err) {
                reject(err);
                return;
            }

            var binAvg = data.Items;
            var hourAvg = {
                coin: coin,
                count: _.sumBy(binAvg, 'count'),
                positiveAvg: _.meanBy(binAvg, 'positiveAvg'),
                negativeAvg: _.meanBy(binAvg, 'negativeAvg'),
                neutralAvg: _.meanBy(binAvg, 'neutralAvg'),
                mixedAvg: _.meanBy(binAvg, 'mixedAvg')
            };
            console.log('hour average:', hourAvg);
            resolve(hourAvg);
        });
    });
}

function calculateChange(coin, liveAvg, hourAvg) {
    console.log('calculating delta');
    return Promise.resolve({
        coin: coin,
        live: liveAvg,
        countDiff: (liveAvg.count - hourAvg.count) / hourAvg.count * 100,
        positiveDiff: liveAvg.positiveAvg - hourAvg.positiveAvg,
        negativeDiff: liveAvg.negativeAvg - hourAvg.negativeAvg,
        neutralDiff: liveAvg.neutralAvg - hourAvg.neutralAvg,
        mixedDiff: liveAvg.mixedAvg - hourAvg.mixedAvg
    });
}

function shouldSendAlerts(coinChanges) {
    _.forEach(coinChanges, function(change) {
        console.log('coin delta:', change);

        //TODO: real logic here
        var threshold = 10;
        if (change.positiveDiff > threshold || change.negativeDiff < -1 * threshold) {
            sendSMS(change.coin, 'is getting positive');
        }
        else if (change.positiveDiff < -1 * threshold || change.negativeDiff > threshold) {
            sendSMS(change.coin, 'is getting negative');
        }
    });
    return Promise.resolve();
}

function sendSMS(coin, reason) {
    console.log('fake send SMS:', coin, reason);
}
