//
// Global map.js variables
//

var $selectExclude
var $selectPokemonNotify
var $selectRarityNotify
var $textPerfectionNotify
var $textLevelNotify
var $selectStyle
var $selectIconSize
var $switchOpenGymsOnly
var $switchActiveRaidGymsOnly
var $switchRaidMinLevel
var $switchRaidMaxLevel
var $selectTeamGymsOnly
var $selectLastUpdateGymsOnly
var $selectMinGymLevel
var $selectMaxGymLevel
var $selectTrainerGymsOnly
var $selectLuredPokestopsOnly
var $selectSearchIconMarker
var $selectLocationIconMarker
var $switchGymSidebar

const language = document.documentElement.lang === '' ? 'en' : document.documentElement.lang
var idToPokemon = {}
var i8lnDictionary = {}
var languageLookups = 0
var languageLookupThreshold = 3

var searchMarkerStyles

var timestamp
var excludedPokemon = []
var notifiedPokemon = []
var notifiedRarity = []
var notifiedMinPerfection = null
var notifiedMinLevel = null

var buffer = []
var reincludedPokemon = []
var reids = []

var map
var markerCluster = window.markerCluster = {}
var rawDataIsLoading = false
var locationMarker
const rangeMarkers = ['pokemon', 'pokestop', 'gym']
var searchMarker
var storeZoom = true
var moves

var oSwLat
var oSwLng
var oNeLat
var oNeLng

var lastpokestops
var lastgyms
var lastpokemon
var lastslocs
var lastspawns

var polygons = []
var geofencesSet = false

var selectedStyle = 'light'

var updateWorker
var lastUpdateTime
var redrawTimeout = null

const gymTypes = ['Uncontested', 'Mystic', 'Valor', 'Instinct']

const audio = new Audio('static/sounds/pokewho.mp3')
const cryFileTypes = ['wav', 'mp3', 'ogg']

const genderType = ['L', '♂', '♀', '⚲']
const unownForm = ['unset', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '!', '?']

const dittoTexts = {
  16: `<span>(Pidgey)</span>`,
  19: `<span>(Rattata)</span>`,
  41: `<span>(Zubat)</span>`,
  161: `<span>(Sentret)</span>`,
  163: `<span>(Hoothoot)</span>`,
  193: `<span>(Yanma)</span>`,
}

const costumeTexts = {
  1: '(Holiday Hat)',
  2: '(Party Hat)',
  3: '(Ash Hat)',
  4: '(Witch Hat)',
}
const weatherImages = {
  1: 'weather_sunny.png',
  2: 'weather_rain.png',
  3: 'weather_partlycloudy_day.png',
  4: 'weather_cloudy.png',
  5: 'weather_windy.png',
  6: 'weather_snow.png',
  7: 'weather_fog.png',
  11: 'weather_clear_night.png',
  13: 'weather_partlycloudy_night.png',
  15: 'weather_moderate.png',
  16: 'weather_extreme.png'
}

const weatherTexts = {
  1: 'Clear',
  2: 'Rain',
  3: 'Partly Cloudy',
  4: 'Cloudy',
  5: 'Windy',
  6: 'Snow',
  7: 'Fog',
}

const alertTexts = {
  1: 'Moderate',
  2: 'Extreme',
}

/*
 text place holders:
 <pkm> - pokemon name
 <prc> - iv in percent without percent symbol
 <atk> - attack as number
 <def> - defense as number
 <sta> - stamnia as number
 */
var notifyIvTitle = '<pkm> <prc>% (<atk>/<def>/<sta>)'
var notifyNoIvTitle = '<pkm>'

/*
 text place holders:
 <dist>  - disappear time
 <udist> - time until disappear
 */
var notifyText = 'disappears at <dist> (<udist>)'

//
// Functions
//

function isShowAllZoom() {
    return showAllZoomLevel > 0 && map.getZoom() >= showAllZoomLevel
}

function getExcludedPokemon() {
    return isShowAllZoom() ? [] : excludedPokemon
}

function excludePokemon(id) { // eslint-disable-line no-unused-vars
    $selectExclude.val(
        $selectExclude.val().concat(id)
    ).trigger('change')
}

function notifyAboutPokemon(id) { // eslint-disable-line no-unused-vars
    $selectPokemonNotify.val(
        $selectPokemonNotify.val().concat(id)
    ).trigger('change')
}

function removePokemonMarker(encounterId) { // eslint-disable-line no-unused-vars
    if (mapData.pokemons[encounterId].marker.rangeCircle) {
        mapData.pokemons[encounterId].marker.rangeCircle.setMap(null)
        delete mapData.pokemons[encounterId].marker.rangeCircle
    }
    if (mapData.pokemons[encounterId].marker.infoWindowIsOpen) {
        mapData.pokemons[encounterId].marker.persist = null
        mapData.pokemons[encounterId].marker.infoWindow.close()
        mapData.pokemons[encounterId].marker.infoWindowIsOpen = false
    }
    mapData.pokemons[encounterId].marker.setMap(null)
    mapData.pokemons[encounterId].marker.setVisible(false)
    mapData.pokemons[encounterId].hidden = true
}

function removelurePokemonMarker(encounterId) { // eslint-disable-line no-unused-vars
    if (mapData.lurePokemons[encounterId].marker.rangeCircle) {
        mapData.lurePokemons[encounterId].marker.rangeCircle.setMap(null)
        delete mapData.lurePokemons[encounterId].marker.rangeCircle
    }
    mapData.lurePokemons[encounterId].marker.setMap(null)
    mapData.lurePokemons[encounterId].hidden = true
}

function createServiceWorkerReceiver() {
    navigator.serviceWorker.addEventListener('message', function (event) {
        const data = JSON.parse(event.data)
        if (data.action === 'centerMap' && data.lat && data.lon) {
            centerMap(data.lat, data.lon, 20)
        }
    })
}

function initMap() { // eslint-disable-line no-unused-vars
    map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: Number(getParameterByName('lat')) || centerLat,
            lng: Number(getParameterByName('lon')) || centerLng
        },
        zoom: Number(getParameterByName('zoom')) || Store.get('zoomLevel'),
        gestureHandling: 'greedy',
        fullscreenControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        clickableIcons: false,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.RIGHT_TOP,
            mapTypeIds: [
                google.maps.MapTypeId.ROADMAP,
                google.maps.MapTypeId.SATELLITE,
                google.maps.MapTypeId.HYBRID,
                'nolabels_style',
                'dark_style',
                'style_light2',
                'style_pgo',
                'dark_style_nl',
                'style_light2_nl',
                'style_pgo_nl',
                'style_pgo_day',
                'style_pgo_night',
                'style_pgo_dynamic'
            ]
        }
    })

    // Enable clustering.
    var clusterOptions = {
        imagePath: 'static/images/cluster/m',
        maxZoom: Store.get('maxClusterZoomLevel'),
        zoomOnClick: Store.get('clusterZoomOnClick'),
        gridSize: Store.get('clusterGridSize')
    }

    markerCluster = new MarkerClusterer(map, [], clusterOptions)

    var styleNoLabels = new google.maps.StyledMapType(noLabelsStyle, {
        name: 'No Labels'
    })
    map.mapTypes.set('nolabels_style', styleNoLabels)

    var styleDark = new google.maps.StyledMapType(darkStyle, {
        name: 'Dark'
    })
    map.mapTypes.set('dark_style', styleDark)

    var styleLight2 = new google.maps.StyledMapType(light2Style, {
        name: 'Light2'
    })
    map.mapTypes.set('style_light2', styleLight2)

    var stylePgo = new google.maps.StyledMapType(pGoStyle, {
        name: 'RocketMap'
    })
    map.mapTypes.set('style_pgo', stylePgo)

    var styleDarkNl = new google.maps.StyledMapType(darkStyleNoLabels, {
        name: 'Dark (No Labels)'
    })
    map.mapTypes.set('dark_style_nl', styleDarkNl)

    var styleLight2Nl = new google.maps.StyledMapType(light2StyleNoLabels, {
        name: 'Light2 (No Labels)'
    })
    map.mapTypes.set('style_light2_nl', styleLight2Nl)

    var stylePgoNl = new google.maps.StyledMapType(pGoStyleNoLabels, {
        name: 'RocketMap (No Labels)'
    })
    map.mapTypes.set('style_pgo_nl', stylePgoNl)

    var stylePgoDay = new google.maps.StyledMapType(pGoStyleDay, {
        name: 'RocketMap Day'
    })
    map.mapTypes.set('style_pgo_day', stylePgoDay)

    var stylePgoNight = new google.maps.StyledMapType(pGoStyleNight, {
        name: 'RocketMap Night'
    })
    map.mapTypes.set('style_pgo_night', stylePgoNight)

    // dynamic map style chooses stylePgoDay or stylePgoNight depending on client time
    var currentDate = new Date()
    var currentHour = currentDate.getHours()
    var stylePgoDynamic = (currentHour >= 6 && currentHour < 17.5) ? stylePgoDay : stylePgoNight
    map.mapTypes.set('style_pgo_dynamic', stylePgoDynamic)

    map.addListener('maptypeid_changed', function (s) {
        Store.set('map_style', this.mapTypeId)
    })

    map.setMapTypeId(Store.get('map_style'))
    map.addListener('idle', updateMap)

    map.addListener('zoom_changed', function () {
        if (storeZoom === true) {
            Store.set('zoomLevel', this.getZoom())
        } else {
            storeZoom = true
        }

        // User scrolled again, reset our timeout.
        if (redrawTimeout) {
            clearTimeout(redrawTimeout)
            redrawTimeout = null
        }

        // Don't redraw constantly even if the user scrolls multiple times,
        // just add it on a timer.
        redrawTimeout = setTimeout(function () {
            redrawPokemon(mapData.pokemons)
            redrawPokemon(mapData.lurePokemons)

            // We're done processing the list. Repaint.
            markerCluster.repaint()
        }, 500)
    })

    //searchMarker = createSearchMarker()
    //locationMarker = createLocationMarker()
    //createMyLocationButton()
    initSidebar()

	/*
    $('#scan-here').on('click', function () {
        var loc = map.getCenter()
        changeLocation(loc.lat(), loc.lng())

        if (!$('#search-switch').checked) {
            $('#search-switch').prop('checked', true)
            searchControl('on')
        }
    })*/

    if (Push._agents.chrome.isSupported()) {
        createServiceWorkerReceiver()
    }
}

/*
function updateLocationMarker(style) {
    if (style in searchMarkerStyles) {
        var url = searchMarkerStyles[style].icon
        if (url) {
            locationMarker.setIcon({
                url: url,
                scaledSize: new google.maps.Size(24, 24)
            })
        } else {
            locationMarker.setIcon(url)
        }
        Store.set('locationMarkerStyle', style)
    }

    return locationMarker
}

function createLocationMarker() {
    var position = Store.get('followMyLocationPosition')
    var lat = ('lat' in position) ? position.lat : centerLat
    var lng = ('lng' in position) ? position.lng : centerLng

    var locationMarker = new google.maps.Marker({
        map: map,
        animation: google.maps.Animation.DROP,
        position: {
            lat: lat,
            lng: lng
        },
        draggable: true,
        icon: null,
        optimized: false,
        zIndex: google.maps.Marker.MAX_ZINDEX + 2
    })

    locationMarker.infoWindow = new google.maps.InfoWindow({
        content: '<div><b>My Location</b></div>',
        disableAutoPan: true
    })

    addListeners(locationMarker)

    google.maps.event.addListener(locationMarker, 'dragend', function () {
        var newLocation = locationMarker.getPosition()
        Store.set('followMyLocationPosition', {
            lat: newLocation.lat(),
            lng: newLocation.lng()
        })
    })

    return locationMarker
}


function updateSearchMarker(style) {
    if (style in searchMarkerStyles) {
        var url = searchMarkerStyles[style].icon
        if (url) {
            searchMarker.setIcon({
                url: url,
                scaledSize: new google.maps.Size(24, 24)
            })
        } else {
            searchMarker.setIcon(url)
        }
        Store.set('searchMarkerStyle', style)
    }

    return searchMarker
}

function createSearchMarker() {
    var searchMarker = new google.maps.Marker({ // need to keep reference.
        position: {
            lat: centerLat,
            lng: centerLng
        },
        map: map,
        animation: google.maps.Animation.DROP,
        draggable: !Store.get('lockMarker'),
        icon: null,
        optimized: false,
        zIndex: google.maps.Marker.MAX_ZINDEX + 1
    })

    searchMarker.infoWindow = new google.maps.InfoWindow({
        content: '<div><b>Search Location</b></div>',
        disableAutoPan: true
    })

    addListeners(searchMarker)

    var oldLocation = null
    google.maps.event.addListener(searchMarker, 'dragstart', function () {
        oldLocation = searchMarker.getPosition()
    })

    google.maps.event.addListener(searchMarker, 'dragend', function () {
        var newLocation = searchMarker.getPosition()
        changeSearchLocation(newLocation.lat(), newLocation.lng())
            .done(function () {
                oldLocation = null
            })
            .fail(function () {
                if (oldLocation) {
                    searchMarker.setPosition(oldLocation)
                }
            })
    })

    return searchMarker
}
*/

var searchControlURI = 'search_control'

function searchControl(action) {
    $.post(searchControlURI + '?action=' + encodeURIComponent(action))
    $('#scan-here').toggleClass('disabled', action === 'off')
}

function updateSearchStatus() {
    $.getJSON(searchControlURI).then(function (data) {
        $('#search-switch').prop('checked', data.status)
        $('#scan-here').toggleClass('disabled', !data.status)
    })
}

