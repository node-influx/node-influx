# node-influx Changelog

## TBA, Version 5.0.0

 * connections: use a configurable backoff for connection failures (exponential by default)
 * connections: fix manging issue on multiple connection attempts
 * connections: treat `5xx` errors as temporary conditions and use a backoff when encountered
 * global: add automated jsdoc support
 * **breaking:** the InfluxDB client must now be invoked as `new InfluxDB`
 * **breaking:** configuration object changes:
   * configuration of the connection pool is now passed in a nested, sub-object

## 2016-05-05, Version 4.2.0

### Notable changes

* typings: Added TypeScript definitions, thanks to @SPARTAN563 (#129)
* init-url: Added support for configuring the client using a url (#128)
* deps: Updated lodash dependency (#133)
* _createKeyTagString: Fix '=' char escaping in KeyTagString (#127)
* _createKeyValueString/_createKeyTagString: Fix encoding failues on objects containing a 'length' key (#126)
