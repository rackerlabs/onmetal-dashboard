/* eslint-env node */
'use strict';

var request = require('request'),
  pkgcloud = require('pkgcloud'),
  config = require('../config'),
  _ = require('underscore'),
  utile = require('utile');

/**
 * Rackspace Client.
 *
 * @param {object} options - used to specify authentication details for the client.
 *   @param {string} username - the username to authenticate.
 *   @param {string} password - the password to authenticate the user with.
 *   @param {URL} authUrl - the full URL to the authentication service endpoint.
 */
var RackspaceClient = function (options) {
  options = options || {};

  var _auth = {
    username: options.username,
    password: options.password,
    authUrl: options.authUrl
  };

  var _clientType = options.clientType || pkgcloud.providers.rackspace.compute;

  var _client = _clientType.createClient({
    username: _auth.username,
    password: _auth.password,
    authUrl: _auth.authUrl,
    useServiceCatalog: false
  });

  /**
   * Used to make an API call.
   * Authentication is made transparent through this method call
   * and the caller does not need to handle it themselves.
   *
   * @param {URL} endpoint - the URL of the service endpoint.
   * @param {callable} callback - the function to call upon completing a request.
   */
  this.apiCall = function (endpoint, params, callback) {
    params = params || {};

    // this handles authentication, token timeouts, etc. behind the scenes for us.
    // checkout the implementation: https://github.com/pkgcloud/pkgcloud/blob/140b7628/lib/pkgcloud/openstack/client.js#L119
    _client.auth(function (err) {
      if (err) {
        callback(err);
        return;
      }

      var headers = {
        'X-OpenStack-Ironic-Api-Version': 'latest'
      };

      if (_client._identity) {
        var token = _client._identity.token;
        _.extend(headers, {
          'X-Auth-Token': token.id
        });
      }

      request.get({
        qs: params,
        url: endpoint,
        headers: headers
      }, callback);
    });
  };
};

function NoAuthClient() {
  this.auth = function (callback) {
    // callback right away with no error
    callback();
  };
}

/**
 * Fake override of the pkgcloud.providers.openstack.compute.createClient method.
 */
NoAuthClient.createClient = function (params) {
  return new NoAuthClient(params);
};

/**
 * Service Client.
 *
 * A class that allows one to make API requests.
 */
var ServiceClient = function (options) {
  options = options || {};

  this._client = options.client;
  this._version = options.version;
  this._endpoint = options.endpoint;
};

/**
 * A wrapper for performing an HTTP web request which returns the raw HTTP response.
 *
 * @param {string} path - the path of the API call to make including the beginning slash,
 *    but excluding the version. Example: `/nodes/detail.json`
 * @param {callable} callback - a function to call upon completing the API request.
 *    passes params: error, {object} response, {string} body.
 */
ServiceClient.prototype._makeApiCall = function (path, params, callback) {
  return this._client.apiCall(utile.format('%s/v%s%s', this._endpoint, this._version, path), params, callback);
};

/**
 * Ironic Client.
 * Parent class: ServiceClient.
 *
 * This is used for talking to the Ironic API. It explicitly only supports API v1.
 *
 * @param {object} options - accepts an `endpoint` key with a {string} value
 *    that points to the API endpoint URL.
 */
var IronicClient = function (options) {
  options = options || {};

  options.version = 1;

  ServiceClient.call(this, options);
};

utile.inherits(IronicClient, ServiceClient);

IronicClient.prototype.getNodesDetail = function (callback) {
  this._makeApiCall('/nodes/detail.json', null, callback);
};

IronicClient.prototype.getNode = function (uuid, callback) {
  this._makeApiCall('/nodes/' + uuid, null, callback);
};

/**
 * Neutron Client.
 * Parent class: ServiceClient.
 *
 * This is used for talking to the Neutron API. It explicitly only supports API v2.0.
 *
 * @param {object} options - accepts an `endpoint` key with a {string} value
 *    that points to the API endpoint URL.
 */
var NeutronClient = function (options) {
  options = options || {};

  options.version = '2.0';

  ServiceClient.call(this, options);
};

utile.inherits(NeutronClient, ServiceClient);

NeutronClient.prototype.getPorts = function (params, callback) {
  this._makeApiCall('/ports', params, callback);
};