function initSidebar() {
    $('#gyms-switch').prop('checked', Store.get('showGyms'))
    $('#gym-sidebar-switch').prop('checked', Store.get('useGymSidebar'))
    $('#gym-sidebar-wrapper').toggle(Store.get('showGyms') || Store.get('showRaids'))
    $('#gyms-filter-wrapper').toggle(Store.get('showGyms'))
    $('#trainer-gyms-only').val(Store.get('showTrainerGymsOnly'))
    $('#team-gyms-only-switch').val(Store.get('showTeamGymsOnly'))
    $('#raids-switch').prop('checked', Store.get('showRaids'))
    $('#raid-active-gym-switch').prop('checked', Store.get('showActiveRaidsOnly'))
    $('#raid-min-level-only-switch').val(Store.get('showRaidMinLevel'))
    $('#raid-max-level-only-switch').val(Store.get('showRaidMaxLevel'))
    $('#raids-filter-wrapper').toggle(Store.get('showRaids'))
    $('#open-gyms-only-switch').prop('checked', Store.get('showOpenGymsOnly'))
    $('#min-level-gyms-filter-switch').val(Store.get('minGymLevel'))
    $('#max-level-gyms-filter-switch').val(Store.get('maxGymLevel'))
    $('#last-update-gyms-switch').val(Store.get('showLastUpdatedGymsOnly'))
    $('#pokemon-switch').prop('checked', Store.get('showPokemon'))
    $('#lure-pokemon-switch').prop('checked', Store.get('showLurePokemon'))
    $('#pokemon-settings-wrapper').toggle(Store.get('showPokemon'))
    $('#pokemon-scale-by-rarity-switch').prop('checked', Store.get('scaleByRarity'))
    $('#pokestops-switch').prop('checked', Store.get('showPokestops'))
    $('#lured-pokestops-only-switch').val(Store.get('showLuredPokestopsOnly'))
    $('#lured-pokestops-only-wrapper').toggle(Store.get('showPokestops'))
    $('#geoloc-switch').prop('checked', Store.get('geoLocate'))
    $('#lock-marker-switch').prop('checked', Store.get('lockMarker'))
    $('#start-at-user-location-switch').prop('checked', Store.get('startAtUserLocation'))
    $('#follow-my-location-switch').prop('checked', Store.get('followMyLocation'))
    $('#scan-here-switch').prop('checked', Store.get('scanHere'))
    $('#scan-here').toggle(Store.get('scanHere'))
    $('#scanned-switch').prop('checked', Store.get('showScanned'))
    $('#spawnpoints-switch').prop('checked', Store.get('showSpawnpoints'))
    $('#ranges-switch').prop('checked', Store.get('showRanges'))
    $('#hideunnotified-switch').prop('checked', Store.get('hideNotNotified'))
    $('#popups-switch').prop('checked', Store.get('showPopups'))
    $('#bounce-switch').prop('checked', Store.get('isBounceDisabled'))
    $('#sound-switch').prop('checked', Store.get('playSound'))
    $('#pokemoncries').toggle(Store.get('playSound'))
    $('#cries-switch').prop('checked', Store.get('playCries'))
    $('#map-service-provider').val(Store.get('mapServiceProvider'))
    $('#medal-wrapper').toggle(Store.get('showMedal'))
    $('#medal-switch').prop('checked', Store.get('showMedal'))
    $('#medal-rattata-switch').prop('checked', Store.get('showMedalRattata'))
    $('#medal-magikarp-switch').prop('checked', Store.get('showMedalMagikarp'))
    $('#geofences-switch').prop('checked', Store.get('showGeofences'))
    $('#weather-cells-switch').prop('checked', Store.get('showWeatherCells'))
    $('#s2cells-switch').prop('checked', Store.get('showS2Cells'))
    $('#weather-alerts-switch').prop('checked', Store.get('showWeatherAlerts'))

    // Only create the Autocomplete element if it's enabled in template.
    var elSearchBox = document.getElementById('next-location')

    if (elSearchBox) {
        var searchBox = new google.maps.places.Autocomplete(elSearchBox)
        $(elSearchBox).css('background-color', $('#geoloc-switch').prop('checked') ? '#e0e0e0' : '#ffffff')

        searchBox.addListener('place_changed', function () {
            var place = searchBox.getPlace()

            if (!place.geometry) return

            var loc = place.geometry.location
            changeLocation(loc.lat(), loc.lng())
        })
    }

    if ($('#search-switch').length) {
        updateSearchStatus()
        setInterval(updateSearchStatus, 5000)
    }

    $('#pokemon-icon-size').val(Store.get('iconSizeModifier'))
}

function getTypeSpan(type) {
    return `<span style='padding: 2px 5px; text-transform: uppercase; color: white; margin-right: 2px; border-radius: 4px; font-size: 0.6em; vertical-align: middle; background-color: ${type['color']}'>${type['type']}</span>`
}

function openMapDirections(lat, lng) { // eslint-disable-line no-unused-vars
    var url = ''
    if (Store.get('mapServiceProvider') === 'googlemaps') {
        url = 'https://www.google.com/maps/?daddr=' + lat + ',' + lng
        window.open(url, '_blank')
    } else if (Store.get('mapServiceProvider') === 'applemaps') {
        url = 'https://maps.apple.com/maps?daddr=' + lat + ',' + lng
        window.open(url, '_self')
    }
}

// Converts timestamp to readable String
function getDateStr(t) {
    var dateStr = 'Unknown'
    if (t) {
        dateStr = moment(t).fromNow()
    }
    return dateStr
}

// Converts timestamp to readable String
function getlongDateStr(t) {
    var ldateStr = 'Unknown'
    if (t) {
        ldateStr = moment(t).format('llll')
    }
    return ldateStr
}

// Converts timestamp to readable String
function getshortDateStr(t) {
    var sdateStr = 'Unknown'
    if (t) {
        sdateStr = moment(t).format('DD/HH:mm')
    }
    return sdateStr
}

function scout(encounterId) { // eslint-disable-line no-unused-vars
    var infoEl = $('#scoutInfo' + atob(encounterId))

    $.ajax({
        url: 'scout',
        type: 'GET',
        data: {
            'encounter_id': encounterId
        },
        dataType: 'json',
        cache: false,
        beforeSend: function () {
            infoEl.text('Scouting, please wait...')
            infoEl.show()
        },
        error: function () {
            infoEl.text('Error scouting, try again?')
        },
        success: function (data, textStatus, jqXHR) {
            if (data.success) {
                // update local values
                var pkm = mapData.pokemons[encounterId]
                pkm['individual_attack'] = data.iv_attack
                pkm['individual_defense'] = data.iv_defense
                pkm['individual_stamina'] = data.iv_stamina
                pkm['move_1'] = data.move_1
                pkm['move_2'] = data.move_2
                pkm['weight'] = data.weight
                pkm['height'] = data.height
                pkm['gender'] = data.gender
                pkm['cp'] = data.cp
                pkm['cp_multiplier'] = data.cp_multiplier
                pkm['catch_prob_1'] = data.catch_prob_1
                pkm['catch_prob_2'] = data.catch_prob_2
                pkm['catch_prob_3'] = data.catch_prob_3
                pkm['rating_attack'] = data.rating_attack
                pkm['rating_defense'] = data.rating_defense
                pkm['previous_id'] = data.previous_id
                pkm['weather_id'] = data.weather_id
                pkm.marker.infoWindow.setContent(pokemonLabel(pkm))
            } else {
                infoEl.text(data.error)
            }
        }
    })
}

function sizeRatio(height, weight, baseHeight, baseWeight) {
    var heightRatio = height / baseHeight
    var weightRatio = weight / baseWeight

    return heightRatio + weightRatio
}

function isMedalPokemonMap(item) {
    if (item['height'] == null && item['weight'] == null) {
        return false
    }
    var baseHeight = (item['pokemon_id'] === 19) ? 0.30 : 0.90
    var baseWeight = (item['pokemon_id'] === 129) ? 3.50 : 10.00
    var ratio = sizeRatio(item['height'], item['weight'], baseHeight, baseWeight)
    if (Store.get('showMedal')) {
      if ((item['pokemon_id'] === 19 && ratio < 1.5) ||
            (item['pokemon_id'] === 129 && ratio > 2.5 && item['weight'] >= 13.13)) {
          return true
      }
    }
    return false
}

function pokemonLabel(pokemon) {
    var name = pokemon.pokemon_name
    var rarityDisplay = pokemon.pokemon_rarity ? '(' + pokemon.pokemon_rarity + ')' : ''
    var types = pokemon.pokemon_types
    var typesDisplay = ''
    var encounterId = pokemon.encounter_id
    var id = pokemon.pokemon_id
    var latitude = pokemon.latitude
    var longitude = pokemon.longitude
    var disappearTime = pokemon.disappear_time
    var atk = pokemon.individual_attack
    var def = pokemon.individual_defense
    var sta = pokemon.individual_stamina
    var pMove1 = (moves[pokemon.move_1] !== undefined) ? i8ln(moves[pokemon.move_1]['name']) : 'gen/unknown'
    var pMove2 = (moves[pokemon.move_2] !== undefined) ? i8ln(moves[pokemon.move_2]['name']) : 'gen/unknown'
    var weight = pokemon.weight
    var height = pokemon.height
    var gender = pokemon.gender
    var form = pokemon.form
    var cp = pokemon.cp
    var cpMultiplier = pokemon.cp_multiplier
    var prob1 = pokemon.catch_prob_1
    var prob2 = pokemon.catch_prob_2
    var prob3 = pokemon.catch_prob_3
    var ratingAttack = pokemon.rating_attack
    var ratingDefense = pokemon.rating_defense
    var previous_id = pokemon.previous_id
    var weather_id = pokemon.weather_id
    var time_id = pokemon.time_id
    var costume_id = pokemon.costume_id
    var spawnpoint_id = pokemon.spawnpoint_id
    var encounterIdLong = atob(encounterId)

    $.each(types, function (index, type) {
        typesDisplay += getTypeSpan(type)
    })

    var pkmIcon = ''
    if (generateImages) {
      pkmIcon = `<img class='pokemon sprite' src='${getPokemonIconImg(id, gender, form, costume_id, weather_id, time_id)}'>`
    } else {
      pkmIcon = `<img class='pokemon sprite' src='${pokemonIcon(id, form)}'>`
    }

    var details = ''
    var contentstring = ''
    var formString = ''

    if (id === 201 && form !== null && form > 0) {
        formString += `(${unownForm[form]})`
    }

    var dittoString = ''
    if (id === 132 && previous_id != null) {
        dittoString += dittoTexts[previous_id]
    }

    var costumeString = ''
    if (costume_id != null) {
        costumeString += costumeTexts[costume_id]
    }

    var medalString = ''
    var baseHeight = (pokemon.pokemon_id === 19) ? 0.30 : 0.90
    var baseWeight = (pokemon.pokemon_id === 129) ? 3.50 : 10.00
    var ratio = sizeRatio(pokemon.height, pokemon.weight, baseHeight, baseWeight)
    if (pokemon.pokemon_id == 19 && ratio < 1.5) {
      medalString += `<span>Tiny</span>`
    }
    if (pokemon.pokemon_id == 129 && ratio > 2.5 && pokemon.weight >= 13.13) {
      medalString += `<span>Big</span>`
    }

    if (gender != null) {
      gender = genderType[gender]
    } else {
      gender = ''
    }

    var removestring = ''
    if (gender == 'L') {
        removestring += `<i class='fa fa-lg fa-fw fa-trash-o'></i> <a href='javascript:removelurePokemonMarker("${encounterId}")'>Remove</a>`
    } else {
        removestring += `<i class='fa fa-lg fa-fw fa-trash-o'></i> <a href='javascript:removePokemonMarker("${encounterId}")'>Remove</a>`
    }

    contentstring += `
    <div class='pokemon name'>
      <b>${costumeString} ${dittoString} ${medalString} ${name}</b> <span class='pokemon name pokedex'><a href='http://pokemon.gameinfo.io/en/pokemon/${id}' target='_blank' title='View in Pokédex'>#${id}</a></span> ${formString} <span class='pokemon gender rarity'>${gender} ${rarityDisplay}</span> ${typesDisplay}
    </div>`

    var weatherBoost = ''
    var weatherIcon = ''
    if (time_id === 2) {
      if (weather_id !== 1 && weather_id !== 3) {
        weatherIcon = weatherImages[weather_id]
      } else {
        weatherIcon = weatherImages[weather_id + 10]
      }
    } else {
      weatherIcon = weatherImages[weather_id]
    }
    if (weather_id) {
        weatherBoost = `<div class='pokemon big'>Weather Boost:
            <img src='static/images/weather/${weatherIcon}' style="width: 24px; vertical-align: middle;">${weatherTexts[weather_id]}
            </div>`
    }

    if (gender == 'L') {
        contentstring += `
        <div>
            <b>Lured Pokemon</b>
        </div>`
    }
    var movesetRating = ''

    if (ratingAttack !== null) {
        movesetRating = `
          <div class='pokemon'>
            Moveset Rating:
            Attack <span class='pokemon encounter'>${ratingAttack}</span> |
            Defense <span class='pokemon encounter'>${ratingDefense}</span>
          </div>`
    }

    var catchProbs = ''

    if (prob1 !== null) {
        catchProbs = `
          <div class='pokemon'>
            Probs:
            <img class='pokemon ball' src='static/images/markers/pokeball.png'> ${(prob1 * 100).toFixed(1)}%
            <img class='pokemon ball' src='static/images/markers/greatball.png'> ${(prob2 * 100).toFixed(1)}%
            <img class='pokemon ball' src='static/images/markers/ultraball.png'> ${(prob3 * 100).toFixed(1)}%
          </div>`
    }

    if (cp !== null && cpMultiplier !== null) {
        var pokemonLevel = getPokemonLevel(cpMultiplier)

        if (atk !== null && def !== null && sta !== null) {
            var iv = getIv(atk, def, sta)
        }

        var iv_circle = cssPercentageCircle(`${iv.toFixed(0)}<br>%`, iv, 100, 82, 66, 51)
        var level_circle = cssPercentageCircle(`Lvl<br>${pokemonLevel}`, pokemonLevel, 35, 30, 20, 10)

        contentstring += `
          <div class='pokemon container'>
            <div class='pokemon container content-left'>
              <div>
                ${pkmIcon}
                <div class='pokemon cp big'>
                  CP: <span class='pokemon encounter big'>${cp}</span>
                </div>
                <div class='pokemon links'>
                  <i class='fa fa-lg fa-fw fa-eye-slash'></i> <a href='javascript:excludePokemon(${id})'>Hide</a>
                </div>
                <div class='pokemon links'>
                  <i class='fa fa-lg fa-fw fa-bullhorn'></i> <a href='javascript:notifyAboutPokemon(${id})'>Notify</a>
                </div>
                <div class='pokemon links'>
                ${removestring}
                </div>
                <div class='pokemon links'>
                  <i class='fa fa-lg fa-fw fa-binoculars'></i> <a href='javascript:scout("${encounterId}")'>Scout</a>
                </div>
              </div>
          </div>
          <div class='pokemon container content-right'>
            <div>
              <div class='pokemon disappear'>
                <span class='label-countdown' disappears-at='${disappearTime}'>00m00s</span> left (${moment(disappearTime).format('h:mm:ss a')})
              </div>
              ${weatherBoost}
              <div class='pokemon'>
                ${iv_circle}
                (A <span class='pokemon encounter'>${atk}</span> &nbsp;&nbsp; D <span class='pokemon encounter'>${def}</span> &nbsp;&nbsp; S <span class='pokemon encounter'>${sta}</span>)
                ${level_circle}
              </div>
              <div class='pokemon'>
                Moveset: <span class='pokemon encounter'>${pMove1}</span> / <span class='pokemon encounter'>${pMove2}</span>
              </div>
              ${movesetRating}
              <div class='pokemon'>
                Weight: ${weight.toFixed(2)}kg | Height: ${height.toFixed(2)}m
              </div>
              ${catchProbs}
              <div class='pokemon'>
                <span class='pokemon navigate'><a href='javascript:void(0);' onclick='javascript:openMapDirections(${latitude},${longitude});' title='Open in Google Maps'>${latitude.toFixed(6)}, ${longitude.toFixed(7)}</a></span>
              </div>
          </div>
        </div>
      </div>`
    } else {
        contentstring += `
      <div class='pokemon container'>
        <div class='pokemon container content-left'>
          <div>
            ${pkmIcon}
            <div class='pokemon links'>
              <i class='fa fa-lg fa-fw fa-eye-slash'></i> <a href='javascript:excludePokemon(${id})'>Hide</a>
            </div>
            <div class='pokemon links'>
              <i class='fa fa-lg fa-fw fa-bullhorn'></i> <a href='javascript:notifyAboutPokemon(${id})'>Notify</a>
            </div>
            <div class='pokemon links'>
              ${removestring}
            </div>
            <div class='pokemon links'>
              <i class='fa fa-lg fa-fw fa-binoculars'></i> <a href='javascript:scout("${encounterId}")'>Scout</a>
            </div>
          </div>
      </div>
      <div class='pokemon container content-right'>
        <div>
          <div class='pokemon disappear'>
            <span class='label-countdown' disappears-at='${disappearTime}'>00m00s</span> left (${moment(disappearTime).format('h:mm:ss a')})
          </div>
          ${weatherBoost}
          <div class='pokemon links'>
            <i class='fa fa-2x fa-binoculars'></i>&nbsp; <a href='javascript:scout("${encounterId}")'>Scout Pokemon</a>
          </div>
          <div class='pokemon'>
            <span class='pokemon navigate'><a href='javascript:void(0);' onclick='javascript:openMapDirections(${latitude},${longitude});' title='Open in Google Maps'>${latitude.toFixed(6)}, ${longitude.toFixed(7)}</a></span>
          </div>
          <div id='scoutInfo${encounterIdLong}' class='pokemon scoutinfo'></div>
      </div>
    </div>
  </div>`
    }

    contentstring += `
      ${details}`

    return contentstring
}

