# Browser Setup

For Node.js, `influx` can be installed and you can use it out of the box!

```
npm install --save influx@next
```

For browsers, this will also work provided you have a bundler which can polyfill Node modules, such as Browserify, Webpack, Jspm, or Rollup with [rollup-plugin-node-resolve](https://github.com/rollup/rollup-plugin-node-resolve).

However, at the time of writing request timeouts will not work by default on any of these platforms until they update to the latest Node API changed. If this is an important feature for you, we recommend that you instruct your bundler to use our [patched version](https://github.com/node-influx/stream-http) of `stream-http` as your `http` polyfill. You can install it via:

```
npm install --save node-influx/stream-http
```

You can tell Webpack to use this module by adding the following section on your `webpack.config.js`:

```js
module.exports = {
  resolve: {
    alias: {
      http: path.resolve(__dirname, 'node_modules/stream-http/index.js')
    }
  }
  
  // the rest of your webpack config
}
```

You can tell Browserify to use this module by adding the following into your build config:

```js
browserify(myFiles, {
  builtins: Object.assign(
    {}, require('browserify/lib/builtins'),
    { http: require('stream-http') }
  )
  
  // the rest of your browserify config
})
```