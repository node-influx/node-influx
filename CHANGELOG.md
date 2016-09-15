# node-influx Changelog

## 2016-09-15, Version 4.2.2

Shoutout to @dandv for lots of awesome PRs this release!

* improvement: sort tags before writing for greater performance (#179)
* improvement: make code compliant with the latest `standard` rules (#161)
* bug: fix escaping of quotes in strings (#183)
* bug: fix empty result from `getDatabaseNames` throwing errors (#168)
* docs: fix messy terminology and typos (#183 and #170)
* docs: include the full license file and copyright (#180)
* docs: fix instructions to run `standard` instead of just `lint` (#181)

## 2016-05-05, Version 4.2.0

### Notable changes

* typings: Added TypeScript definitions, thanks to @SPARTAN563 (#129)
* init-url: Added support for configuring the client using a url (#128)
* deps: Updated lodash dependency (#133)
* _createKeyTagString: Fix '=' char escaping in KeyTagString (#127)
* _createKeyValueString/_createKeyTagString: Fix encoding failues on objects containing a 'length' key (#126)
