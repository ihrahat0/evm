module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ['module-resolver', {
      root: ['./'],
      alias: {
        'uniswap': './packages/uniswap/src',
        'graphql': './packages/graphql/src'
      }
    }]
  ]
}; 