const path = require("path");
const isSaucy = !!process.env.SAUCE;
const sauceLaunchers = {
  sauceChrome: {
    base: "SauceLabs",
    browserName: "chrome",
    platform: "Windows 10",
    version: "54.0",
  },
  sauceFirefox: {
    base: "SauceLabs",
    browserName: "firefox",
    platform: "Windows 10",
    version: "49.0",
  },
  sauceEdge: {
    base: "SauceLabs",
    browserName: "MicrosoftEdge",
    platform: "Windows 10",
    version: "14.14393",
  },
};

if (/^[0-9]+$/.test(process.env.TRAVIS_PULL_REQUEST)) {
  console.log("Refusing to run SauceLabs tests in pull requests");
  process.exit(0);
}

module.exports = function (config) {
  config.set({
    /**
     * General base config:
     */
    basePath: path.join(__dirname, ".."),
    frameworks: ["mocha"],
    reporters: isSaucy ? ["mocha", "saucelabs"] : ["mocha"],

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
      require("karma-sauce-launcher"),
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
     * SauceLabs config:
     */
    sauceLabs: {
      testName: "node-influx",
      public: "public",
      tunnelIdentifier: process.env.TRAVIS_JOB_NUMBER,
      startConnect: false,
    },
    customLaunchers: sauceLaunchers,

    /**
     * Karma run config:
     */
    browsers: isSaucy ? Object.keys(sauceLaunchers) : ["Chrome"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    singleRun: true,
  });
};
