var map;
var markerLayer;
var currentMarker, featuresMarker;
var locationButton, clearButton;
var zoom;

var latitude, longitude;
var distance = 5;

var start = null;
var firstLoad = true;

var app = {
    // Application Constructor
    initialize: function() {
        start = Date.now();
        map = L.mapbox.map('map', 'a4enquiry.h2e4fhb5', {
            zoomControl: false,
            tileLayer: {
                detectRetina: true,
                retinaVersion: 'a4enquiry.h2e5dopc'
            }
        });
        markerLayer = L.mapbox.featureLayer();
        currentMarker = L.mapbox.featureLayer();
        featuresMarker = L.mapbox.featureLayer();
        locationButton = L.Control.extend({
            options: {
                position: 'topleft',
            },
            onAdd: function(map) {
                var controlDiv = L.DomUtil.create('div', 'location-button');
                L.DomEvent.addListener(controlDiv, 'click', L.DomEvent.stopPropagation)
                    .addListener(controlDiv, 'click', L.DomEvent.preventDefault)
                    .addListener(controlDiv, 'click', function() {
                        console.log('>>>>> Update Current Location <<<<<');
                        app.clearStatusText();
                        app.getPosition();
                });
                var controlUI = L.DomUtil.create('div', 'location-button-content', controlDiv);
                controlUI.title = 'Update Location';
                return controlDiv;
            }
        });
        clearButton = L.Control.extend({
            options: {
                position: 'topright',
            },
            onAdd: function(map) {
                var controlDiv = L.DomUtil.create('div', 'clear-button');
                L.DomEvent.addListener(controlDiv, 'click', L.DomEvent.stopPropagation)
                    .addListener(controlDiv, 'click', L.DomEvent.preventDefault)
                    .addListener(controlDiv, 'click', function() {
                        console.log('>>>>> Clear all search results <<<<<');
                        app.setStatusText('Cleared all search results');
                        setTimeout(app.clearStatusText, 3000);
                        featuresMarker.clearLayers();
                        // $('#search').val('');
                        // app.displayResults();
                });
                var controlUI = L.DomUtil.create('div', 'clear-button-content', controlDiv);
                controlUI.title = 'Clear All Search Results';
                return controlDiv;
            }
        });
        map.addControl(new locationButton());
        map.addControl(new clearButton());
        map.dragging.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.keyboard.disable();
        // map.fitWorld();
        $('#search-bar').hide();
        $('#status').hide();
/*        $('#search-bar').click(function(e) {
            console.log('>>>>> Touch <<<<<');
            e.stopPropagation();
            e.preventDefault();
        });*/
        $('.clear-button').hide();
        this.bindEvents();
    },

    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.getPosition();
    },

    getPosition: function() {
         $.mobile.loading('show', {
            text: 'Getting Your Current Location',
            textVisible: true,
            theme: 'a',
            html: ''
        });
        navigator.geolocation.getCurrentPosition(app.getPosSuccess, app.getPosError, { 
            enableHighAccuracy: true, 
            timeout: 30000, 
            maximumAge: 0
        });
    },

    getPosSuccess: function(position) {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        var end = Date.now();
        console.log('>>>>> ' + (end - start) + ' | Position: ' + latitude + ' ' + longitude + ' <<<<<');
        app.displayResults();
    },

    getAddress: function() {
        var reverseGeocoder = 'http://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=' + latitude + '&lon=' + longitude;
        var geojson = [];

        $.ajax({
            type: 'GET',
            url: reverseGeocoder,
            dataType: 'json',
            success: function(result) {
                console.log('>>>>> Reverse Geocoding <<<<<');
                geojson = {
                    'type': 'Feature',
                     'geometry': {
                        'type': 'Point',
                        'coordinates': [longitude, latitude]
                    },
                    'properties': {
                        'title': 'Your current location',
                        'description': result.display_name,
                        'marker-color': '#fc4353',
                        'marker-size': 'large',
                        'marker-symbol': 'star'
                    }
                };
            },
            async: false
        });

        return geojson;
    },

    getFeatures: function(search) {
        var bounding = boundingCoords(Math.radians(latitude), Math.radians(longitude), distance, EARTH_RADIUS);
        var south = Math.degrees(bounding.south);
        var west = Math.degrees(bounding.west);
        var north = Math.degrees(bounding.north);
        var east = Math.degrees(bounding.east);

        /* overpass search QI format:

        (
          node
            ["amenity"="fire_station"]
            (50.6,7.0,50.8,7.3);
          way
            ["amenity"="fire_station"]
            (50.6,7.0,50.8,7.3);
          rel
            ["amenity"="fire_station"]
            (50.6,7.0,50.8,7.3);
        );
        (._;>;);
        out;

        */

        // Overpass query with timeout set to 30 seconds and sort by quadtile index (qt)
        var overpass = 'http://overpass.osm.rambler.ru/cgi/interpreter?data=[out:json][timeout:30];';
        overpass += '(node["name"~"' + search + '"]';
        overpass += '(' + + south + ',' + west +',' + north + ','+ east + ');';
        overpass += 'way["name"~"' + search + '"]';
        overpass += '(' + + south + ',' + west +',' + north + ','+ east + ');';
        overpass += 'rel["name"~"' + search + '"]';
        overpass += '(' + + south + ',' + west +',' + north + ','+ east + ');';
        overpass += ');(._;>;);out qt;';

        // var overpass = 'http://overpass.osm.rambler.ru/cgi/interpreter?data=[out:json];node["railway"~"' + search + '"](' + south + ',' + west +',' + north + ','+ east + ');out body;';
        console.log('>>>>> Overpass URL: ' + overpass + ' <<<<<');

        var geojson = [];
        var querySuccess = false;
        app.setStatusText('Searching ...');

        $.ajax({
            type: 'GET',
            url: overpass,
            dataType: 'json',
            timeout: 10000,
            success: function(result) {
                querySuccess = true;
                console.log('>>>>> Number of results = ' + result.elements.length + ' <<<<<');
                geojson = osmtogeojson(result);
                console.log('>>>>> Number of features = ' + geojson.features.length + ' <<<<<');
                var features = geojson.features;
                if (features.length > 0) {
                    for (var i in features) {
                        var properties = features[i].properties;
                        properties['description'] = properties.tags.name;
                        /*switch (features[i].geometry.type) {
                            case 'Point':
                                properties['marker-size'] = 'medium';
                                properties['marker-color'] = '#ff0000';
                                break;
                            case 'LineString':
                                properties['stroke'] = '#555555';
                                properties['stroke-opacity'] = 1.0;
                                break;
                            case 'Polygon':
                                properties['stroke'] = '#555555';
                                properties['stroke-opacity'] = 1.0;
                                properties['fill'] = '#555555';
                                properties['fill-opacity'] = 0.5;
                                break;
                        }*/
                    }
                }
            },
            fail: function(jqXHR, status, message) {
                console.log('>>>>> Feature search fail <<<<<');
                console.log('>>>>> ' + status + ' - ' + message);
            },
            async: false
        });

        if (!querySuccess) {
            app.setStatusText('Search timeout. Your query may return too many results. Please try to narrow your search.');
            setTimeout(app.clearStatusText, 5000);
            return;
        }

        // console.log(JSON.stringify(geojson, null, '\t'));
        return geojson;
    },

    parseSearchText: function(search) {
        // Trim spaces before and after search term
        console.log('>>>>> Manipulate search query <<<<<');
        search = search.trim();

        // Case insensitive search
        var query = search.split(' ');
        search = '';
        for (var i = 0; i < query.length; i++) {
            console.log(query[i]);
            var letter = query[i].substring(0, 1);
            if (($.isNumeric(letter) == false) && (letter.charCodeAt(0) <= 255)) {
                letter = (letter == letter.toLocaleUpperCase()) ? letter.toLocaleLowerCase() : letter.toLocaleUpperCase();
                query[i] = '[' + letter + query[i].substring(0, 1) + ']' + query[i].substring(1);
            }
            search += (i == 0) ? query[i] : ' ' + query[i];
        }
        console.log(search);
        return search;
    },

    displayResults: function() {
        console.log('>>>>> Display <<<<<');
        zoom = (firstLoad) ? 17 : map.getZoom();
        firstLoad = false;

        $.mobile.loading('hide');
        $('#search-bar').show();
        $('.clear-button').show();
        (currentMarker != null) ? currentMarker.clearLayers() : currentMarker;
        currentMarker.setGeoJSON(app.getAddress()).addTo(map);
        map.setView([latitude, longitude], zoom);
        map.dragging.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.keyboard.enable();
        // map.zoomControl.addTo(map);

        $('#search').on('change', function(e) {
            console.log(e.target);
            setTimeout(function() {
                console.log('>>>>> Search value = ' + $('#search').val() + ' <<<<<');
                // app.setStatusText('Searching ...');
                var currentSearch = $('#search').val();
                if (currentSearch == '') {
                    console.log('>>>>> Empty search term <<<<<');
                    app.clearStatusText();
                } else {
                    console.log('>>>>> Search proceed <<<<<');
                    currentSearch = app.parseSearchText(currentSearch);
                    var geojson = app.getFeatures(currentSearch);
                    if (geojson) {
                        var results = geojson.features.length;
                        console.log(results);
                        if (results > 0) {
                            (featuresMarker != null) ? featuresMarker.clearLayers() : featuresMarker;
                            featuresMarker.setGeoJSON(geojson).addTo(map);
                            // map.setView([latitude, longitude], zoom);
                            app.setStatusText('Found ' + results + ' entries');
                            setTimeout(app.clearStatusText, 3000);
                        } else {
                            featuresMarker.clearLayers();
                            app.setStatusText('Cannot find any results');
                            setTimeout(app.clearStatusText, 3000);
                        }
                    }
                }
            }, 100);
        });
    },

    getPosError: function(error) {
        var end = Date.now();
        console.log('>>>>> ' + (end - start) + ' | Code: ' + error.code + ' - ' + error.message + ' <<<<<');
        $.mobile.loading('hide');
        latitude = 22.4;
        longitude = 114.2;
        app.displayResults();
        switch (error.code) {
            case 1:
            case 2:
            case 3:
                app.setStatusText('Code: ' + error.code + ' - ' + error.message);
                // alert((end - start) + ' | Code: ' + error.code + ' - ' + error.message);
                break;
            default:
                app.setStatusText('Unknown Error');
                // alert((end - start) + ' | Unknown Error');
                break;
        }
    },

    setStatusText: function(text) {
        $('#status').text(text).show();
    },

    clearStatusText: function() {
        $('#status').text('').hide();
    }
};

