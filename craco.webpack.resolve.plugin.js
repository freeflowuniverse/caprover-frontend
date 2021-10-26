// jshint esversion:6
const path = require("path")

module.exports = {
    overrideWebpackConfig: ({ webpackConfig, cracoConfig, pluginOptions, context: { env, paths } }) => {

        // append fs to aliases, do not overwrite the whole resolve or aliases object
        // otherwise loading modules will completely fail
        if (!webpackConfig.resolve.alias) {
            webpackConfig.resolve.alias = {}
        }
        webpackConfig.resolve.alias.fs = path.resolve(__dirname, 'src/polyfills/fs')

        return webpackConfig;
    }
};
