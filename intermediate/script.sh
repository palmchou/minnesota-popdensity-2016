#!/usr/bin/env bash

source clean.sh

echo "shp2json"
echo "shp2json cb_2016_27_tract_500k.shp -o mn.json"
shp2json ../cb_2016_27_tract_500k.shp -o mn.json

echo "geoproject"
#geoproject 'd3.geoConicConformal().parallels([47 + 2 / 60, 48 + 38 / 60]).rotate([93 + 6 / 60, 0]).fitSize([960, 960], d)' < mn.json > mn-north.json
geoproject 'd3.geoConicConformal().parallels([45 + 37 / 60, 47 + 3 / 60]).rotate([94 + 15 / 60, 0]).fitSize([960, 960], d)' < mn.json > mn-central.json
#geoproject 'd3.geoConicConformal().parallels([43 + 47 / 60, 45 + 13 / 60]).rotate([94, 0]).fitSize([960, 960], d)' < mn.json > mn-south.json

echo "geo2svg"
#geo2svg -w 960 -h 960 < mn-north.json > mn-north.svg
geo2svg -w 960 -h 960 < mn-central.json > mn-central.svg
#geo2svg -w 960 -h 960 < mn-south.json > mn-south.svg

echo "split into ndjson"
ndjson-split 'd.features' < mn-central.json > mn-central.ndjson

echo "set feature's id"
ndjson-map 'd.id = d.properties.GEOID.slice(2), d' < mn-central.ndjson  > mn-central-id.ndjson

echo "download census data"
curl 'https://api.census.gov/data/2016/acs/acs5/?get=B01003_001E&for=tract:*&in=state:27' \
  -o cb_2016_27_tract_B01003.json

echo "convert census json data to ndjson objects"
ndjson-cat cb_2016_27_tract_B01003.json | ndjson-split 'd.slice(1)' | ndjson-map '{id: d[2] + d[3], B01003: +d[0]}' \
  > cb_2016_27_tract_B01003.ndjson

echo "join the population data to the geometry"
ndjson-join 'd.id' mn-central-id.ndjson cb_2016_27_tract_B01003.ndjson \
  > mn-central-join.ndjson

echo "compute the population density"
ndjson-map 'd[0].properties = {density: Math.floor(d[1].B01003 / d[0].properties.ALAND * 2589975.2356)}, d[0]' \
  < mn-central-join.ndjson > mn-central-density.ndjson

echo "convert back to GeoJSON"
ndjson-reduce 'p.features.push(d), p' '{type: "FeatureCollection", features: []}' \
  < mn-central-density.ndjson > mn-central-density.json

echo "generate SVG choropleth"
ndjson-map -r d3 \
  '(d.properties.fill = d3.scaleSequential(d3.interpolateViridis).domain([0, 4000])(d.properties.density), d)' \
  < mn-central-density.ndjson \
  > mn-central-color.ndjson
geo2svg -n --stroke none -p 1 -w 960 -h 960 \
  < mn-central-color.ndjson \
  > mn-central-color.svg

echo "convert GeoJSON to TopoJSON"
geo2topo -n tracts=mn-central-density.ndjson > mn-tracts-topo.json

echo "toposimplify"
toposimplify -p 1 -f < mn-tracts-topo.json > mn-simple-topo.json

echo "topoquantize and delta-encode"
topoquantize 1e5 < mn-simple-topo.json > mn-quantized-topo.json

echo "derive county geometry"
topomerge -k 'd.id.slice(0, 3)' counties=tracts < mn-quantized-topo.json > mn-merge-topo.json

echo "create state_border feature"
topomerge --mesh -f 'a === b' state_border=counties \
  < mn-merge-topo.json \
  > mn-state-topo.json

echo "filter county boundary feature"
topomerge --mesh -f 'a !== b' counties=counties \
  < mn-state-topo.json \
  > mn-topo.json

echo "generate the final visualization svg"
(topo2geo tracts=- \
    < mn-topo.json \
    | ndjson-map -r d3 -r d3=d3-scale-chromatic 'z = d3.scaleThreshold().domain([1, 10, 50, 200, 500, 1000, 2000, 4000]).range(d3.schemeOrRd[9]), d.features.forEach(f => f.properties.fill = z(f.properties.density)), d' \
    | ndjson-split 'd.features'; \
topo2geo counties=- \
    < mn-topo.json \
    | ndjson-map 'd.properties = {"stroke": "#000", "stroke-opacity": 0.3}, d')\
  | geo2svg -n --stroke none -p 1 -w 960 -h 960 \
  > mn.svg