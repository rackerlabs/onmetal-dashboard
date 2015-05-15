/* eslint-env node */
'use strict';

/**
 * Simple Dict.
 *
 * Simple wrapper on top of a JavaScript Object that allows for the typical
 * methods provided by a HashMap interface.
 *
 * Keys are taken in as is and are not hashed by this implementation.
 */
function SimpleDict() {
  var _map = {};

  /**
   * Retrieves the value associated with this key. Returns undefined if the
   * key does not exist.
   *
   * @param {Object} key - this key can be of any type
   * @returns {boolean} - the value
   */
  this.get = function (key) {
    return _map[key];
  };

  /**
   * Checks to see if a given key exists.
   *
   * @param {Object} key - this key can be of any type
   * @returns {boolean} - if the key exists
   */
  this.has = function (key) {
    return (key in _map);
  };

  /**
   * Sets a given key to a given value.
   *
   * @param {Object} key - the key to index on
   * @param {Object} data - the data to store
   */
  this.set = function (key, data) {
    _map[key] = data;
  };

  /**
   * Fetches the underlying object used to store the key-value pairs.
   *
   * @returns {Object}
   */
  this.getStorageObject = function () {
    return _map;
  };
}

module.exports.SimpleDict = SimpleDict;
