## npm-republicate

### Description 

Replicates a module (along with its dependencies) from an NPM registry to another by publishing it (&& dependencies).

### API

`republicate(package, options, callback)`, where:

- `package` is an object containing the `name` && `version` properties (for the module you want to replicate)
- `options` is an object that can have the following properties: cacheDir / npmClient (see https://github.com/alessioalex/npm-pkginfo), to (target registry), from (destination registry), username, email, password (NPM data needed for auth when publishing a module), log (bunyan logger instance).

### Use cases

- custom replication of the NPM registry (only replicate the modules you want)

### Usage

```js
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

pkgName    = process.env.PKG || 'express';
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
});
```

Note: to better view the logs for the default example you can use bunyan like so:

```bash
node republicate.js | bunyan -o short
```

### Motivation

Creating private NPM registries with easy custom replication of modules.

### How does it work?

Reads all the dependencies for a package, then iterates through each and publishes them.

### Tests

`npm test`

### License

MIT
