const webpack = require("webpack");
const path = require("path");
const http = path.resolve(__dirname, "../node_modules/stream-http/index.js");
const samsam = path.resolve(__dirname, "../node_modules/@sinonjs/samsam");

module.exports = (() => {
  const config = {};

  config.resolve = {
    extensions: [".ts", ".js", ".json"],
    alias: {
      http,
      https: http,
      process: require.resolve("process/browser.js"),
      "process/browser": require.resolve("process/browser.js"),
    },
    fallback: {
      buffer: require.resolve("buffer/"),
      querystring: require.resolve("querystring-es3"),
      url: require.resolve("url/"),
    },
  };

  config.module = {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true,
          configFile: path.resolve(__dirname, "../tsconfig.json"),
        },
      },
      {
        test: /\.js$/,
        include: [samsam],
        loader: "babel-loader",
        options: {
          presets: [
            [
              "@babel/preset-env",
              {
                targets: {
                  chrome: "80",
                },
              },
            ],
          ],
        },
      },
    ],
  };

  config.plugins = [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: require.resolve("process/browser.js"),
    }),
    new webpack.DefinePlugin({
      "process.env": {
        WEBPACK: '"1"',
        ENV: JSON.stringify(process.ENV),
      },
    }),
  ];

  return config;
})();
