/*
  Parse WACK file and display on a map with other stuff
*/


const roadTypeArray = ["motorway","trunk","primary","secondary","tertiary","unclassified","residential","living_street","pedestrian"]

function parseWACK2GeoJson(arraybuffer) {
  const dv = new DataView(arraybuffer);

  // check that magic is equal to "wissotskysmapfmt" in ascii
  const magic = new TextDecoder().decode(new Uint8Array(arraybuffer.slice(0,16)));
  console.log("Magic: " + magic);

  const version = dv.getBigUint64(16,true);
  console.log("Version: " + version);
  if (version == 1) {
    return parseWACKversion1(dv);
  } else if (version == 2) {
    return parseWACKversion2(dv);
  }

}

function parseWACKversion1(dv) {
  const ref_lon = dv.getFloat64(24,true);
  const ref_lat = dv.getFloat64(32,true);
  const nodes_count = dv.getUint16(40,true);
  const roads_count = dv.getInt16(42,true);

  console.log("Reference Longitude: " + ref_lon);
  console.log("Reference Latitude: " + ref_lat);
  console.log("Nodes Count: " + nodes_count);
  console.log("Roads Count: " + roads_count);

  let road_lengths = [];
  for (let i = 44; i < 44 + roads_count; i += 1) {
      road_lengths.push(dv.getUint8(i,true));
  }
  console.log("Road Lengths: " + road_lengths);

  let road_types = [];
  for (let i = 44 + roads_count; i < 44 + (roads_count * 2); i += 1) {
      road_types.push(dv.getUint8(i,true));
  }
  console.log("Road Types: " + road_types);

  let nodes = [];
  let current_lon = ref_lon;
  let current_lat = ref_lat;
  for (let i = 44 + (roads_count * 2); i < 44 + (roads_count * 2) + (nodes_count * 4); i += 4) {
      current_lon = current_lon + dv.getInt16(i,true)/10000;
      current_lat = current_lat + dv.getInt16(i + 2,true)/10000;
      nodes.push([current_lon,current_lat]);
  }
  console.log("Nodes: " + nodes);
  console.log("Nodes Count: " + nodes.length);
  console.log(nodes[0]);

  let roads = []
  let roads_start = 44 + (roads_count * 2) + (nodes_count * 4);

  for (const length of road_lengths) {
      let road = [];
      for (let i = roads_start; i < roads_start + length*2; i += 2) {
          road.push(dv.getUint16(i,true));
      }
      roads.push(road);
      roads_start += length*2;
  }

  console.log("Roads: " + roads);
  console.log("Roads Count: " + roads.length);
  console.log(roads[0]);

  // decode to geojson
  let features = [];
  for (let i = 0; i < roads.length; i++) {
      let road = roads[i];
      let road_type = road_types[i];
      let road_coords = [];
      for (let j = 0; j < road.length; j++) {
          let node = nodes[road[j]-1]; // off by one error due to julia 1-indexing
          road_coords.push(node);
      }
      let feature = {
          "type": "Feature",
          "properties": {
              "type": road_type,
              "id": i,
              "kind": roadTypeArray[road_type]
          },
          "geometry": {
              "type": "LineString",
              "coordinates": road_coords
          }
      };
      features.push(feature);
  }

  let geojson_roads = {
      "type": "FeatureCollection",
      "features": features
  };

  return {geojson_roads}
}

