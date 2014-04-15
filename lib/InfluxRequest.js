
var request = require('request');
var _ = require('underscore');
var url = require('url');

var resubmitErrorCodes = ['ETIMEDOUT','ESOCKETTIMEDOUT','ECONNRESET','ECONNREFUSED'];

function InfluxRequest(options,callback)
{

  this.index = 0;
  this.hosts_available = [];
  this.hosts_disabled = [];
  this.defaultRequestOptions = {
    timeout : 2000
  };

  this.options = {
    failureTimeout : 30000,
    maxRetries     : 2
  };

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

  var host = this.hosts_available[this.index];
  ++this.index;
  this.checkIndex();
  console.log('selected host',host,this.index);
  return host;
};

InfluxRequest.prototype.checkIndex = function()
{
  if (this.index >= this.hosts_available.length)
  {
    this.index=0;
  }
};

InfluxRequest.prototype.filterHosts = function (hosts,host)
{
  return _.filter(hosts,function(aHost) { return !(aHost.name == host.name && aHost.port == host.port);});
};

InfluxRequest.prototype.disableHost = function(host)
{
  this.hosts_available = this.filterHosts(this.hosts_available,host);
  this.hosts_disabled.push(host);
  this.checkIndex();
};


InfluxRequest.prototype.url = function(host,path) {
  return url.format({
    protocol  : 'http:',
    hostname  : host.name,
    port      : host.port
  })+'/'+path;
};

InfluxRequest.prototype._request = function (options,callback)
{
  var self = this;
  var host = this.getHost();

  var requestOptions = _.extend({retries : 0, host : host},this.defaultRequestOptions,options);

  //need to store the original path, in case we need to re-submit the request onError
  if (!requestOptions.originalUrl) requestOptions.originalUrl = requestOptions.url;
  requestOptions.url = this.url(host,requestOptions.originalUrl);
  requestOptions.retries++;
  request(requestOptions,function(err,response,body)
  {
    self._parseCallback(err,response,body, requestOptions, callback)
  });
};

InfluxRequest.prototype._parseCallback = function(err,response,body, requestOptions , callback)
{

  if (err)
  {
    console.log(err,err.code,resubmitErrorCodes.indexOf(err.code));
  }
  if (err && -1 !== resubmitErrorCodes.indexOf(err.code))
  {
    this.disableHost(requestOptions.host);
    if (this.options.maxRetries >= requestOptions.retries)
    {
      return this._request(requestOptions,callback);
    }
  }
  return callback(err,response,body);

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
