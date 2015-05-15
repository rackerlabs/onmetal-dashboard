/* eslint-env node */
'use strict';

var express = require('express');
var router = express.Router();
var config = require('../config');
var _ = require('underscore');

var _getRegions = function () {
  return _.map(config.regions,
    function (services, region) {
      return {
        name: region,
        url: services.ironic.serviceHost
      };
    });
};

/* GET home page. */
router.get('/', function (req, res) {
  res.render('index', {
    title: 'Express',
    regions: _getRegions()
  });
});

module.exports = router;
