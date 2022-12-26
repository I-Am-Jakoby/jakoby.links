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
const shortcodeCreations = db.collection('shortcode_creations')
const shortcodeInvocations = db.collection('shortcode_invocations')

const allowedStatuses = [ 300, 301, 302, 303, 304, 307 ]
const appPort = get(process, 'env.PORT', 3000)
const appWebsite = get(process, 'env.WEBSITE', 'https://localhost/')
const appProtocol = get(process, 'env.PROTOCOL', 'https')
const appPassword = get(process, 'env.PASSWORD', 'iamjakoby')

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
  redirect: get(shortcodeRecord, 'props.redirect', appWebsite),
  shortcode: get(shortcodeRecord, 'key')
})

// Add some authentication
const authenticationMiddleware = (req, res, next) => {
  const passwordHeader = req.get('Authorization')
  const [ _, password ] = passwordHeader.split(' ')
  if (password === appPassword) return next()
  return res.sendStatus(401)
}

// CREATE
app.post('/_new',
  bodyParser.json(),
  bodyParser.urlencoded({ extended: false }),
  async (req, res) => {
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
    const { protocol, ip, method, baseUrl, path, params, query, body } = req

    await shortcodes.set(shortcode, { redirect, status })
    await shortcodeCreations.set(shortcode, { protocol, ip, method, baseUrl, path, params, query, body })

    const shortcodeRecord = await shortcodes.get(shortcode)
    res.json(formatShortcodeRecord(shortcodeRecord))
  })

// READ
app.get('/_list', authenticationMiddleware, async (req, res) => {
  const { results } = await shortcodes.list(Infinity)
  const shortcodeRecords = await Promise.all(results.map(({ key }) => shortcodes.get(key)))
  res.json(shortcodeRecords.map(formatShortcodeRecord))
})

app.get('/:shortcode/_metadata', authenticationMiddleware, async (req, res) => {
  try {
    const shortcode = get(req, 'params.shortcode')
    const shortcodeRecord = await shortcodes.get(shortcode)
    if (!shortcodeRecord) return res.sendStatus(404)

    const record = formatShortcodeRecord(shortcodeRecord)
    const { props: creation } = await shortcodeCreations.get(shortcode)
    const { results: invocationRecords } = await shortcodeInvocations.filter({ shortcode })
    res.json({ record, creation, invocations: invocationRecords.map(({ props }) => props) })
  } catch (e) {
    res.sendStatus(500, e.message)
  }
})

// DELETE
app.delete('/:shortcode', authenticationMiddleware, async (req, res) => {
  try {
    const shortcode = get(req, 'params.shortcode')
    const shortcodeRecord = await shortcodes.get(shortcode)
    if (!shortcodeRecord) return res.sendStatus(404)

    await shortcodes.delete(shortcode)
    res.sendStatus(200)
  } catch (e) {
    res.sendStatus(500, e.message)
  }
})

// Redirect
app.use('/:shortcode',
  bodyParser.json(),
  bodyParser.urlencoded({ extended: false }),
  async (req, res, next) => {
    try {
      const shortcode = get(req, 'params.shortcode')
      const shortcodeRecord = await shortcodes.get(shortcode)
      if (!shortcodeRecord) return next()

      const { status, redirect } = formatShortcodeRecord(shortcodeRecord)
      const { protocol, ip, method, baseUrl, path, params, query, body } = req
      const invocationKey = `${Date.now()} ${ip} ${method} ${shortcode}`
      await shortcodeInvocations.set(invocationKey, { shortcode, protocol, ip, method, baseUrl, path, params, query, body })

      res.redirect(status, redirect)
    } catch (e) { return next() }
  })

// Catch-all
app.use('*', (req, res) => {
  const ejsParams = {
    appRoot: `${appProtocol}://${req.get('host')}`,
    website: appWebsite,
    statuses: allowedStatuses
  }

  const apiTemplatePath = path.resolve(__dirname, '..', 'views', 'api.md.ejs')
  const apiTemplate = fs.readFileSync(apiTemplatePath, 'utf8')
  const apiMarkdown = ejs.render(apiTemplate, ejsParams)

  const headerTemplatePath = path.resolve(__dirname, '..', 'views', 'header.md.ejs')
  const headerTemplate = fs.readFileSync(headerTemplatePath, 'utf8')
  const headerMarkdown = ejs.render(headerTemplate, ejsParams)

  res.render('index.html.ejs', {
    ...ejsParams,
    bodyContent: marked.parse(apiMarkdown),
    headerContent: marked.parse(headerMarkdown)
  })
})

// Start service
app.listen(appPort)
