var semver = require('semver');

Utils = {};

// var fixtures = ["3.0.4","0.14.0","3.0.5","1.0.0","1.0.0-rc4","1.0.0-rc3","1.0.0-rc2","1.0.0-rc","1.0.0-beta2","1.0.0-beta","0.14.1","3.2.0","2.0.0","2.0.0-rc3","2.0.0-rc2","2.0.0-rc","2.0.0-beta3","2.0.0-beta2","2.0.0-beta","1.0.2","1.0.3","1.0.4","1.0.5","1.0.6","1.0.7","1.0.1","1.0.8","3.3.1","2.3.10","2.1.1","2.2.0","2.2.1","2.2.2","2.3.0","2.3.1","2.3.2","2.3.3","2.3.4","2.3.5","2.3.6","2.3.7","2.1.0","2.3.8","2.3.9","2.5.0","2.5.6","2.3.12","2.4.0","2.4.1","2.4.2","2.4.3","2.4.4","2.4.5","2.4.6","2.5.5","2.5.4","2.4.7","2.5.1","2.5.2","2.3.11","2.5.3","2.5.8","3.2.1","3.0.0-rc5","3.0.0-rc4","3.0.0-rc3","3.0.0-rc2","3.0.0-rc1","3.1.2","3.0.0-beta7","3.0.0-beta6","3.0.0-beta4","3.0.0-beta3","3.0.0-beta2","3.1.1","3.1.0","2.5.7","3.0.6","3.0.3","3.0.2","3.0.1","3.0.0","2.5.11","2.5.10","2.5.9","3.0.0-beta1","3.0.0-alpha1","3.0.0-alpha2","3.0.0-alpha3","3.0.0-alpha4","3.0.0-alpha5","3.2.4","3.2.2","3.2.3","3.3.5","3.3.3","3.3.2","3.3.0","3.2.6","3.2.5","3.3.4","3.3.6","3.3.7","3.3.8","3.4.0","3.4.1","3.4.2","3.4.3","3.4.4"];
Utils.getSortedVersions = function(versions, desc) {
  var op, reverseOp;

  // ascending by default
  if (!desc)  {
    op = 'gt';
    reverseOp = 'lt';
  } else {
    op = 'lt';
    reverseOp = 'gt';
  }

  return versions.sort(function(a, b) {
    if (semver[op](a, b)) {
      return 1;
    }

    if (semver[reverseOp](a, b)) {
      return -1;
    }

    return 0;
  });
};

module.exports = Utils;
