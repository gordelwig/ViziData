////////////////
/// timeline ///
////////////////
function genChart(data){
	if(data === undefined) { data = current_setsel; } // TODO

	console.log("/~~ generating chart data ~~\\ ");

	var benchmark_chart = new Date();

	////
	/// tomporary hacky timeline fix for changed data structure
	// TODO refurbish when upgrading timeline
	// still TODO? check if it can improved
	var x = [], y = [], ticks = [];
	var dat_obj = {},
		i,j,d;
	
	var tilecount = (C_WMAX - C_WMIN) / data.parent.tile_width;
	for(i = 0; i < tilecount; i++) {
		for(j=data.min; j<=data.max; j++) {
			d = data.data[i][j];
			if(d !== undefined) {
				if(dat_obj[j] === undefined) {
					dat_obj[j] = d.length;
				} else {
					dat_obj[j] += d.length;
				}
			}
		}
	}

	for(i=data.min; i<=data.max; i++) {
		if(dat_obj[i] !== undefined) {
			x.push(i);
			y.push(dat_obj[i]);
		}
	}
	

	//chartdat.push([x,y]);
	chartdat[0] = [x,y];

	console.log("  |BM| iterating and sorting finished (took "+(new Date()-benchmark_chart)+"ms)");

	initChart();

	console.log("  |BM| chart creation complete (total of "+(new Date()-benchmark_chart)+"ms");
	console.log("\\~~ finished generating chart ~~/ ");
}




function initChart() {
	if(chartdat.length <= 0) { return false; }
	if(chart !== undefined) {
		chart.destroy();
	}

	var connectionH = 10; // height of connection component
		//summargin = 10; // extend value range of the summary component

	var container = $("#chart");
	var containerW = container.width(),
		detailH = Math.floor(container.height() * (2/3)) - connectionH,
		summaryH = Math.floor(container.height() * (1/3)); // - connectionH;

	//var initSelection = {	// default initial selection
	if(timeSel === undefined) {
		timeSel = {
	      	data : {		// TODO this could go into dataset config options
	        	x : {
	          		min : 1500,
	          		max : 2014
    	}  	}, fmin: 0, fmax: 0   };
	}

    var selCallback = function() { // callback function for selection change
    	var range = getTimeSelection();
    	timeSel.data.x = {
    		min: range.min,
    		max: range.max
    	};
    	$("#range-tt-min>div").text(range.min);
    	$("#range-tt-max>div").text(range.max);
		genGrid();
	};

    var detail, detailOptions,
        summaryOptions, // summary, (global)
        connection, connectionOptions;


    // Configuration for detail (top view):
    detailOptions = {
        name : 'detail',
        data : chartdat,
        height : detailH,
        width: containerW,
        title: "Timeline",
        // Flotr Configuration
        config : {
	        'bars' : {
	    	    lineWidth : 1,
	          	show : true,
	          	fill : true,
	          	fillOpacity : 0.6
	        },
	        mouse : {
				track: true,
				trackY: false,
				trackAll: true,
				sensibility: 1,
				trackDecimals: 4,
				position: 'nw',
				lineColor: '#ff9900',
				fillColor: '#ff9900',
				fillOpacity: 0.6,
				trackFormatter : function (o) {
			    	return "<em>" + current_setsel.strings.label + "</em> in " + parseInt(o.x) + ": <em>"+ parseInt(o.y) + "</em>";
			    }
	        },
	        yaxis : { 
	          	autoscale : true,
	          	autoscaleMargin : 0.05,
	          	noTicks : 4,
	          	showLabels : true,
	          	min : 0
	        }
		}
    };

    // Configuration for summary (bottom view):
    summaryOptions = {
      	name : 'summary',
        data : chartdat,
        height : summaryH,
        width: containerW,
        // Flotr Configuration
        config : {
	        'lines' : {
				show : true,
				lineWidth : 1,
				fill : true,
				fillOpacity : 0.2,
				fillBorder : true
	        },
	        xaxis : {
	          	noTicks: 5,
	          	showLabels : true,
	        	//min: current_setsel.min - summargin, // messy hack for issue #11
	        	//max: current_setsel.max + summargin  // causes trouble
	        },
	        yaxis : {
	          	autoscale : true,
	          	autoscaleMargin : 0.1
	        },
	        handles : {
	          	show : true
	        },
	        selection : {
	          	mode : 'x'
	        },/*
	        grid : {
	          	verticalLines : false
	        },
	        mouse: {
	        	margin: 100
	        }*/


      	}
    };

    connectionOptions = {
	    name : 'connection',
	    adapterConstructor : envision.components.QuadraticDrawing,
	    height: connectionH,
	    width: containerW
    };

    // Building the vis:
    chart = new envision.Visualization();
    detail = new envision.Component(detailOptions);
    summary = new envision.Component(summaryOptions);
    connection = new envision.Component(connectionOptions);
    interaction = new envision.Interaction();

    // Render Visualization
    chart
      	.add(detail)
      	.add(connection)
      	.add(summary)
      	.render(container.get(0));
	
	// Wireup Interaction
	interaction
        .leader(summary)
        .follower(detail)
        .follower(connection)
        .add(envision.actions.selection, {callback: selCallback});

   	appendTimelineRangeTips();
    // set to initial selection state
  	summary.trigger('select', timeSel);

}

