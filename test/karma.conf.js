const path = require('path')

module.exports = function (config) {
  config.set({
    basePath: path.join(__dirname, '..'),
    frameworks: ['mocha'],
    reporters: ['mocha'],

    plugins: [
        require('karma-mocha'),
        require('karma-mocha-reporter'),
        require('karma-chrome-launcher'),
        require('karma-webpack'),
        require('karma-sourcemap-loader'),
        { 'middleware:pool-tests': ['factory', require('./fixture/pool-middleware.js')] }
    ],

    webpack: require('./webpack.config'),
    webpackServer: { noInfo: true },
    webpackMiddleware: { stats: 'errors-only' },

    files: [
        'test/karma.shim.js',
    ],
    preprocessors: {
        'test/karma.shim.js': ['webpack']
    },

    middleware: ['pool-tests'],

    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    browsers: ['Chrome'],

    singleRun: true
  })
}
