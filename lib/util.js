/* eslint-env node */
'use strict';

var config = require('../config'),
  auth = require('./auth'),
  events = require('events'),
  _ = require('underscore');

var Util = {};

Util._graphiteClients = {};
Util._emitter = new events.EventEmitter();

Util.getEmitter = function () {
  return Util._emitter;
}

/**
 * Formates Date to human-readable string.
 * @returns {string} YYYY-MM-DD Hours:Minutes:Seconds
 */
Util.formatDate = function (date) {
  return date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
};

/**
 * Get the alerts url for the given region.
 *
 * @returns {string} - the alertsUrl.  Undefined if the region has no
 * alertsUrl.
 */
Util.getAlertsUrl = function (region) {
  return (Util.getCredentials(region) || {}).alertsUrl;
};

/**
 * Returns an array of flavors extracted from the `config.flavors`
 * namespace.
 *
 * @returns {array} - returns an array of strings representing the
 *    flavors found in the config file.
 */
Util.getFlavors = function () {
  return _.pluck(config.flavors, 'name');
};

/**
 * Returns an array of moods extracted from the `config.moods`
 * namespace.
 *
 * @returns {array} - returns an array of strings representing the
 *    moods found in the config file.
 */
Util.getMoods = function () {
  return _.pluck(config.moods, 'name');
};

/**
 * Get node's flavor by checking its memory size.
 *
 * @param node - JSON corresponding to an Ironic node
 * @returns {string} Flavor string, must be unique.
 */
Util.getNodeFlavor = function (node) {
  var flavor = null;
  config.flavors.some(function (obj) {
    if (obj.validate(node)) {
      flavor = obj.name;
      return true;
    }
  });

  return flavor;
};

/**
 * Get node's state by filtering on node's provision, error, and instance
 * related properties.
 *
 * @param node - JSON corresponding to an Ironic node
 * @returns {string} Mood string, must be unique.
 */
Util.getNodeMood = function (node) {
  var mood = null;
  config.moods.some(function (obj) {
    if (obj.validate(node)) {
      mood = obj.name;
      return true;
    }
  });

  return mood;
};

/**
 * Get seconds since node's last heartbeat
 *
 * @param node - JSON corresponding to an Ironic node
 * @returns {number} seconds since this node's last heartbeat
 */
Util.getLastHeartbeat = function (node) {
  var now = Math.round(_.now() / 1000);
  var key = 'driver_info';
  if ('driver_internal_info' in node) {
    key = 'driver_internal_info';
  }
  var last_heartbeat = node[key].agent_last_heartbeat;
  if (last_heartbeat === undefined) {
    return null;
  }
  return now - last_heartbeat;
};

/**
 * Extract the information we want from a node
 * @param node - JSON corresponding to an Ironic node
 * @param {string} region
 * @returns {object}
 */
Util.getNodeInfo = function (node, region, alerts_url) {
  // Set up alerts link if an alerts_url is provided
  var alerts_endpoint = null;
  if (alerts_url) {
    alerts_endpoint = alerts_url + '/' + node.instance_uuid;
  }
  var time_since_heartbeat = this.getLastHeartbeat(node);

  var clean_step = node.driver_info.decommission_target_state;
  var driver_info_key = 'driver_info';
  if ('driver_internal_info' in node) {
    driver_info_key = 'driver_internal_info';
    var steps = node.driver_internal_info.clean_steps;
    if (steps && steps.length) {
      clean_step = steps[0];
    }
  }
  clean_step = clean_step || '';

  return {
    uuid: node.uuid,
    instance_id: node.instance_uuid,
    provision_state: node.provision_state,
    power_state: node.power_state,
    target_power_state: node.target_power_state,
    last_error: node.last_error || '',
    maintenance: node.maintenance,
    error: (node.last_error !== null),
    flavor: Util.getNodeFlavor(node),
    agent_url: node[driver_info_key].agent_url,
    clean_step: clean_step,
    hardware_manager_version: node[driver_info_key].hardware_manager_version,
    reservation: node.reservation,
    node_detail: region + '/detail/' + node.uuid,
    alerts_endpoint: alerts_endpoint,
    last_heartbeat: time_since_heartbeat === null ? time_since_heartbeat : time_since_heartbeat + 's ago'
  };
};

