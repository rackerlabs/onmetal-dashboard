/* eslint-env node */
'use strict';

var _ = require('underscore'),
  utile = require('utile'),
  util = require('../lib/util');

/**
 * Get and format node details, then render to response object
 *
 * @oaram {object} res - HTTP response object, to be rendered to
 * @oaram {object} node - the node to format and render
 * @oaram {string} region - the region this node belongs to
 */
var getNodeDetail = function (res, node, region) {
  if (!node.driver_info && !node.driver_internal_info) {
    res.send(500, 'Node has no driver_info <br />' + JSON.stringify(node));
    return;
  }

  var time_since_heartbeat = util.getLastHeartbeat(node);
  var alerts_url = util.getAlertsUrl(region);
  if (alerts_url) {
    alerts_url += '/' + node.instance_uuid;
  }

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

  var nodeDetail = {
    links: {
      alerts: alerts_url,
      summary: '/' + region,
      agent: node[driver_info_key].agent_url,
      neutron: utile.format('/%s/detail/%s/neutron', region, node.uuid),
      node: _.find(node.links, function (link) { return link.rel === 'self'; }).href
    },
    overview: {
      uuid: node.uuid,
      instance_id: node.instance_uuid,
      mood: util.getNodeMood(node),
      flavor: util.getNodeFlavor(node),
      power_state: node.power_state,
      error: (node.last_error !== null)
    },
    state: {
      power_state: node.power_state,
      target_power_state: node.target_power_state,
      provision_state: node.provision_state,
      target_provision_state: node.target_provision_state,
      clean_step: clean_step,
      hardware_manager_version: node[driver_info_key].hardware_manager_version,
      provision_updated_at: node.provision_updated_at,
      reservation: node.reservation,
      created_at: node.created_at,
      updated_at: node.updated_at
    },
    error: {
      last_error: node.last_error,
      last_heartbeat: time_since_heartbeat + 's ago',
      console_enabled: node.console_enabled
    },
    maintenance: {
      maintenance_reason: node.maintenance_reason
    },
    ipmi: {
      ipmi_address: node.driver_info.ipmi_address,
      ipmi_username: node.driver_info.ipmi_username,
      ipmi_password: node.driver_info.ipmi_password
    },
    network: {
      agent_url: node[driver_info_key].agent_url,
      ipmi_address: node.driver_info.ipmi_address,
      ports: node.ports,
      links: node.links
    },
    raw: JSON.stringify(node, null, 4)
  };

  res.render('detail', nodeDetail);
  res.end();
};

/**
 * GET request handler for detail page.
 */
var detail = function (req, res) {
  var region = req.params.region;
  var node_uuid = req.params.node_detail;
  var ironic = util.getIronicClient(region);

  ironic.getNode(node_uuid, function (err, resp, body) {
    if (err) {
      res.send(500, 'Couldn\'t load response.<br /><pre>' + err + '</pre><br/>');
      return;
    }

    if (resp.statusCode >= 400 && resp.statusCode < 600) {
      res.send(500, 'Couldn\'t load response.<br /><pre>' + body + '</pre><br/>' +
          'status code: ' + resp.statusCode);
      return;
    }

    var node = JSON.parse(body);
    getNodeDetail(res, node, region);
  });
};

module.exports = detail;