function isOngoingRaid(raid) {
    return raid && Date.now() < raid.end && Date.now() > raid.start
}

function isValidRaid(raid) {
    return raid && Date.now() < raid.end && Date.now() > raid.spawn
}

function isGymSatisfiesRaidMinMaxFilter(raid) {
    if (raid) {
        return (raid['level'] <= Store.get('showRaidMaxLevel') && raid['level'] >= Store.get('showRaidMinLevel')) ? 1 : 0
    } else {
        return 0
    }
}

function gymLabel(gym, includeMembers = true) {
    const raid = gym.raid
    var raidStr = ''
    if (raid && raid.end > Date.now()) {
        if (raid.pokemon_id !== null) {
            let pMove1 = (moves[raid['move_1']] !== undefined) ? i8ln(moves[raid['move_1']]['name']) : 'unknown'
            let pMove2 = (moves[raid['move_2']] !== undefined) ? i8ln(moves[raid['move_2']]['name']) : 'unknown'

            raidStr += `
                    <div class='move'>
                      <span class='name'>${pMove1}</span><span class='type ${moves[raid['move_1']]['type'].toLowerCase()}'>${i8ln(moves[raid['move_1']]['type'])}</span>
                    </div>
                    <div class='move'>
                      <span class='name'>${pMove2}</span><span class='type ${moves[raid['move_2']]['type'].toLowerCase()}'>${i8ln(moves[raid['move_2']]['type'])}</span>
                    </div>`
        }
    }
    const lastScannedStr = getDateStr(gym.last_scanned)
    const lastModifiedStr = getDateStr(gym.last_modified)
    const slotsString = gym.slots_available ? (gym.slots_available === 1 ? '1 Free Slot' : `${gym.slots_available} Free Slots`) : 'No Free Slots'
    const teamColor = ['85,85,85,1', '0,134,255,1', '255,26,26,1', '255,159,25,1']
    const teamName = gymTypes[gym.team_id]
    const isUpcomingRaid = raid != null && Date.now() < raid.start
    const isRaidStarted = isOngoingRaid(raid)
    const isRaidFilterOn = Store.get('showRaids')

    var subtitle = ''
    var rimage = ''
    var image = ''
    var imageLbl = ''
    var gymdes = ''
    var gymImg = ''
    var navInfo = ''
    var memberStr = ''

    const gymPoints = gym.total_cp
    const titleText = gym.name ? gym.name : (gym.team_id === 0 ? teamName : 'Team ' + teamName)
    const title = `
      <div class='gym name' style='color:rgba(${teamColor[gym.team_id]})'>
        ${titleText} Gym
      </div>`

    if (gym.team_id !== 0) {
        subtitle = `
        <div>
            <img class='gym info strength' src='static/images/gym/Strength.png'>
            <span class='gym info strength'>
              Strength: ${gymPoints} (${slotsString})
            </span>
        </div>`
    }

    if (typeof gym.description !== 'undefined' && gym.description !== null) {
      gymdes += `<span class='gym pokemon'>${gym.description}</span>`
	  }

    if (typeof gym.url !== 'undefined' && gym.url !== null) {
  		gymImg += `<img class="gym imgcircle team-${gym.team_id}" src="${gym.url}"/>`
  	}

    if ((isUpcomingRaid || isRaidStarted) && isRaidFilterOn && isGymSatisfiesRaidMinMaxFilter(raid)) {
        const raidColor = ['252,112,176', '255,158,22', '184,165,221']
        const levelStr = '★'.repeat(raid['level'])

        if (isRaidStarted) {
          // Use Pokémon-specific image.
          if (raid.pokemon_id !== null) {
                rimage = `
                    <div class='raid container'>
                    <div class='raid container content-left'>
                        <div>
                        <img class='gym sprite' src='static/sprites/${raid.pokemon_id}.png'>
                        </div>
                    </div>
                    <div class='raid container content-right'>
                        <div>
                        <div class='raid pokemon'>
                            ${raid['pokemon_name']} <a href='http://pokemon.gameinfo.io/en/pokemon/${raid['pokemon_id']}' target='_blank' title='View in Pokédex'>#${raid['pokemon_id']}</a> | CP: ${raid['cp']}
                    </div>
                        ${raidStr}
                    </div>
                    </div>
                </div>
                    <div class='raid'>
                    <span style='color:rgb(${raidColor[Math.floor((raid.level - 1) / 2)]})'>
                    ${levelStr}
                    </span>
                    <span class='raid countdown label-countdown' disappears-at='${raid.end}'></span> left (${moment(raid.end).format('h:mm:ss a')})
                    </div>
                `
            }
        }

    }
    if ((isUpcomingRaid) && isRaidFilterOn && isGymSatisfiesRaidMinMaxFilter(raid)) {
        const raidColor = ['252,112,176', '255,158,22', '184,165,221']
        const levelStr = '★'.repeat(raid['level'])
        if (gym.is_in_battle == 1) {
          image = `<span class='gym container2 content-right'> ${gymImg} <img class='gym container2 content-left' src='gym_img?team=${gymTypes[gym.team_id]}&level=${getGymLevel(gym)}&raidlevel=${raid.level}&battle=1'> </span>`
        } else {
          image = `<span class='gym container2 content-right'> ${gymImg} <img class='gym container2 content-left' src='gym_img?team=${gymTypes[gym.team_id]}&level=${getGymLevel(gym)}&raidlevel=${raid.level}'> </span>`
        }
        imageLbl = `
            <div class='raid'>
              <span style='color:rgb(${raidColor[Math.floor((raid.level - 1) / 2)]})'>
              ${levelStr}
              </span>
              Raid in <span class='raid countdown label-countdown' disappears-at='${raid.start}'> (${moment(raid.start).format('h:mm:ss a')})</span>
            </div>`
    } else if (gym.is_in_battle == 1) {
        image = `<span class='gym container2 content-right'> ${gymImg} <img class='gym container2 content-left' src='gym_img?team=${gymTypes[gym.team_id]}&level=${getGymLevel(gym)}&battle=1'> </span>`
        imageLbl = `<font size="3"><b>In Battle</b></font>`
    } else {
        image = `<span class='gym container2 content-right'> ${gymImg} <img class='gym container2 content-left' src='gym_img?team=${teamName}&level=${getGymLevel(gym)}'> </span>`
        imageLbl = `<font size="3"><b>${teamName}</b></font>`
    }


    navInfo = `
            <div class='gym container'>
                <div>
                  <span class='gym info navigate'>
                    <a href='javascript:void(0);' onclick='javascript:openMapDirections(${gym.latitude},${gym.longitude});' title='Open in Google Maps'>
                      ${gym.latitude.toFixed(6)}, ${gym.longitude.toFixed(7)}
                    </a>
                  </span>
                </div>
                <div class='gym info last-scanned'>
                    Last Scanned: ${lastScannedStr}
                </div>
                <div class='gym info last-modified'>
                    Last Modified: ${lastModifiedStr}
                </div>
            </div>
        </div>`

    if (includeMembers) {
        memberStr = '<div>'
        gym.pokemon.forEach((member) => {
            var deployStr = getDateStr(member.deployment_time)
            var shortdeployStr = getshortDateStr(member.deployment_time)
            var longdeployStr = getlongDateStr(member.deployment_time)
            var berryImg = ''
            if (member.cp_decayed < (member.pokemon_cp - 200) && member.cp_decayed >= (member.pokemon_cp - 800)) {
              berryImg += `<img class='gym berry' src='static/images/gym/berry1.png'>`
            } else if (member.cp_decayed < (member.pokemon_cp - 600) && member.cp_decayed >= (member.pokemon_cp - 1200)) {
              berryImg += `<img class='gym berry' src='static/images/gym/berry2.png'>`
            } else if (member.cp_decayed < (member.pokemon_cp - 1200) && member.cp_decayed >= (member.pokemon_cp - 1800)) {
              berryImg += `<img class='gym berry' src='static/images/gym/berry3.png'>`
            } else if (member.cp_decayed < (member.pokemon_cp - 1800)) {
              berryImg += `<img class='gym berry' src='static/images/gym/berry4.png'>`
            }

            var dtimeStr = ''
            var coinoutStr = ''
            var deploycount = member.deployment_time

            var timeDiff = Date.now() - member.deployment_time
            var gseconds = Math.floor(timeDiff / 1000) % 60 ;
            var gminutes = Math.floor((timeDiff / (1000*60)) % 60);
            var ghours = Math.floor((timeDiff / (1000*60*60)) % 24);
            var gdays = Math.floor((timeDiff / (1000*60*60*24)) % 7);
            if (gdays > 0) {
              dtimeStr += `${gdays}D${ghours}H${gminutes}M`
            } else if (ghours > 0) {
              dtimeStr += `${ghours}H${gminutes}M`
            } else if (gminutes > 0) {
              dtimeStr += `${gminutes}M`
            }
            if (ghours >= 8) {
              coinoutStr += `<img class='gym coin' height='25px' src='static/images/gym/coin.png'>`
            }

            var formString = ''
            if (member.pokemon_id === 201 && member.form !== null && member.form > 0) {
                formString += `(${unownForm[`${member.form}`]})`
            }

            memberStr += `
            <span class='gym member' title='${member.trainer_name} Lv: ${member.trainer_level} | ${member.pokemon_name}${formString} | Stardust Use: ${member.num_upgrades}x | Deployed: ${longdeployStr}'>
              <center>
                <div>
                  <div>
                    <span class='gym pokemon'>${member.trainer_name}</span>
                  </div>
                  <div>
                    <span class='gym pokemon'>Lv: ${member.trainer_level}</span>
                  </div>
                  <div>
                    <i class='${pokemonSprite(member.pokemon_id, member.form)}'></i>
                  </div>
                  <div>
                    <span class='gym pokemon'>${member.pokemon_name}${formString}X${member.num_upgrades}</span>
                  </div>
                  <div>
                    <span class='gym cp team-${gym.team_id}'>${member.pokemon_cp}</span>
                  </div>
                  <div>
                    <img class='gym pokemon motivation heart' src='static/images/gym/Heart.png'> <span class='gym pokemon motivation'>${member.cp_decayed}</span>
                  </div>
                  <div>
                    <span>${berryImg}</span> <span>${coinoutStr}</span>
                  </div>
                  <div>
                    <span class='gym countup label-countup' count-up='${deploycount}'></span>
                  </div>
                  <div>
                    <span class='gym pokemon'>${shortdeployStr}</span>
                  </div>
                </div>
              </center>
            </span>`
        })

        memberStr += '</div>'
    }

    return `
        <div>
            <center>
                ${title}
                ${gymdes}
                ${subtitle}
                ${image}
                ${rimage}
                ${imageLbl}
            </center>
            ${navInfo}
            <center>
                ${memberStr}
            </center>
        </div>`
}

function pokestopLabel(pokestop) {
    var str
    var pokestopIcn = ''
    var pokestopName = ''
    var pokestopDes = ''
    var pokestopImg = ''
    var pokestopDep = ''
    if (pokestop.lure_expiration) {
      pokestopIcn += `<img class='pokestop stopicn' src='static/images/pokestop//PokestopLured.png'>`
    } else {
      pokestopIcn += `<img class='pokestop stopicn' src='static/images/pokestop/Pokestop.png'>`
    }
    if (typeof pokestop.name !== 'undefined' && pokestop.name !== null) {
      pokestopName += `<center><span class='pokestop text1'>${pokestop.name}</span></center>`
	  }
    if (typeof pokestop.description !== 'undefined' && pokestop.description !== null) {
      pokestopDes += `<center><span class='pokestop text2'>${pokestop.description}</span></center>`
	  }
    if (typeof pokestop.url !== 'undefined' && pokestop.url !== null && pokestop.lure_expiration) {
  		pokestopImg += `<img class='pokestop imgcircle lure' src='${pokestop.url}'>`
  	} else if (typeof pokestop.url !== 'undefined' && pokestop.url !== null) {
      pokestopImg += `<img class='pokestop imgcircle nolure' src='${pokestop.url}'>`
    }
    if (typeof pokestop.deployer !== 'undefined' && pokestop.deployer !== null) {
      pokestopDep += `<center><span class='pokestop deploy'><b>${pokestop.deployer}</b></span></center>`
	  }
    var pokestopNav = `<center><span class='pokestop text2'><a href='javascript:void(0);' onclick='javascript:openMapDirections(${pokestop.latitude},${pokestop.longitude});' title='Open in Google Maps';'>${pokestop.latitude.toFixed(6)}, ${pokestop.longitude.toFixed(7)}</a></span></center>`
    if (pokestop.lure_expiration) {

    var luredPokemonStr = ''
    if (pokestop.lure_pokemon) {
      var activePokemonName = pokestop.lure_pokemon.pokemon_name
      var activePokemonId = pokestop.lure_pokemon.pokemon_id
      var rarityDisplay = pokestop.lure_pokemon.pokemon_rarity ? '(' + pokestop.lure_pokemon.pokemon_rarity + ')' : ''
      var typesDisplay = ''
      $.each(pokestop.lure_pokemon.pokemon_types, function (index, type) {
        typesDisplay += getTypeSpan(type)
      })
      luredPokemonStr = `
            <center><div class='pokemon name'>
              <b>${activePokemonName}</b> <span class='pokemon name pokedex'><a href='http://pokemon.gameinfo.io/en/pokemon/${activePokemonId}' target='_blank' title='View in Pokédex'>#${activePokemonId}</a></span> <span class='pokemon gender rarity'> ${rarityDisplay}</span> ${typesDisplay}
            </div></center>
      `
    }
        str = `
            <div>
              <div>
                ${pokestopName}
              </div>
              <div>
                ${pokestopDep}
              </div>
              <div class='pokestop lure'>
                ${pokestopIcn} Lured Pokéstop
              </div>
              ${luredPokemonStr}
              <div class='pokestop-expire'>
                  <span class='label-countdown' disappears-at='${pokestop.lure_expiration}'>00m00s</span> left (${moment(pokestop.lure_expiration).format('h:mm:ss a')})
              </div>
              <div>
                ${pokestopImg}
              </div>
              <div>
                ${pokestopDes}
              </div>
              <div>
                ${pokestopNav}
              </div>
            </div>
          </div>`
    } else {
        str = `
            <div>
              <div>
                ${pokestopName}
              </div>
              <div class='pokestop nolure'>
                ${pokestopIcn} Pokéstop
              </div>
              <div>
                ${pokestopImg}
              </div>
              <div>
                ${pokestopDes}
              </div>
              <div>
                ${pokestopNav}
              </div>
            </div>
          </div>`
    }
    return str
}

function formatSpawnTime(seconds) {
    // the addition and modulo are required here because the db stores when a spawn disappears
    // the subtraction to get the appearance time will knock seconds under 0 if the spawn happens in the previous hour
    return ('0' + Math.floor(((seconds + 3600) % 3600) / 60)).substr(-2) + ':' + ('0' + seconds % 60).substr(-2)
}

function spawnpointLabel(item) {
    var str = `
        <div>
            <b>Spawn Point</b>
        </div>`

    if (item.uncertain) {
        str += `
            <div>
                Spawn times not yet determined. Current guess ${formatSpawnTime(item.appear_time)} until ${formatSpawnTime(item.disappear_time)}
            </div>`
    } else {
        str += `
            <div>
                Every hour from ${formatSpawnTime(item.appear_time)} to ${formatSpawnTime(item.disappear_time)}
            </div>`
    }
    return str
}

