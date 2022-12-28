const db = require('@cyclic.sh/dynamodb')
const get = require('lodash/get')
const hljs = require('highlight.js')
const Chance = require('chance')
const { marked } = require('marked')

module.exports.db = db
module.exports.marked = marked

const shortcodes = module.exports.shortcodes = db.collection('shortcodes')
const shortcodeCreations = module.exports.shortcodeCreations = db.collection('shortcode_creations')
const shortcodeInvocations = module.exports.shortcodeInvocations = db.collection('shortcode_invocations')

const appPort = module.exports.appPort = get(process, 'env.PORT', 3000)
const appRoot = module.exports.appRoot = get(process, 'env.DEPLOYMENT', `http://localhost:${appPort}`)
const appWebsite = module.exports.appWebsite = get(process, 'env.WEBSITE', appRoot)
const appShortcodeLength = module.exports.appShortcodeLength = parseInt(get(process, 'env.SHORTCODE_LENGTH', 6))

const appProduct = module.exports.appProduct = get(process, 'env.PRODUCT', 'Simple Shortcode Service')
const appProductLogo = module.exports.appProductLogo = get(process, 'env.PRODUCT_LOGO', 'Simple Shortcode Service')
const appProductDescription = module.exports.appProductDescription = get(process, 'env.PRODUCT_DESCRIPTION', 'Simple Shortcode Service')

const appNotifyHook = module.exports.appNotifyHook = get(process, 'env.NOTIFY_WEBHOOK', appRoot)

const appDiscordUser = module.exports.appDiscordUser = get(process, 'env.DISCORD_USER', appRoot)
const appDiscordUserImage = module.exports.appDiscordUserImage = get(process, 'env.DISCORD_USER_IMAGE', 'https://i.imgur.com/myekW.jpeg')

const allowedStatuses = module.exports.allowedStatuses = [ 300, 301, 302, 303, 304, 307 ]

module.exports.appVars = {
  port: appPort,
  root: appRoot,
  website: appWebsite,
  shortcodeLength: appShortcodeLength,
  product: appProduct,
  productLogo: appProductLogo,
  productDescription: appProductDescription,
  notifyHook: appNotifyHook,
  discordUser: appDiscordUser,
  discordUserImage: appDiscordUserImage,
  statuses: allowedStatuses
}

// Configure marked
marked.setOptions({
  gfm: true,
  langPrefix: 'hljs language-',
  highlight: (code, lang) => {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  }
})

// Algorithm for generating a new shortcode
module.exports.generateShortcode = async (length = appShortcodeLength) => {
  const shortcode = (new Chance()).word({ length })
  const existingShortcode = await shortcodes.get(shortcode)
  if (!existingShortcode) return shortcode
  return await generateShortcode(length + 1)
}

// Output formatting for shortcode records
module.exports.formatShortcodeRecord = shortcodeRecord => ({
  status: get(shortcodeRecord, 'props.status', 301),
  redirect: get(shortcodeRecord, 'props.redirect', appWebsite),
  shortcode: get(shortcodeRecord, 'key')
})
