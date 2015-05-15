/* eslint-env node */
'use strict';

var auth = require('./auth'),
  _ = require('underscore'),
  NodeCollection = require('../lib/nodecollection'),
  util = require('./util');

/**
 * Data Cache.
 *
 * @param {object} params
 *   @param {int} period - time in milliseconds between requesting updated API information
 *   @param {ServiceClient} service_client - service_client instance to use when requesting data
 *   @param {string} region - the region this DataCache is responsible for
 */
function DataCache(params) {
  var _period = params.period;
  var _region = params.region;
  var _client = params.service_client;

  var _last_update = 0;
  var _coll = new NodeCollection(util.getMoods(), util.getFlavors());
  var _sendingMetrics = util.isGraphiteEnabled(_region);
  var _metricsPrefix = _sendingMetrics ? util.getMetricsPrefix(_region) : null;

  function _getMetricName(flavor, mood) {
    return [_metricsPrefix, _region, flavor, mood].join('.');
  }

  // This is the master key-value object that is copied to create "new" metrics objects
  var _metricsMaster = {};
  if (_sendingMetrics) {
    _.each(util.getFlavors(), function (flavor) {
      _.each(util.getMoods(), function (mood) {
        var namespace = _getMetricName(flavor, mood);
        _metricsMaster[namespace] = 0;
      });
    });
  }

  /**
   * Sets the `_last_update` to the current time in milliseconds.
   */
  var _setLastUpdate = function () {
    _last_update = _.now();
  };

  /**
   * Get this DataCache's stored NodeCollection.
   *
   * @returns {object} - the NodeCollection.
   */
  this.getNodeCollection = function() {
    return _coll;
  };

  /**
   * Calculates the time since this object's data was last updated from
   * the server.
   *
   * @returns {int} - difference in milliseconds since the last update.
   */
  this.getLastUpdate = function () {
    return _.now() - _last_update;
  };

  /**
   * Getter for the `ServiceClient` instance related to this region.
   *
   * @returns {ServiceClient} - an instance of `ServiceClient` related to this region.
   */
  this.getAuthenticationClient = function () {
    return _client;
  };

  /**
   * Compare a list of node data against the cached data, and apply any updates
   * to the DataCache's stored NodeCollection.
   *
   * @param {array} nodes - List of raw node data
   * @returns {boolean} - Whether or not the NodeCollection has changed
   */
  var _updateNodeCollection = function (nodes) {
    var uuids = {};
    var updated = false;
    var metrics = _.clone(_metricsMaster);
    var alerts_url = util.getAlertsUrl(_region);

    // Temperary NodeCollection, don't pollute _coll until update is done
    var coll = new NodeCollection(util.getMoods(), util.getFlavors());

    // Loop through the newly updated nodes
    _.each(nodes, function (node) {
      node.flavor = util.getNodeFlavor(node);
      node.mood = util.getNodeMood(node);

      if (_sendingMetrics) {
        var metricName = _getMetricName(node.flavor, node.mood);
        ++metrics[metricName];
      }

      if (!_coll.nodeExists(node)) {
        // This node is newly added
        updated = true;
      } else if (node.mood !== _coll.getNodeByUUID(node.uuid).mood) {
        // This node has been updated
        var oldNode = _coll.getNodeByUUID(node.uuid);
        util.getEmitter().emit('mood-change', _region, node, oldNode.mood, node.mood);
        updated = true;
      }

      // In either case, add nodes to the temp NodeCollection
      coll.addNode(node, util.getNodeInfo(node, _region, alerts_url));
      uuids[node.uuid] = null;
    });

    // Check for nodes in old _coll but not the new nodes list
    _.each(_.keys(_coll.get()._index), function (uuid) {
      if (!_.has(uuids, uuid)) {
        // This node was just removed -- don't have to add it back.
        updated = true;
      }
    });

    if (_sendingMetrics) {
      util.sendMetrics(_region, metrics);
    }

    _coll = coll;
    return updated;
  };

  /**
   * Async call to update the internal array of node objects.
   *
   * @param {object} io - socket.io Server object
   * @param {object} service - the service object from config
   * @param {callable} callback - the callable to call. Passes a single param `error`
   *    which can be checked for success. `error` is `false` if no error was encountered.
   */
  this.updateNodeDetails = function (io, service, callback) {
    var nodes = [];
    var error = false;

    // GET request to the Ironic API (via the Ironic service client)
    _client.getNodesDetail(function (err, resp, body) {
      if (err) {
        error = { msg: 'Error retrieving node details from Ironic API', err: err,
                  class: 'datacache', method: '_retrieveNodeDetails' };
        callback(error, service);
        return;
      }

      try {
        nodes = JSON.parse(body).nodes;
      } catch (jsonErr) {
        error = { msg: 'Error parsing JSON from Ironic API response', err: jsonErr,
                  class: 'datacache', method: '_retrieveNodeDetails' };
        callback(error, service);
        return;
      }

      _setLastUpdate();

      // Update this DataCache's NodeCollection, and check if it's changed
      var updated = _updateNodeCollection(nodes);
      if (updated) {
        console.log('page updated - reloading');
        io.emit('reload');
      }

      callback(false, service);
    });
  };

  /**
   * Gets a node from the hostcache by uuid.
   *
   * @param {String} node_uuid - the uuid to search for
   * @returns {object} node
   */
  this.getNodeByUUID = function (node_uuid) {
    return _coll.getNodeByUUID(node_uuid);
  };

  /**
   * Determines if the current data is stale by checking when the
   * data was last updated.
   *
   * @returns {boolean} - if the current data is stale
   */
  this.isDataStale = function () {
    return this.getLastUpdate() >= _period;
  };

  /**
   * Returns the collection of node objects previously retrieved from the Ironic API.
   * This is the cached version of the nodes and is not guaranteed to
   * be up to date. This means that even though the `period` may be set to 5000ms,
   * the data is not necessarily always the most recent.
   *
   * @returns {Array} - the collection of node objects from the Ironic API
   */
  this.getNodes = function () {
    return _.values(_coll.getNodes());
  };
}

