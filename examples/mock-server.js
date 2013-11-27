"use strict";

// set the maxSockets to a reasonable value since they're used
// by npm-registry-client and there's no other way to set this up currently
// this annoyance will be solved in v0.12.x
// var semver = require('semver');
var http = require('http');
// if (!semver.satisfies(process.version, '< 0.11.x') && (http.globalAgent.maxSockets < 100)) {
  http.globalAgent.maxSockets = 300;
// }

var os                = require('os'),
    fse               = require('fs-extra'),
    bunyan            = require('bunyan'),
    republicate       = require('../'),
    createMockServer  = require('../lib/mock-server'),
    port, server, tmpDir, pkgName, pkgVersion, logger;

port   = process.env.PORT || 3333;
// NOTE: this mock server is just for testing && example purposes,
// it shouldn't be used as an NPM registry in production
server = createMockServer(port);
// tmpDir for cache
tmpDir = os.tmpdir() + '/npm-republicator-example';
fse.removeSync(tmpDir);
fse.mkdirsSync(tmpDir);

pkgName    = process.env.PKG || 'request';
pkgVersion = process.env.VER || 'latest';

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
  from     : process.env.FROM || ('http://registry.npmjs.eu/'),
  to       : 'http://localhost:' + port + '/',
  // the following are required when you publish modules with NPM
  username : 'johndoe',
  email    : 'john@doe.npm',
  password : 'roses',
  // passing your bunyan custom logger
  log      : logger
}, function(err) {
  var msg;

  if (err) { throw err; }

  msg =  pkgName + '@' + pkgVersion + ' replicated from http://registry.npmjs.org/';
  msg += ' to http://localhost:' + port + '/ along with its dependencies';

  logger.info(msg);
  // at this point you can see the installed packages at http://localhost:port
  // the tarballs are also available, so you do
  //
  // `npm config set registry http://localhost:3333/`
  // `npm cache clean`
  // `npm install package@version`
  //
  // TADA!!

  // the app will stay alive at this point, but
  // if you want to close it uncomment the line below
  // server.close();
});
