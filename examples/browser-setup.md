# Browser Setup

For Node.js, `influx` can be installed and you can use it out of the box!

```
npm install --save influx@next
```

For browsers, this will also work provided you have a bundler which can polyfill Node modules, such as Browserify, Webpack, Jspm, or Rollup with [rollup-plugin-node-resolve](https://github.com/rollup/rollup-plugin-node-resolve).

However, at the time of writing, request timeouts will not work by default on any of these platforms until they update to the latest Node API changes. If this is an important feature for you, we recommend that you instruct your bundler to use our [patched version](https://github.com/node-influx/stream-http) of `stream-http` as your `http` polyfill. You can install it via:

```
npm install --save node-influx/stream-http
```

You can tell Webpack to use this module by adding the following section in your `webpack.config.js`:

```js
const http = path.resolve(__dirname, "node_modules/stream-http/index.js");

module.exports = {
  resolve: {
    alias: { http, https: http },
  },

  // the rest of your webpack config
};
```

You can tell Browserify to use this module by adding the following into your build config:

```js
const http = require("stream-http");

browserify(myFiles, {
  builtins: Object.assign({}, require("browserify/lib/builtins"), {
    http,
    https: http,
  }),

  // the rest of your browserify config
});
```