function geofenceLabel(item) {
    var str
    if (item.excluded) {
        str = `
            <div>
                <b>Excluded Area</b>
            </div>`
    } else {
        str = `
            <div>
                <b>Geofence</b>
            </div>`
    }

    str += `
        <div>
            ${item.name}
        </div>`

    return str
}

function addRangeCircle(marker, map, type, teamId) {
    var targetmap = null
    var circleCenter = new google.maps.LatLng(marker.position.lat(), marker.position.lng())
    var gymColors = ['#999999', '#0051CF', '#FF260E', '#FECC23'] // 'Uncontested', 'Mystic', 'Valor', 'Instinct']
    var teamColor = gymColors[0]
    if (teamId) teamColor = gymColors[teamId]

    var range
    var circleColor

    // handle each type of marker and be explicit about the range circle attributes
    switch (type) {
        case 'pokemon':
            circleColor = '#C233F2'
            range = 40 // pokemon appear at 40m and then you can move away. still have to be 40m close to see it though, so ignore the further disappear distance
            break
        case 'pokestop':
            circleColor = '#3EB0FF'
            range = 40
            break
        case 'gym':
            circleColor = teamColor
            range = 40
            break
    }

    if (map) targetmap = map

    var rangeCircleOpts = {
        map: targetmap,
        radius: range, // meters
        strokeWeight: 1,
        strokeColor: circleColor,
        strokeOpacity: 0.9,
        center: circleCenter,
        fillColor: circleColor,
        fillOpacity: 0.3
    }
    var rangeCircle = new google.maps.Circle(rangeCircleOpts)
    return rangeCircle
}

function isRangeActive(map) {
    if (map.getZoom() < 16) return false
    return Store.get('showRanges')
}

function getIv(atk, def, stm) {
    if (atk !== null) {
        return 100.0 * (atk + def + stm) / 45
    }

    return false
}

function getPokemonLevel(cpMultiplier) {
    if (cpMultiplier < 0.734) {
        var pokemonLevel = (58.35178527 * cpMultiplier * cpMultiplier -
        2.838007664 * cpMultiplier + 0.8539209906)
    } else {
        pokemonLevel = 171.0112688 * cpMultiplier - 95.20425243
    }
    pokemonLevel = (Math.round(pokemonLevel) * 2) / 2

    return pokemonLevel
}

function getGymLevel(gym) {
    return 6 - gym['slots_available']
}

function getRaidLevel(raid) {
    if (raid) {
        return raid['level']
    } else {
        return 0
    }
}

function lpad(str, len, padstr) {
    return Array(Math.max(len - String(str).length + 1, 0)).join(padstr) + str
}

function repArray(text, find, replace) {
    for (var i = 0; i < find.length; i++) {
        text = text.replace(find[i], replace[i])
    }

    return text
}

function getTimeUntil(time) {
    var now = Date.now()
    var tdiff = time - now

    var sec = Math.floor((tdiff / 1000) % 60)
    var min = Math.floor((tdiff / 1000 / 60) % 60)
    var hour = Math.floor((tdiff / (1000 * 60 * 60)) % 24)

    return {
        'total': tdiff,
        'hour': hour,
        'min': min,
        'sec': sec,
        'now': now,
        'ttime': time
    }
}

function getTimeCount(time) {
    var now = +new Date()
    var tdiff = now - time

    var sec = Math.floor((tdiff / 1000) % 60)
    var min = Math.floor((tdiff / 1000 / 60) % 60)
    var hour = Math.floor((tdiff / (1000 * 60 * 60)) % 24)
    var day = Math.floor((tdiff / (1000*60*60*24)) % 7);

    return {
        'total': tdiff,
        'day': day,
        'hour': hour,
        'min': min,
        'sec': sec,
        'now': now,
        'ttime': time
    }
}

function getNotifyText(item) {
    var iv = getIv(item['individual_attack'], item['individual_defense'], item['individual_stamina'])
    var find = ['<prc>', '<pkm>', '<atk>', '<def>', '<sta>']
    var replace = [((iv) ? iv.toFixed(1) : ''), item['pokemon_name'], item['individual_attack'],
        item['individual_defense'], item['individual_stamina']]
    var ntitle = repArray(((iv) ? notifyIvTitle : notifyNoIvTitle), find, replace)
    var dist = moment(item['disappear_time']).format('h:mm:ss a')
    var until = getTimeUntil(item['disappear_time'])
    var udist = (until.hour > 0) ? until.hour + ':' : ''
    udist += lpad(until.min, 2, 0) + 'm' + lpad(until.sec, 2, 0) + 's'
    find = ['<dist>', '<udist>']
    replace = [dist, udist]
    var ntext = repArray(notifyText, find, replace)

    return {
        'fav_title': ntitle,
        'fav_text': ntext
    }
}

function playPokemonSound(pokemonID, cryFileTypes) {
    if (!Store.get('playSound')) {
        return
    }

    if (!Store.get('playCries')) {
        audio.play()
    } else {
        // Stop if we don't have any supported filetypes left.
        if (cryFileTypes.length === 0) {
            return
        }

        // Try to load the first filetype in the list.
        const filetype = cryFileTypes.shift()
        const audioCry = new Audio('static/sounds/cries/' + pokemonID + '.' + filetype)

        audioCry.play().catch(function (err) {
            // Try a different filetype.
            if (err) {
                console.log('Sound filetype %s for Pokémon %s is missing.', filetype, pokemonID)

                // If there's more left, try something else.
                playPokemonSound(pokemonID, cryFileTypes)
            }
        })
    }
}

function isNotifyPoke(poke) {
    const isOnNotifyList = notifiedPokemon.indexOf(poke['pokemon_id']) > -1 || notifiedRarity.indexOf(poke['pokemon_rarity']) > -1
    var hasHighIV = false
    var hasHighLevel = false
    var hasHighAttributes = false

    if (poke['individual_attack'] != null && poke['cp_multiplier'] !== null) {
        const perfection = getIv(poke['individual_attack'], poke['individual_defense'], poke['individual_stamina'])
        const level = getPokemonLevel(poke['cp_multiplier'])
        hasHighIV = notifiedMinPerfection > 0 && perfection >= notifiedMinPerfection
        hasHighLevel = notifiedMinLevel > 0 && level >= notifiedMinLevel

        hasHighAttributes = (hasHighIV && !(notifiedMinLevel > 0)) || (hasHighLevel && !(notifiedMinPerfection > 0)) || hasHighLevel && hasHighIV
    }

    return isOnNotifyList || hasHighAttributes
}

function customizePokemonMarker(marker, item, skipNotification) {
    var notifyText = getNotifyText(item)
    marker.addListener('click', function () {
        this.setAnimation(null)
        this.animationDisabled = true
    })

    if (!marker.rangeCircle && isRangeActive(map)) {
        marker.rangeCircle = addRangeCircle(marker, map, 'pokemon')
    }
    if (!marker.rangeCircle && isRangeActive(map)) {
        marker.rangeCircle = addRangeCircle(marker, map, 'LuredPokemon')
    }
    marker.infoWindow = new google.maps.InfoWindow({
        content: pokemonLabel(item),
        disableAutoPan: true
    })

    if (isNotifyPoke(item)) {
        if (!skipNotification) {
            playPokemonSound(item['pokemon_id'], cryFileTypes)
            sendNotification(notifyText.fav_title, notifyText.fav_text, 'static/sprites/' + item['pokemon_id'] + '.png', item['latitude'], item['longitude'])
        }
        if (marker.animationDisabled !== true) {
            marker.setAnimation(google.maps.Animation.BOUNCE)
        }
    }

    if (Store.get('showMedal')) {
        if (isMedalPokemonMap(item)) {
            if (!skipNotification) {
                if (Store.get('showMedalRattata') && item['pokemon_id'] == 19) {
                  playPokemonSound(item['pokemon_id'], cryFileTypes)
                  sendNotification(notifyText.fav_title, notifyText.fav_text, 'static/sprites/' + item['pokemon_id'] + '.png', item['latitude'], item['longitude'])
                }
                if (Store.get('showMedalMagikarp') && item['pokemon_id'] == 129) {
                  playPokemonSound(item['pokemon_id'], cryFileTypes)
                  sendNotification(notifyText.fav_title, notifyText.fav_text, 'static/sprites/' + item['pokemon_id'] + '.png', item['latitude'], item['longitude'])
                }
            }
            if (Store.get('showMedalRattata') && item['pokemon_id'] == 19) {
              if (marker.animationDisabled !== true) {
                  marker.setAnimation(google.maps.Animation.BOUNCE)
              }
            }
            if (Store.get('showMedalMagikarp') && item['pokemon_id'] == 129) {
              if (marker.animationDisabled !== true) {
                  marker.setAnimation(google.maps.Animation.BOUNCE)
              }
            }
        }
    }

    addListeners(marker)
}

function setupGymMarker(item) {
    var marker = new google.maps.Marker({
        position: {
            lat: item['latitude'],
            lng: item['longitude']
        },
        map: map
    })
    marker.infoWindow = new google.maps.InfoWindow({
        content: '',
        disableAutoPan: true
    })
    updateGymMarker(item, marker)

    if (!marker.rangeCircle && isRangeActive(map)) {
        marker.rangeCircle = addRangeCircle(marker, map, 'gym', item['team_id'])
    }


    if (Store.get('useGymSidebar')) {
        marker.addListener('click', function () {
            var gymSidebar = document.querySelector('#gym-details')
            if (gymSidebar.getAttribute('data-id') === item['gym_id'] && gymSidebar.classList.contains('visible')) {
                gymSidebar.classList.remove('visible')
            } else {
                gymSidebar.setAttribute('data-id', item['gym_id'])
                showGymDetails(item['gym_id'])
            }
        })

        google.maps.event.addListener(marker.infoWindow, 'closeclick', function () {
            marker.persist = null
        })

        if (!isMobileDevice() && !isTouchDevice()) {
            marker.addListener('mouseover', function () {
                marker.infoWindow.open(map, marker)
                clearSelection()
                updateLabelDiffTime()
                updateLabelTime()
            })
        }

        marker.addListener('mouseout', function () {
            if (!marker.persist) {
                marker.infoWindow.close()
            }
        })
    } else {
        addListeners(marker)
    }

    return marker
}

function updateGymMarker(item, marker) {
    let raidLevel = getRaidLevel(item.raid)
    let markerImage = ''
    let scaleNumber = ''
    console.log("not null:" + (item.raid !== null) + " ongoing: ")
    var timeDelta = (Date.now() - item.last_scanned) / 1000 / 2 // minutes since last scan
    var opacity = (timeDelta < Store.get('obsoletion1')) ? 1.0 : (timeDelta < Store.get('obsoletion2')) ? Store.get('opacity1') : (timeDelta < Store.get('obsoletion3')) ? Store.get('opacity2') : Store.get('opacity3')

    var gymSize = getGymLevel(item) <= 1 ? 60 : getGymLevel(item) <= 2 ? 55 : getGymLevel(item) <= 3 ? 50 : getGymLevel(item) <= 4 ? 45 : getGymLevel(item) <= 5 ? 40 : 30
    if (item.raid && isOngoingRaid(item.raid) && Store.get('showRaids') && raidLevel >= Store.get('showRaidMinLevel') && raidLevel <= Store.get('showRaidMaxLevel')) {
        markerImage = 'gym_img?team=' + gymTypes[item.team_id] + '&level=' + getGymLevel(item) + '&raidlevel=' + item['raid']['level'] + '&pkm=' + item['raid']['pokemon_id']
        marker.setIcon({
            url: markerImage,
            scaledSize: new google.maps.Size(75, 75)
        })
        marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1)
    } else if (item.raid && item.raid.end > Date.now() && Store.get('showRaids') && !Store.get('showActiveRaidsOnly') && raidLevel >= Store.get('showRaidMinLevel') && raidLevel <= Store.get('showRaidMaxLevel')) {
        if (item.is_in_battle == 1) {
          markerImage = 'gym_img?team=' + gymTypes[item.team_id] + '&level=' + getGymLevel(item) + '&raidlevel=' + item['raid']['level'] + '&battle=' + '1'
          scaleNumber = 75
        } else {
          markerImage = 'gym_img?team=' + gymTypes[item.team_id] + '&level=' + getGymLevel(item) + '&raidlevel=' + item['raid']['level']
          scaleNumber = 60
        }
        marker.setIcon({
            url: markerImage,
            scaledSize: new google.maps.Size(scaleNumber, scaleNumber)
        })
    } else if (item.is_in_battle == 1) {
          markerImage = 'gym_img?team=' + gymTypes[item.team_id] + '&level=' + getGymLevel(item) + '&battle=' + '1'
          marker.setIcon({
              url: markerImage,
              scaledSize: new google.maps.Size(75, 75)
          })
    } else {
        markerImage = 'gym_img?team=' + gymTypes[item.team_id] + '&level=' + getGymLevel(item)
        marker.setIcon({
            url: markerImage,
            scaledSize: new google.maps.Size(gymSize, gymSize)
        })
        marker.setZIndex(1)
    }
    marker.setOpacity(opacity)
    marker.infoWindow.setContent(gymLabel(item))
    return marker
}

function setupPokestopMarker(item) {
    var imagename = item['lure_expiration'] ? 'PokestopLured' : 'Pokestop'
    var image = {
        url: 'static/images/pokestop/' + imagename + '.png',
        scaledSize: new google.maps.Size(32, 32)
    }
    var marker = new google.maps.Marker({
        position: {
            lat: item['latitude'],
            lng: item['longitude']
        },
        map: map,
        zIndex: item['lure_expiration'] ? 3 : 2,
        icon: image
    })

    if (!marker.rangeCircle && isRangeActive(map)) {
        marker.rangeCircle = addRangeCircle(marker, map, 'pokestop')
    }

    marker.infoWindow = new google.maps.InfoWindow({
        content: pokestopLabel(item),
        disableAutoPan: true
    })

    addListeners(marker)
    return marker
}

function getColorByDate(value) {
    // Changes the color from red to green over 15 mins
    var diff = (Date.now() - value) / 1000 / 60 / 15

    if (diff > 1) {
        diff = 1
    }

    // value from 0 to 1 - Green to Red
    var hue = ((1 - diff) * 120).toString(10)
    return ['hsl(', hue, ',100%,50%)'].join('')
}

function setupScannedMarker(item) {
    var circleCenter = new google.maps.LatLng(item['latitude'], item['longitude'])

    var marker = new google.maps.Circle({
        map: map,
        clickable: false,
        center: circleCenter,
        radius: item['radius'],
        fillColor: getColorByDate(item['last_modified']),
        fillOpacity: 0.1,
        strokeWeight: 1,
        strokeOpacity: 0.5
    })

    return marker
}

function getColorBySpawnTime(value) {
    var now = new Date()
    var seconds = now.getMinutes() * 60 + now.getSeconds()

    // account for hour roll-over
    if (seconds < 900 && value > 2700) {
        seconds += 3600
    } else if (seconds > 2700 && value < 900) {
        value += 3600
    }

    var diff = (seconds - value)
    var hue = 275 // light purple when spawn is neither about to spawn nor active
    if (diff >= 0 && diff <= 1800) { // green to red over 30 minutes of active spawn
        hue = (1 - (diff / 60 / 30)) * 120
    } else if (diff < 0 && diff > -300) { // light blue to dark blue over 5 minutes til spawn
        hue = ((1 - (-diff / 60 / 5)) * 50) + 200
    }

    hue = Math.round(hue / 5) * 5

    return hue
}