NeutronClient.prototype.getPort = function (uuid, callback) {
  this._makeApiCall('/ports/' + uuid, null, callback);
};

/**
 * Service Mapper.
 *
 * This is a singleton object that manages creation of `ServiceClient` and
 * `RackspaceClient` instances. Instances are created as they are accessed.
 */
var ServiceMapper = function (config) {
  var _credentials = {};
  var _serviceClients = {};
  var _serviceClientTypes = {
    'ironic': IronicClient,
    'neutron': NeutronClient
  };

  /**
   * @returns if the given `credsKey` key exists in the `_credentials` object.
   */
  this.authClientExists = function (credsKey) {
    return _.has(_credentials, credsKey);
  };

  /**
   * Creates an authentication client used to make requests against Rackspace services.
   * If there is already an instance associated with the `credsKey` passed, it will not
   * be recreated.
   *
   * @param {String} credsKey - if this arg is null, the instance created will use an
   *    instance of the `NoAuthClient` instead of the `pkgcloud` compute client.
   * @returns {`RackspaceClient`} - the newly created instance
   */
  this.createAuthClient = function (credsKey) {
    // If we have created the client before, let's not recreate it.
    if (this.authClientExists(credsKey)) {
      return null;
    }

    var params = {};
    if (credsKey === null) {
      // credsKey is null when no authorization is required
      params = { clientType: NoAuthClient };
    } else {
      // combine params with the keys+values in the credentials config
      params = config.credentials[credsKey];
    }

    return new RackspaceClient(params);
  };

  /**
   * Creates a service client of a specified type.
   *
   * @param {String} type - must exist in `_serviceClientTypes`
   * @returns {ServiceClient} - an instance of a `ServiceClient` for the specified type.
   */
  this.createServiceClient = function (service, type) {
    if (this.serviceClientExists(service)) {
      return null;
    }

    return new _serviceClientTypes[type]({
      endpoint: this.getServiceEndpoint(service),
      client: this.getAuthClient(service)
    });
  };

  /**
   * Retrieves the authentication client for the given service or creates it and returns it.
   */
  this.getAuthClient = function (service) {
    var credsKey = (service || {}).credentials;
    if (!this.authClientExists(credsKey)) {
      _credentials[credsKey] = this.createAuthClient(credsKey);
    }

    return _credentials[credsKey];
  };

  /**
   * Gets a ServiceClient for a given service config by the passed type.
   * Creates a ServiceClient instance if it does not exist.
   *
   * @returns {ServiceClient}
   */
  this.getServiceClient = function (service, type) {
    if (!this.serviceClientTypeExists(type)) {
      throw utile.format('ServiceClient %s does not exist!', type);
    }

    var scKey = this.getServiceClientKey(service, type);
    if (!this.serviceClientExists(service, type)) {
      _serviceClients[scKey] = this.createServiceClient(service, type);
    }

    return _serviceClients[scKey];
  };

  /**
   * Gets the service client key in the format `type` + '~' + `service.serviceHost`
   * which can be used as an index into the _serviceClients object.
   *
   * @returns {String} - service client key
   */
  this.getServiceClientKey = function (service, type) {
    if (!service || !_.has(service, 'serviceHost')) {
      return null;
    }

    return utile.format('%s~%s', type, service.serviceHost);
  };

  /**
   * Gets the proper format for the service endpoint.
   *
   * @param {Object} service - the service config object to construct an endpoint from
   * @returns {String} - a URL with the protocol, host, and port matching the specified
   *    service object
   */
  this.getServiceEndpoint = function (service) {
    if (!service || !_.has(service, 'serviceHost', 'serviceProto', 'servicePort')) {
      return null;
    }

    return utile.format('%s://%s:%s', service.serviceProto, service.serviceHost, service.servicePort);
  };

  /**
   * Checks if an instance of `ServiceClient` exists for the specified service and type.
   * @returns {boolean}
   */
  this.serviceClientExists = function (service, type) {
    var key = this.getServiceClientKey(service, type);
    return _.has(_serviceClients, key);
  };

  /**
   * Checks if there is an associate `ServiceClient` type associated with the `serviceName`
   * @returns {boolean}
   */
  this.serviceClientTypeExists = function (serviceName) {
    return !_.isUndefined(_serviceClientTypes[serviceName]);
  };
};

module.exports = {
  ServiceMapper: new ServiceMapper(config)
};
