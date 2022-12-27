#!/usr/bin/env node

require('dotenv').config()
const axios = require('axios')
const appRoot = process.env.DEPLOYMENT
const appPass = process.env.PASSWORD

const authParams = {
  headers: {
    Authorization: `Bearer ${appPass}`
  }
}

;(async () => {
  const listResponse = await axios.get(`${appRoot}/_list`, authParams)

  listResponse.data.forEach(({ status, redirect, shortcode }) => {
    const looksLikeWebhook = /webhook/.test(redirect)
    const isWebhookStatus = status === 307
    if (!looksLikeWebhook || isWebhookStatus) return

    const looksLikeDiscordWebhook = /^https:\/\/(?:canary\.)?discord\.com\/api\/webhooks/.test(redirect)
    if (looksLikeDiscordWebhook) {
      console.info('Shortcode', shortcode, 'looks like a discord webhook. Sending a friendly message.')

      axios.post(redirect, {
        username: 'Steve H. Ackerman#1438',
        avatar_url: 'https://cdn.discordapp.com/avatars/805590585826082818/ca6ca3e427619a13fa3ee528d5d030d1.webp',
        content: `
It looks like you're trying to use \`${appRoot}\` to shorten a webhook.
You should use status \`307\` instead of \`301\`.
THIS SHORTCODE (\`${shortcode}\`) WILL BE DELETED.
Check out this article for more information: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        `,
        embeds: [{
          title: 'Shortcode',
          fields: [{
            name: 'Shortcode',
            value: shortcode,
            inline: true
          }, {
            name: 'Status',
            value: status,
            inline: true
          }, {
            name: 'Redirect',
            value: redirect
          }]
        }]
      })
    }

    console.info('DELETING:', shortcode, 'uses status', status, 'but looks like a webhook', redirect)
    axios.delete(`${appRoot}/${shortcode}`, authParams)
  })

})()