function changeSpawnIcon(color, zoom) {
    var urlColor = ''
    if (color === 275) {
        urlColor = './static/icons/hsl-275-light.png'
    } else {
        urlColor = './static/icons/hsl-' + color + '.png'
    }
    var zoomScale = 1.6 // adjust this value to change the size of the spawnpoint icons
    var minimumSize = 1
    var newSize = Math.round(zoomScale * (zoom - 10)) // this scales the icon based on zoom
    if (newSize < minimumSize) {
        newSize = minimumSize
    }

    var newIcon = {
        url: urlColor,
        scaledSize: new google.maps.Size(newSize, newSize),
        anchor: new google.maps.Point(newSize / 2, newSize / 2)
    }

    return newIcon
}

function spawnPointIndex(color) {
    var newIndex = 1
    var scale = 0
    if (color >= 0 && color <= 120) { // high to low over 15 minutes of active spawn
        scale = color / 120
        newIndex = 100 + scale * 100
    } else if (color >= 200 && color <= 250) { // low to high over 5 minutes til spawn
        scale = (color - 200) / 50
        newIndex = scale * 100
    }

    return newIndex
}

function setupSpawnpointMarker(item) {
    var circleCenter = new google.maps.LatLng(item['latitude'], item['longitude'])
    var hue = getColorBySpawnTime(item.appear_time)
    var zoom = map.getZoom()

    var marker = new google.maps.Marker({
        map: map,
        position: circleCenter,
        icon: changeSpawnIcon(hue, zoom),
        zIndex: spawnPointIndex(hue)
    })

    marker.infoWindow = new google.maps.InfoWindow({
        content: spawnpointLabel(item),
        disableAutoPan: true,
        position: circleCenter
    })

    addListeners(marker)

    return marker
}

function setupGeofencePolygon(item) {
    var randomcolor = randomColor()
    // Random with color seed randomColor({hue: 'pink'})
    // Total random '#'+Math.floor(Math.random()*16777215).toString(16);
    if (item.excluded === true) {
        randomcolor = randomColor({hue: 'red'})
    } else {
        randomcolor = randomColor({hue: 'green'})
    }

    var polygon = new google.maps.Polygon({
        map: map,
        paths: item['coordinates'],
        strokeColor: randomcolor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: randomcolor,
        fillOpacity: 0.5
    })

    var markerPosition = polygonCenter(polygon)

    polygon.infoWindow = new google.maps.InfoWindow({
        content: geofenceLabel(item),
        disableAutoPan: true,
        position: markerPosition
    })

    addListeners(polygon)

    return polygon
}

function polygonCenter(polygon) {
    var hyp, Lat, Lng

    var X = 0
    var Y = 0
    var Z = 0
    polygon.getPath().forEach(function (vertex, inex) {
        var lat
        var lng
        lat = vertex.lat() * Math.PI / 180
        lng = vertex.lng() * Math.PI / 180
        X += Math.cos(lat) * Math.cos(lng)
        Y += Math.cos(lat) * Math.sin(lng)
        Z += Math.sin(lat)
    })

    hyp = Math.sqrt(X * X + Y * Y)
    Lat = Math.atan2(Z, hyp) * 180 / Math.PI
    Lng = Math.atan2(Y, X) * 180 / Math.PI

    return new google.maps.LatLng(Lat, Lng)
}

function clearSelection() {
    if (document.selection) {
        document.selection.empty()
    } else if (window.getSelection) {
        window.getSelection().removeAllRanges()
    }
}

function addListeners(marker) {
    marker.addListener('click', function () {
        if (!marker.infoWindowIsOpen) {
            marker.infoWindow.open(map, marker)
            clearSelection()
            updateLabelDiffTime()
            updateLabelTime()
            marker.persist = true
            marker.infoWindowIsOpen = true
        } else {
            marker.persist = null
            marker.infoWindow.close()
            marker.infoWindowIsOpen = false
        }
    })

    google.maps.event.addListener(marker.infoWindow, 'closeclick', function () {
        marker.persist = null
    })

    if (!isMobileDevice() && !isTouchDevice()) {
        marker.addListener('mouseover', function () {
            marker.infoWindow.open(map, marker)
            clearSelection()
            updateLabelDiffTime()
            updateLabelTime()
        })
    }

    marker.addListener('mouseout', function () {
        if (!marker.persist) {
            marker.infoWindow.close()
        }
    })

    return marker
}

function clearStaleMarkers() {
    const oldPokeMarkers = []

    $.each(mapData.pokemons, function (key, value) {
        const isPokeExpired = mapData.pokemons[key]['disappear_time'] < Date.now()
        const isPokeExcluded = getExcludedPokemon().indexOf(mapData.pokemons[key]['pokemon_id']) !== -1

        if (isPokeExpired || isPokeExcluded) {
            const oldMarker = mapData.pokemons[key].marker

            if (oldMarker.rangeCircle) {
                oldMarker.rangeCircle.setMap(null)
                delete oldMarker.rangeCircle
            }

            // If it was a Pokémon w/ notification it won't be in a cluster,
            // but that doesn't matter because the MarkerClusterer will check
            // for it itself.
            oldPokeMarkers.push(oldMarker)
            oldMarker.setMap(null)
            delete mapData.pokemons[key]
            // Overwrite method to avoid all timing issues with libraries.
            oldMarker.setMap = function () {}
        }
    })

    markerCluster.removeMarkers(oldPokeMarkers, true)

    $.each(mapData.lurePokemons, function (key, value) {
        if (mapData.lurePokemons[key]['disappear_time'] < new Date().getTime() ||
            getExcludedPokemon().indexOf(mapData.lurePokemons[key]['pokemon_id']) >= 0) {
            mapData.lurePokemons[key].marker.setMap(null)
            delete mapData.lurePokemons[key]
        }
    })

    $.each(mapData.scanned, function (key, value) {
        // If older than 15mins remove
        if (mapData.scanned[key]['last_modified'] < (new Date().getTime() - 15 * 60 * 1000)) {
            mapData.scanned[key].marker.setMap(null)
            delete mapData.scanned[key]
        }
    })
}

function showInBoundsMarkers(markers, type) {
    $.each(markers, function (key, value) {
        const item = markers[key]
        const marker = item.marker
        var show = false

        if (!item.hidden) {
            if (typeof marker.getBounds === 'function') {
                if (map.getBounds().intersects(marker.getBounds())) {
                    show = true
                }
            } else if (typeof marker.getPosition === 'function') {
                if (map.getBounds().contains(marker.getPosition())) {
                    show = true
                }
            } else if(type == 's2cell'){
                 if (map.getBounds().intersects(getS2CellBounds(item))) {
                     show = true
                 }
             }
        }

        // Marker has an associated range.
        if (show && rangeMarkers.indexOf(type) !== -1) {
            // No range circle yet... let's create one.
            if (!marker.rangeCircle) {
                // But only if range is active.
                if (isRangeActive(map)) {
                    if (type === 'gym') marker.rangeCircle = addRangeCircle(marker, map, type, item.team_id)
                    else marker.rangeCircle = addRangeCircle(marker, map, type)
                }
            } else { // There's already a range circle.
                if (isRangeActive(map)) {
                    marker.rangeCircle.setMap(map)
                } else {
                    marker.rangeCircle.setMap(null)
                }
            }
        }

        if (show && !marker.getMap()) {
            marker.setMap(map)
            // Not all markers can be animated (ex: scan locations)
            if (marker.setAnimation && marker.oldAnimation) {
                marker.setAnimation(marker.oldAnimation)
            }
        } else if (!show && marker.getMap()) {
            // Not all markers can be animated (ex: scan locations)
            if (marker.getAnimation) {
                marker.oldAnimation = marker.getAnimation()
            }
            if (marker.rangeCircle) marker.rangeCircle.setMap(null)
            marker.setMap(null)
        }
    })
}

function isAuthenticated() {
	
	var acc_token = localStorage.getItem('access_token');
	if (acc_token) {
		// Check whether the current time is past the
		// access token's expiry time
		var expiresAt = JSON.parse(localStorage.getItem('expires_at'));
		
	    var btn_login = document.getElementById('btn-login');
	    var btn_logout = document.getElementById('btn-logout');
		if (new Date().getTime() < expiresAt) {
		    btn_login.style.display = 'none';
		    btn_logout.style.display = 'inline';
			return true
		} else {
            console.log('Token expired: Remove tokens')
            localStorage.removeItem('access_token');
            localStorage.removeItem('id_token');
            localStorage.removeItem('expires_at');
			btn_login.style.display = "inline";
			btn_logout.style.display = "none";
			window.location.href = "/";
			return false
		}
	} else {
		return false
	}
}

function loadRawData() {

	if (isAuthenticated()) {
    var loadPokemon = Store.get('showPokemon')
    var loadLurePokemon = Store.get('showLurePokemon')
    var loadGyms = (Store.get('showGyms') || Store.get('showRaids'))
    var loadPokestops = Store.get('showPokestops')
    var loadScanned = Store.get('showScanned')
    var loadSpawnpoints = Store.get('showSpawnpoints')
    var loadLuredOnly = Boolean(Store.get('showLuredPokestopsOnly'))
    var loadGeofences = Store.get('showGeofences')
    var loadWeather = Store.get('showWeatherCells')
    var loadS2Cells = Store.get('showS2Cells')
    var loadWeatherAlerts = Store.get('showWeatherAlerts')

    var bounds = map.getBounds()
    var swPoint = bounds.getSouthWest()
    var nePoint = bounds.getNorthEast()
    var swLat = swPoint.lat()
    var swLng = swPoint.lng()
    var neLat = nePoint.lat()
    var neLng = nePoint.lng()

    return $.ajax({
        url: 'raw_data',
        type: 'GET',
        data: {
            'timestamp': timestamp,
            'pokemon': loadPokemon,
            'lurePokemon': loadLurePokemon,
            'lastpokemon': lastpokemon,
            'pokestops': loadPokestops,
            'lastpokestops': lastpokestops,
            'luredonly': loadLuredOnly,
            'gyms': loadGyms,
            'lastgyms': lastgyms,
            'scanned': loadScanned,
            'lastslocs': lastslocs,
            'spawnpoints': loadSpawnpoints,
            'geofences': loadGeofences,
            'weather': loadWeather,
            's2cells': loadS2Cells,
            'weatherAlerts': loadWeatherAlerts,
            'lastspawns': lastspawns,
            'swLat': swLat,
            'swLng': swLng,
            'neLat': neLat,
            'neLng': neLng,
            'oSwLat': oSwLat,
            'oSwLng': oSwLng,
            'oNeLat': oNeLat,
            'oNeLng': oNeLng,
            'reids': String(isShowAllZoom() ? excludedPokemon :  reincludedPokemon),
            'eids': String(getExcludedPokemon())
        },
        dataType: 'json',
        cache: false,
        beforeSend: function () {
            if (rawDataIsLoading) {
                return false
            } else {
                rawDataIsLoading = true
            }
        },
        error: function () {
            // Display error toast
            toastr['error']('Please check connectivity or reduce marker settings.', 'Error getting data')
            toastr.options = {
                'closeButton': true,
                'debug': false,
                'newestOnTop': true,
                'progressBar': false,
                'positionClass': 'toast-top-right',
                'preventDuplicates': true,
                'onclick': null,
                'showDuration': '300',
                'hideDuration': '1000',
                'timeOut': '25000',
                'extendedTimeOut': '1000',
                'showEasing': 'swing',
                'hideEasing': 'linear',
                'showMethod': 'fadeIn',
                'hideMethod': 'fadeOut'
            }
        },
        complete: function () {
            rawDataIsLoading = false
        }
    })
	}
}

function processPokemons(pokemon) {
    if (!Store.get('showPokemon')) {
        return false // In case the checkbox was unchecked in the meantime.
    }

    // Process Pokémon per chunk of total so we don't overwhelm the client and
    // allow redraws in between. We enable redraw in addMarkers, which doesn't
    // repaint/reset all previous markers but only draws new ones.
    processPokemonChunked(pokemon, Store.get('processPokemonChunkSize'))
}

function processPokemonChunked(pokemon, chunkSize) {
    // Early skip if we have nothing to process.
    if (typeof pokemon === 'undefined' || pokemon.length === 0) {
        return
    }

    const oldMarkers = []
    const newMarkers = []
    const chunk = pokemon.splice(-1 * chunkSize)

    $.each(chunk, function (i, poke) {
        // Early skip if we've already stored this spawn or if it's expiring
        // too soon.
        const encounterId = poke.encounter_id
        const expiringSoon = (poke.disappear_time < (Date.now() + 3000))
        if (mapData.pokemons.hasOwnProperty(encounterId) || expiringSoon) {
            return
        }

        const markers = processPokemon(poke)
        const newMarker = markers[0]
        const oldMarker = markers[1]

        // Don't add Pokémon marker to clusters if we're sending a notification.
        if (!isNotifyPoke(poke)) {
            if (newMarker) {
                newMarkers.push(newMarker)
            }

            if (oldMarker) {
                oldMarkers.push(oldMarker)
            }
        } else {
            if (newMarker) {
                newMarker.setMap(map)
            }

            if (oldMarker) {
                oldMarker.setMap(null)
            }
        }
    })

    // Disable instant redraw, we'll repaint ourselves after we've added the
    // new markers.
    markerCluster.removeMarkers(oldMarkers, true)
    markerCluster.addMarkers(newMarkers, false)

    // Any left?
    if (pokemon.length > 0) {
        setTimeout(function () {
            processPokemonChunked(pokemon, chunkSize)
        }, Store.get('processPokemonIntervalMs'))
    }
}

function processPokemon(item) {
    const isExcludedPoke = getExcludedPokemon().indexOf(item['pokemon_id']) !== -1
    const isPokeAlive = item['disappear_time'] > Date.now()

    var oldMarker = null
    var newMarker = null

    if (!(item['encounter_id'] in mapData.pokemons) &&
         !isExcludedPoke && isPokeAlive) {
        // Add marker to map and item to dict.
        const isNotifyPkmn = isNotifyPoke(item)
        if (!item.hidden && (!Store.get('hideNotNotified') || isNotifyPkmn)) {
            const isBounceDisabled = Store.get('isBounceDisabled')
            const scaleByRarity = Store.get('scaleByRarity')
            const isNotifyPkmn = isNotifyPoke(item)

            if (item.marker) {
                updatePokemonMarker(item.marker, map, scaleByRarity, isNotifyPkmn)
            } else {
                newMarker = setupPokemonMarker(item, map, isBounceDisabled, scaleByRarity, isNotifyPkmn)
                customizePokemonMarker(newMarker, item, !Store.get('showPopups'))
                item.marker = newMarker
            }

            mapData.pokemons[item['encounter_id']] = item
        } else {
            oldMarker = item.marker
        }
    }

    return [newMarker, oldMarker]
}

function processLurePokemons (i, item) {
  if (!Store.get('showLurePokemon')) {
    return false // in case the checkbox was unchecked in the meantime.
  }

  if (!(item['encounter_id'] in mapData.lurePokemons) &&
    excludedPokemon.indexOf(item['pokemon_id']) < 0) {
    // add marker to map and item to dict
    if (item.marker) {
      item.marker.setMap(null)
    }
    if (!item.hidden) {
      const isBounceDisabled = Store.get('isBounceDisabled')
      const scaleByRarity = Store.get('scaleByRarity')
      const isNotifyPkmn = isNotifyPoke(item)

      if (item.marker) {
          updatePokemonMarker(item.marker, map, scaleByRarity, isNotifyPkmn)
      } else {
          item.marker = setupPokemonMarker(item, map, isBounceDisabled, scaleByRarity, isNotifyPkmn)
          customizePokemonMarker(item.marker, item)
      }
      //item.marker = setupPokemonMarker(item, map, isBounceDisabled, scaleByRarity, isNotifyPkmn)
      //customizePokemonMarker(item.marker, item)
      mapData.lurePokemons[item['encounter_id']] = item
    }
  }
}

