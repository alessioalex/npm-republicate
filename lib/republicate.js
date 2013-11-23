"use strict";
 
/**
 * Basic example that returns all the deps
 * for Express 3.1.x
 */
var getDeps  = require('npm-dep-chain'),
    semver   = require('semver'),
    _        = require('lodash'),
    PkgInfo  = require('npm-pkginfo'),
    errTo    = require('errto'),
    after    = require('after'),
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
  var npmClient, defaultNpmClient, i, required,
      field, log, version, npmConf;

  log = opts.log || logger;

  required = ['to', 'username', 'password', 'email'];
  for(i = 0; i < required.length; i++) {
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

  getDeps({
    name    : pkg.name,
    version : version
  }, {
    npmClient : npmClient
  }, errTo(cb, function(deps) {
    var count, next;

    count = _.reduce(deps, function(acc, versions) {
      return acc + Object.keys(versions).length;
    }, 0);

    next = after(count, cb);

    log.info({
      deps     : Object.keys(deps),
      versions : count
    }, 'Found dependencies for ' + pkg.name + '@' + version);

    Object.keys(deps).forEach(function(dep) {
      var versions;

      versions = Object.keys(deps[dep]);
      versions = semver.sort(versions);

      log.debug({
        versions: versions
      }, 'Republicating ' + dep);

      versions.forEach(function(version) {
        var data, stripProps, props, pkgInfo;

        pkgInfo = deps[dep][version];

        // require('fs').writeFileSync(__dirname + '/../test/fixtures/pkg_data/' + dep + '_' + version + '.json', JSON.stringify(pkgInfo));

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

        publish(npmConf, data, pkgInfo.dist.tarball, function(err) {
          if (err) {
            if (err.code === 'EPUBLISHCONFLICT') {
              log.info('pkg already exists: ' + pkgInfo.name + '@' + pkgInfo.version);
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
}

module.exports = replicateModule;
