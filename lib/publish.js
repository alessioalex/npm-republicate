"use strict";

var RegClient = require('npm-registry-client'),
    npmConf   = require('npmconf'),
    request   = require('request'),
    os        = require('os'),
    fs        = require('fs'),
    path      = require('path'),
    uuid      = require('uuid'),
    once      = require('once'),
    errTo     = require('errto');

function publish(confData, pkgInfo, tarballUrl, cb) {
  var tmp, npmLogLevels, npmLogger, log;

  tmp            = confData.tmp || os.tmpdir();
  confData.cache = tmp;
  log            = confData.log;
  delete confData.tmp;

  npmLogger    = {};
  npmLogLevels = ['error', 'warn', 'info', 'verbose', 'silly', 'http', 'pause', 'resume'];
  npmLogLevels.forEach(function(level) {
    npmLogger[level] = function() {
      log.debug({
        args            : Array.prototype.slice.call(arguments),
        'npm-log-level' : level
      }, 'npm-registry-client:publish')
    };
  });

  confData.log = npmLogger;

  npmConf.load(confData, function(err, conf) {
    var req, client, auth;

    if (err) { return cb(err); }

    if (!conf.get('_auth')) {
      auth = conf.get('username') + ':' + conf.get('_password');
      conf.set('_auth', new Buffer(auth, 'utf8').toString('base64'));
    }

    cb     = once(cb);
    client = new RegClient(conf);
    req    = request.get(tarballUrl);

    req.on('response', function(res) {
      if (res.statusCode !== 200) {
        return cb(new Error('Bad status code ' + res.statusCode + ' : ' + tarballUrl));
      }

      req.on('error', cb);

      // pause the request until it's actually piped into something
      // when publishing with NPM
      req.pause();
      var reqPipe = req.pipe;
      req.pipe = function() {
        var args = Array.prototype.slice.call(arguments);
        reqPipe.apply(req, args);
        process.nextTick(function() {
          // ok good to go since we actually have something to pipe into
          req.resume();
        });
      }

      pkgInfo['_npmRepublicated'] = 1;

      // TODO: in case there's an error you should make a request to delete
      // the attachment from NPM [or maybe the whole pkg version] ?
      client.publish(pkgInfo, req, cb);
    });
  });
}

module.exports = publish;
