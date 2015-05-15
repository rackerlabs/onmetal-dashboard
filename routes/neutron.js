/* eslint-env node */
'use strict';

var util = require('../lib/util'),
  HostCache = require('../lib/hostcache'),
  path = require('path');

var neutron = function (req, res) {
  var region = req.params.region;
  var node_uuid = req.params.node_detail;
  var details_url = path.dirname(req.originalUrl);

  // attempt to find a neutron client, bail out if we fail
  var neutron = util.getNeutronClient(region);
  if (neutron === null) {
    res.send(500, 'No neutron client configured.');
    return;
  }

  var node = HostCache.getNodeCache(region).getNodeByUUID(node_uuid);

  // fetch neutron ports for node
  var params = {};
  if (node.uuid) {
    params['switch:hardware_id'] = node.uuid;
  }

  if (node.instance_uuid) {
    params.device_id = node.instance_uuid;
  }

  neutron.getPorts(params, function (err, resp, body) {
    if (err) {
      res.send(500, 'Couldn\'t load response.<br /><pre>' + err + '</pre><br/>');
      return;
    }

    if (resp.statusCode >= 400 && resp.statusCode < 600) {
      res.send(500, 'Couldn\'t load response.<br /><pre>' + body + '</pre><br/>' +
          'status code: ' + resp.statusCode);
      return;
    }

    var ports = JSON.parse(body).ports;
    res.render('neutron', {
      ports: ports,
      node: node,
      details_url: details_url
    });
    res.end();
  });
};

module.exports = neutron;
