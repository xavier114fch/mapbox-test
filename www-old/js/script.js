// Add a watch ID for geolocation function
var watchId = null;

window.onload = init();

function init() {
	// Add device ready listener
	document.addEventListener('deviceready', onDeviceReady, false);
}

function onDeviceReady() {
    watchId = navigator.geolocation.watchPosition(getPosSuccess, getPosError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 3000 });

    $('#toggleGPS').change(function() {
        console.log('>>>>> GPS Watch: ' + $(this).val() + ' <<<<<');
        if (watchId != null) {
            console.log('>>>>> Disable GPS watching <<<<<');
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        } else {
            console.log('>>>>> Enable GPS watching <<<<<');
            watchId = navigator.geolocation.watchPosition(getPosSuccess, getPosError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 3000 });
        }
    })
}

function getPosSuccess(position) {
    // Get the lat/lon position
    var lat = position.coords.latitude;
    var lon = position.coords.longitude;
    var reverseGeocoder = 'http://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=' + lat + '&lon=' + lon;
    var geojson = [];
    var distance = $('#toggleDistance').val();
    console.log('>>>>> Distance: ' + distance + ' <<<<<');

    $.getJSON(reverseGeocoder, function(result) {
        console.log(">>>>> Reverse Geocoding <<<<<");
        geojson.push({
            'type': 'Feature',
             'geometry': {
                'type': 'Point',
                'coordinates': [lon, lat]
            },
            'properties': {
                'title': 'Your current location',
                'description': result.display_name,
                'marker-color': '#fc4353',
                'marker-size': 'large',
                'marker-symbol': 'star'
            }
        });

        var bounding = boundingCoords(Math.radians(lat), Math.radians(lon), distance, EARTH_RADIUS);
        var south = Math.degrees(bounding.south);
        var west = Math.degrees(bounding.west);
        var north = Math.degrees(bounding.north);
        var east = Math.degrees(bounding.east);

        var overpass = 'http://overpass.osm.rambler.ru/cgi/interpreter?data=[out:json];node["tourism"="hotel"](' + south + ',' + west +',' + north + ','+ east + ');out body;';
        console.log('>>>>> Overpass URL: ' + overpass + ' <<<<<');

        $.getJSON(overpass, function(result) {
            console.log('>>>>> Number of results = ' + result.elements.length + ' <<<<<');
            var elements = result.elements;
            for (var i in elements) {
                geojson.push({
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Point',
                        'coordinates': [elements[i].lon, elements[i].lat]
                    },
                    'properties': {
                        'title': elements[i].tags.name,
                        'marker-color': '#0000ff',
                        'marker-size': 'medium',
                        'marker-symbol': 'lodging'
                    }
                });
            }

            // console.log(JSON.stringify(geojson, null, '\t'));
            (markerLayer != null) ? markerLayer.clearLayers() : markerLayer;
            markerLayer.setGeoJSON(geojson).addTo(map);
            map.setView([lat, lon], 17);
        });
    });
}

function getPosError(error) {
    console.log('Code: ' + error.code + '. Message: ' + error.message + '\n');
    if (error.code != 3)
        alert('Code: ' + error.code + '. Message: ' + error.message + '\n');
}

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