/**
 * Gets the associated service object.
 *
 * @param {string} region - the region to check
 * @param {string} type - the service type
 * @returns {object} - the service config from config.js
 */
Util.getServiceConfig = function (region, type) {
  if (!_.has(config.regions, region) || !_.has(config.regions[region], type)) {
    return null;
  }

  return config.regions[region][type];
};

/**
 * Gets the credentials for a region's ironic client.
 *
 * @param {String} region - the region to check
 * @returns {object} - credentials object
 */
Util.getCredentials = function (region) {
  var service = Util.getServiceConfig(region, 'ironic');
  if (!service.credentials) {
    return null;
  }

  return config.credentials[service.credentials];
};

/**
 * Get an Ironic service client for this region
 *
 * @param {String} region - the region to check
 * @returns {object} - Ironic ServiceClient
 */
Util.getIronicClient = function (region) {
  var ironic = Util.getServiceConfig(region, 'ironic');
  return auth.ServiceMapper.getServiceClient(ironic, 'ironic');
};

/**
 * Get an Neutron service client for this region
 *
 * @param {String} region - the region to check
 * @returns {object} - Neutron ServiceClient
 */
Util.getNeutronClient = function (region) {
  var neutron = Util.getServiceConfig(region, 'neutron');
  return auth.ServiceMapper.getServiceClient(neutron, 'neutron');
};

/**
 * Get the Ironic API endpoint for the given node's details
 *
 * @param {String} region - the region this node belongs to
 * @param {String} node_uuid - the uuid of the node to look up
 */
Util.getNodeURL = function (region, node_uuid) {
  var ironic = Util.getServiceConfig(region, 'ironic');
  var stub = auth.ServiceMapper.getServiceEndpoint(ironic, 'ironic');
  return stub + '/nodes/' + node_uuid;
};

/**
 * Set any null values in an object to the value of the replace parameter.
 * This is not a recursive search, and only searches top level values.
 *
 * @param {object} entity - the entity to sanitize
 * @param {any} replace - the value to replace null values with
 * @returns {object}
 */
Util.sanitizeAjaxObject = function (entity, replace) {
  return _
    .chain(entity)
    // take each key-value pair and return the key and value as an array
    // but first sanitize the value if it is falsey to return the `replacement`
    // value.
    .map(function (v, k) { return [k, (v || replace)]; })
    // takes in an array of key-value pairs and transforms it into an object
    .object()
    // return the final JSON object
    .value();
};

/**
 * Checks to see if there is graphite config specified for a given region.
 *
 * @param {String} region - the region
 * @returns {boolean} - if graphite is enabled for this region
 */
Util.isGraphiteEnabled = function (region) {
  return _.has(config.regions[region], 'graphite')
    && _.has(config.regions[region].graphite, 'endpoints')
    && _.has(config.regions[region].graphite.endpoints, 'graphite');
};

/**
 * Gets or creates the graphite client object used to send metrics for a given
 * region.
 *
 * @param {String} region - the region
 * @returns {graphite} - the graphite client
 */
Util.getGraphiteClient = function (region) {
  if (!Util.isGraphiteEnabled(region)) {
    return null;
  }

  if (!(region in Util._graphiteClients)) {
    Util._graphiteClients[region] = require('graphite').createClient(
      config.regions[region].graphite.endpoints.graphite
    );
  }

  return Util._graphiteClients[region];
};

/**
 * Obtains the metrics prefix string from the config for the given region.
 *
 * @param {String} region - the region
 * @returns {String} - the metrics prefix
 */
Util.getMetricsPrefix = function (region) {
  return Util.isGraphiteEnabled(region) ? config.regions[region].graphite.metricsPrefix : null;
};

/**
 * Sends the key-value-pairs of metrics to the graphite server.
 *
 * @param {Object} metrics - the set of metrics to send
 */
Util.sendMetrics = function (region, metrics) {
  if (!Util.isGraphiteEnabled(region)) {
    return;
  }

  Util.getGraphiteClient(region).write(metrics, function (err) {
    if (err) {
      console.error('Failed to send metric: ' + JSON.stringify(err, null, 2));
    }
  });
};

module.exports = Util;
