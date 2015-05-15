'use strict';

var config = require('../config');
var util = require('./util');
var irc = require('irc');
var _ = require('underscore');

var _emitter = util.getEmitter();
var bot = null;

var Bot = function() {
  this.start = function() {
    bot = new irc.Client(config.irc.server, config.irc.nick, config.irc.opts);
  };
}

var goodMoods = _.filter(config.moods, function(mood) {
  return mood.moodType === 'good';
});

var badMoods = _.filter(config.moods, function(mood) {
  return mood.moodType === 'bad';
});

var isInMoods = function(mood, moods) {
  for (var i = 0; i < moods.length; i++) {
    if (mood.indexOf(moods[i].name) !== -1) {
      return true;
    }
  }
  return false;
};

var isBadMood = _.memoize(function(mood) {
  return isInMoods(mood, badMoods);
});

var isGoodMood = _.memoize(function(mood) {
  return isInMoods(mood, goodMoods);
});

var shouldAlert = function(oldMood, newMood) {
  return (isGoodMood(oldMood) && isBadMood(newMood));
};

_emitter.on('mood-change', function(region, node, oldMood, newMood) {
  var nodeUrl = config.dashboardUrl + region + '/detail/' + node['uuid'];
  var moodStr = oldMood + ' -> ' + newMood + '; ' + nodeUrl;
  console.log(region + ': saw mood change: ' + moodStr);
  if (shouldAlert(oldMood, newMood)) {
    bot.say('#teeth-alerts', region + ': node mood changed: ' + moodStr);
  }
});

module.exports = new Bot();
