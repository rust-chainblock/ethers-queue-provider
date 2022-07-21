const webpack = require('webpack');
const esbuild = require('esbuild');
const path = require('path');
const os = require('os');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = function(config) {
  config.set({
    frameworks: [ 'mocha', 'webpack' ],
    files: ['test/**.js'],
    preprocessors: {
      'test/**.js': [ 'webpack' ]
    },
    client: {
      mocha: {
        timeout: 500000 // 5 minutes, since we are running multiple retries with timeouts
      }
    },
    webpack: {
      mode: 'development',
      module: {
        rules: [
          {
            test: /\.js?$/,
            loader: 'esbuild-loader',
            options: {
              // Caver.js specific
              target: 'es2018',
              implementation: esbuild
            }
          }
        ]
      },
      output: {
        path: path.join(os.tmpdir(), '_karma_webpack_') + Math.floor(Math.random() * 1000000)
      },
      plugins: [
        new NodePolyfillPlugin(),
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
        }),
      ],
      resolve: {
        fallback: {
          assert: require.resolve('assert/'),
          // Caver.js specific
          fs: false,
          net: false,
          http: false,
          https: false,
        },
      }
    },
    plugins: [
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-mocha',
      'karma-webpack'
    ],
    colors: true,
    logLevel: 'info',
    autoWatch: false,
    browsers: [ 'ChromeHeadless', 'FirefoxHeadless' ]
  });
};
