const get = require('lodash/get')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const Chance = require('chance')

const db = require('@cyclic.sh/dynamodb')
const flatCache = require('flat-cache')

const app = express()

const lootDir = path.resolve(__dirname, '..', 'loot')
const cache = flatCache.load(process.env.APP_CACHE, lootDir)
const allowedStatuses = [ 300, 301, 302, 303, 304, 307 ]

const generateShortcode = (length = 1) => {
  const shortcode = (new Chance()).word({ length })
  const existingRecord = cache.getKey(shortcode)
  if (existingRecord) return generateShortcode(length + 1)
  return shortcode
}

app.get('/:shortcode', async (req, res, next) => {
  const shortcode = get(req, 'params.shortcode')
  const resource = await db.collection('shortcodes').get(shortcode)
  if (!resource) return next()

  const redirect = get(resource, 'redirect', process.env.APP_WEBSITE)
  const status = get(resource, 'status', 301)
  res.redirect(status, redirect)
})

app.post('/new', bodyParser.json(), async (req, res) => {
  const redirect = get(req, 'body.redirect')
  if (!redirect) return res.sendStatus(400, 'No redirect URI provided')

  try { new URL(redirect) }
  catch (e) { return res.sendStatus(400, e.message) }

  let status
  try { status = parseInt(get(req, 'body.status', 301)) }
  catch (e) { return res.sendStatus(400, e.message) }

  if (!allowedStatuses.includes(status)) {
    return res.sendStatus(400, 'Invalid status')
  }

  const shortcode = generateShortcode()
  const record = await db.collection('shortcodes')
    .set(shortcode, { redirect, status })

  res.json(record)
})

app.use('*', (req, res) => {
  res.sendStatus(404)
})

app.listen(process.env.APP_PORT)
