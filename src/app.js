const get = require('lodash/get')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const Chance = require('chance')

const app = express()
const lootDir = path.resolve(__dirname, '..', 'loot')
// const shortcodes = db.collection('shortcodes')
const allowedStatuses = [ 300, 301, 302, 303, 304, 307 ]

// Direct from the dox
const CyclicDb = require('@cyclic.sh/dynamodb')
const db = CyclicDb(process.env.CYCLIC_DB)
const shortcodes = db.collection('shortcodes')

const generateShortcode = async (length = 1) => {
  // Generate a new random word
  const shortcode = (new Chance()).word({ length })

  // Check to see if there's an existing shortcode with this name
  const existingShortcode = await shortcodes.get(shortcode)

  // No existing shortcode? Great!
  if (!existingShortcode) return shortcode

  // Otherwise, try again
  return await generateShortcode(length + 1)
}

const formatShortcodeRecord = shortcodeRecord => ({
  shortcode: get(shortcodeRecord, 'key'),
  status: get(shortcodeRecord, 'props.status', 301),
  redirect: get(shortcodeRecord, 'props.redirect', process.env.WEBSITE)
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

  const shortcode = await generateShortcode()
  await shortcodes.set(shortcode, { redirect, status })
  const record = await shortcodes.get(shortcode)
  res.json(formatShortcodeRecord(record))
})

app.use('/:shortcode', async (req, res, next) => {
  const shortcode = get(req, 'params.shortcode')

  let record
  try { record = await shortcodes.get(shortcode) }
  catch (e) { return next() }

  const { status, redirect } = formatShortcodeRecord(record)
  res.redirect(status, redirect)
})

app.use('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'static', 'index.html'))
})

app.listen(process.env.PORT || 3000)
