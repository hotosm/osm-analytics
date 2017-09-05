/* eslint quotes: "off" */

import buildings from './buildings.json'
import highways from './highways.json'
import waterways from './waterways.json'
import pois from './pois.json'

import settings from '../../../settings/settings'
import { filters as filterOptions } from '../../../settings/options'
import themes from '../../../settings/themes'

const applyTheme = (themeName, style) => {
  return !themes[themeName]
    ? style
    : Object.assign(style, {
      layers: style.layers.map(layer =>
        Object.assign(layer, {
          paint: (themes[themeName][style.name]
            .filter(th => th.id === layer.id)[0] || layer)
            .paint
        })
      )
    })
}

export default function getStyle(filters, options) {
  if (!options) options = {}
  const currentTheme = options.theme || 'default'
  const timeFilter = options.timeFilter
  const experienceFilter = options.experienceFilter
  const server = options.source || settings['vt-source']

  const filterStyles = {
    buildings: applyTheme(currentTheme, buildings),
    highways: applyTheme(currentTheme, highways),
    waterways: applyTheme(currentTheme, waterways),
    pois: applyTheme(currentTheme, pois),
  }

  var allSources = {}
  filterOptions.forEach(filterOption => {
    let style = filterOption.id
    if (!filterStyles[style]) throw new Error('gl style undefined for feature type ', filterOption)
    Object.keys(filterStyles[style].sources).forEach(source => {
      allSources[source] = JSON.parse(JSON.stringify(filterStyles[style].sources[source]))
      allSources[source].tiles[0] = allSources[source].tiles[0].replace('{{server}}', server)
    })
  })

  return {
    "version": 8,
    "sources": allSources,
    "layers": filters
      .map(filter => filterStyles[filter].layers.map(layer => {
        if (!layer.id.match(/highlight/)) return layer
        if (!timeFilter && !experienceFilter) {
          layer.filter = ["==", "_timestamp", -1]
        }
        if (timeFilter) {
          layer.filter = ["all",
            [">=", "_timestamp", timeFilter[0]],
            ["<=", "_timestamp", timeFilter[1]]
          ]
        }
        if (experienceFilter) {
          layer.filter = ["all",
            [">=", "_userExperience", experienceFilter[0]],
            ["<=", "_userExperience", experienceFilter[1]]
          ]
        }

        return layer
      }))
      .reduce((prev, filterSources) => prev.concat(filterSources), [])
      .sort((a,b) => {
        if (a.id.match(/highlight/) && b.id.match(/highlight/)) return 0
        if (a.id.match(/highlight/)) return +1
        if (b.id.match(/highlight/)) return -1
        return 0
      })
  }
  buildings,
  highways,
  waterways
}

export function getCompareStyles(filters, compareTimes, theme) {
  const beforeSource = (compareTimes[0] === 'now') ? settings['vt-source'] : settings['vt-hist-source']+'/'+compareTimes[0]
  const afterSource = (compareTimes[1] === 'now') ? settings['vt-source'] : settings['vt-hist-source']+'/'+compareTimes[1]
  var glCompareLayerStyles = {
    before: JSON.parse(JSON.stringify(getStyle(filters, { source: beforeSource, theme }))),
    after: JSON.parse(JSON.stringify(getStyle(filters, { source: afterSource, theme })))
  }
  // don't need highlight layers
  glCompareLayerStyles.before.layers = glCompareLayerStyles.before.layers.filter(layer => !layer.source.match(/highlight/))
  glCompareLayerStyles.after.layers = glCompareLayerStyles.before.layers.filter(layer => !layer.source.match(/highlight/))
  return glCompareLayerStyles
}
