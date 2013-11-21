"use strict";

var uuid         = require('uuid'),
    crypto       = require('crypto'),
    _            = require('lodash'),
    os           = require('os'),
    fs           = require('fs'),
    fse          = require('fs-extra'),
    errTo        = require('errto'),
    once         = require('once'),
    after        = require('after'),
    assert       = require('assert'),
    http         = require('http'),
    request      = require('request'),
    PkgInfo      = require('npm-pkginfo'),
    findPort     = require('portfinder').getPort,
    createServer = require('../lib/mock-server'),
    republicate  = require('../'),
    shasums      = require(__dirname + '/fixtures/shasums.json'),
    packages     = require(__dirname + '/fixtures/pkgdata.json'),
    noop         = function(){},
    silentLogger, osTmpDir, tarballsDir, pkgsTmp, packagesNames,
    pkgsTmp2, pkgVersions, pkgVersionsLength;

function die(err) {
  cleanUp(function(err2) {
    throw err;
  });
}

function compareSha(stream, expectedSha, msg, cb) {
  var shasum;

  cb = once(cb);

  shasum = crypto.createHash('sha1');

  stream.on('data', function(chunk) {
    shasum.update(chunk);
  });

  stream.on('error', cb);

  stream.on('end', function() {
    var finalSha;

    finalSha = shasum.digest('hex');
    assert.equal(finalSha, expectedSha, msg);
    cb();
  });
}

// set the maxSockets to a reasonable value since they're used
// by npm-registry-client and there's no other way to set this up currently
if (http.globalAgent.maxSockets < 100) {
  http.globalAgent.maxSockets = 100;
}

// pkgVersions used for determining the number of iterations passed to the
// after cb function
pkgVersionsLength = 0;
pkgVersions = {};
packagesNames = Object.keys(packages);
packagesNames.forEach(function(name) {
  Object.keys(packages[name].versions).forEach(function(version) {
    if (!pkgVersions[name + '-' + version]) {
      pkgVersions[name + '-' + version] = name;
      pkgVersionsLength++;
    }
  });
});

osTmpDir    = os.tmpdir();
// create temporary folders to store tarballs
tarballsDir = osTmpDir + '/republicator-tmpdir';
// temp file for pkgs data
pkgsTmp     = osTmpDir + '/republicator-pkgdata';
pkgsTmp2    = osTmpDir + '/republicator-pkgdata2';

function cleanUp(cb) {
  var next, folders;

  folders = [tarballsDir, pkgsTmp, pkgsTmp2];
  next = after(folders.length, errTo(die, cb));

  folders.forEach(function(folder) {
    fse.remove(folder, errTo(next, function() {
      fse.mkdirs(folder, next);
    }));
  });
}

cleanUp(function() {
  findPort(errTo(die, function(port) {
    var masterRegistry, cloneRegistry, npmClient;

    masterRegistry = createServer(port, packages, __dirname + '/fixtures/tarballs');

    findPort(errTo(die, function(port2) {
      cloneRegistry  = createServer(port2, null, tarballsDir);

      silentLogger = {};
      ['debug', 'warn', 'info', 'error'].forEach(function(method) {
        silentLogger[method] = noop;
      });

      // publish the dep chain for express
      republicate({
        name    : 'express',
        version : '3.1.2'
      }, {
        cacheDir : pkgsTmp,
        from     : 'http://localhost:' + port + '/',
        to       : 'http://localhost:' + port2 + '/',
        username : 'johndoe',
        email    : 'john@example.com',
        password : 'johndoe',
        log      : silentLogger
      }, errTo(die, function() {
        var next;

        // Modules replicated from http://localhost:{port}/ to http://localhost:{port2}/

        // checking for 2 things:
        // - tarball checksum for each package version
        // - package data for each package
        next = after(pkgVersionsLength + packagesNames.length, errTo(die, function() {
          masterRegistry.close();
          cloneRegistry.close();
          cleanUp(function() {
            process.exit();
          });
        }));

        // filename format: <MODULENAME>-<VERSION>
        // ex: once-1.2.3
        Object.keys(pkgVersions).forEach(function(filename) {
          var url, pkgName;

          pkgName = pkgVersions[filename];
          url     = 'http://localhost:' + port2 + '/' + pkgName + '/-/' + filename + '.tgz';

          // for each package make sure the shasum of the original package corresponds
          // to the shasum of the republished package
          compareSha(request(url), shasums[filename], 'asserting sha for ' + filename, next);
        });

        // used for verifying package data for the clone registry
        npmClient = new PkgInfo({
          REGISTRY_URL : 'http://localhost:' + port2 + '/',
          cacheStore   : new PkgInfo.stores.fs({ dir: pkgsTmp2 })
        });
        packagesNames.forEach(function(name) {
          npmClient.get(name, errTo(die, function(pkgData) {
            var originalVersions, expectedVersions, msg;

            originalVersions = Object.keys(packages[name].versions).sort();
            expectedVersions = Object.keys(pkgData.versions).sort();
            msg = 'comparing versions for package ' + name;

            assert.deepEqual(originalVersions, expectedVersions, msg);
            next();
          }));
        });

      }));
    }));
  }));
});
