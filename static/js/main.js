
var socket = io.connect('http://localhost:8080');

var chart_ids = []; // Lookup array of HTMl element ids for each currency pair/keyword chart 
var chart_data = []; // Lookup array for current data for each currency pair/keyword chart

socket.on('status', function (data) {
  /*
  Check if we have a new trained model.
  If so:
  a) remove loading animation from chart window
  b) make a copy of the last candle as the next candle to appear as a starting point
  c) Build the chart
  */ 
  
  if (data.trained == true) {
    candles = data.candles;
    $("#" + chart_ids[data.pair]).parent().addClass('loaded');
    chart_data[data.pair] = candles;
    last_candle = candles[candles.length - 1];
    last_candle.time = last_candle.time + 60;
    chart_data[data.pair].push(last_candle);
    var width = $('#' + chart_ids[data.pair]).width();
    var height = $('#' + chart_ids[data.pair]).height();
    var params = data.pair.split('|');
    buildChart(chart_ids[data.pair], width, height, candles, params[0], params[1]);
  }
});
socket.on('candles', function (data) {
  /*
  We have a new candle.
  Remove the oldest candle from the data set for this currencypair/keyword chart
  Remove the candle we were animating.
  Add the confirmed candle twice (one historical, one to animate)
  Rebuild chart
  */ 
  console.log(data);
  chart_data[data.pair].splice(0, 1);
  chart_data[data.pair].pop();
  chart_data[data.pair].push(data.candles);
  last_candle = data.candles;
  last_candle.time = last_candle.time + 60;
  chart_data[data.pair].push(last_candle);
  var width = $('#' + chart_ids[data.pair]).width();
  var height = $('#' + chart_ids[data.pair]).height();
  var params = data.pair.split('|');
  buildChart(chart_ids[data.pair], width, height, chart_data[data.pair], params[0], params[1]);
});
socket.on('next_prediction', function (data) {
   /*
  We have a new prediction.
  Build potential future candle based on previous candle and incoming prediction data
  Rebuild chart
  */ 
  chart_data[data.pair][chart_data[data.pair].length - 1].candle.closeAsk = chart_data[data.pair][chart_data[data.pair].length - 1].candle.openAsk + data.prediction / 10000;
  $('#view_' + chart_ids[data.pair]).html("<strong>" + data.pair + "</strong><br/>Next Change Weighting: " + Math.round(data.prediction * 1000) / 1000);
  var width = $('#' + chart_ids[data.pair]).width();
  var height = $('#' + chart_ids[data.pair]).height();
  var params = data.pair.split('|');
  buildChart(chart_ids[data.pair], width, height, chart_data[data.pair], params[0], params[1]);
});

function setupChart() {

  // Form Validation
  $('.error').removeClass('error');
  var currency = $('#currencypair').val();
  var keyword = $('#keyword').val();
  if (currency == 0) {
    $('#currencypair').parent().addClass('error');
    return false;
  }
  if (keyword == '') {
    $('#keyword').parent().addClass('error');
    return false;
  }
  /*
  if form is valid, create a new div for the chart,
  give it a unique id, save the id to the lookup table
  and display a loading animation inside
  */
  var newChart = $('<div class="chart" id=""></div>');
  $(newChart).uniqueId();
  var newChartHolder = $('<div class="col-xs-6 chartHolder loading"></div>');
  $(newChartHolder).append($(newChart));
  chart_ids[currency + "|" + keyword] = $(newChart).attr('id');
  valueViewer = $('<div id="view_' + chart_ids[currency + "|" + keyword] + '"></div>');
  loader = $("<div class='loader'><svg width='120px' height='120px' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid' class='uil-default'><rect x='0' y='0' width='100' height='100' fill='none' class='bk'></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(0 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(30 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.08333333333333333s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(60 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.16666666666666666s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(90 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.25s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(120 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.3333333333333333s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(150 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.4166666666666667s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(180 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.5s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(210 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.5833333333333334s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(240 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.6666666666666666s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(270 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.75s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(300 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.8333333333333334s' repeatCount='indefinite'/></rect><rect  x='46.5' y='40' width='7' height='20' rx='5' ry='5' fill='#00b2ff' transform='rotate(330 50 50) translate(0 -30)'>  <animate attributeName='opacity' from='1' to='0' dur='1s' begin='0.9166666666666666s' repeatCount='indefinite'/></rect></svg></div>");
  $(newChartHolder).append($(loader));
  $('#charts').append($(newChartHolder));
  $('#realTime').append($(valueViewer));

  //  Make a request to the server to train a model for this currency pair / keyword combo

  $.get("/train/" + currency + "/" + keyword, function (data) {
  });
}

