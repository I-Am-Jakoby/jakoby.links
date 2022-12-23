require('dotenv').config()

const path = require('path')
const flatCache = require('flat-cache')

const lootDir = path.resolve(__dirname, 'loot')
const cache = flatCache.load(process.env.APP_CACHE, lootDir)

cache.setKey('lol', {
  redirect: 'https://jakoby.lol/'
})

cache.save()
