const webpack = require('webpack')
const path = require('path')
const http = path.resolve(__dirname, '../node_modules/stream-http/index.js')

module.exports = (() => {
  const config = {}

  config.resolve = {
    extensions: ['.ts', '.js', '.json'],
    alias: { http, https: http }
  }

  config.module = {
    loaders: [
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader',
        query: {
          useForkChecker: true,
          tsconfig: path.resolve(__dirname, '../tsconfig.json')
        }
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      }
    ]
  }

  config.plugins = [
    new webpack.DefinePlugin({
      'process.env': {
        WEBPACK: '"1"',
        ENV: JSON.stringify(process.ENV)
      }
    })
  ]

  return config
})()
