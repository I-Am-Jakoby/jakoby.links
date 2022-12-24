const db = require('@cyclic.sh/dynamodb')
const fs = require('fs')
const ejs = require('ejs')
const get = require('lodash/get')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const { marked } = require('marked')

const Chance = require('chance')

const app = express()
const shortcodes = db.collection('shortcodes')
const allowedStatuses = [ 300, 301, 302, 303, 304, 307 ]

// use EJS as our templating engine
app.set('view engine', 'ejs')

// Configure marked
marked.setOptions({
  gfm: true,
  langPrefix: 'hljs language-',
  highlight: (code, lang) => {
    const hljs = require('highlight.js')
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  }
})

// Algorithm for generating a new shortcode
const generateShortcode = async (length = 4) => {
  const shortcode = (new Chance()).word({ length })
  const existingShortcode = await shortcodes.get(shortcode)
  if (!existingShortcode) return shortcode
  return await generateShortcode(length + 1)
}

// Output formatting for shortcode records
const formatShortcodeRecord = shortcodeRecord => ({
  status: get(shortcodeRecord, 'props.status', 301),
  redirect: get(shortcodeRecord, 'props.redirect', process.env.WEBSITE),
  shortcode: get(shortcodeRecord, 'key')
})

// Add some authentication
const authenticationMiddleware = (req, res, next) => {
  const passwordHeader = req.get('Authorization')
  const [ _, password ] = passwordHeader.split(' ')
  if (password === process.env.PASSWORD) return next()
  return res.sendStatus(401)
}

// CREATE
app.post('/_new', bodyParser.json(), async (req, res) => {
  const redirect = get(req, 'body.redirect')
  if (!redirect) return res.status(400).send('No redirect URI provided')

  try { new URL(redirect) }
  catch (e) { return res.status(400).send(e.message) }

  let status
  try { status = parseInt(get(req, 'body.status', 301)) }
  catch (e) { return res.status(400).send(e.message) }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).send('Invalid status')
  }

  const shortcode = await generateShortcode()
  await shortcodes.set(shortcode, { redirect, status })
  const record = await shortcodes.get(shortcode)
  res.json(formatShortcodeRecord(record))
})

// READ
app.get('/_list', authenticationMiddleware, async (req, res) => {
  const { results } = await shortcodes.list(Infinity)
  const records = await Promise.all(results.map(({ key }) => shortcodes.get(key)))
  res.json(records.map(formatShortcodeRecord))
})

// DELETE
app.delete('/:shortcode', authenticationMiddleware, async (req, res) => {
  const shortcode = get(req, 'params.shortcode')
  const record = await shortcodes.get(shortcode)
  if (!record) return res.sendStatus(404)
  try { await shortcodes.delete(shortcode) }
  catch (e) { res.sendStatus(500, e.message) }
  return res.sendStatus(200)
})

// Redirect
app.use('/:shortcode', async (req, res, next) => {
  try {
    const shortcode = get(req, 'params.shortcode')
    const record = await shortcodes.get(shortcode)
    const { status, redirect } = formatShortcodeRecord(record)
    res.redirect(status, redirect)
  } catch (e) { return next() }
})

// Catch-all
app.use('*', (req, res) => {
  const markdownTemplatePath = path.resolve(__dirname, '..', 'views', 'index.md.ejs')
  const markdownTemplate = fs.readFileSync(markdownTemplatePath, 'utf8')

  const markdown = ejs.render(markdownTemplate, {
    appRoot: `${req.protocol}://${req.get('host')}`,
    website: process.env.WEBSITE
  })

  res.render('index.html.ejs', {
    appRoot: `${req.protocol}://${req.get('host')}`,
    website: process.env.WEBSITE,
    statuses: allowedStatuses,
    htmlContent: marked.parse(markdown)
  })
})


// Start service
app.listen(process.env.PORT || 3000)
