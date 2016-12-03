var EventEmitter = require('events').EventEmitter;
var util = require('util');

Predictor = function (keyword, currency) {

    var self = this;
    EventEmitter.call(self);

    self.keyword = keyword;
    self.currency = currency;

    self.trained = false;
    self.training = false;
    self.ratesClient = null;
    self.twitterClient = null;
    self.weightsLookup = new Array();
    self.tweetsToBeClassified = new Array();
    self.wordFeatures = new Array();

    self.twitterStream;
    self.nextDate;

    self.futureScore = 0;
    self.futureCount = 0;

    this.train = function () {
        self.training = true;
        currentDate = new Date().toISOString().slice(0, 10);
        
        console.log(self.currency+"|"+self.keyword+": Started training" );
        

        // Get all tweets for keyword  until now
        self.twitterClient.get('search/tweets', { q: self.keyword, until: currentDate, result_type: 'recent', count: 100 }, function (err, tweets, response) {

            console.log(self.currency+"|"+self.keyword+": Tweets received" );

            //add tweets to array of not-classified tweets in reverse 
            //TODO: should be a queue

            self.tweetsToBeClassified = tweets.statuses.reverse();
            self.nextDate = new Date(tweets.statuses[0].created_at).toISOString();

            // Get minute candles since timestamp of oldest tweet

            self.ratesClient.getCandlesNow(self.currency, self.nextDate, 'M1', function (error, candles) {

                console.log(self.currency+"|"+self.keyword+": Candles received" );

                //Store Candles & calculate weight for each one (close price - open price) 
                
                self.setIntervalWeights(candles);

                console.log(self.currency+"|"+self.keyword+": Weighting complete" );

                //Set latest candle timestamp as timestamp to get candles from on next run
                self.nextDate = new Date(candles[candles.length - 1].time / 1000).toISOString();

                console.log(self.currency+"|"+self.keyword+": Classifying Tweet Tokens" );

                //Classify pending tweets

                self.classifyTweets();

                console.log(self.currency+"|"+self.keyword+": Classifying Tweet Tokens Complete" );
                console.log(self.currency+"|"+self.keyword+": Listening for new Tweets" );
                
                //Start a Twitter stream for new tweets tracking our keyword
                self.twitterStream = self.twitterClient.stream('statuses/filter', { track: self.keyword });

                //On new tweet, our prediction is calculated based on this and all non-classified tweets
                self.twitterStream.on('data', function (event) {

                    if (event != 'undefined') { // Fix for occasional oanda-adapter hiccup
                        self.futureCount++;
                        self.futureScore = (self.futureScore + self.evaluateTweetResult(event)) / self.futureCount;
                        //Notify clients of prediction
                        self.emit('prediction_update', self.futureScore);
                        self.tweetsToBeClassified.unshift(event);
                    }
                });

                // Periodically poll for new candle
                setInterval(function () {                    
                    self.ratesClient.getCandlesNow(self.currency, self.nextDate, 'M1', function (error, candles) {
                        if (candles.length > 0) {

                            
                            console.log(self.currency+"|"+self.keyword+": New Candle (Training pending tweets with new data)" );

                            //If we get a candle , calculate weight and add it to our data

                            self.setIntervalWeights(candles);

                            //Set timestamp for next run
                            self.nextDate = new Date(candles[candles.length - 1].time / 1000).toISOString();

                            //Classify pending tweets
                            self.classifyTweets();

                            //Reset Prediction data

                            self.futureCount=0;
                            self.futureScore=0;

                            console.log(self.currency+"|"+self.keyword+": New Candle (Training complete)" );

                            //Notify clients
                            self.emit('new_candle', self.weightsLookup[self.weightsLookup.length - 1]);
                        }
                    });
                }, 30000);
                self.trained = true;
                //Notify clients of training complete
                self.emit('trained', self.weightsLookup);

            }, self);
        });
    };
    self.evaluateTweetResult = function (atweet) {

        // Remove numbers & symbols from tweet . We could also strip URLs here as well as stop words
        // Tokenize tweet
        
        tokens = atweet.text.replace(/[^A-Za-z ]/g, '').split(' ');
        var count = 0;
        var score = 0;

        //Average score from tokens in tweet that HAVE a score. the rest do not influence the result
        for (var i = 0, len = tokens.length; i < len; i++) {
            
            if (self.wordFeatures['feat_' + tokens[i]] != undefined) {
                score = score + self.wordFeatures['feat_' + tokens[i]].weight;
                count++;
            }
        }
        if (count == 0) {
            return 0;
        } else {
            return score / count;
        }

    }
    self.setIntervalWeights = function (results) {
        for (var i = 0, len = results.length; i < len; i++) {

            self.weightsLookup.push({ time: results[i].time / 1000000, weight: Math.round((results[i].closeAsk - results[i].openAsk) * 1000000) / 100, candle: results[i] });

        }
    }
    self.classifyTweets = function () {

        var weightsExist = true;


        while ((tweet = self.tweetsToBeClassified.pop()) && weightsExist) {
            
            // Each pending tweet:
            // Remove numbers & symbols from tweet . We could also strip URLs here as well as stop words
            // Tokenize tweet
            tokens = tweet.text.replace(/[^A-Za-z ]/g, '').split(' ');

            for (var i = 0, len = tokens.length; i < len; i++) {

                //get immediate next candle after tweet for weighting
                filtered = self.weightsLookup.filter(function (intervalWeight) {
                    return intervalWeight.time > (new Date(tweet.created_at).getTime()) / 1000;
                });

                //if no next candle exists yet we can't process any more tweets. leave them pending
                if (filtered.length == 0) {
                    self.tweetsToBeClassified.push(tweet);
                    weightsExist = false;
                    break;
                }
                tweetWeight = filtered[0].weight;

                //for each token:
                //if it exists, average new weight with previous data. if not set new weight
                if (tokens[i].trim() != '') {
                    if (self.wordFeatures['feat_' + tokens[i]] != undefined) {
                        self.wordFeatures['feat_' + tokens[i]].weight = (self.wordFeatures['feat_' + tokens[i]].weight * self.wordFeatures['feat_' + tokens[i]].count + tweetWeight) / (self.wordFeatures['feat_' + tokens[i]].count + 1);
                        self.wordFeatures['feat_' + tokens[i]].count++;
                    } else {
                        self.wordFeatures['feat_' + tokens[i]] = { weight: tweetWeight, count: 1 };
                    }
                }
            }
        }
    };
    this.setRatesClient = function (oanda) {
        self.ratesClient = oanda;
    };
    this.setTwitterClient = function (twitter) {
        self.twitterClient = twitter;
    }
};

util.inherits(Predictor, EventEmitter);
module.exports = Predictor;