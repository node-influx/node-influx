const webpack = require('webpack')
const path = require('path')

module.exports = (() => {
  const config = {}

  config.resolve = {
    extensions: ['.ts', '.js', '.json', '']
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
        ENV: JSON.stringify(process.ENV),
      }
    })
  ];

  return config
})()