function processPokestop(i, item) {
    if (!Store.get('showPokestops')) {
        return false
    }

    if (Store.get('showLuredPokestopsOnly') && !item['lure_expiration']) {
        return true
    }

    if (!mapData.pokestops[item['pokestop_id']]) { // new pokestop, add marker to map and item to dict
        if (item.marker && item.marker.rangeCircle) {
            item.marker.rangeCircle.setMap(null)
        }
        if (item.marker) {
            item.marker.setMap(null)
        }
        item.marker = setupPokestopMarker(item)
        mapData.pokestops[item['pokestop_id']] = item
    } else { // change existing pokestop marker to unlured/lured
        var redraw = false
        var item2 = mapData.pokestops[item['pokestop_id']]
        if (!!item['lure_expiration'] !== !!item2['lure_expiration']) {
          redraw = true
        } else if ('lure_pokemon' in item) {
          if ('lure_pokemon' in item2) {
            var lurePokemon1 = item['lure_pokemon']
            var lurePokemon2 = item2['lure_pokemon']
            if (lurePokemon1['encounter_id'] !== lurePokemon2['encounter_id']) {
              redraw = true
            }
          } else {
            redraw = true
          }
        } else if ('lure_pokemon' in item2) {
          redraw = true
        }
        if (redraw) {
            if (item2.marker && item2.marker.rangeCircle) {
                item2.marker.rangeCircle.setMap(null)
            }
            item2.marker.setMap(null)
            item.marker = setupPokestopMarker(item)
            mapData.pokestops[item['pokestop_id']] = item
        }
    }
}

function updatePokestops() {
    if (!Store.get('showPokestops')) {
        return false
    }

    var removeStops = []
    var currentTime = new Date().getTime()

    // change lured pokestop marker to unlured when expired
    $.each(mapData.pokestops, function (key, value) {
        if (value['lure_expiration'] && value['lure_expiration'] < currentTime) {
            value['lure_expiration'] = null
            if (value.marker && value.marker.rangeCircle) {
                value.marker.rangeCircle.setMap(null)
            }
            value.marker.setMap(null)
            value.marker = setupPokestopMarker(value)
        }
    })

    // remove unlured stops if show lured only is selected
    if (Store.get('showLuredPokestopsOnly')) {
        $.each(mapData.pokestops, function (key, value) {
            if (!value['lure_expiration']) {
                removeStops.push(key)
            }
        })
        $.each(removeStops, function (key, value) {
            if (mapData.pokestops[value] && mapData.pokestops[value].marker) {
                if (mapData.pokestops[value].marker.rangeCircle) {
                    mapData.pokestops[value].marker.rangeCircle.setMap(null)
                }
                mapData.pokestops[value].marker.setMap(null)
                delete mapData.pokestops[value]
            }
        })
    }
}

function processGym(i, item) {
    var gymLevel = getGymLevel(item)
    var raidLevel = getRaidLevel(item.raid)

    if (!Store.get('showGyms') && !Store.get('showRaids')) {
        return false // in case the checkbox was unchecked in the meantime.
    }

    var removeGymFromMap = function (gymid) {
        if (mapData.gyms[gymid] && mapData.gyms[gymid].marker) {
            if (mapData.gyms[gymid].marker.rangeCircle) {
                mapData.gyms[gymid].marker.rangeCircle.setMap(null)
            }
            mapData.gyms[gymid].marker.setMap(null)
            delete mapData.gyms[gymid]
        }
    }

    if (Store.get('showOpenGymsOnly')) {
        if (item.slots_available === 0) {
            removeGymFromMap(item['gym_id'])
            return true
        }
    }

    if (!Store.get('showGyms')) {
        if (Store.get('showRaids') && !isValidRaid(item.raid)) {
            removeGymFromMap(item['gym_id'])
            return true
        }

        if (Store.get('showActiveRaidsOnly')) {
            if (!isOngoingRaid(item.raid)) {
                removeGymFromMap(item['gym_id'])
                return true
            }
        }

        if (raidLevel > Store.get('showRaidMaxLevel') || raidLevel < Store.get('showRaidMinLevel')) {
            removeGymFromMap(item['gym_id'])
            return true
        }
    }

    if (Store.get('showTeamGymsOnly') && Store.get('showTeamGymsOnly') !== item.team_id) {
        removeGymFromMap(item['gym_id'])
        return true
    }

    if (Store.get('showLastUpdatedGymsOnly')) {
        var now = new Date()
        if ((Store.get('showLastUpdatedGymsOnly') * 3600 * 1000) + item.last_scanned < now.getTime()) {
            removeGymFromMap(item['gym_id'])
            return true
        }
    }

    if (gymLevel < Store.get('minGymLevel')) {
        removeGymFromMap(item['gym_id'])
        return true
    }

    if (gymLevel > Store.get('maxGymLevel')) {
        removeGymFromMap(item['gym_id'])
        return true
    }

    var trainerFound = false

    for (var j = 0; j < item.pokemon.length; j++) {
        if (item['pokemon'][j].trainer_name.toUpperCase() == Store.get('showTrainerGymsOnly').toUpperCase()) {
            trainerFound = true
        }
    }

    if (!trainerFound && Store.get('showTrainerGymsOnly') !== '') {
        removeGymFromMap(item['gym_id'])
        return true
    }

    if (item['gym_id'] in mapData.gyms) {
        item.marker = updateGymMarker(item, mapData.gyms[item['gym_id']].marker)
    } else { // add marker to map and item to dict
        item.marker = setupGymMarker(item)
    }
    mapData.gyms[item['gym_id']] = item
}

function processScanned(i, item) {
    if (!Store.get('showScanned')) {
        return false
    }

    var scanId = item['latitude'] + '|' + item['longitude']

    if (!(scanId in mapData.scanned)) { // add marker to map and item to dict
        if (item.marker) {
            item.marker.setMap(null)
        }
        item.marker = setupScannedMarker(item)
        mapData.scanned[scanId] = item
    } else {
        mapData.scanned[scanId].last_modified = item['last_modified']
    }
}

function updateScanned() {
    if (!Store.get('showScanned')) {
        return false
    }

    $.each(mapData.scanned, function (key, value) {
        if (map.getBounds().intersects(value.marker.getBounds())) {
            value.marker.setOptions({
                fillColor: getColorByDate(value['last_modified'])
            })
        }
    })
}

function processSpawnpoint(i, item) {
    if (!Store.get('showSpawnpoints')) {
        return false
    }

    var id = item['id']

    if (!(id in mapData.spawnpoints)) { // add marker to map and item to dict
        if (item.marker) {
            item.marker.setMap(null)
        }
        item.marker = setupSpawnpointMarker(item)
        mapData.spawnpoints[id] = item
    }
}

function updateSpawnPoints() {
    if (!Store.get('showSpawnpoints')) {
        return false
    }

    var zoom = map.getZoom()

    $.each(mapData.spawnpoints, function (key, value) {
        if (map.getBounds().contains(value.marker.getPosition())) {
            var hue = getColorBySpawnTime(value['appear_time'])
            value.marker.setIcon(changeSpawnIcon(hue, zoom))
            value.marker.setZIndex(spawnPointIndex(hue))
        }
    })
}

function updateGeofences(geofences) {
    var i
    if (!Store.get('showGeofences') && geofencesSet === true) {
        for (i = 0; i < polygons.length; i++) {
            polygons[i].setMap(null)
        }
        polygons = []
        geofencesSet = false
        return false
    } else if (Store.get('showGeofences') && geofencesSet === false) {
        var key
        i = 0
        for (key in geofences) {
            polygons[i] = setupGeofencePolygon(geofences[key])
            i++
        }
        geofencesSet = true
    }
}
function updateMap() {
    if (isAuthenticated()) {updateMap2();}
}
function updateMap2() {
    loadRawData().done(function (result) {
        var lurePokemons = {}
        $.each(result.lurePokemons, function (i, item) {
          var pokestopId = item['pokestop_id']
          lurePokemons[pokestopId] = item
        })
        $.each(result.pokestops, function (i, item) {
          var pokestopId = item['pokestop_id']
          if (pokestopId in lurePokemons) {
            item['lure_pokemon'] = lurePokemons[pokestopId]
          }
        })
        processPokemons(result.pokemons)
        $.each(result.lurePokemons, processLurePokemons)
        $.each(result.pokestops, processPokestop)
        $.each(result.gyms, processGym)
        $.each(result.scanned, processScanned)
        $.each(result.spawnpoints, processSpawnpoint)
        $.each(result.weather, processWeather)
        $.each(result.s2cells, processS2Cell)
        processWeatherAlerts(result.weatherAlerts)
        updateMainCellWeather()
        // showInBoundsMarkers(mapData.pokemons, 'pokemon')
        showInBoundsMarkers(mapData.lurePokemons, 'lurePokemon')
        showInBoundsMarkers(mapData.gyms, 'gym')
        showInBoundsMarkers(mapData.pokestops, 'pokestop')
        showInBoundsMarkers(mapData.scanned, 'scanned')
        showInBoundsMarkers(mapData.spawnpoints, 'inbound')
        showInBoundsMarkers(mapData.weather, 'weather')
        showInBoundsMarkers(mapData.s2cells, 's2cell')
        showInBoundsMarkers(mapData.weatherAlerts, 's2cell')
        clearStaleMarkers()

        // We're done processing. Redraw.
        markerCluster.redraw()

        updateScanned()
        updateSpawnPoints()
        updatePokestops()
        updateGeofences(result.geofences)

        if ($('#stats').hasClass('visible')) {
            countMarkers(map)
        }

        oSwLat = result.oSwLat
        oSwLng = result.oSwLng
        oNeLat = result.oNeLat
        oNeLng = result.oNeLng

        lastgyms = result.lastgyms
        lastpokestops = result.lastpokestops
        lastpokemon = result.lastpokemon
        lastslocs = result.lastslocs
        lastspawns = result.lastspawns

        reids = result.reids
        if (reids instanceof Array) {
            reincludedPokemon = reids.filter(function (e) {
                return this.indexOf(e) < 0
            }, reincludedPokemon)
        }
        timestamp = result.timestamp
        lastUpdateTime = Date.now()
    })
}

function redrawPokemon(pokemonList) {
    $.each(pokemonList, function (key, value) {
        var item = pokemonList[key]

        if (!item.hidden) {
            const scaleByRarity = Store.get('scaleByRarity')
            const isNotifyPkmn = isNotifyPoke(item)

            updatePokemonMarker(item, map, scaleByRarity, isNotifyPkmn)
        }
    })
}

var updateLabelDiffTime = function () {
    $('.label-countdown').each(function (index, element) {
        var disappearsAt = getTimeUntil(parseInt(element.getAttribute('disappears-at')))

        var hours = disappearsAt.hour
        var minutes = disappearsAt.min
        var seconds = disappearsAt.sec
        var timestring = ''

        if (disappearsAt.ttime < disappearsAt.now) {
            timestring = '(expired)'
        } else {
            timestring = lpad(hours, 2, 0) + ':' + lpad(minutes, 2, 0) + ':' + lpad(seconds, 2, 0)
        }

        $(element).text(timestring)
    })
}

var updateLabelTime = function () {
    $('.label-countup').each(function (index, element) {
        var countUp = getTimeCount(parseInt(element.getAttribute('count-up')))
        var days = countUp.day
        var hours = countUp.hour
        var minutes = countUp.min
        var seconds = countUp.sec
        var timestring = ''
        if (days > 0) {
          timestring += days + 'D'
        }
        if (hours > 0) {
          timestring += hours + 'H'
        }
        timestring += minutes + 'M'
        $(element).text(timestring)
    })
}

function getPointDistance(pointA, pointB) {
    return google.maps.geometry.spherical.computeDistanceBetween(pointA, pointB)
}

function sendNotification(title, text, icon, lat, lon) {
    var notificationDetails = {
        icon: icon,
        body: text,
        data: {
            lat: lat,
            lon: lon
        }
    }

    if (Push._agents.desktop.isSupported()) {
        /* This will only run in browsers which support the old
         * Notifications API. Browsers supporting the newer Push API
         * are handled by serviceWorker.js. */
        notificationDetails.onClick = function (event) {
            if (Push._agents.desktop.isSupported()) {
                window.focus()
                event.currentTarget.close()
                centerMap(lat, lon, 20)
            }
        }
    }

    /* Push.js requests the Notification permission automatically if
     * necessary. */
    Push.create(title, notificationDetails).catch(function () {
        /* Push.js doesn't fall back automatically if the user denies the
         * Notifications permission. */
        //sendToastrPokemonNotification(title, text, icon, lat, lon)
    })
}

function sendToastrPokemonNotification(title, text, icon, lat, lon) {
    var notification = toastr.info(text, title, {
        closeButton: true,
        positionClass: 'toast-top-right',
        preventDuplicates: true,
        onclick: function () {
            centerMap(lat, lon, 20)
        },
        showDuration: '300',
        hideDuration: '500',
        timeOut: '6000',
        extendedTimeOut: '1500',
        showEasing: 'swing',
        hideEasing: 'linear',
        showMethod: 'fadeIn',
        hideMethod: 'fadeOut'
    })
    notification.removeClass('toast-info')
    notification.css({
        'padding-left': '74px',
        'background-image': `url('./${icon}')`,
        'background-size': '48px',
        'background-color': '#0c5952'
    })
}

function createMyLocationButton() {
    var locationContainer = document.createElement('div')

    var locationButton = document.createElement('button')
    locationButton.style.backgroundColor = '#fff'
    locationButton.style.border = 'none'
    locationButton.style.outline = 'none'
    locationButton.style.width = '28px'
    locationButton.style.height = '28px'
    locationButton.style.borderRadius = '2px'
    locationButton.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
    locationButton.style.cursor = 'pointer'
    locationButton.style.marginRight = '10px'
    locationButton.style.padding = '0px'
    locationButton.title = 'My Location'
    locationContainer.appendChild(locationButton)

    var locationIcon = document.createElement('div')
    locationIcon.style.margin = '5px'
    locationIcon.style.width = '18px'
    locationIcon.style.height = '18px'
    locationIcon.style.backgroundImage = 'url(static/mylocation-sprite-1x.png)'
    locationIcon.style.backgroundSize = '180px 18px'
    locationIcon.style.backgroundPosition = '0px 0px'
    locationIcon.style.backgroundRepeat = 'no-repeat'
    locationIcon.id = 'current-location'
    locationButton.appendChild(locationIcon)

    locationButton.addEventListener('click', function () {
        centerMapOnLocation()
    })

    locationContainer.index = 1
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationContainer)

    google.maps.event.addListener(map, 'dragend', function () {
        var currentLocation = document.getElementById('current-location')
        currentLocation.style.backgroundPosition = '0px 0px'
    })
}

function centerMapOnLocation() {
    var currentLocation = document.getElementById('current-location')
    var imgX = '0'
    // var animationInterval = setInterval(function () {
        // if (imgX === '-18') {
            // imgX = '0'
        // } else {
            // imgX = '-18'
        // }
        // currentLocation.style.backgroundPosition = imgX + 'px 0'
    // }, 500)
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
            locationMarker.setPosition(latlng)
            map.setCenter(latlng)
            Store.set('followMyLocationPosition', {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            })
            //clearInterval(animationInterval)
            currentLocation.style.backgroundPosition = '-144px 0px'
        })
    } else {
        //clearInterval(animationInterval)
        currentLocation.style.backgroundPosition = '0px 0px'
    }
}

