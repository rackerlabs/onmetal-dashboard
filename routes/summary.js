/* eslint-env node */
'use strict';

var express = require('express'),
  util = require('../lib/util'),
  HostCache = require('../lib/hostcache'),
  _ = require('underscore'),
  config = require('../config');

/**
 * Summary Router.
 * Pre-loads given domains in a HostCache and handles GET requests by loading
 * information from the HostCache.
 *
 * @param {object} io - socket.io Server object
 * @returns {express.Router}
 */
var SummaryRouter = function (io) {

  // Pre-caching each region
  _.keys(config.regions).forEach(function (region) {
    var services = config.regions[region];
    _.keys(services).forEach(function (serviceName) {
      // Create a DataCache for every Ironic service
      var service = services[serviceName];
      if (serviceName === 'ironic') {
        HostCache.createNodeCache(service, region, io).updateNodeDetails(io, service, function (error, service) {
          console.log('[' + service.serviceHost + '] error: ' + JSON.stringify(error, null, 2));
        });
      }
    });
  });

  function getBuilder(region) {
    var cache = HostCache.getNodeCache(region);
    var coll = cache.getNodeCollection();
    return coll.get();
  }

  var router = express.Router();

  router.all('*.json', function (req, res, next) {
    res.set('Content-Type', 'application/json');
    next();
  });

  router.get('/ajax/:region/anomalous.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    var nodes = _
      .chain(builder._index)
      .filter(function (index) { return !_.contains(['inactive', 'provisioned', 'clean', 'maintenance', 'deploying'], index.mood); })
      .map(function (index) {
        var node = builder.moods[index.mood].nodes[index.idx];
        var payload = {
          uuid: node.uuid,
          instance_uuid: node.instance_id,
          flavor: node.flavor,
          mood: index.mood,
          power_state: node.power_state,
          provision_state: node.provision_state,
          target_provision_state: node.target_provision_state,
          error: node.last_error
        };

        // setting the html char code `&nbsp;` will fix datatables being
        // unsearchable.
        return util.sanitizeAjaxObject(payload, '&nbsp;');
      })
      .value();

    res.send(JSON.stringify({data: nodes}));
  });

  router.get('/ajax/:region/clean.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    var nodes = _
      .chain(builder.moods.clean.nodes)
      .map(function (node) {
        var clean_step = node.clean_step;
        if ('driver_internal_info' in node) {
          var steps = node.driver_internal_info['clean_steps'];
          if (steps && steps.length) {
            clean_step = steps[0];
          }
        }
        var payload = {
          uuid: node.uuid,
          flavor: node.flavor,
          power_state: node.power_state,
          // hack this to be an empty string if clean_step is still undefined
          clean_step: clean_step || '',
          last_heartbeat: node.last_heartbeat,
          hardware_manager_version: node.hardware_manager_version
        };

        // setting the html char code `&nbsp;` will fix datatables being
        // unsearchable.
        return util.sanitizeAjaxObject(payload, '&nbsp;');
      })
      .value();

    res.send(JSON.stringify({data: nodes}));
  });

  router.get('/ajax/:region/deploying.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    var nodes = _
      .chain(builder.moods.deploying.nodes)
      .map(function (node) {
        var payload = {
          uuid: node.uuid,
          instance_uuid: node.instance_id,
          flavor: node.flavor,
          power_state: node.power_state
        };

        // setting the html char code `&nbsp;` will fix datatables being
        // unsearchable.
        return util.sanitizeAjaxObject(payload, '&nbsp;');
      })
      .value();

    res.send(JSON.stringify({data: nodes}));
  });

  router.get('/ajax/:region/maintenance.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    var nodes = _
      .chain(builder.moods.maintenance.nodes)
      .map(function (node) {
        var payload = {
          uuid: node.uuid,
          instance_uuid: node.instance_id,
          flavor: node.flavor,
          power_state: node.power_state,
          provision_state: node.provision_state,
          error: node.last_error
        };

        // setting the html char code `&nbsp;` will fix datatables being
        // unsearchable.
        return util.sanitizeAjaxObject(payload, '&nbsp;');
      })
      .value();

    res.send(JSON.stringify({data: nodes}));
  });

  router.get('/ajax/:region/provisioned.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    var nodes = _
      .chain(builder.moods.provisioned.nodes)
      .map(function (node) {
        var payload = {
          uuid: node.uuid,
          instance_uuid: node.instance_id,
          flavor: node.flavor,
          power_state: node.power_state,
          provision_state: node.provision_state
        };

        // setting the html char code `&nbsp;` will fix datatables being
        // unsearchable.
        return util.sanitizeAjaxObject(payload, '&nbsp;');
      })
      .value();

    res.send(JSON.stringify({data: nodes}));
  });

  router.get('/ajax/:region/inactive.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    var nodes = _
      .chain(builder.moods.inactive.nodes)
      .map(function (node) {
        var payload = {
          uuid: node.uuid,
          flavor: node.flavor,
          power_state: node.power_state,
          provision_state: node.provision_state
        };

        // setting the html char code `&nbsp;` will fix datatables being
        // unsearchable.
        return util.sanitizeAjaxObject(payload, '&nbsp;');
      })
      .value();

    res.send(JSON.stringify({data: nodes}));
  });

  router.get('/ajax/:region/capacity.json', function (req, res, next) {
    var builder = getBuilder(req.params.region);

    // Create a list of flavor objects with their counts
    var flavors = [];

    _.each(util.getFlavors(), function (flavor) {
      flavors.push({
        'flavor': flavor,
        'provisioned': 0,
        'unavailable': 0,
        'available': 0,
        'total': 0
      });
    });

    _.each(builder._index, function (node) {
      var flavor = _.where(flavors, {'flavor': node.flavor})[0];
      if (_.contains(['provisioned', 'deploying'], node.mood)) {
        flavor['provisioned']++;
      }
      else if (_.contains(['inactive', 'clean', 'deploying', 'deleting'], node.mood)) {
        flavor['available']++;
      }
      else {
        flavor['unavailable']++;
      }
      flavor['total']++;
    });
    res.send(JSON.stringify({data: flavors}));
  });

  // Endpoint for returning raw json
  router.get('/:region.json', function (req, res, next) {
    res.send(JSON.stringify(getBuilder(req.params.region), null, 2));
  });

  /**
   * GET request handler.
   * Gets a HostCache and categorizes node info into a NodeCollection.
   */
  router.get('/:region', function (req, res, next) {
    var region = req.params.region;
    var builder = getBuilder(region);

    // we only want the moods data, not the index data
    var moodsData = builder.moods;
    var regions = _.keys(config.regions);

    res.render('tables', {
      alerts_url: util.getAlertsUrl(region),
      moods: moodsData,
      flavors: util.getFlavors(),
      conf_moods: config.moods,
      conf_flavors: config.flavors,
      metricsPrefix: util.getMetricsPrefix(region),
      graphiteEndpoints: util.isGraphiteEnabled(region) ? config.regions[region].graphite.endpoints : {},
      regions: regions,
      region: region
    });
    res.end();
  });

  return router;
};

module.exports = SummaryRouter;
