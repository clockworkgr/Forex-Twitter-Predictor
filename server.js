// server.js

// modules =================================================
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var predictengine = require('./app/predictor');
var server = require('http').Server(app);
var sio = require('socket.io')(server);
var expressSession = require('express-session');
var MemoryStore = expressSession.MemoryStore;
var sessionKey = 'express.sid';
var sessionStore = new MemoryStore();
var config = require('./config');
var sioCookieParser = require('cookie-parser')(config.session_secret);
var socketMap=[];
var OANDAAdapter = require('oanda-adapter');
var Twitter = require('twitter');

// Setup OANDA API client 
var RatesClient = new OANDAAdapter({    
    environment: config.oanda_env,    
    accessToken: config.oanda_token    
});

// Setup Twitter API client
var TwitterClient = new Twitter({
  consumer_key: config.twitter_cons_key,
  consumer_secret: config.twitter_cons_secret,
  access_token_key: config.twitter_access_key,
  access_token_secret: config.twitter_access_secret
});

//Setup express middlewar (JSON Request Bodies, Session Cookies, Location to serve static content from)
app.use(bodyParser.json());
app.use(expressSession({ store: sessionStore, secret: config.session_secret, key: sessionKey,resave: true,saveUninitialized: true,cookie: {httpOnly: false, secure: false} }));
app.use(express.static(__dirname + '/static'));

// Start Express
server.listen(config.port);
                     
console.log('Server started on port ' + config.port);

//Set up API Route
app.get('/train/:currency/:keyword',function (req, res) {

        // Get a new predictor instance for this currency-pair / keyword combo
        var predictor = new predictengine(req.params.keyword, req.params.currency);

        predictor.setRatesClient(RatesClient);
        predictor.setTwitterClient(TwitterClient);
        //Start Training
        predictor.train();

        //Setup Listeners to push data through socket.io back to the client
        predictor.on('trained', function (data) {
            socketMap[req.sessionID].emit('status', { pair: req.params.currency+"|"+req.params.keyword, trained: true, candles:data.slice(-100) });
        });
        predictor.on('new_candle', function (data) {            
            socketMap[req.sessionID].emit('candles', { pair: req.params.currency+"|"+req.params.keyword, candles: data });
        });
        predictor.on('prediction_update', function (data) {            
            socketMap[req.sessionID].emit('next_prediction', { pair: req.params.currency+"|"+req.params.keyword, prediction: data });
        });
        
        res.send('OK');
    });

//Set up default route    
app.get('/', function (req, res) {
        res.sendFile(__dirname + '/static/index.html');
});


// Share session data between socket.io & express to allow us to send data back to the specific client
sio.use(function(socket, next) {    
    var data=socket.request;
    sioCookieParser(data, {}, function (err) {        
        if (err) {
            console.log(err);
            next(new Error(err));
        } else {            
            sessionStore.load(data.signedCookies[sessionKey], function (err, session) {            
                if (err || !session) {
                    next(new Error(err));
                } else {            
                    data.sessionID = data.signedCookies[sessionKey];
                    data.session=session;
                    next();
                }
            });
        }
    });
});
sio.sockets.on('connection', function (socket) {    
    var hs = socket.request;
    socketMap[hs.sessionID]=socket;    
    console.log('A socket with sessionID ' + hs.sessionID + ' connected!');    
    var intervalID = setInterval(function () {
        hs.session.reload(function () {
            hs.session.touch().save();
        });
    }, 60 * 1000);    
    socket.on('disconnect', function () {
        console.log('A socket with sessionID ' + hs.sessionID + ' disconnected!');        
        clearInterval(intervalID);
    });

});
// expose app           
exports = module.exports = app;                        