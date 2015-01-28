/**
 * Dependencies.
 */

var utils = require('./utils')
var request = require('request')
var debug = require('debug')('nodejs-etcd')
var https = require('https')
var httpsync = require('http-sync')
var fs = require('fs')
var parseurl = require('url')
var querystring = require('querystring')
var util = require('util')

/**
 * Initialize a new client.
 *
 * @see configure()
 */

function Client(opts) {
  this.version = 'v2'
  this.configure(opts || {})
}



Client.prototype.generator = require('./result').handle_generator


/**
 * Configure connection options.
 *
 * Settings:
 *
 *  - port
 *  - host
 *
 *
 * @param {Object} opts
 * @return {Client}
 * @public
 */

Client.prototype.configure = function (settings) {
  //TODO: validate the url?
  this.baseurl = settings.url + '/' + this.version
  //ssl client certificate support.
  //Set up HttpsAgent if sslopts {ca, key, cert} are given
  if ('ssloptions' in settings) {
    var sslopts = {}
    for(var key in settings.ssloptions) {
      switch(key) {
        case "ca":
        case "key":
        case "cert":
        case "pfx":
          sslopts[key] = fs.readFileSync(settings.ssloptions[key])
          break
        default:
          sslopts[key] = settings.ssloptions[key]
          break
      }
    }
    this.ssloptions = settings.ssloptions
    this.agent = new https.Agent(sslopts)
  } else {
    this.ssloptions = false
    this.agent = false
  }
  return this;
};


/**
* Internal method for calling the server.
*
* @param {Object} options
* @param {Function} cb
* @return {Object}
* @private
*
*/
Client.prototype._call = function (options, callback) {
  // by default, just log to console the result.
  cb = callback || this.generator()
  var blocking = ('blocking' in options) && options.blocking
  delete options.blocking
  url = this.url('keys', options.key)

  delete options.key
  if (blocking) {
    var parse = parseurl.parse(url)
    var proto = parse.protocol
    var reqParams = {}
    var qs = querystring.stringify(options.qs)
    reqParams.protocol = parse.protocol.substring(0, parse.protocol.length - 1)
    reqParams.method = options.method
    reqParams.path = parse.path
    if (qs.length > 0) {
      reqParams.path += "?" + qs
    }
    reqParams.port = parse.port
    reqParams.host = parse.hostname
    if (this.ssloptions) {
      for (var key in this.ssloptions) {
        reqParams[key] = this.ssloptions[key]
      }
    }
    var syncrequest = httpsync.request(reqParams)
    try {
      var response = syncrequest.end()
    } catch (e) {
      console.log(e)
    }
    callback(undefined, response, response.body.toString())
  } else {
    if (this.agent) {
      options.agent = this.agent
    }
    request(url, options, cb)
  }
  return this;
};


/**
 * Machines.
 *
 * TODO: look into `res.error`.
 *
 * @param {Function} cb
 * @public
 */

Client.prototype.machines = function (cb) {
  return request.get(this.url('machines'), cb)
};

/**
 * Leader.
 *
 * TODO: look into `res.error`.
 *
 * @param {Function} cb
 * @public
 */

Client.prototype.leader = function (cb) {
  return request.get(this.url('leader'), cb)
};


/**
* Read.
*
* @param {Object} options
* @return {Object}
* @public
*/

Client.prototype.read = function (options, cb) {
  if (!options) options = {}

  var opts = {}
  opts.method = 'GET'
  opts.key = options.key || '/'

  opts.qs = {}
  if ('recursive' in options) opts.qs.recursive = options.recursive
  if ('wait' in options) opts.qs.wait = options.wait
  if ('wait_index' in options) opts.qs.waitIndex = options.wait_index
  if ('sorted' in options) opts.qs.sorted = options.sorted
  if ('blocking' in options) opts.blocking = options.blocking
  return this._call(opts, cb)
};

/**
 * Get.
 *
 * @param {String} key
 * @param {Function} cb
 * @return {Client}
 * @public
 */

Client.prototype.get = function (key, cb) {
  return this.read({'key': key}, cb)
};

/**
 * Delete.
 *
 * @param {String} key
 * @param {Function} cb
 * @return {Client}
 * @public
 */

Client.prototype.del = function (options, cb) {
  var opts = {'method': 'DELETE'}
  opts.key = options.key
  opts.qs = {};
  if ('recursive' in options) opts.qs.recursive = options.recursive
  if ('dir' in options) opts.qs.dir = options.dir
  if ('blocking' in options) opts.blocking = options.blocking
  // Still unsupported, but they may work soon.
  if ('prev_value' in options) opts.qs.prevValue = options.prev_value
  if ('prev_index' in options) opts.qs.prevIndex = options.prev_index
  return this._call(opts, cb)
};


/**
 * Write.
 *
 * @param {Object} options
 * @param {Function} cb
 * @return {Mixed}
 * @public
 */

Client.prototype.write = function (options, cb) {
  var opts = {}

  opts.method = ('method' in options) && options.method || 'PUT'
  opts.key = options.key || '/'
  opts.form = {'value': options.value}
  opts.qs = {};

  if ('ttl' in options) opts.form.ttl = options.ttl
  if ('dir' in options) opts.qs.dir = options.dir
  if ('blocking' in options) opts.blocking = options.blocking
  if ('prev_exists' in options) opts.form.prevExists = options.prev_exists
  if ('prev_index' in options) opts.form.prevIndex = options.prev_index
  if ('prev_value' in options) opts.form.prevValue = options.prev_value

  return this._call(opts, cb)
}

/**
 * Append.
 *
 * @param {Object} options
 * @param {Function} cb
 * @return {Mixed}
 * @public
 */

Client.prototype.append = function (options, cb) {
  options.method = 'POST'
  return this.write(options, cb)
}

/**
 * Endpoint utility.
 *
 * @return {String}
 * @private
 */

Client.prototype.url = function () {
  var route = [].slice.call(arguments).join('/').replace('//','/')
  return this.baseurl + '/' + route
};



module.exports = Client
