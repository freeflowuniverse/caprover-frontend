// jshint esversion:6
const resolvePlugin = require('./craco.webpack.resolve.plugin')
module.exports = {
    webpack: {
        plugins: [
         
        ],
        configure: {
            module: {
              rules: [
                {
                  test: /\.js$/,
                  loader: require.resolve('@open-wc/webpack-import-meta-loader'),
                },
                {
                    test: /\.m?js$/,
                    include: /node_modules[/\\|]@polkadot/i,
                    use: {
                      loader: 'babel-loader',
                      options: {
                        presets: [
                          '@babel/preset-env',
                        ],
                        plugins: [
                          "@babel/plugin-proposal-private-methods",
                          "@babel/plugin-proposal-class-properties",
                          '@babel/plugin-proposal-object-rest-spread',
                        ]
                      }
                    }
                  },
              ]
            }
          },
    },
    plugins: [
        { plugin: resolvePlugin, options: { preText: "will add resolve with fs polyfill to webpack config:" } }
    ],
}
