/* eslint-env node */
'use strict';

var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');

var routes = require('./routes/index');
var SummaryRouter = require('./routes/summary');
var detail = require('./routes/detail');
var neutron = require('./routes/neutron');

var app = express();

/**
 * Bootstrap the config to copy over defaults for values that are not overridden.
 */
var _ = require('underscore');

_.deepObjectExtend = function (target, source) {
  _.keys(source).forEach(function (prop) {
    if (_.has(target, prop)) {
      _.deepObjectExtend(target[prop], source[prop]);
    } else {
      target[prop] = source[prop];
    }
  });

  return target;
};

_.deepObjectExtend(require('./config.js'),
                   require('./config.sample.js'));
/**
 * End of config bootstrapping.
 */

// spin up irc
var config = require('./config.js');
var bot = require('./lib/bot');
if (config.irc.enabled) {
  bot.start();
}


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.use('/', routes);
app.get('/:region/detail/:node_detail/neutron', neutron);
app.get('/:region/detail/:node_detail', detail);
app.use('/', new SummaryRouter(io));

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    // console.log(err);
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
    // next();
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
  // next();
});
app.set('port', process.env.PORT || 9000);

server.listen(app.get('port'));
