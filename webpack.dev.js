const webpackConfig = require('./webpack.config');
const path = require('path');

webpackConfig.mode = 'development';
webpackConfig.output.filename = `${webpackConfig.output.library}.js`;
webpackConfig.output.path = path.resolve(__dirname, 'example');

module.exports = webpackConfig;
