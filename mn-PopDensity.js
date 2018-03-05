//Define Margin
var margin = {left: 0, right: 0, top: 0, bottom: 20},
    width = 960 - margin.left - margin.right,
    height = 980 - margin.top - margin.bottom;

//Define SVG
var svg = d3.select("#visualization")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var ca_color = d3.scaleThreshold().domain([1, 10, 50, 200, 500, 1000, 2000, 4000]).range(d3.schemeOrRd[9]);
var mn_color = d3.scaleThreshold().domain([1, 5, 40, 160, 400, 800, 2000, 6000]).range(d3.schemeGnBu[9]);

var path = d3.geoPath();

function draw_color_legend(color, upper_bound, name) {
    var x = d3.scaleSqrt()
        .domain([0, upper_bound])
        .rangeRound([550, 950]);

    var g = svg.append("g")
        .attr("class", "legend legend-" + name)
        .attr("transform", "translate(0,40)");

    g.selectAll("rect")
        .data(color.range().map(function(d) {
            d = color.invertExtent(d);
            if (d[0] == null) d[0] = x.domain()[0];
            if (d[1] == null) d[1] = x.domain()[1];
            return d;
        }))
        .enter().append("rect")
        .attr("height", 8)
        .attr("x", function(d) { return x(d[0]); })
        .attr("width", function(d) { return x(d[1]) - x(d[0]); })
        .attr("fill", function(d) { return color(d[0]); });

    g.append("text")
        .attr("class", "caption")
        .attr("x", x.range()[0])
        .attr("y", -6)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("Population per square mile");

    g.call(d3.axisBottom(x)
        .tickSize(13)
        .tickValues(color.domain()))
        .select(".domain")
        .remove();

    g.style('opacity', 0);

    return g;
}

var ca_legend = draw_color_legend(ca_color, 4500, 'ca');
var mn_legend = draw_color_legend(mn_color, 6500, 'mn');

function fill_tract_color(color_scale) {
    svg.selectAll("g.tracts path")
        .style("fill", function(d) { return color_scale(d.properties.density) });
}

ca_legend.style('opacity', 1);
var cur_legend = 'ca';

function change_legend_color() {
    if (cur_legend === 'ca') {
        cur_legend = 'mn';
        fill_tract_color(mn_color);
        ca_legend.style('opacity', 0);
        mn_legend.style('opacity', 1);
    } else {
        cur_legend = 'ca';
        fill_tract_color(ca_color);
        ca_legend.style('opacity', 1);
        mn_legend.style('opacity', 0);
    }
}

var g_buttons = svg.append("g")
    .attr("class", "buttons-g")
    .attr("transform", "translate(550, 70)");

function create_butoon(name, text, width, tx, ty, callback) {
    var btn = g_buttons.append("g")
        .attr("class", "button button-" + name)
        .attr("transform", "translate(" + tx + "," + ty + ")");

    btn.append("rect")
        .attr("height", 28)
        .attr("width", width)
        .attr('rx', 5)
        .attr('ry', 5)
        .attr("fill", '#f2f2f2')
        .attr("stroke", '#000');

    btn.append("text")
        .style("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", 20)
        .attr("font-size", "16px")
        .text(text);

    btn.on("click", callback);
    btn.on("mouseover", function () {
        btn.select("rect")
            .attr("fill", "#cfcfcf")
    });
    btn.on("mouseout", function () {
        btn.select("rect")
            .attr("fill", "#f2f2f2")
    });
}
var state_b_on = false;
var tract_b_on = false;
create_butoon('change_color', 'Change Legend Color', 180, 0, 0, change_legend_color);
create_butoon('change_color', 'Toggle State Boundary', 180, 0, 34, function () {
    if (state_b_on) {
        svg.select("g.state-border")
            .attr("class", "state-border boundary-off")
    } else {
        svg.select("g.state-border")
            .attr("class", "state-border boundary-on")
    }
    state_b_on = !state_b_on;
});
create_butoon('change_color', 'Toggle Census Tract Boundary', 220, 188, 34, function () {
    if (tract_b_on) {
        svg.select("g.tracts")
            .attr("class", "tracts boundary-off")
    } else {
        svg.select("g.tracts")
            .attr("class", "tracts boundary-on")
    }
    tract_b_on = !tract_b_on;
});

d3.json('mn-topo.json', function (error, mn) {
    if (error) return console.error(error);

    // draw tracts
    svg.append("g")
        .attr("class", "tracts boundary-off")
        .selectAll("path")
        .data(topojson.feature(mn, mn.objects.tracts).features)
        .enter().append("path")
        .attr("d", path);

    fill_tract_color(ca_color);

    // draw county boundary
    svg.append("g")
        .attr("class", "counties boundary-on")
        .selectAll("path")
        .data(topojson.feature(mn, mn.objects.counties).features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", "none");

    // draw state boundary
    svg.append("g")
        .attr("class", "state-border boundary-off")
        .selectAll("path")
        .data(topojson.feature(mn, mn.objects.state_border).features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", "none");
});
