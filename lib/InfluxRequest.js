
var request = require('request');

var url = require('url');
function InfluxRequest(options,callback)
{
  this.hosts_available = [];
}

InfluxRequest.prototype.addHost = function (hostname,port)
{
  this.hosts_available.push({
    name      : hostname,
    port      : port,
    available : true,
    timeout   : 0
  });
};

InfluxRequest.prototype.getHost = function()
{
  var host = this.hosts_available.shift();
  this.hosts_available.push(host);
  return host;
};


InfluxRequest.prototype.url = function(path) {

  var host = this.getHost();

  return url.format({
    protocol  : 'http:',
    hostname  : host.name,
    port      : host.port
  })+'/'+path;
};

InfluxRequest.prototype._request = function (options,callback)
{
  options.url = this.url(options.url);
  var self = this;
  request(options,function(err,response,body)
  {
    self._parseCallback(err,response,body, options, callback)
  });
};

InfluxRequest.prototype._parseCallback = function(err,response,body, options , callback)
{
  callback(err,response,body);
};

InfluxRequest.prototype.get = function (options,callback)
{
  this._request(options,callback);
};


InfluxRequest.prototype.post = function(options,callback)
{
  options.method='POST';
  this._request(options,callback);
};

module.exports = InfluxRequest;
