"use strict";

/**
 * Mock NPM server used for testing
 */
var express = require('express'),
    _       = require('lodash'),
    uuid    = require('uuid'),
    os      = require('os'),
    fs      = require('fs'),
    crypto  = require('crypto');

function createServer(port, packages, tarballsDir) {
  var app, updated, shasums;

  packages    = packages || {};
  tarballsDir = tarballsDir || os.tmpdir();
  updated     = Date.now();
  app         = express();
  shasums     = {};

  app.use(express.favicon());
  app.use(express.cookieParser('some secret here'));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());

  app.all('*', function(req, res, next) {
    app.emit('mock-server:request', { method: req.method, url: req.url });
    next();
  });

  app.post('/_session', function(req, res, next) {
    var _cookie;

    _cookie = 'AuthSession=' + new Buffer(req.body.name + ':password').toString('base64');
    _cookie += '; Version=1; Expires=Tue, 19 Nov 2033 21:14:43 GMT;';
    _cookie += ' Max-Age=86400; Path=/; HttpOnly';

    res.setHeader('Set-Cookie', _cookie);

    res.send({
      ok: true,
      name: req.body.name,
      roles: []
    });
  });

  app.get('/', function(req, res, next) {
    res.redirect('/-/all');
  });

  app.get('/-/all', function(req, res, next) {
    var pkgs, fields;

    pkgs   = {
      '_updated': updated
    };

    fields = [
      'name', 'description', 'maintainers', 'author',
      'repository', 'time', 'versions', 'keywords'
    ];

    Object.keys(packages).forEach(function(pkg) {
      pkgs[pkg] = _.pick(packages[pkg], fields);
    });

    res.send(pkgs);
  });

  app.get('/:name', function(req, res, next) {
    res.send(packages[req.params.name]);
  });

  app.get('/:name/:version', function(req, res, next) {
    res.send(packages[req.params.name].versions[req.params.version]);
  });

  app.put('/:name', function(req, res, next) {
    var pkg = req.params.name;

    if (!packages[pkg]) {
      packages[pkg] = _.extend(req.body, { _rev: uuid.v1(), _id: pkg });

      res.status(201).send({
        ok  : 1,
        id  : pkg,
        rev : packages[pkg]._rev
      });
    } else {
      res.status(409).send({
        error  : "bad rev",
        reason : "must supply latest _rev to update existing package"
      });
    }

  });

  app.get('/:name/-/:file', function(req, res, next) {
    var filePath;

    filePath = tarballsDir + '/' + req.params.file;

    fs.exists(filePath, function(exists) {
      if (!exists) {
        return res.status(404).send({ error: 'not_found', reason: 'not found' });
      }

      fs.createReadStream(filePath).pipe(res);
    });
  });

  app.put('/:name/-/:file/-rev/:rev', function(req, res, next) {
    var pkg, shasum, finalSha;

    shasum = crypto.createHash('sha1');
    pkg    = req.params.name;
    packages[pkg]._rev = uuid.v1();

    req.pipe(fs.createWriteStream(tarballsDir + '/' + req.params.file));

    req.on('data', function(chunk) {
      shasum.update(chunk);
    });

    req.on('end', function() {
      finalSha = shasum.digest('hex');
      app.emit('mock-server:attachment', req.params, finalSha);

      shasums[req.params.file.replace('.tgz', '')] = finalSha;

      res.status(201).send({
        ok  : 1,
        id  : pkg,
        rev : packages[pkg]._rev
      });
    });
  });

  app.put('/:name/:version/-tag/latest', function(req, res, next) {
    var pkg, tarball;

    var pkg = req.params.name;
    packages[pkg]._rev = uuid.v1();

    tarball = 'http://localhost:' + port + '/';
    tarball += req.params.name + '/-/';
    tarball += req.params.name + '-' + req.params.version + '.tgz'

    packages[pkg].versions[req.params.version] = JSON.parse(JSON.stringify(packages[pkg]));
    packages[pkg].versions[req.params.version].version = req.params.version;
    // packages[pkg].versions[req.params.version].dist = {
    //   shasum  : shasums[req.params.name + '-' + req.params.version],
    //   tarball : tarball
    // };
    packages[pkg]['dist-tags'] = {
      latest: req.params.version
    };

    updated  = Date.now();

    res.status(201).send({
      ok  : 1,
      id  : pkg,
      rev : packages[pkg]._rev
    });
  });

  return app.listen(port);
}

module.exports = createServer;
