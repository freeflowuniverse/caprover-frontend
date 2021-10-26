// jshint esversion:6
const resolvePlugin = require('./craco.webpack.resolve.plugin')

module.exports = {
    webpack: {
        plugins: [],
    },
    plugins: [
        { plugin: resolvePlugin, options: { preText: "will add resolve with fs polyfill to webpack config:" } }
    ],
}