/*
The code below is a JavaScript port of the original Java code by Jan Philip Matuschek, which was originally published at:

http://janmatuschek.de/LatitudeLongitudeBoundingCoordinates
*/

// Contants for min/max lat/lng values
var MIN_LAT = -Math.PI / 2;
var MAX_LAT = Math.PI / 2;
var MIN_LON = -Math.PI;
var MAX_LON = Math.PI;

// Radius of the Earth
var EARTH_RADIUS = 6371.009;

// Converts from degrees to radians
Math.radians = function(degrees) {
  return degrees * Math.PI / 180;
};
 
// Converts from radians to degrees
Math.degrees = function(radians) {
  return radians * 180 / Math.PI;
};

// Calculate the distance between 2 known points. All in radians
function distanceTo(lat1, lat2, lon1, lon2, r) {
    return Math.acos(Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2)) * r;
}

// Calculate the bounding coordinates of some distance from a point. All in radians
function boundingCoords(lat, lon, d, r) {
    var radDist = d / r;

    var minLat = lat - radDist;
    var maxLat = lat + radDist;

    var minLon, maxLon;
    if ((minLat > MIN_LAT) && (maxLat < MAX_LAT)) {
        var deltaLon = Math.asin(Math.asin(radDist) / Math.cos(lat));

        minLon = lon - deltaLon;
        (minLon < MIN_LON) ? minLon += 2 * Math.PI : minLon;

        maxLon = lon + deltaLon;
        (maxLon > MAX_LON) ? maxLon -= 2 * Math.PI : maxLon;
    } else {
        minLat = Math.max(minLat, MIN_LAT);
        maxLat = Math.min(maxLat, MAX_LAT);
        minLon = MIN_LON;
        maxLon = MAX_LON;
    }

    return {
        'south': minLat,
        'west': minLon,
        'north': maxLat,
        'east': maxLon
    };
}