function parseWACKversion2(dv) {
    let offset = 24;
    const ref_lon = dv.getFloat64(offset,true);
    offset += 8;
    const ref_lat = dv.getFloat64(offset,true);
    offset += 8;
    const nodes_count = dv.getUint32(offset,true);
    offset += 4;
    const roads_count = dv.getUint32(offset,true);
    offset += 4;

    console.log("Reference Longitude: " + ref_lon);
    console.log("Reference Latitude: " + ref_lat);
    console.log("Nodes Count: " + nodes_count);
    console.log("Roads Count: " + roads_count);

    let road_lengths = [];
    for (let i = offset; i < offset + (roads_count * 2); i += 2) {
        road_lengths.push(dv.getUint16(i,true));
    }
    console.log("Road Lengths: " + road_lengths);
    offset += roads_count * 2;

    let road_types = [];
    for (let i = offset; i < offset + roads_count; i += 1) {
        road_types.push(dv.getUint8(i,true));
    }
    console.log("Road Types: " + road_types);
    offset += roads_count;

    let distances = [];
    for (let i = offset; i < offset + (127 * 8); i += 8) {
        distances.push(dv.getFloat64(i,true));
    }
    console.log("Distances: " + distances);
    console.log("Distances Count: " + distances.length);
    offset += 127 * 8;

    let nodes = [];
    let current_lon = ref_lon;
    let current_lat = ref_lat;
    for (let i = offset; i < offset + (nodes_count * 2); i += 2) {
        let lon = dv.getInt8(i,true);
        let lat = dv.getInt8(i + 1,true);
        let lon_sign = Math.sign(lon);
        let lat_sign = Math.sign(lat);
        //console.log("Lon: " + lon_sign + " Lat: " + lat_sign);
        let lon_distance = distances[Math.abs(lon)-1];
        let lat_distance = distances[Math.abs(lat)-1];
        //console.log("Lon Distance: " + (lon_sign * lon_distance)+ " Lat Distance: " + (lat_sign * lat_distance));
        current_lon = current_lon + (lon_sign * lon_distance);
        current_lat = current_lat + (lat_sign * lat_distance);
        nodes.push([current_lon,current_lat]);
    }
    //console.log("Nodes: " + nodes);
    console.log("Nodes Count: " + nodes.length);
    console.log(nodes[0]);
    offset += nodes_count * 2;

    let roads = []
    let roads_start = offset;

    for (const length of road_lengths) {
        let road = [];
        for (let i = roads_start; i < roads_start + length*4; i += 4) {
            road.push(dv.getUint32(i,true));
        }
        roads.push(road);
        roads_start += length*4;
    }

    //console.log("Roads: " + roads);
    console.log("Roads Count: " + roads.length);
    console.log(roads[0]);

    // decode to geojson
    let features_roads = [];
    let features_buildings = [];
    for (let i = 0; i < roads.length; i++) {
        let road = roads[i];
        let road_type = road_types[i];
        let road_coords = [];
        for (let j = 0; j < road.length; j++) {
            let node = nodes[road[j]-1]; // off by one error due to julia 1-indexing
            road_coords.push(node);
        }
        if (road_type == 32) { // if the road is a building
          let feature = {
            "type": "Feature",
            "properties": {
                "type": road_type,
                "id": i,
                "dummy": 1
            },
            "geometry": {
                "type": "LineString",
                "coordinates": road_coords
            }
          };
          features_buildings.push(feature);
        } else {
          let feature = {
            "type": "Feature",
            "properties": {
                "type": road_type,
                "id": i,
                "kind": roadTypeArray[road_type]
            },
            "geometry": {
                "type": "LineString",
                "coordinates": road_coords
            }
          };
          features_roads.push(feature);
        }

        
    }
    let geojson_roads = {
        "features": features_roads,
        "type": "FeatureCollection"
        
    };
    let geojson_buildings = {
        "features": features_buildings,
        "type": "FeatureCollection"
        
    };

    return {geojson_roads,geojson_buildings}
}
//
//
//
//
//
function renderWackToMapObject(map,wackarraybuffer) {
  map.addSource('ocean',{
    'type': 'geojson',
    'data': 'map_data/ilnp-water.geojson'
  })
  map.addSource('land',{
    'type': 'geojson',
    'data': 'map_data/ilnp-landuse.geojson'
  })
  // parse wack file
  const geoJSONcontent = parseWACK2GeoJson(wackarraybuffer);
  //console.warn(geoJSONcontent)

  // Add as source to the map
  map.addSource('streets', {
      'type': 'geojson',
      'data': geoJSONcontent.geojson_roads
  });
  map.addSource('buildings', {
      'type': 'geojson',
      'data': geoJSONcontent.geojson_buildings
  });

  map.addSource('place_labels',{
    'type': 'geojson',
    'data': 'map_data/il-cities-2.geojson'
  })
  
  // add all the styles to the map so we see something
  for (const layer of StyleLayers.layers) {
   map.addLayer(layer);
  }
}

