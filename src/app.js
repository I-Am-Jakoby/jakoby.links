const db = require('@cyclic.sh/dynamodb')
const get = require('lodash/get')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const Chance = require('chance')

const app = express()
const lootDir = path.resolve(__dirname, '..', 'loot')
const shortcodes = db.collection('shortcodes')
const allowedStatuses = [ 300, 301, 302, 303, 304, 307 ]

const generateShortcode = async (length = 1) => {
  // Generate a new random word
  const shortcode = (new Chance()).word({ length })

  // Check to see if there's an existing shortcode with this name
  try { await shortcodes.get(shortcode) }

  // If there isn't, return the new shortcode
  catch (e) { return shortcode }

  // If there is, try again
  return await generateShortcode(length + 1)
}

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

  const shortcode = await generateShortcode()
  await shortcodes.set(shortcode, { redirect, status })
  const record = await shortcodes.get(shortcode)

  res.json(record)
})

app.use('/:shortcode', async (req, res, next) => {
  const shortcode = get(req, 'params.shortcode')

  let record
  try { record = await shortcodes.get(shortcode) }
  catch (e) { return next() }

  const redirect = get(record, 'redirect', process.env.APP_WEBSITE)
  const status = get(record, 'status', 301)
  res.redirect(status, redirect)
})

app.use('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'static', 'index.html'))
})

const port =
  process.env.PORT ||
  process.env.APP_PORT ||
  3000

app.listen(port)
