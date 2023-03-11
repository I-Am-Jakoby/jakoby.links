const get = require('lodash/get')
const { Router } = require('express')

const {
  appVars,
  shortcodes,
  shortcodeCreations,
  shortcodeInvocations,
  formatShortcodeRecord
} = require('../lib')

const formatRecord = record => ({ _key: record.key, ...record.props })

const adminAppRouter = new Router

adminAppRouter.use('/api', require('./api'))

adminAppRouter.get('/', async (req, res) => {
  const { results } = await shortcodes.list(Infinity)
  const shortcodeRecords = await Promise.all(results.map(({ key }) => shortcodes.get(key)))
  const formattedShortcodes = shortcodeRecords.map(({ key: _key, props }) => ({ ...props, _key }))
  res.render('admin/index.html.ejs', { appVars, shortcodes: formattedShortcodes })
})

adminAppRouter.get('/shortcodes/:shortcode', async (req, res) => {
  const shortcodeRecord = await shortcodes.get(get(req, 'params.shortcode'))
  const shortcode = { _key: shortcodeRecord.key, ...shortcodeRecord.props }

  const { props: creation } = await shortcodeCreations.get(shortcode._key)
  const { results: invocationRecords } = await shortcodeInvocations.filter({ shortcode: shortcode._key })
  const invocations = invocationRecords.map(({ props }) => props)

  res.render('admin/shortcode.html.ejs', { appVars, shortcode, creation, invocations })
})

adminAppRouter.get('/report', require('./report'))

module.exports = adminAppRouter