function changeLocation(lat, lng) {
    var loc = new google.maps.LatLng(lat, lng)
    changeSearchLocation(lat, lng).done(function () {
        map.setCenter(loc)
        searchMarker.setPosition(loc)
    })
}

function changeSearchLocation(lat, lng) {
    return $.post('next_loc?lat=' + lat + '&lon=' + lng, {})
}

function centerMap(lat, lng, zoom) {
    var loc = new google.maps.LatLng(lat, lng)

    map.setCenter(loc)

    if (zoom) {
        storeZoom = false
        map.setZoom(zoom)
    }
}

function i8ln(word) {
    if ($.isEmptyObject(i8lnDictionary) && language !== 'en' && languageLookups < languageLookupThreshold) {
        $.ajax({
            url: 'static/dist/locales/' + language + '.min.json',
            dataType: 'json',
            async: false,
            success: function (data) {
                i8lnDictionary = data
            },
            error: function (jqXHR, status, error) {
                console.log('Error loading i8ln dictionary: ' + error)
                languageLookups++
            }
        })
    }
    if (word in i8lnDictionary) {
        return i8lnDictionary[word]
    } else {
        // Word doesn't exist in dictionary return it as is
        return word
    }
}

/*
function updateGeoLocation() {
    if (navigator.geolocation && (Store.get('geoLocate') || Store.get('followMyLocation'))) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var lat = position.coords.latitude
            var lng = position.coords.longitude
            var center = new google.maps.LatLng(lat, lng)

            if (Store.get('geoLocate')) {
                // the search function makes any small movements cause a loop. Need to increase resolution
                if ((typeof searchMarker !== 'undefined') && (getPointDistance(searchMarker.getPosition(), center) > 40)) {
                    $.post('next_loc?lat=' + lat + '&lon=' + lng).done(function () {
                        map.panTo(center)
                        searchMarker.setPosition(center)
                    })
                }
            }
            if (Store.get('followMyLocation')) {
                if ((typeof locationMarker !== 'undefined') && (getPointDistance(locationMarker.getPosition(), center) >= 5)) {
                    map.panTo(center)
                    locationMarker.setPosition(center)
                    Store.set('followMyLocationPosition', {
                        lat: lat,
                        lng: lng
                    })
                }
            }
        })
    }
}
*/

function createUpdateWorker() {
    try {
        if (isMobileDevice() && (window.Worker)) {
            var updateBlob = new Blob([`onmessage = function(e) {
                var data = e.data
                if (data.name === 'backgroundUpdate') {
                    self.setInterval(function () {self.postMessage({name: 'backgroundUpdate'})}, 5000)
                }
            }`])

            var updateBlobURL = window.URL.createObjectURL(updateBlob)

            updateWorker = new Worker(updateBlobURL)

            updateWorker.onmessage = function (e) {
                var data = e.data
                if (document.hidden && data.name === 'backgroundUpdate' && Date.now() - lastUpdateTime > 2500) {
                    updateMap()
                    //updateGeoLocation()
                }
            }

            updateWorker.postMessage({
                name: 'backgroundUpdate'
            })
        }
    } catch (ex) {
        console.log('Webworker error: ' + ex.message)
    }
}

function showGymDetails(id) { // eslint-disable-line no-unused-vars
    var sidebar = document.querySelector('#gym-details')
    var sidebarClose

    sidebar.classList.add('visible')

    var data = $.ajax({
        url: 'gym_data',
        type: 'GET',
        data: {
            'id': id
        },
        dataType: 'json',
        cache: false
    })

    data.done(function (result) {
        var pokemonHtml = ''
        if (result.pokemon.length) {
            result.pokemon.forEach((pokemon) => {
                pokemonHtml += getSidebarGymMember(pokemon)
            })

            pokemonHtml = `<table><tbody>${pokemonHtml}</tbody></table>`
        } else if (result.team_id === 0) {
            pokemonHtml = ''
        } else {
            pokemonHtml = `
                <center>
                    Gym Leader:<br>
                    <i class="${pokemonSprite(result.guard_pokemon_id, 0, true)}"></i><br>
                    <b>${result.guard_pokemon_name}</b>

                    <p style="font-size: .75em; margin: 5px;">
                        No additional gym information is available for this gym. Make sure you are collecting <a href="https://rocketmap.readthedocs.io/en/develop/extras/gyminfo.html">detailed gym info.</a>
                        If you have detailed gym info collection running, this gym's Pokemon information may be out of date.
                    </p>
                </center>
            `
        }

        var topPart = gymLabel(result, false)
        sidebar.innerHTML = `${topPart}${pokemonHtml}`

        sidebarClose = document.createElement('a')
        sidebarClose.href = '#'
        sidebarClose.className = 'close'
        sidebarClose.tabIndex = 0
        sidebar.appendChild(sidebarClose)

        sidebarClose.addEventListener('click', function (event) {
            event.preventDefault()
            event.stopPropagation()
            sidebar.classList.remove('visible')
        })
    })
}

function getSidebarGymMember(pokemon) {
    var perfectPercent = getIv(pokemon.iv_attack, pokemon.iv_defense, pokemon.iv_stamina)
    var moveEnergy = Math.round(100 / pokemon.move_2_energy)
    var formString = ''

    if (pokemon.pokemon_id === 201 && pokemon.form !== null && pokemon.form > 0) {
        formString += `(<b>${unownForm[`${pokemon.form}`]}</b>)`
    }

    return `
                    <tr onclick=toggleGymPokemonDetails(this)>
                        <td width="35px">
                            <i class="${pokemonSprite(pokemon.pokemon_id, pokemon.form, true)}" >
                        </td>
                        <td>
                            <div class="gym pokemon" style="line-height:0.5em;"><b>${pokemon.pokemon_name}</b>${formString}X${pokemon.num_upgrades}</div>
                            <div><img class="gym pokemon motivation heart" src="static/images/gym/Heart.png"> <span class="gym pokemon motivation">${pokemon.cp_decayed}</span></div>
                        </td>
                        <td width="190" align="center">
                            <div class="gym pokemon" style="line-height:1em;"><b>${pokemon.trainer_name}</b></div>
                            <div class="gym pokemon" style="line-height:1em;">Lv: <b>${pokemon.trainer_level}</b></div>
                            <div class="gym pokemon"><b>${getDateStr(pokemon.deployment_time)}</b></div>
                        </td>
                        <td width="10">
                            <!--<a href="#" onclick="toggleGymPokemonDetails(this)">-->
                                <i class="fa fa-angle-double-down"></i>
                            <!--</a>-->
                        </td>
                    </tr>
                    <tr class="details">
                        <td colspan="2">
                            <div class="ivs">
                                <div class="iv">
                                    <div class="type">ATK</div>
                                    <div class="value">
                                        ${pokemon.iv_attack}
                                    </div>
                                </div>
                                <div class="iv">
                                    <div class="type">DEF</div>
                                    <div class="value">
                                        ${pokemon.iv_defense}
                                    </div>
                                </div>
                                <div class="iv">
                                    <div class="type">STA</div>
                                    <div class="value">
                                        ${pokemon.iv_stamina}
                                    </div>
                                </div>
                                <div class="iv" style="width: 36px;"">
                                    <div class="type">PERFECT</div>
                                    <div class="value">
                                        ${perfectPercent.toFixed(0)}<span style="font-size: .6em;">%</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td colspan="2">
                            <div class="moves">
                                <div class="move">
                                    <div class="name">
                                        <b>${pokemon.move_1_name}</b>
                                        <div class="type ${pokemon.move_1_type['type_en'].toLowerCase()}">${pokemon.move_1_type['type']}</div>
                                    </div>
                                    <div class="damage">
                                        <b>${pokemon.move_1_damage}</b>
                                    </div>
                                </div>
                                <br>
                                <div class="move">
                                    <div class="name">
                                        <b>${pokemon.move_2_name}</b>
                                        <div class="type ${pokemon.move_2_type['type_en'].toLowerCase()}">${pokemon.move_2_type['type']}</div>
                                        <div>
                                            <i class="move-bar-sprite move-bar-sprite-${moveEnergy}"></i>
                                        </div>
                                    </div>
                                    <div class="damage">
                                        <b>${pokemon.move_2_damage}</b>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                    `
}

function toggleGymPokemonDetails(e) { // eslint-disable-line no-unused-vars
    e.lastElementChild.firstElementChild.classList.toggle('fa-angle-double-up')
    e.lastElementChild.firstElementChild.classList.toggle('fa-angle-double-down')
    e.nextElementSibling.classList.toggle('visible')
}

function getParameterByName(name, url) {
    if (!url) {
        url = window.location.search
    }
    name = name.replace(/[[\]]/g, '\\$&')
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
    var results = regex.exec(url)
    if (!results) {
        return null
    }
    if (!results[2]) {
        return ''
    }
    return decodeURIComponent(results[2].replace(/\+/g, ' '))
}


//
// Page Ready Execution
//

$(function () {
    /* If push.js is unsupported or disabled, fall back to toastr
     * notifications. */
    Push.config({
        serviceWorker: 'serviceWorker.min.js',
        //fallback: function (notification) {
        //    sendToastrPokemonNotification(
        //        notification.title,
        //        notification.body,
        //        notification.icon,
        //        notification.data.lat,
        //        notification.data.lon
        //    )
        //}
    })
})

$(function () {
    // populate Navbar Style menu
    $selectStyle = $('#map-style')

    // Load Stylenames, translate entries, and populate lists
    $.getJSON('static/dist/data/mapstyle.min.json').done(function (data) {
        var styleList = []

        $.each(data, function (key, value) {
            styleList.push({
                id: key,
                text: i8ln(value)
            })
        })

        // setup the stylelist
        $selectStyle.select2({
            placeholder: 'Select Style',
            data: styleList,
            minimumResultsForSearch: Infinity
        })

        // setup the list change behavior
        $selectStyle.on('change', function (e) {
            selectedStyle = $selectStyle.val()
            map.setMapTypeId(selectedStyle)
            Store.set('map_style', selectedStyle)
        })

        // recall saved mapstyle
        $selectStyle.val(Store.get('map_style')).trigger('change')
    })

    var mapServiceProvider = $('#map-service-provider')

    mapServiceProvider.select2({
        placeholder: 'Select map provider',
        data: ['googlemaps', 'applemaps'],
        minimumResultsForSearch: Infinity
    })

    mapServiceProvider.on('change', function (e) {
        var selectedVal = mapServiceProvider.val()
        Store.set('mapServiceProvider', selectedVal)
    })

    $selectIconSize = $('#pokemon-icon-size')

    $selectIconSize.select2({
        placeholder: 'Select Icon Size',
        minimumResultsForSearch: Infinity
    })

    $selectIconSize.on('change', function () {
        Store.set('iconSizeModifier', this.value)
        redrawPokemon(mapData.pokemons)
        redrawPokemon(mapData.lurePokemons)

        // We're done processing the list. Repaint.
        markerCluster.repaint()
    })

    $switchOpenGymsOnly = $('#open-gyms-only-switch')

    $switchOpenGymsOnly.on('change', function () {
        Store.set('showOpenGymsOnly', this.checked)
        lastgyms = false
        updateMap()
    })

    $switchActiveRaidGymsOnly = $('#raid-active-gym-switch')

    $switchActiveRaidGymsOnly.on('change', function () {
        Store.set('showActiveRaidsOnly', this.checked)
        lastgyms = false
        updateMap()
    })

    $switchRaidMinLevel = $('#raid-min-level-only-switch')

    $switchRaidMinLevel.select2({
        placeholder: 'Minimum raid level',
        minimumResultsForSearch: Infinity
    })

    $switchRaidMinLevel.on('change', function () {
        Store.set('showRaidMinLevel', this.value)
        lastgyms = false
        updateMap()
    })

    $switchRaidMaxLevel = $('#raid-max-level-only-switch')

    $switchRaidMaxLevel.select2({
        placeholder: 'Maximum raid level',
        minimumResultsForSearch: Infinity
    })

    $switchRaidMaxLevel.on('change', function () {
        Store.set('showRaidMaxLevel', this.value)
        lastgyms = false
        updateMap()
    })


    $selectTeamGymsOnly = $('#team-gyms-only-switch')

    $selectTeamGymsOnly.select2({
        placeholder: 'Only Show Gyms For Team',
        minimumResultsForSearch: Infinity
    })

    $selectTeamGymsOnly.on('change', function () {
        Store.set('showTeamGymsOnly', this.value)
        lastgyms = false
        updateMap()
    })

    $selectLastUpdateGymsOnly = $('#last-update-gyms-switch')

    $selectLastUpdateGymsOnly.select2({
        placeholder: 'Only Show Gyms Last Updated',
        minimumResultsForSearch: Infinity
    })

    $selectLastUpdateGymsOnly.on('change', function () {
        Store.set('showLastUpdatedGymsOnly', this.value)
        lastgyms = false
        updateMap()
    })

    $selectMinGymLevel = $('#min-level-gyms-filter-switch')

    $selectMinGymLevel.select2({
        placeholder: 'Minimum Gym Level',
        minimumResultsForSearch: Infinity
    })

    $selectMinGymLevel.on('change', function () {
        Store.set('minGymLevel', this.value)
        lastgyms = false
        updateMap()
    })

    $selectMaxGymLevel = $('#max-level-gyms-filter-switch')

    $selectMaxGymLevel.select2({
        placeholder: 'Maximum Gym Level',
        minimumResultsForSearch: Infinity
    })

    $selectMaxGymLevel.on('change', function () {
        Store.set('maxGymLevel', this.value)
        lastgyms = false
        updateMap()
    })

    $selectTrainerGymsOnly = $('#trainer-gyms-only')

    $selectTrainerGymsOnly.on('change', function () {
        Store.set('showTrainerGymsOnly', this.value)
        lastgyms = false
        updateMap()
    })

    $selectLuredPokestopsOnly = $('#lured-pokestops-only-switch')

    $selectLuredPokestopsOnly.select2({
        placeholder: 'Only Show Lured Pokestops',
        minimumResultsForSearch: Infinity
    })

    $selectLuredPokestopsOnly.on('change', function () {
        Store.set('showLuredPokestopsOnly', this.value)
        lastpokestops = false
        updateMap()
    })
    $switchGymSidebar = $('#gym-sidebar-switch')

    $switchGymSidebar.on('change', function () {
        Store.set('useGymSidebar', this.checked)
        lastgyms = false
        $.each(['gyms'], function (d, dType) {
            $.each(mapData[dType], function (key, value) {
                // for any marker you're turning off, you'll want to wipe off the range
                if (mapData[dType][key].marker.rangeCircle) {
                    mapData[dType][key].marker.rangeCircle.setMap(null)
                    delete mapData[dType][key].marker.rangeCircle
                }
                mapData[dType][key].marker.setMap(null)
            })
            mapData[dType] = {}
        })
        updateMap()
    })

    //$selectSearchIconMarker = $('#iconmarker-style')
    //$selectLocationIconMarker = $('#locationmarker-style')

	/*
    $.getJSON('static/dist/data/searchmarkerstyle.min.json').done(function (data) {
        searchMarkerStyles = data
        var searchMarkerStyleList = []

        $.each(data, function (key, value) {
            searchMarkerStyleList.push({
                id: key,
                text: value.name
            })
        })
		/*
        $selectSearchIconMarker.select2({
            placeholder: 'Select Icon Marker',
            data: searchMarkerStyleList,
            minimumResultsForSearch: Infinity
        })

        $selectSearchIconMarker.on('change', function (e) {
            var selectSearchIconMarker = $selectSearchIconMarker.val()
            Store.set('searchMarkerStyle', selectSearchIconMarker)
            updateSearchMarker(selectSearchIconMarker)
        })

        $selectSearchIconMarker.val(Store.get('searchMarkerStyle')).trigger('change')

        updateSearchMarker(Store.get('lockMarker'))

        $selectLocationIconMarker.select2({
            placeholder: 'Select Location Marker',
            data: searchMarkerStyleList,
            minimumResultsForSearch: Infinity
        })

        $selectLocationIconMarker.on('change', function (e) {
            Store.set('locationMarkerStyle', this.value)
            updateLocationMarker(this.value)
        })

        $selectLocationIconMarker.val(Store.get('locationMarkerStyle')).trigger('change')
		
    })*/
})

