var bunyan   = require('bunyan'),
    logger;

logger = bunyan.createLogger({
  name        : 'republicator',
  serializers : bunyan.stdSerializers,
  level       : process.env.LOG_LEVEL || 'info'
});

module.exports = logger;