/**
* sets or changes the time selection */
function changeTimeSel(min,max,relative) {
	if(relative === undefined) { relative = true; }

	var sel = chart.components[2].api.flotr.selection;
	if(relative) {

		timeSel.fmin += min - Math.floor(min);
		timeSel.fmax += max - Math.floor(max);

		min = Math.floor(min + timeSel.data.x.min + Math.floor(timeSel.fmin));
		max = Math.floor(max + timeSel.data.x.max + Math.floor(timeSel.fmax));

		timeSel.fmin -= Math.floor(timeSel.fmin);
		timeSel.fmax -= Math.floor(timeSel.fmax);
	}

	if(min >= max) { return false; }
	if(max > current_setsel.max) { return false; }
	if(min < current_setsel.min) { return false; }

	timeSel.data.x = {
		min: min,
		max: max
	};

	if(min !== current_setsel.min || max !== current_setsel.max) {
		sel.selecting = true;
	}
	sel.setSelection({x1: min, x2: max});

}


/**
* returns sanitized selection of the timeline */
function getTimeSelection() {
	var cAE, min = current_setsel.min, max = current_setsel.max,
		sel = chart.components[2].api.flotr.selection;

	if(sel.selecting !== false) {
		cAE = sel.getArea();
		cAE.min = Math.round(cAE.x1);
		cAE.max = Math.round(cAE.x2);
	} else {
		cAE = {
			min: min,
			max: max
		};
	}

	// TODO simplify
	return {
		min: (cAE.min >= min ? cAE.min : min),
		max: (cAE.max <= max ? cAE.max : max)
	};
}

function appendTimelineRangeTips() {
	var cont = $(
		'<div id="range-tt-min" class="range-tt hover-tt">' +
			'<span class="arrow arrow-left"></span>' + 
			'<div></div>' +
			'<span class="arrow arrow-right"></span>' +
		'</div>' +
		'<div id="range-tt-max" class="range-tt hover-tt">' +
			'<span class="arrow arrow-left"></span>' + 
			'<div></div>' +
			'<span class="arrow arrow-right"></span>' +
		'</div>'); //.hide();
	$("#chart").append(cont);

	// $("#chart .detail").on("mouseenter", function() {
	// 	$(".range-tt").addClass("hintin");
	// }).on("mouseleave", function() {
	// 	$(".range-tt").removeClass("hintin");
	// });


	// change interval limits with arrows
	var repeatTimeout, repeatInterval;
	$(".range-tt .arrow").on("mousedown", function() {

		//allow_redraw = false;
		var min = ($(this).parent().attr("id") === "range-tt-min" ?
			($(this).hasClass("arrow-left") ? -1 : +1 ) :
			0);
		var max = ($(this).parent().attr("id") === "range-tt-max" ?
			($(this).hasClass("arrow-left") ? -1 : +1 ) :
			0);
		changeTimeSel(min,max);

		repeatTimeout = setTimeout(function() {
			repeatInterval = setInterval(function() {
				changeTimeSel(min,max);
			}, 100);
		}, 100);
	}).on("mouseup", function() {
		clearTimeout(repeatTimeout);
		clearInterval(repeatInterval);
		//$("#freezer>input").trigger("change");
	});


	// drag behavior on detail view
	var stepSize;
	var drag = d3.behavior.drag()
        .on("drag", function(u,i) {
            changeTimeSel(-d3.event.dx*stepSize, -d3.event.dx*stepSize);
        }).on("dragstart", function() {
        	stepSize = (timeSel.data.x.max - timeSel.data.x.min) / $("#chart").width();
        }).on("dragend", function() {
        	//$("#freezer>input").trigger("change");
        });
    d3.selectAll("#chart .detail").call(drag);
}


/**
* updates/builds the chart
* (addSeries is bugged so build the chart from the ground)*/
function updateChart(seriez) {
	

	/*if(chart !== undefined) { chart.destroy(); }

	chart = new Highcharts.StockChart({
		chart: {
			type: 'spline',
			renderTo: 'chart'
		},
		title: {
			text: null
		},
		credits: {
			enabled: false
		},
		rangeSelector: {
			enabled: true,
			buttons: [{
				type: "year",
				count: 10,
				text: "10y"
			},{
				type: "year",
				count: 100,
				text: "100y"
			},{
				type: "year",
				count: 1000,
				text: "1000y"
			},{
				type: "all",
				text: "all"
			}],
			buttonTheme: {
				width: 80
			}
		},
		legend: {
			enabled: false
		},
		yAxis: {
			floor: 0,
			type: "logarithmic"
		},
		xAxis: {
			type: "linear",
			events: {
				setExtremes: function() {
					clearTimeout(redrawTimer);
					redrawTimer = setTimeout(genGrid, 200); // (!)genGrid adds another timeout
				}
			}
		},
		navigator: {
			margin: 5,
			enabled: true,
			xAxis: {
				type: "linear"
			}
		},
		plotOptions: {
			series: {
				dataGrouping: {
					enabled: true
				}
			}
		},//*//*
		tooltip: {
			xDateFormat: "%Y"
		},
		series: seriez
	});*/

}

/////////////////////////////
/// Highcharts Extensions ///
/////////////////////////////
/*
Highcharts.wrap(Highcharts.Chart.prototype, 'pan', function (proceed) {

  proceed.apply(this, Array.prototype.slice.call(arguments, 1));
  genGrid();

});*/