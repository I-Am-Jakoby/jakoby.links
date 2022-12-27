const get = require('lodash/get')
const { Router } = require('express')

const {
  appRoot,
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
  res.render('admin/index.html.ejs', { appRoot, shortcodes: formattedShortcodes })
})

adminAppRouter.get('/shortcodes/:shortcode', async (req, res) => {
  const shortcodeRecord = await shortcodes.get(get(req, 'params.shortcode'))
  const shortcode = { _key: shortcodeRecord.key, ...shortcodeRecord.props }

  const { props: creation } = await shortcodeCreations.get(shortcode._key)
  const { results: invocationRecords } = await shortcodeInvocations.filter({ shortcode: shortcode._key })
  const invocations = invocationRecords.map(({ props }) => props)

  res.render('admin/shortcode.html.ejs', { appRoot, shortcode, creation, invocations })
})

module.exports = adminAppRouter

// READ
// adminApiRouter.get('/shortcodes', async (req, res) => {
//   const { results } = await shortcodes.list(Infinity)
//   const shortcodeRecords = await Promise.all(results.map(({ key }) => shortcodes.get(key)))
//   res.json(shortcodeRecords.map(formatShortcodeRecord))
// })
//
// adminApiRouter.get('/creations', async (req, res) => {
//   const { results } = await shortcodeCreations.list(Infinity)
//   const records = await Promise.all(results.map(({ key }) => shortcodeCreations.get(key)))
//   res.json(records.map(record => get(record, 'props')))
// })
//
// adminApiRouter.get('/invocations', async (req, res) => {
//   const { results } = await shortcodeInvocations.list(Infinity)
//   const records = await Promise.all(results.map(({ key }) => shortcodeInvocations.get(key)))
//   res.json(records.map(record => get(record, 'props')))
// })

// READ
// adminApiRouter.get('/shortcodes/:shortcode', async (req, res) => {
//   const shortcode = get(req, 'params.shortcode')
//   const shortcodeRecord = await shortcodes.get(shortcode)
//   if (!shortcodeRecord) return res.sendStatus(404)
//
//   const record = formatShortcodeRecord(shortcodeRecord)
//   const { props: creation } = await shortcodeCreations.get(shortcode)
//   const { results: invocationRecords } = await shortcodeInvocations.filter({ shortcode })
//   const invocations = invocationRecords.map(({ props }) => props)
//   res.json({ ...record, creation, invocations })
// })