function min(a, b) { return a < b ? a : b; }

function max(a, b) { return a > b ? a : b; }

function buildChart(chartid, width, height, data, currency, keyword) {

  var margin = 50;

  var end = new Date(data[data.length - 1].time * 1000);
  var start = new Date(data[0].time * 1000);
  
  d3.select("#" + chartid).select('svg').remove();
  //Responsive drawing of D3 chart
  var chart = d3.select("#" + chartid).append("svg:svg").attr("width", width).attr("height", height);

  //Mapping d3 data
  var y = d3.scale.linear().domain([d3.min(data.map(function (x) { return x.candle.lowAsk; })), d3.max(data.map(function (x) { return x.candle.highAsk; }))]).range([height - margin, margin]);
  var x = d3.scale.linear().domain([d3.min(data.map(function (d) { return d.time; })), d3.max(data.map(function (d) { return d.time; }))]).range([margin, width - margin]);

  //Draw grid
  chart.selectAll("line.x")
    .data(x.ticks(10))
    .enter().append("svg:line")
    .attr("class", "x")
    .attr("x1", x)
    .attr("x2", x)
    .attr("y1", margin)
    .attr("y2", height - margin)
    .attr("stroke", "#ccc");
  chart.selectAll("line.y")
    .data(y.ticks(10))
    .enter().append("svg:line")
    .attr("class", "y")
    .attr("x1", margin)
    .attr("x2", width - margin)
    .attr("y1", y)
    .attr("y2", y)
    .attr("stroke", "#ccc");

  //Draw x and y legends
  chart.selectAll("text.xrule")
    .data(x.ticks(6))
    .enter().append("svg:text")
    .attr("class", "xrule")
    .attr("x", x)
    .attr("y", height - margin)
    .attr("dy", 20)
    .attr("text-anchor", "middle")
    .text(function (d) {
      var date = new Date(d * 1000);
      return (addZero(date.getMonth() + 1)) + "/" + addZero(date.getDate()) + " " + addZero(date.getHours()) + ":" + addZero(date.getMinutes());

    });
  chart.selectAll("text.yrule")
    .data(y.ticks(10))
    .enter().append("svg:text")
    .attr("class", "yrule")
    .attr("x", width - margin)
    .attr("y", y)
    .attr("dy", 0)
    .attr("dx", 20)
    .attr("text-anchor", "middle")
    .text(String);

    //Draw Candle
  chart.selectAll("rect")
    .data(data)
    .enter().append("svg:rect")
    .attr("x", function (d) { return x(d.time); })
    .attr("y", function (d) { return y(max(d.candle.openAsk, d.candle.closeAsk)); })
    .attr("height", function (d) { return y(min(d.candle.openAsk, d.candle.closeAsk)) - y(max(d.candle.openAsk, d.candle.closeAsk)); })
    .attr("width", function (d) { return 0.5 * (width - 2 * margin) / data.length; })
    .attr("fill", function (d) { return d.candle.openAsk > d.candle.closeAsk ? "red" : "green"; });

    //Draw wick
  chart.selectAll("line.stem")
    .data(data)
    .enter().append("svg:line")
    .attr("class", "stem")
    .attr("x1", function (d) { return x(d.time) + 0.25 * (width - 2 * margin) / data.length; })
    .attr("x2", function (d) { return x(d.time) + 0.25 * (width - 2 * margin) / data.length; })
    .attr("y1", function (d) { return y(d.candle.highAsk); })
    .attr("y2", function (d) { return y(d.candle.lowAsk); })
    .attr("stroke", function (d) { return d.candle.openAsk > d.candle.closeAsk ? "red" : "green"; })

  //Draw chart title
  chart.append("svg:text")
    .attr("x", (width / 2))
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("text-decoration", "underline")
    .text(currency + " / \"" + keyword + "\"");
}

function addZero(i) {
  //Helper function to pad zeroes to time display
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}