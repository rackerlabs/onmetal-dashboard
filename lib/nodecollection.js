/* eslint-env node */
'use strict';

var SimpleDict = require('./simpledict').SimpleDict;

/**
 * Node Collection.
 * This data structure provides a way to store node objects and keep up-to-date
 * metrics on those stored nodes.
 * This data structure is intended to be insert only.
 *
 * @param {Array} moods - an array of strings that describe the possible moods
 * @param {Array} flavors - an array of strings that describe the available flavors
 */
function NodeCollection(moods, flavors) {
  var _map = new SimpleDict();
  var _moods = {};
  var _nodes = {};

  // build the moods structure
  moods.forEach(function (mood) {
    _moods[mood] = {
      nodes: []
    };

    // each mood has a collection of flavors, each of which have an associated count.
    flavors.forEach(function (flavor) {
      _moods[mood][flavor] = {
        count: 0
      };
    });
  });

  /**
   * Checks if a given node exists in the internal data structures.
   * Please note that the indices are constructued from the node's uuid.
   *
   * @param {object} node - the node to lookup.
   * @returns {boolean} - does the node exist in this data structure?
   */
  this.nodeExists = function (node) {
    return _map.has(node.uuid);
  };

  /**
   * Get a node from this NodeCollection by UUID
   *
   * @params {string} node_uuid - the uuid of the node to get
   * @returns {object} - the node object.  Will be an empty dict if the uuid
   *  does not exist in the NodeCollection
   */
  this.getNodeByUUID = function (node_uuid) {
    return _nodes[node_uuid] || {};
  };

  /**
   * Inserts an index based on the node.uuid value. Adds some additional metadata
   * about the node to the index collection to allow retrieval based solely on a node's
   * uuid.
   *
   * @param {object} node - the node object. Needs a uuid field.
   * @param {string} mood - the node's calculated mood.
   * @param {string} flavor - the node's calculated flavor.
   * @param {int} idx - the index in the mood's node array where this object was inserted at
   *    no guarantee to be up to date/accurate if this structure is modified externally.
   */
  var _addIndex = function (node, mood, flavor, idx) {
    _map.set(node.uuid, {
      mood: mood,
      flavor: flavor,
      idx: idx
    });
  };

  /**
   * Adds the given node to the internal data structures and updates
   * internal metadata/counts.
   * This method will silently fail if the node already exists.
   *
   * @param {object} node - the node to add.
   * @param {object} nodeInfo - the node's extracted info.
   */
  this.addNode = function (node, nodeInfo) {
    if (this.nodeExists(node)) {
      return;
    }

    var mood = node.mood;
    var flavor = node.flavor;

    // update the flavor count
    ++_moods[mood][flavor].count;

    // append the node to the related mood's `nodes` array
    _moods[mood].nodes.push(nodeInfo);

    _addIndex(node, mood, flavor, _moods[mood].nodes.length - 1);

    _nodes[node.uuid] = node;
  };

  /**
   * A getter for the moods/_index object.
   *
   * @returns {object} - the moods + _index object
   */
  this.get = function () {
    return {
      moods: _moods,
      _index: _map.getStorageObject()
    };
  };

  /**
   * Getter for _nodes object
   *
   * @returns {object} - mapping between uuids and node objects
   */
  this.getNodes = function () {
    return _nodes;
  };
}

module.exports = NodeCollection;