$(function () {
    moment.locale(language)
    function formatState(state) {
        if (!state.id) {
            return state.text
        }
        var $state = $(`<span><i class="${pokemonSprite(state.element.value)}"></i> ${state.text}</span>`)
        return $state
    }

    if (Store.get('startAtUserLocation') && getParameterByName('lat') == null && getParameterByName('lon') == null) {
        centerMapOnLocation()
    }

    $.getJSON('static/dist/data/moves.min.json').done(function (data) {
        moves = data
    })

    $selectExclude = $('#exclude-pokemon')
    $selectPokemonNotify = $('#notify-pokemon')
    $selectRarityNotify = $('#notify-rarity')
    $textPerfectionNotify = $('#notify-perfection')
    $textLevelNotify = $('#notify-level')
    var numberOfPokemon = 493

    // Load pokemon names and populate lists
    $.getJSON('static/dist/data/pokemon.min.json').done(function (data) {
        var pokeList = []

        $.each(data, function (key, value) {
            if (key > numberOfPokemon) {
                return false
            }
            var _types = []
            pokeList.push({
                id: key,
                text: i8ln(value['name']) + ' - #' + key
            })
            value['name'] = i8ln(value['name'])
            value['rarity'] = i8ln(value['rarity'])
            $.each(value['types'], function (key, pokemonType) {
                _types.push({
                    'type': i8ln(pokemonType['type']),
                    'color': pokemonType['color']
                })
            })
            value['types'] = _types
            idToPokemon[key] = value
        })

        // setup the filter lists
        $selectExclude.select2({
            placeholder: i8ln('Select Pokémon'),
            data: pokeList,
            templateResult: formatState
        })
        $selectPokemonNotify.select2({
            placeholder: i8ln('Select Pokémon'),
            data: pokeList,
            templateResult: formatState
        })
        $selectRarityNotify.select2({
            placeholder: i8ln('Select Rarity'),
            data: [i8ln('Common'), i8ln('Uncommon'), i8ln('Rare'), i8ln('Very Rare'), i8ln('Ultra Rare')],
            templateResult: formatState
        })

        // setup list change behavior now that we have the list to work from
        $selectExclude.on('change', function (e) {
            buffer = excludedPokemon
            excludedPokemon = $selectExclude.val().map(Number)
            buffer = buffer.filter(function (e) {
                return this.indexOf(e) < 0
            }, excludedPokemon)
            reincludedPokemon = reincludedPokemon.concat(buffer)
            clearStaleMarkers()
            Store.set('remember_select_exclude', excludedPokemon)
        })
        $selectPokemonNotify.on('change', function (e) {
            notifiedPokemon = $selectPokemonNotify.val().map(Number)
            Store.set('remember_select_notify', notifiedPokemon)
        })
        $selectRarityNotify.on('change', function (e) {
            notifiedRarity = $selectRarityNotify.val().map(String)
            Store.set('remember_select_rarity_notify', notifiedRarity)
        })
        $textPerfectionNotify.on('change', function (e) {
            notifiedMinPerfection = parseInt($textPerfectionNotify.val(), 10)
            if (isNaN(notifiedMinPerfection) || notifiedMinPerfection <= 0) {
                notifiedMinPerfection = ''
            }
            if (notifiedMinPerfection > 100) {
                notifiedMinPerfection = 100
            }
            $textPerfectionNotify.val(notifiedMinPerfection)
            Store.set('remember_text_perfection_notify', notifiedMinPerfection)
        })

        $textLevelNotify.on('change', function (e) {
            notifiedMinLevel = parseInt($textLevelNotify.val(), 10)
            if (isNaN(notifiedMinLevel) || notifiedMinLevel <= 0) {
                notifiedMinLevel = ''
            }
            if (notifiedMinLevel > 40) {
                notifiedMinLevel = 40
            }
            $textLevelNotify.val(notifiedMinLevel)
            Store.set('remember_text_level_notify', notifiedMinLevel)
        })

        // recall saved lists
        $selectExclude.val(Store.get('remember_select_exclude')).trigger('change')
        $selectPokemonNotify.val(Store.get('remember_select_notify')).trigger('change')
        $selectRarityNotify.val(Store.get('remember_select_rarity_notify')).trigger('change')
        $textPerfectionNotify.val(Store.get('remember_text_perfection_notify')).trigger('change')
        $textLevelNotify.val(Store.get('remember_text_level_notify')).trigger('change')

        if (isTouchDevice() && isMobileDevice()) {
            $('.select2-search input').prop('readonly', true)
        }
    })

    // run interval timers to regularly update map and timediffs
    window.setInterval(updateLabelDiffTime, 1000)
    window.setInterval(updateLabelTime, 1000)
    window.setInterval(updateMap, 5000)
    //window.setInterval(updateGeoLocation, 1000)

    createUpdateWorker()

    // Wipe off/restore map icons when switches are toggled
    function buildSwitchChangeListener(data, dataType, storageKey) {
        return function () {
            Store.set(storageKey, this.checked)

            if (this.checked) {
                // When switch is turned on we asume it has been off, makes sure we dont end up in limbo
                // Without this there could've been a situation where no markers are on map and only newly modified ones are loaded
                if (storageKey === 'showPokemon') {
                    lastpokemon = false
                } else if (storageKey === 'showPokestops') {
                    lastpokestops = false
                } else if (storageKey === 'showScanned') {
                    lastslocs = false
                } else if (storageKey === 'showSpawnpoints') {
                    lastspawns = false
                }
                updateMap()
            } else if (storageKey === 'showGyms' || storageKey === 'showRaids') {
                // if any of switch is enable then do not remove gyms markers, only update them
                if (Store.get('showGyms') || Store.get('showRaids')) {
                    lastgyms = false
                    updateMap()
                } else {
                    $.each(dataType, function (d, dType) {
                        $.each(data[dType], function (key, value) {
                            // for any marker you're turning off, you'll want to wipe off the range
                            if (data[dType][key].marker.rangeCircle) {
                                data[dType][key].marker.rangeCircle.setMap(null)
                                delete data[dType][key].marker.rangeCircle
                            }
                            data[dType][key].marker.setMap(null)
                        })
                        data[dType] = {}
                    })
                }
            } else {
                $.each(dataType, function (d, dType) {
                    var oldPokeMarkers = []
                    $.each(data[dType], function (key, value) {
                        // for any marker you're turning off, you'll want to wipe off the range
                        if (data[dType][key].marker.rangeCircle) {
                            data[dType][key].marker.rangeCircle.setMap(null)
                            delete data[dType][key].marker.rangeCircle
                        }
                        if (storageKey !== 'showRanges') {
                            data[dType][key].marker.setMap(null)
                            if (dType === 'pokemons') {
                                oldPokeMarkers.push(data[dType][key].marker)
                            }
                        }
                    })
                    // If the type was "pokemons".
                    if (oldPokeMarkers.length > 0) {
                        markerCluster.removeMarkers(oldPokeMarkers)
                    }
                    if (storageKey !== 'showRanges') data[dType] = {}
                })
                if (storageKey === 'showRanges') {
                    updateMap()
                }
            }
        }
    }

    function resetGymFilter() {
        Store.set('showTeamGymsOnly', 0)
        Store.set('minGymLevel', 0)
        Store.set('maxGymLevel', 6)
        Store.set('showOpenGymsOnly', false)

        $('#team-gyms-only-switch').val(Store.get('showTeamGymsOnly'))
        $('#open-gyms-only-switch').prop('checked', Store.get('showOpenGymsOnly'))
        $('#min-level-gyms-filter-switch').val(Store.get('minGymLevel'))
        $('#max-level-gyms-filter-switch').val(Store.get('maxGymLevel'))

        $('#team-gyms-only-switch').trigger('change')
        $('#min-level-gyms-filter-switch').trigger('change')
        $('#max-level-gyms-filter-switch').trigger('change')
    }

    // Setup UI element interactions
    $('#gyms-switch').change(function () {
        var options = {
            'duration': 500
        }
        resetGymFilter()
        var wrapperGyms = $('#gyms-filter-wrapper')
        var switchRaids = $('#raids-switch')
        var wrapperSidebar = $('#gym-sidebar-wrapper')
        if (this.checked) {
            lastgyms = false
            wrapperGyms.show(options)
            wrapperSidebar.show(options)
        } else {
            lastgyms = false
            wrapperGyms.hide(options)
            if (!switchRaids.prop('checked')) {
                wrapperSidebar.hide(options)
            }
        }
        buildSwitchChangeListener(mapData, ['gyms'], 'showGyms').bind(this)()
    })
    $('#raids-switch').change(function () {
        var options = {
            'duration': 500
        }
        var wrapperRaids = $('#raids-filter-wrapper')
        var switchGyms = $('#gyms-switch')
        var wrapperSidebar = $('#gym-sidebar-wrapper')
        if (this.checked) {
            lastgyms = false
            wrapperRaids.show(options)
            wrapperSidebar.show(options)
        } else {
            lastgyms = false
            wrapperRaids.hide(options)
            if (!switchGyms.prop('checked')) {
                wrapperSidebar.hide(options)
            }
        }
        buildSwitchChangeListener(mapData, ['gyms'], 'showRaids').bind(this)()
    })
    $('#pokemon-switch').change(function () {
        buildSwitchChangeListener(mapData, ['pokemons'], 'showPokemon').bind(this)()
        markerCluster.repaint()
    })
    $('#lure-pokemon-switch').change(function () {
        buildSwitchChangeListener(mapData, ['lurePokemons'], 'showLurePokemon').bind(this)()
        markerCluster.repaint()
    })
    $('#pokemon-scale-by-rarity-switch').change(function () {
        // Change and store the flag
        Store.set('scaleByRarity', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })
    $('#scanned-switch').change(function () {
        buildSwitchChangeListener(mapData, ['scanned'], 'showScanned').bind(this)()
    })
    $('#spawnpoints-switch').change(function () {
        buildSwitchChangeListener(mapData, ['spawnpoints'], 'showSpawnpoints').bind(this)()
    })
    $('#ranges-switch').change(buildSwitchChangeListener(mapData, ['gyms', 'pokemons', 'pokestops'], 'showRanges'))

    $('#weather-cells-switch').change(function () {
        buildSwitchChangeListener(mapData, ['weather'], 'showWeatherCells').bind(this)()
    })

    $('#s2cells-switch').change(function () {
        buildSwitchChangeListener(mapData, ['s2cells'], 'showS2Cells').bind(this)()
    })

    $('#weather-alerts-switch').change(function () {
        buildSwitchChangeListener(mapData, ['weatherAlerts'], 'showWeatherAlerts').bind(this)()
    })


    $('#pokestops-switch').change(function () {
        var options = {
            'duration': 500
        }
        var wrapper = $('#lured-pokestops-only-wrapper')
        if (this.checked) {
            lastpokestops = false
            wrapper.show(options)
        } else {
            lastpokestops = false
            wrapper.hide(options)
        }
        return buildSwitchChangeListener(mapData, ['pokestops'], 'showPokestops').bind(this)()
    })

    $('#sound-switch').change(function () {
        Store.set('playSound', this.checked)
        var options = {
            'duration': 500
        }
        var criesWrapper = $('#pokemoncries')
        if (this.checked) {
            criesWrapper.show(options)
        } else {
            criesWrapper.hide(options)
        }
    })

    $('#bounce-switch').change(function () {
        Store.set('isBounceDisabled', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })

    $('#hideunnotified-switch').change(function () {
        Store.set('hideNotNotified', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })

    $('#popups-switch').change(function () {
        Store.set('showPopups', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })

    $('#cries-switch').change(function () {
        Store.set('playCries', this.checked)
    })

    $('#medal-switch').change(function () {
        var wrapper = $('#medal-wrapper')
        wrapper.toggle(this.checked)
        // Change and store the flag
        Store.set('showMedal', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })

    $('#medal-rattata-switch').change(function () {
        // Change and store the flag
        Store.set('showMedalRattata', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })

    $('#medal-magikarp-switch').change(function () {
        // Change and store the flag
        Store.set('showMedalMagikarp', this.checked)
        // Remove all Pokemon markers from map
        RedrawPokemon()
    })

    $('#geoloc-switch').change(function () {
        $('#next-location').prop('disabled', this.checked)
        $('#next-location').css('background-color', this.checked ? '#e0e0e0' : '#ffffff')
        if (!navigator.geolocation) {
            this.checked = false
        } else {
            Store.set('geoLocate', this.checked)
        }
    })

    $('#geofences-switch').change(function () {
        Store.set('showGeofences', this.checked)
        updateMap()
    })

    $('#lock-marker-switch').change(function () {
        Store.set('lockMarker', this.checked)
        searchMarker.setDraggable(!this.checked)
    })

    $('#search-switch').change(function () {
        searchControl(this.checked ? 'on' : 'off')
    })

    $('#start-at-user-location-switch').change(function () {
        Store.set('startAtUserLocation', this.checked)
    })

	/*
    $('#follow-my-location-switch').change(function () {
        if (!navigator.geolocation) {
            this.checked = false
        } else {
            Store.set('followMyLocation', this.checked)
        }
        locationMarker.setDraggable(!this.checked)
    })

    $('#scan-here-switch').change(function () {
        if (this.checked && !Store.get('scanHereAlerted')) {
            alert('Use this feature carefully ! This button will set the current map center as new search location. This may cause worker to teleport long range.')
            Store.set('scanHereAlerted', true)
        }
        $('#scan-here').toggle(this.checked)
        Store.set('scanHere', this.checked)
    })
	*/
	
    if ($('#nav-accordion').length) {
        $('#nav-accordion').accordion({
            active: 0,
            collapsible: true,
            heightStyle: 'content'
        })
    }

    // Initialize dataTable in statistics sidebar
    //   - turn off sorting for the 'icon' column
    //   - initially sort 'name' column alphabetically

    $('#pokemonList_table').DataTable({
        paging: false,
        searching: false,
        info: false,
        errMode: 'throw',
        'language': {
            'emptyTable': ''
        },
        'columns': [
            { 'orderable': false },
            null,
            null,
            null
        ]
    }).order([1, 'asc'])
})

function RedrawPokemon() {
  // Remove all Pokemon markers from map
  var oldPokeMarkers = []
  $.each(mapData['pokemons'], function (key, pkm) {
      // for any marker you're turning off, you'll want to wipe off the range
      if (pkm.marker.rangeCircle) {
          pkm.marker.rangeCircle.setMap(null)
          delete pkm.marker.rangeCircle
      }
      pkm.marker.setMap(null)
      oldPokeMarkers.push(pkm.marker)
  })
  $.each(mapData['lurePokemons'], function (key, pkm) {
      // for any marker you're turning off, you'll want to wipe off the range
      if (pkm.marker.rangeCircle) {
          pkm.marker.rangeCircle.setMap(null)
          delete pkm.marker.rangeCircle
      }
      pkm.marker.setMap(null)
      oldPokeMarkers.push(pkm.marker)
  })
  markerCluster.removeMarkers(oldPokeMarkers)
  mapData['pokemons'] = {}
  mapData['lurePokemons'] = {}
  // Reload all Pokemon
  lastpokemon = false
  updateMap()
}
