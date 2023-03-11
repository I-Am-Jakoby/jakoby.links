const get = require('lodash/get')
const sortBy = require('lodash/sortBy')
const groupBy = require('lodash/groupBy')

const geoip = require('geoip-country')

const { appVars, shortcodeInvocations } = require('../lib')

module.exports = async (req, res) => {
  const invocationsResponse = await shortcodeInvocations.filter()
  const invocations = invocationsResponse.results.map(({ props }) => {
    const country = get(geoip.lookup(props.ip), 'country', 'UNKNOWN')
    return { ...props, country }
  })

  const invocationsByShortcode = groupBy(invocations, 'shortcode')
  const invocationsCountByShortcode = Object.entries(invocationsByShortcode).reduce((memo, [shortcode, invocations]) => ([ ...memo, { shortcode, invocations } ]), [])
  const sortedInvocationsCountByShortcode = sortBy(invocationsCountByShortcode, ({ invocations }) => -invocations.length)

  const invocationsByCountry = groupBy(invocations, 'country')
  const invocationsCountByCountry = Object.entries(invocationsByCountry).reduce((memo, [country, invocations]) => ([ ...memo, { country, invocations } ]), [])
  const sortedInvocationsCountByCountry = sortBy(invocationsCountByCountry, ({ invocations }) => -invocations.length)

  const invocationsByIP = groupBy(invocations, 'ip')
  const invocationsCountByIP = Object.entries(invocationsByIP).reduce((memo, [ip, invocations]) => ([ ...memo, { ip, invocations } ]), [])
  const sortedInvocationsCountByIP = sortBy(invocationsCountByIP, ({ invocations }) => -invocations.length)

  res.render('admin/report.html.ejs', {
    appVars,
    invocationsByShortcodeData: sortedInvocationsCountByShortcode.map(({ invocations }) => invocations.length),
    invocationsByShortcodeLabels: sortedInvocationsCountByShortcode.map(({ shortcode }) => shortcode),
    invocationsByCountryData: sortedInvocationsCountByCountry.map(({ invocations }) => invocations.length),
    invocationsByCountryLabels: sortedInvocationsCountByCountry.map(({ country }) => country)
  })
}
