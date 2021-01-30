const path = require("path");
process.env.CHROME_BIN = require('puppeteer').executablePath()

module.exports = function (config) {
  config.set({
    /**
     * General base config:
     */
    basePath: path.join(__dirname, ".."),
    frameworks: ["mocha", 'webpack'],
    reporters: ['mocha'],

    client: {
      mocha: {
        timeout: 10000,
      },
    },

    plugins: [
      require("karma-mocha"),
      require("karma-mocha-reporter"),
      require("karma-chrome-launcher"),
      require("karma-webpack"),
      require("karma-sourcemap-loader"),
      {
        "middleware:pool-tests": [
          "factory",
          require("./fixture/pool-middleware.js"),
        ],
      },
    ],

    /**
     * Webpack and bundling config:
     */
    webpack: require("./webpack.config"),
    webpackServer: { noInfo: true },
    webpackMiddleware: { stats: "errors-only" },
    files: ["test/karma.shim.js"],
    preprocessors: { "test/karma.shim.js": ["sourcemap", "webpack"] },
    middleware: ["pool-tests"],

    /**
     * Karma run config:
     */
    browsers: ['ChromeHeadless'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    singleRun: true,
  });
};
