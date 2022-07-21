const webpack = require('webpack');
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const library = 'AxiosQueueProvider';

module.exports = {
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts?$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'ts',
          target: 'es2015',
          implementation: esbuild
        }
      }
    ]
  },
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist/browser'),
    library,
    libraryTarget: 'umd',
    libraryExport: 'default',  // export the default as window.MyClass
  },
  plugins: [
    new webpack.BannerPlugin(fs.readFileSync('./LICENSE', 'utf8')),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      http: false,
      https: false,
    }
  },
};
