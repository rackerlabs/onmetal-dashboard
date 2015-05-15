/* eslint-env browser */
/* global $:false, io:false, console:false */

$(function() {
  var socket = io();

  // On updating hostcache, data was changed
  socket.on('reload', function() {
    console.log('data was changed, reloading page');
    // disabled until ajax reloads are enabled as per issue #57
    // history.go(0);
  });
});