/**
 * Host Cache.
 * A mapping between hosts and their respective cache.
 */
function HostCache() {
  var _hosts = {};

  /**
   * Makes an async call to update the node details on the passed cache instance.
   *
   * @param {DataCache} cache - the cache to update
   * @param {object} service - the service object from config
   * @param {object} io - socket.io Server object
   */
  this.updateNodes = function (cache, service, io) {
    cache.updateNodeDetails(io, service, function (err, service) {
      if (err) {
        console.log('Error on auto refresh');
        console.log('Host in error should be: ' + service.serviceHost);
        console.log(err);
      }
    });
  };

  /**
   * Checks to see if a node cache exists for the specified region.
   *
   * @param {String} region - the region to check
   * @returns {boolean}
   */
  this.nodeCacheExists = function (region) {
    return _.has(_hosts, region);
  };

  /**
   * Create a cache and set up authentication client for one region.
   *
   * @param {object} service - service object from config
   * @param {String} region - the region for the node cache
   * @param {object} io - socket.io Server object
   *
   * @returns {object} - the newly created DataCache.  If no DataCache is
   *    created (one already exists), return null.
   */
  this.createNodeCache = function (service, region, io) {
    if (this.nodeCacheExists(region)) {
      return null; // don't re-create cache
    }

    // We don't have a cache for this region yet, so make one
    var _period = service.refreshRate || 5 * 1000;
    _hosts[region] = new DataCache({
      service_client: auth.ServiceMapper.getServiceClient(service, 'ironic'),
      period: _period,
      region: region
    });

    // Set up the refresh loop
    setInterval(this.updateNodes, _period, _hosts[region], service, io);

    return _hosts[region];
  };

  /**
   * Retrieves the DataCache for the provided region.
   * Creates the DataCache if it does not exist, and starts the
   * timed interval for updating the data.
   *
   * @param {string} region - the region to perform a lookup on
   * @returns {DataCache} - returns the associated DataCache instance
   */
  this.getNodeCache = function (region) {
    if (!this.nodeCacheExists(region)) {
      throw 'Cache does not exist for region: ' + region + '!';
    }

    return _hosts[region];
  };
}

module.exports = new HostCache();