// map styling based on versatiles neutrino https://github.com/versatiles-org/versatiles-style
const StyleLayers = {
	"layers": [
		{
			"id": "background",
			"type": "background",
			"paint": {
				"background-color": "#f6f0f6"
			}
		},
		{
			
			"id": "water-ocean",
			"type": "fill",
			"source": "ocean",
			"paint": {
				"fill-color": "#cbd2df"
			}
		},
		{
			
			"id": "land-commercial",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "commercial", "retail" ] ],
			"paint": {
				"fill-color": "#f1e7f1",
				"fill-opacity": { "stops": [ [ 10, 0 ], [ 11, 1 ] ] }
			}
		},
		{
			
			"id": "land-industrial",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "industrial", "quarry", "railway" ] ],
			"paint": {
				"fill-color": "#f1e7f1",
				"fill-opacity": { "stops": [ [ 10, 0 ], [ 11, 1 ] ] }
			}
		},
		{
			
			"id": "land-residential",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "garages", "residential" ] ],
			"paint": {
				"fill-color": "#f1e7f1",
				"fill-opacity": { "stops": [ [ 10, 0 ], [ 11, 1 ] ] }
			}
		},
		{
			
			"id": "land-agriculture",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "brownfield", "farmland", "farmyard", "greenfield", "greenhouse_horticulture", "orchard", "plant_nursery", "vineyard" ] ],
			"paint": {
				"fill-color": "#f8eeee",
				"fill-opacity": { "stops": [ [ 10, 0 ], [ 11, 1 ] ] }
			}
		},
		{
			
			"id": "land-waste",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "landfill" ] ],
			"paint": {
				"fill-color": "#f6f0f6"
			}
		},
		{
			
			"id": "land-park",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "park", "village_green", "recreation_ground" ] ],
			"paint": {
				"fill-color": "#dbdfd8",
				"fill-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "land-garden",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "allotments", "garden" ] ],
			"paint": {
				"fill-color": "#dbdfd8",
				"fill-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "land-burial",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "cemetery", "grave_yard" ] ],
			"paint": {
				"fill-color": "#f6f0f6"
			}
		},
		{
			
			"id": "land-leisure",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "miniature_golf", "playground", "golf_course" ] ],
			"paint": {
				"fill-color": "#f6f0f6"
			}
		},
		{
			
			"id": "land-rock",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "bare_rock", "scree", "shingle" ] ],
			"paint": {
				"fill-color": "#f6f0f6"
			}
		},
		{
			
			"id": "land-forest",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "forest" ] ],
			"paint": {
				"fill-color": "#d9e3d9",
				"fill-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			}
		},
		{
			
			"id": "land-grass",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "grass", "grassland", "meadow", "wet_meadow" ] ],
			"paint": {
				"fill-color": "#e7e9e5",
				"fill-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "land-vegetation",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "heath", "scrub" ] ],
			"paint": {
				"fill-color": "#dbdfd8",
				"fill-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "land-sand",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "beach", "sand" ] ],
			"paint": {
				"fill-color": "#f6f0f6"
			}
		},
		{
			
			"id": "land-wetland",
			"type": "fill",
			"source": "land",
			"filter": [ "all", [ "in", "kind", "bog", "marsh", "string_bog", "swamp" ] ],
			"paint": {
				"fill-color": "#f6f0f6"
			}
		},
		{
			
			"id": "building",
			"type": "fill",
			"source": "buildings",
			"paint": {
				"fill-color": "#e0d1d9",
				"fill-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "tunnel-street-track:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 14, 2 ], [ 16, 4 ], [ 18, 18 ], [ 19, 48 ], [ 20, 96 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-pedestrian:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-service:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "tunnel", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 14, 2 ], [ 16, 4 ], [ 18, 18 ], [ 19, 48 ], [ 20, 96 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-livingstreet:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ]
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-residential:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-unclassified:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-tertiary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-secondary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "secondary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "tunnel-street-primary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "primary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "tunnel-street-trunk-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "trunk" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "tunnel-street-motorway-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "motorway" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 12
		},
		{
			
			"id": "tunnel-street-tertiary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-secondary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "secondary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 11, 2 ], [ 14, 5 ], [ 16, 8 ], [ 18, 30 ], [ 19, 68 ], [ 20, 138 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-primary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "primary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 7, 2 ], [ 10, 4 ], [ 14, 6 ], [ 16, 12 ], [ 18, 36 ], [ 19, 74 ], [ 20, 144 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-trunk:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "trunk" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 7, 2 ], [ 10, 4 ], [ 14, 6 ], [ 16, 12 ], [ 18, 36 ], [ 19, 74 ], [ 20, 144 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-motorway:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "motorway" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#dedede",
				"line-dasharray": [ 1, 2 ],
				"line-width": { "stops": [ [ 5, 2 ], [ 10, 5 ], [ 14, 5 ], [ 16, 14 ], [ 18, 38 ], [ 19, 84 ], [ 20, 168 ] ] },
				"line-opacity": { "stops": [ [ 5, 0 ], [ 6, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-track",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 14, 1 ], [ 16, 3 ], [ 18, 16 ], [ 19, 44 ], [ 20, 88 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-pedestrian",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-service",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "tunnel", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 14, 1 ], [ 16, 3 ], [ 18, 16 ], [ 19, 44 ], [ 20, 88 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-livingstreet",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-residential",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-unclassified",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-track-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "bicycle", "designated" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-pedestrian-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "bicycle", "designated" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-service-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "bicycle", "designated" ], [ "==", "tunnel", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-livingstreet-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "bicycle", "designated" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-residential-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "bicycle", "designated" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-unclassified-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "bicycle", "designated" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-tertiary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-secondary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "secondary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "tunnel-street-primary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "primary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "tunnel-street-trunk-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "trunk" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "tunnel-street-motorway-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "motorway" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 12
		},
		{
			
			"id": "tunnel-street-tertiary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-secondary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "secondary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 11, 1 ], [ 14, 4 ], [ 16, 6 ], [ 18, 28 ], [ 19, 64 ], [ 20, 130 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-primary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "primary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 7, 1 ], [ 10, 3 ], [ 14, 5 ], [ 16, 10 ], [ 18, 34 ], [ 19, 70 ], [ 20, 140 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-trunk",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "trunk" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 7, 1 ], [ 10, 3 ], [ 14, 5 ], [ 16, 10 ], [ 18, 34 ], [ 19, 70 ], [ 20, 140 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-street-motorway",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "tunnel", true ], [ "in", "kind", "motorway" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#f7f7f7",
				"line-width": { "stops": [ [ 5, 1 ], [ 10, 4 ], [ 14, 4 ], [ 16, 12 ], [ 18, 36 ], [ 19, 80 ], [ 20, 160 ] ] },
				"line-opacity": { "stops": [ [ 5, 0 ], [ 6, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "tunnel-transport-lightrail:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "light_rail" ], [ "!has", "service" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#e8d5e0",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 3 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 0.3 ] ] }
			}
		},
		{
			
			"id": "tunnel-transport-rail:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "rail" ], [ "!has", "service" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#e8d5e0",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 3 ] ] },
				"line-opacity": { "stops": [ [ 8, 0 ], [ 9, 0.3 ] ] }
			}
		},
		{
			
			"id": "tunnel-transport-lightrail",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "light_rail" ], [ "!has", "service" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f8f2f5",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 2 ] ] },
				"line-dasharray": [ 2, 2 ],
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 0.3 ] ] }
			}
		},
		{
			
			"id": "tunnel-transport-rail",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "rail" ], [ "!has", "service" ], [ "==", "tunnel", true ] ],
			"paint": {
				"line-color": "#f8f2f5",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 2 ] ] },
				"line-dasharray": [ 2, 2 ],
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 0.3 ] ] }
			}
		},
		{
			
			"id": "way-footway:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "footway" ] ],
			"paint": {
				"line-width": { "stops": [ [ 17, 0 ], [ 18, 3 ] ] },
				"line-opacity": { "stops": [ [ 17, 0 ], [ 18, 1 ] ] },
				"line-color": "#fadfff"
			},
			"minzoom": 17
		},
		{
			
			"id": "way-steps:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "steps" ] ],
			"paint": {
				"line-width": { "stops": [ [ 17, 0 ], [ 18, 3 ] ] },
				"line-opacity": { "stops": [ [ 17, 0 ], [ 18, 1 ] ] },
				"line-color": "#fadfff"
			},
			"minzoom": 17
		},
		{
			
			"id": "way-path:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "path" ] ],
			"paint": {
				"line-width": { "stops": [ [ 17, 0 ], [ 18, 3 ] ] },
				"line-opacity": { "stops": [ [ 17, 0 ], [ 18, 1 ] ] },
				"line-color": "#fadfff"
			},
			"minzoom": 17
		},
		{
			
			"id": "street-track:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 14, 2 ], [ 16, 4 ], [ 18, 18 ], [ 19, 48 ], [ 20, 96 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-pedestrian:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-service:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 14, 2 ], [ 16, 4 ], [ 18, 18 ], [ 19, 48 ], [ 20, 96 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-livingstreet:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e6e6e6"
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-residential:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-unclassified:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-tertiary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-secondary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "secondary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "street-primary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "primary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "street-trunk-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "trunk" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "street-motorway-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "motorway" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 12
		},
		{
			
			"id": "street-tertiary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-secondary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "secondary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 11, 2 ], [ 14, 5 ], [ 16, 8 ], [ 18, 30 ], [ 19, 68 ], [ 20, 138 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-primary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "primary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 7, 2 ], [ 10, 4 ], [ 14, 6 ], [ 16, 12 ], [ 18, 36 ], [ 19, 74 ], [ 20, 144 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-trunk:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "trunk" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 7, 2 ], [ 10, 4 ], [ 14, 6 ], [ 16, 12 ], [ 18, 36 ], [ 19, 74 ], [ 20, 144 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-motorway:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "motorway" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#e6e6e6",
				"line-width": { "stops": [ [ 5, 2 ], [ 10, 5 ], [ 14, 5 ], [ 16, 14 ], [ 18, 38 ], [ 19, 84 ], [ 20, 168 ] ] },
				"line-opacity": { "stops": [ [ 5, 0 ], [ 6, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "way-footway",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "footway" ] ],
			"paint": {
				"line-width": { "stops": [ [ 17, 0 ], [ 18, 2 ] ] },
				"line-opacity": { "stops": [ [ 17, 0 ], [ 18, 1 ] ] },
				"line-color": "#fef8ff"
			},
			"minzoom": 17
		},
		{
			
			"id": "way-steps",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "steps" ] ],
			"paint": {
				"line-width": { "stops": [ [ 17, 0 ], [ 18, 2 ] ] },
				"line-opacity": { "stops": [ [ 17, 0 ], [ 18, 1 ] ] },
				"line-color": "#fef8ff"
			},
			"minzoom": 17
		},
		{
			
			"id": "way-path",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "path" ] ],
			"paint": {
				"line-width": { "stops": [ [ 17, 0 ], [ 18, 2 ] ] },
				"line-opacity": { "stops": [ [ 17, 0 ], [ 18, 1 ] ] },
				"line-color": "#fef8ff"
			},
			"minzoom": 17
		},
		{
			
			"id": "street-track",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 14, 1 ], [ 16, 3 ], [ 18, 16 ], [ 19, 44 ], [ 20, 88 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-pedestrian",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#fef8ff",
				"line-width": { "stops": [ [ 12, 1 ], [ 13, 1 ], [ 14, 2 ], [ 15, 3 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-service",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 14, 1 ], [ 16, 3 ], [ 18, 16 ], [ 19, 44 ], [ 20, 88 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-livingstreet",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-residential",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-unclassified",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-track-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "bicycle", "designated" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-pedestrian-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "bicycle", "designated" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-service-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "bicycle", "designated" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-livingstreet-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "bicycle", "designated" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-residential-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "bicycle", "designated" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-unclassified-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "bicycle", "designated" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-tertiary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-secondary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "secondary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "street-primary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "primary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "street-trunk-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "trunk" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "street-motorway-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "motorway" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 12
		},
		{
			
			"id": "street-tertiary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "tertiary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-secondary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "secondary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 11, 1 ], [ 14, 4 ], [ 16, 6 ], [ 18, 28 ], [ 19, 64 ], [ 20, 130 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-primary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "primary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 7, 1 ], [ 10, 3 ], [ 14, 5 ], [ 16, 10 ], [ 18, 34 ], [ 19, 70 ], [ 20, 140 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-trunk",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "trunk" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 7, 1 ], [ 10, 3 ], [ 14, 5 ], [ 16, 10 ], [ 18, 34 ], [ 19, 70 ], [ 20, 140 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "street-motorway",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "!=", "bridge", true ], [ "!=", "tunnel", true ], [ "in", "kind", "motorway" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 5, 1 ], [ 10, 4 ], [ 14, 4 ], [ 16, 12 ], [ 18, 36 ], [ 19, 80 ], [ 20, 160 ] ] },
				"line-opacity": { "stops": [ [ 5, 0 ], [ 6, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "transport-lightrail:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "light_rail" ], [ "!has", "service" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e8d5e0",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 3 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "transport-rail:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "rail" ], [ "!has", "service" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#e8d5e0",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 3 ] ] },
				"line-opacity": { "stops": [ [ 8, 0 ], [ 9, 1 ] ] }
			}
		},
		{
			
			"id": "transport-lightrail",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "light_rail" ], [ "!has", "service" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#f8f2f5",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 2 ] ] },
				"line-dasharray": [ 2, 2 ],
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "transport-rail",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "rail" ], [ "!has", "service" ], [ "!=", "bridge", true ], [ "!=", "tunnel", true ] ],
			"paint": {
				"line-color": "#f8f2f5",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 2 ] ] },
				"line-dasharray": [ 2, 2 ],
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-track:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 14, 2 ], [ 16, 4 ], [ 18, 18 ], [ 19, 48 ], [ 20, 96 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-pedestrian:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-service:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "bridge", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 14, 2 ], [ 16, 4 ], [ 18, 18 ], [ 19, 48 ], [ 20, 96 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-livingstreet:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#d9d9d9"
			}
		},
		{
			
			"id": "bridge-street-residential:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-unclassified:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-tertiary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "tertiary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-secondary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "secondary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"minzoom": 13
		},
		{
			
			"id": "bridge-street-primary-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "primary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"minzoom": 13
		},
		{
			
			"id": "bridge-street-trunk-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "trunk" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"minzoom": 13
		},
		{
			
			"id": "bridge-street-motorway-link:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "motorway" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 7 ], [ 18, 14 ], [ 20, 40 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"minzoom": 12
		},
		{
			
			"id": "bridge-street-tertiary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "tertiary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 12, 2 ], [ 14, 3 ], [ 16, 6 ], [ 18, 26 ], [ 19, 64 ], [ 20, 128 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-secondary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "secondary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 11, 2 ], [ 14, 5 ], [ 16, 8 ], [ 18, 30 ], [ 19, 68 ], [ 20, 138 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-primary:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "primary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 7, 2 ], [ 10, 4 ], [ 14, 6 ], [ 16, 12 ], [ 18, 36 ], [ 19, 74 ], [ 20, 144 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-trunk:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "trunk" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 7, 2 ], [ 10, 4 ], [ 14, 6 ], [ 16, 12 ], [ 18, 36 ], [ 19, 74 ], [ 20, 144 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-motorway:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "motorway" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#d9d9d9",
				"line-width": { "stops": [ [ 5, 2 ], [ 10, 5 ], [ 14, 5 ], [ 16, 14 ], [ 18, 38 ], [ 19, 84 ], [ 20, 168 ] ] },
				"line-opacity": { "stops": [ [ 5, 0 ], [ 6, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-street-track",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 14, 1 ], [ 16, 3 ], [ 18, 16 ], [ 19, 44 ], [ 20, 88 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-pedestrian",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-service",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "bridge", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 14, 1 ], [ 16, 3 ], [ 18, 16 ], [ 19, 44 ], [ 20, 88 ] ] },
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-livingstreet",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-residential",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-unclassified",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-track-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "track" ], [ "==", "bicycle", "designated" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-pedestrian-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "pedestrian" ], [ "==", "bicycle", "designated" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-service-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "service" ], [ "==", "bicycle", "designated" ], [ "==", "bridge", true ], [ "!=", "service", "driveway" ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-livingstreet-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "living_street" ], [ "==", "bicycle", "designated" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-residential-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "residential" ], [ "==", "bicycle", "designated" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-unclassified-bicycle",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "kind", "unclassified" ], [ "==", "bicycle", "designated" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": 1
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-tertiary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "tertiary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-secondary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "secondary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "bridge-street-primary-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "primary" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "bridge-street-trunk-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "trunk" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 13, 0 ], [ 14, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 13
		},
		{
			
			"id": "bridge-street-motorway-link",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "motorway" ], [ "==", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 12 ], [ 20, 38 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			},
			"minzoom": 12
		},
		{
			
			"id": "bridge-street-tertiary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "tertiary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 12, 1 ], [ 14, 2 ], [ 16, 5 ], [ 18, 24 ], [ 19, 60 ], [ 20, 120 ] ] },
				"line-opacity": { "stops": [ [ 12, 0 ], [ 13, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-secondary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "secondary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 11, 1 ], [ 14, 4 ], [ 16, 6 ], [ 18, 28 ], [ 19, 64 ], [ 20, 130 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-primary",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "primary" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 7, 1 ], [ 10, 3 ], [ 14, 5 ], [ 16, 10 ], [ 18, 34 ], [ 19, 70 ], [ 20, 140 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-trunk",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "trunk" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 7, 1 ], [ 10, 3 ], [ 14, 5 ], [ 16, 10 ], [ 18, 34 ], [ 19, 70 ], [ 20, 140 ] ] },
				"line-opacity": { "stops": [ [ 7, 0 ], [ 8, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-street-motorway",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "==", "bridge", true ], [ "in", "kind", "motorway" ], [ "!=", "link", true ] ],
			"paint": {
				"line-color": "#ffffff",
				"line-width": { "stops": [ [ 5, 1 ], [ 10, 4 ], [ 14, 4 ], [ 16, 12 ], [ 18, 36 ], [ 19, 80 ], [ 20, 160 ] ] },
				"line-opacity": { "stops": [ [ 5, 0 ], [ 6, 1 ] ] }
			},
			"layout": {
				"line-join": "round",
				"line-cap": "round"
			}
		},
		{
			
			"id": "bridge-transport-lightrail:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "light_rail" ], [ "!has", "service" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#e8d5e0",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 3 ] ] },
				"line-opacity": { "stops": [ [ 11, 0 ], [ 12, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-transport-rail:outline",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "rail" ], [ "!has", "service" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#e8d5e0",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 3 ] ] },
				"line-opacity": { "stops": [ [ 8, 0 ], [ 9, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-transport-lightrail",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "light_rail" ], [ "!has", "service" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#f8f2f5",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 2 ] ] },
				"line-dasharray": [ 2, 2 ],
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "bridge-transport-rail",
			"type": "line",
			"source": "streets",
			"filter": [ "all", [ "in", "kind", "rail" ], [ "!has", "service" ], [ "==", "bridge", true ] ],
			"paint": {
				"line-color": "#f8f2f5",
				"line-width": { "stops": [ [ 8, 1 ], [ 12, 1 ], [ 15, 2 ] ] },
				"line-dasharray": [ 2, 2 ],
				"line-opacity": { "stops": [ [ 14, 0 ], [ 15, 1 ] ] }
			}
		},
		{
			
			"id": "label-place-neighbourhood",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "neighbourhood" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 14, 12 ] ] },
				"text-transform": "uppercase"
			},
			"paint": {
				"icon-color": "#cea0c7",
				"text-color": "#cea0c7",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 14
		},
		{
			
			"id": "label-place-quarter",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "quarter" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 13, 13 ] ] },
				"text-transform": "uppercase"
			},
			"paint": {
				"icon-color": "#cea0bf",
				"text-color": "#cea0bf",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 13
		},
		{
			
			"id": "label-place-suburb",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "suburb" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 11, 11 ], [ 13, 14 ] ] },
				"text-transform": "uppercase"
			},
			"paint": {
				"icon-color": "#cea0b7",
				"text-color": "#cea0b7",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 11
		},
		{
			
			"id": "label-place-hamlet",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "hamlet" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 10, 11 ], [ 12, 14 ] ] }
			},
			"paint": {
				"icon-color": "#cea0ac",
				"text-color": "#cea0ac",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 10
		},
		{
			
			"id": "label-place-village",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "village" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 9, 11 ], [ 12, 14 ] ] }
			},
			"paint": {
				"icon-color": "#cea0ac",
				"text-color": "#cea0ac",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 9
		},
		{
			
			"id": "label-place-town",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "town" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 8, 11 ], [ 12, 14 ] ] }
			},
			"paint": {
				"icon-color": "#cea0ac",
				"text-color": "#cea0ac",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 8
		},
		{
			
			"id": "label-place-city",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "city" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 7, 11 ], [ 10, 14 ] ] }
			},
			"paint": {
				"icon-color": "#cea0ac",
				"text-color": "#cea0ac",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 7
		},
		{
			
			"id": "label-place-statecapital",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "state_capital" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 6, 11 ], [ 10, 15 ] ] }
			},
			"paint": {
				"icon-color": "#cea0ac",
				"text-color": "#cea0ac",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 6
		},
		{
			
			"id": "label-place-capital",
			"type": "symbol",
			"source": "place_labels",
			"filter": [ "==", "kind", "capital" ],
			"layout": {
				"text-field": "{name}",
				"text-font": [ "noto_sans_regular" ],
				"text-size": { "stops": [ [ 5, 12 ], [ 10, 16 ] ] }
			},
			"paint": {
				"icon-color": "#cea0ac",
				"text-color": "#cea0ac",
				"text-halo-color": "#ffffff",
				"text-halo-width": 0.1,
				"text-halo-blur": 1
			},
			"minzoom": 5
		}
	]
}

