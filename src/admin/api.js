const get = require('lodash/get')
const axios = require('axios')
const { Router } = require('express')

const {
  appRoot,
  appDiscordUser,
  appDiscordUserImage,
  shortcodes,
  shortcodeCreations,
  shortcodeInvocations,
  formatShortcodeRecord
} = require('../lib')

const adminApiRouter = new Router()

// DELETE
adminApiRouter.delete('/shortcodes/:shortcode', async (req, res) => {
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

adminApiRouter.post('/cleanup_301_webhooks', async (req, res) => {
  const { results } = await shortcodes.list(Infinity)

  const shortcodeRecords = await Promise.all(results.map(async ({ key }) => {
    const shortcodeRecord = await shortcodes.get(key)
    return formatShortcodeRecord(shortcodeRecord)
  }))

  const actionsCollector = []
  shortcodeRecords.forEach(({ status, redirect, shortcode }) => {
    const looksLikeWebhook = /webhook/.test(redirect)
    const isWebhookStatus = status === 307
    if (!looksLikeWebhook || isWebhookStatus) return

    const looksLikeDiscordWebhook = /^https:\/\/(?:canary\.)?discord\.com\/api\/webhooks/.test(redirect)
    if (looksLikeDiscordWebhook) {
      actionsCollector.push({ shortcode, redirect, status, action: 'Send discord webhook message.' })

      axios.post(redirect, {
        username: appDiscordUser,
        avatar_url: appDiscordUserImage,
        content: `
It looks like you're trying to use \`${appRoot}\` to shorten a webhook.
You should use status \`307\` instead of \`301\`.

**Your shortcode (\`${shortcode}\`) will be deleted.**

*Check out this article for more information:*
*https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307*
        `
      })
    }

    actionsCollector.push({ shortcode, redirect, status, action: 'Deleting shortcode.' })
    shortcodes.delete(shortcode)
  })

  return res.json(actionsCollector)
})

module.exports = adminApiRouter
