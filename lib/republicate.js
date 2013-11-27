"use strict";
 
var getDeps  = require('npm-dep-chain'),
    semver   = require('semver'),
    _        = require('lodash'),
    PkgInfo  = require('npm-pkginfo'),
    errTo    = require('errto'),
    after    = require('after'),
    utils    = require('./utils'),
    logger   = require('./logger'),
    publish  = require('./publish');

function asyncErr(cb, msg) {
  process.nextTick(function() {
    return cb(msg);
  });
}

/**
 * pkg = { name: , version }
 * opts = { to: , from: , npmClient: , [cacheDir]: ..}
 */
function replicateModule(pkg, opts, cb) {
  var npmClient, i, required, field, log, version, npmConf, pendingPackages;

  pendingPackages = {};
  log = opts.log || logger;

  required = ['to', 'username', 'password', 'email'];
  for (i = 0; i < required.length; i++) {
    field = required[i];
    if (!opts[field]) {
      return asyncErr(cb, 'must provide "' + field + '" param ');
    }
  }

  if (!pkg || !pkg.name) {
    return asyncErr(cb, 'must provide package name');
  }

  if (!opts.npmClient) {
    if (!opts.cacheDir) {
      return asyncErr(cb, "You must supply either the npmClient or the cacheDir");
    }
    npmClient = new PkgInfo({
      REGISTRY_URL : opts.from || 'http://registry.npmjs.org',
      cacheStore   : new PkgInfo.stores.fs({ dir: opts.cacheDir })
    });
  } else {
    npmClient = opts.npmClient;
  }

  npmConf = {
    registry  : opts.to,
    tmp       : opts.tmp,
    username  : opts.username,
    _password : opts.password,
    email     : opts.email,
    log       : log
  };

  version = pkg.version || 'latest';

  log.debug({
    npmConf: npmConf
  }, 'conf');

  npmClient.get(pkg.name, errTo(cb, function(pkgData) {
    var pkgVersions, republicateNext;

    pkgVersions = utils.getSortedVersions(Object.keys(pkgData.versions));

    // if you don't want to republicate the module with all its versions
    // but a specific version
    if (!opts.all) {
      pkgVersions = [version];
    }

    // TODO: make request to TO registry to get the versions diff
    log.info({
      versions: pkgVersions
    }, 'Republicating versions for ' + pkg.name);

    republicateNext = function(err) {
      var version;

      if (err) { return cb(err); }

      version = pkgVersions.shift();

      if (!version) { return cb(); }

      getDeps({
        name    : pkg.name,
        version : version
      }, {
        npmClient : npmClient
      }, errTo(cb, function(deps) {
        var count, next;

        count = _.reduce(deps, function(acc, _versions) {
          return acc + Object.keys(_versions).length;
        }, 0);

        next = after(count, republicateNext);

        log.info({
          deps     : Object.keys(deps),
          versions : count
        }, 'Found dependencies for ' + pkg.name + '@' + version);

        Object.keys(deps).forEach(function(dep) {
          var _versions;

          _versions = Object.keys(deps[dep]);
          _versions = semver.sort(_versions);

          log.debug({
            versions: _versions
          }, 'Republicating ' + dep);

          _versions.forEach(function(version) {
            var data, stripProps, props, pkgInfo;

            pkgInfo = deps[dep][version];

            stripProps = [
              '_id', '_from', '_npmVersion', '_npmUser',
              'dist', '_engineSupported', '_nodeVersion', '_defaultsLoaded'
            ];
            props = Object.keys(pkgInfo).filter(function(key) {
              return (stripProps.indexOf(key) === -1);
            });
            data = _.pick(pkgInfo, props);

            if (pkgInfo._npmVersion) {
              data._npmVersion = pkgInfo._npmVersion;
            }

            data.dist = {
              shasum: pkgInfo.dist.shasum
            };
            data.dist.tarball  = opts.to + pkgInfo.name;
            data.dist.tarball += '/-/' + pkgInfo.name + '-' + pkgInfo.version + '.tgz';

            data._npmUser = {
              name  : opts.username,
              email : opts.email
            };

            log.debug('preparing to publish ' + pkgInfo.name + '@' + pkgInfo.version + ' :: ' + pkgInfo.dist.tarball);

            // TODO: add pendingPackages when returning an error, so you know
            // what pkgs are in an inconsistent state
            pendingPackages[pkgInfo.name + '@' + pkgInfo.version] = 1;

            publish(npmConf, data, pkgInfo.dist.tarball, function(err) {
              delete pendingPackages[pkgInfo.name + '@' + pkgInfo.version];

              if (err) {
                if (err.code === 'EPUBLISHCONFLICT') {
                  log.info('pkg already exists: ' + pkgInfo.name + '@' + pkgInfo.version + ' :: ' + pkgInfo.dist.tarball);
                  return next();
                }

                return next(err);
              } else {
                log.info('published ' + pkgInfo.name + '@' + pkgInfo.version);
                return next();
              }
            });
          });
        });
      }));
    };

    republicateNext();

  }));
}

module.exports = replicateModule;
