const fs = require('fs')
const ejs = require('ejs')
const get = require('lodash/get')
const first = require('lodash/first')
const path = require('path')
const uuid = require('uuid')
const axios = require('axios')
const crypto = require('crypto')
const express = require('express')
const bodyParser = require('body-parser')
const minifyHTML = require('express-minify-html')

const {
  marked,
  users,
  shortcodes,
  shortcodeCreations,
  shortcodeInvocations,
  allowedStatuses,
  appVars,
  appPort,
  appRoot,
  appWebsite,
  appNotifyHook,
  generateShortcode, formatShortcodeRecord
} = require('./lib')

const passport = require('passport')
const GitHubStrategy = require('passport-github2')

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${process.env.DEPLOYMENT}/auth/github/callback`
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { results: userRecords } = await users.filter({ _github_auth: { profile: { id: profile.id } } })
    if (userRecords.length) return done(null, first(userRecords))

    // Record not found. Create a new user
    const userId = uuid.v4()
    await users.set(userId, { _github_auth: { accessToken, refreshToken, profile } })
    const newUser = await users.get(userId)
    console.log(newUser)
    done(null, newUser)
  } catch (e) {
    done(e)
  }
}))

const app = express()

// Minify html output
app.use(minifyHTML({
  override: true,
  exception_url: false,
  htmlMinifier: {
    minifyJS: true,
    minifyCSS: true,
    minifyURLs: true,
    sortClassName: true,
    sortAttributes: true,
    removeComments: true,
    processScripts: ['text/javascript'],
    useShortDoctype: true,
    collapseWhitespace: true,
    removeAttributeQuotes: true,
    removeRedundantAttributes: true,
    collapseBooleanAttributes: true,
    removeScriptTypeAttributes: true,
    collapseInlineTagWhitespace: true,
    removeStyleLinkTypeAttributes: true,
  }
}))

// use EJS as our templating engine
app.set('view engine', 'ejs')

// Add the admin router
app.use('/admin', passport.authenticate('github', { scope: [ 'user:email' ] }), require('./admin'))
app.get('/auth/github', passport.authenticate('github', { scope: [ 'user:email' ] }))
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), async (req, res) => {
  // Successful authentication, redirect home.
  res.redirect('/home')
});

// CREATE
app.post('/',
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
    const { protocol, method, path, baseUrl, params, query, body } = req
    const ip = req.get('x-forwarded-for') || req.get('ip')

    await shortcodes.set(shortcode, { redirect, status })
    await shortcodeCreations.set(shortcode, { shortcode, protocol, ip, method, path, baseUrl, params, query, body })

    const shortcodeRecord = await shortcodes.get(shortcode)
    res.json(formatShortcodeRecord(shortcodeRecord))
  })

// Integrity check
const indexTemplate = fs.readFileSync(path.resolve(__dirname, '..', 'views', 'index.html.ejs'), 'utf8')
const integritiesMatcher = /integrity=\"(?!sha)([^\"]+)\"/gm
const [ [ _, integrityCode ] ] = indexTemplate.matchAll(integritiesMatcher)
const integrityCheck = crypto.createHash('sha512').update(integrityCode, 'utf8').digest('hex')
app.use(`/flag/${integrityCheck}`,
  bodyParser.json(),
  bodyParser.urlencoded({ extended: false }),
  (req, res) => {
    const { method, baseUrl, query, body } = req
    const ip = req.get('x-forwarded-for') || req.get('ip')
    const content = JSON.stringify({ ip, method, baseUrl, query, body }, null, 2)
    try { axios.post(appNotifyHook, { content: `\`\`\`json\n${content}\`\`\``, username: appRoot, ...body }) }
    catch (e) { console.warn(e.message) }
    res.json({
      method: 'POST',
      target: `/flag/${integrityCheck}`,
      reference: 'https://gist.github.com/Birdie0/78ee79402a4301b1faf412ab5f1cdcf9',
      body: { username: 'discord#1337', content: atob('VGVsbCB1cyB3aG8geW91IGFyZSwgbGVnZW5k') }
    })
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
      const { protocol, method, path, baseUrl, params, query, body } = req
      const ip = req.get('x-forwarded-for') || req.get('ip')
      const invocation = uuid.v4()
      await shortcodeInvocations.set(invocation, { invocation, shortcode, protocol, ip, method, path, baseUrl, params, query, body })

      res.redirect(status, redirect)
    } catch (e) { return next() }
  })

// Catch-all
app.use('*', (req, res) => {
  const apiTemplatePath = path.resolve(__dirname, '..', 'views', 'api.md.ejs')
  const apiTemplate = fs.readFileSync(apiTemplatePath, 'utf8')
  const apiMarkdown = ejs.render(apiTemplate, { appVars })

  const headerTemplatePath = path.resolve(__dirname, '..', 'views', 'header.md.ejs')
  const headerTemplate = fs.readFileSync(headerTemplatePath, 'utf8')
  const headerMarkdown = ejs.render(headerTemplate, { appVars })

  res.render('index.html.ejs', {
    appVars,
    bodyContent: marked.parse(apiMarkdown),
    headerContent: marked.parse(headerMarkdown)
  })
})

// Start service
app.listen(appPort)
