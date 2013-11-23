"use strict";

// ex:
// node cli.js | bunyan -o short

// set the maxSockets to a reasonable value since they're used
// by npm-registry-client and there's no other way to set this up currently
// this annoyance will be solved in v0.12.x
var semver = require('semver');
var http = require('http');
if (!semver.satisfies(process.version, '< 0.11.x') && (http.globalAgent.maxSockets < 100)) {
  http.globalAgent.maxSockets = 100;
}

var os                = require('os'),
    fse               = require('fs-extra'),
    bunyan            = require('bunyan'),
    republicate       = require('../'),
    port, tmpDir, pkgName, pkgVersion, logger, to, from;

// tmpDir for cache
tmpDir = os.tmpdir() + '/npm-republicator-example';
fse.removeSync(tmpDir);
fse.mkdirsSync(tmpDir);

port       = process.env.PORT || 2013;
pkgName    = process.env.PKG  || 'express';
pkgVersion = process.env.VER  || 'latest';
to         = process.env.TO   || 'http://localhost:' + port + '/';
from       = process.env.FROM || 'http://registry.npmjs.eu';

logger     = bunyan.createLogger({
  name   : 'app',
  stream : process.stdout,
  level  : 'info'
});

republicate({
  name    : pkgName,
  version : pkgVersion
}, {
  cacheDir : tmpDir,
  from     : from,
  to       : to,
  // the following are required when you publish modules with NPM
  username : 'johndoe',
  email    : 'john@doe.npm',
  password : 'roses',
  // passing your bunyan custom logger
  log      : logger
}, function(err) {
  var msg;

  if (err) { throw err; }

  msg =  pkgName + '@' + pkgVersion + ' replicated from ' + from;
  msg += ' to ' + to + ' along with its dependencies';

  logger.info(msg);
});
