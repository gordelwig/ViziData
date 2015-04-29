/////////////////////////
/// general map logic ///
/////////////////////////
/**
** grid generation and 
** drawing functions 
*/

/**
* timeout wrapper*/
function genGrid(reso, mAE, data) {
	if(chart === undefined) { return 0; } // depend on timeline
	clearTimeout(redrawTimer);
	redrawTimer = setTimeout(function() {
		generateGrid(reso, mAE, data);
	}, 200);
}

/**
* Generate data grid for the map
* parameters optional */
function generateGrid(reso, mAE, data) {

	if(!allow_redraw) { return false; }
	if(data === undefined) { data = current_setsel; } // todo dynamic from filter?
	if( mAE === undefined) {  mAE = getBounds(true); }
	if(reso === undefined) { reso = calcReso(); }


	/// main function body
	var worker = function() { //timeout for dom redraw
		
		console.log("/~~ generating new grid with resolution "+reso+" ~~\\");
		var bms = new Date();
		var progBM = '';
		console.log("  ~ start iterating data");

		var count = 0;
		cellmap = {}; // reset cellmap

		/// calculate everything we can outside the loop for performance
		setColorScale(reso);

		// get axisExtremes
		var cAE = getTimeSelection();

		/*// boundary enforcement
		if(mAE[0].min < C_WMIN) { mAE[0].min = C_WMIN; }
		if(mAE[0].max > C_WMAX) { mAE[0].max = C_WMAX; }
		if(mAE[1].min < C_HMIN) { mAE[1].min = C_HMIN; }
		if(mAE[1].max > C_HMAX) { mAE[1].max = C_HMAX; }*/

		// min and max tile
		var mmt = getMinMaxTile(mAE);
		var tMin = mmt.min,
			tMax = mmt.max;
		console.log("  # will iterate over tiles "+tMin+" to "+tMax);
		

		/// finish
		var finish = function() {
			console.log("  |BM| progressive drawing(ms): " + progBM);
			console.log("  |BM| iteration complete ("+(new Date()-bms)+"ms)");
			drawPlot(true, cellmap, reso);
			console.log("  |BM| finished genGrid (total of "+(new Date()-bms)+"ms)");

			filledTiles = [tMin+1,tMax-1];

			$("#legend").html("<em>inside the visible area</em><br>"+
				//"<span>["+mAE[0].min.toFixed(1)+","+mAE[1].min.toFixed(1)+"]-["+mAE[0].max.toFixed(1)+","+mAE[1].max.toFixed(1)+"]</span><br>"+
				"we have registered a total of<br>"+
				"<em>"+count+" "+data.parent.label+"</em><br>"+
				"that <em>"+data.strings.term+"</em><br>"+
				"between <em>"+cAE.min+"</em> and <em>"+cAE.max+"</em>");

			selectCell();
			//urlifyState(); // is always called in selectCell

			console.log("\\~~ grid generation complete~~/ ");
			mutexGenGrid = 0;
		};

		/// iterate & aggregate over a single tile
		var iterate = function(offset) {
			if(mutexGenGrid === -1) {	// cancel loop
				mutexGenGrid = 0;		// if new function call
				return 0;				// has been made
			}
			var cellmapprog = {}, l, a, ti, i;
			if(!renderRTL) { i = tMin + offset; }
					  else { i = tMax - offset; }
			if(i <= tMax && i >= tMin) {	// still work to do			// for each map tile in visible area
				for(var j = cAE.min; j <= cAE.max; j++) { 					// go over each key in range
					if(data.data[i][j] !== undefined) {							// if it is defined
						l = data.data[i][j].length;
						for(var k = 0; k < l; k++) {								// go over each event in key and
							a = data.data[i][j][k];
							if(section_filter(a,mAE)) {									// if it actually lies within map bounds
								ti = coord2index(a[ARR_M_LON],a[ARR_M_LAT],reso);
								if(cellmap[ti] === undefined) {	cellmap[ti] = []; }			// aggregate it on the grid
								cellmap[ti].push([a[ARR_M_I],j]);
								cellmapprog[ti] = cellmap[ti];
								count++;
							}
						}
					}
				}
				// draw each tile after aggregating (if not already drawn)
				if(i < filledTiles[0] || i > filledTiles[1]) {
					progBM += drawPlot(i, cellmapprog, reso) +',';
				}
				setTimeout(function() {
					iterate(++offset);
				},1);
			} else { // iterated over all tiles
				finish();
			}
		};
		iterate(0);
	};

	// set it all in motion - if no other generation is running
	if(mutexGenGrid === 1) { mutexGenGrid = -1;	}
	var goOn = function() {
		if(mutexGenGrid !== 0) { setTimeout(goOn,10); }
		else {
			mutexGenGrid = 1;
			$("#legend").html("<em>massive calculations...</em>");
			setTimeout(worker,1);
	}	};
	goOn();
}



///////////////
/// filters ///
///////////////

// true if object geo lies within currently visible section
function section_filter(obj,aE){
		return (
			(obj[ARR_M_LAT] >= (aE[1].min)) &&
			(obj[ARR_M_LAT] <= (aE[1].max))	
			
		) && (
			(obj[ARR_M_LON] >= (aE[0].min)) && 
			(obj[ARR_M_LON] <= (aE[0].max))	
		);
}


//////////////////
/// aggregators //
/*/////////////////
function testing_aggregator(tmap,obj,reso) {
	var ti = coord2index(obj[ARR_M_LON],obj[ARR_M_LAT],reso);
	if(tmap[ti] === undefined) {
		tmap[ti] = [];
		tmap[ti].push(obj[2]);
	} else {
		tmap[ti].push(obj[2]);
	}
	return tmap;
}
*/

/**
* draw the map layer
* [@param clear] clear before drawing, true: everything, false: nothing, i: tile i
* [@param newmap] new cell mapping to derive drawing data from
* [@param reso] required if newmap is given - resolution of new gridmap */
function drawPlot(clear, newmap, reso) {
	if(clear === undefined) { clear = true; }

	if(newmap !== undefined && reso === undefined) { 
		conslole.warn('drawPlot(): newmap given but no resolution. Using old drawing data.');
	} 

	mapctx.save();
	if(clear === true) {
		mapctx.clearRect(0,0,canvasW,canvasH);
	}

	var uMBM = new Date();

	if(newmap !== undefined && reso !== undefined) { // calculate new drawing map
		var draw = [],
			min = Infinity,
			max = -Infinity;
		
		$.each(newmap, function(k,v) {
			var c = index2canvasCoord(k, reso);
			v = v.length;

			draw.push([[c[0],c[1]],v]);

			// get extreme values
			if(v<min) { min = v; }
			if(v>max) { max = v; }
		});
		drawdat = {draw: draw, min: min, max: max, reso: reso};
	}
	if(typeof clear !== "number" && newmap !== undefined) {
		console.log("  ~ drawing "+drawdat.draw.length+" shapes");
		console.log("  # data extreme values - min: "+drawdat.min+", max: "+drawdat.max);
		console.log("  |BM| (dataset generation in "+(new Date()-uMBM)+"ms)");
	}

	// color defs
	/*// TODO color calculation is buggy
		// (using hsl model might be good idea)
	var rmax, gmax, bmax, rlog_factorm, glog_factor, blog_factor;
	if(colorize) {
		rmax = current_setsel.colorScale.min[0];
		rlog_factor = (rmax-current_setsel.colorScale.max[0])/Math.log(drawdat.max);
		gmax = current_setsel.colorScale.min[1];
		glog_factor = (gmax-current_setsel.colorScale.max[1])/Math.log(drawdat.max);
		bmax = current_setsel.colorScale.min[2];
		blog_factor = (bmax-current_setsel.colorScale.max[2])/Math.log(drawdat.max);
	} else {
		bmax = 255; //215;
		blog_factor = bmax/drawdat.max;//Math.log(drawdat.max);
		gmax = 235; //205;
		glog_factor = gmax/Math.log(drawdat.max);
		rmax = 185;//14;
		rlog_factor = rmax/Math.log(drawdat.max);
	}*/
	

	var canvasRenderBM = new Date();

	// sizes and radii of primitiva
	var bleed = 1;// + 1/lastTransformState.scale*0.25; // 1.25; // larger size for bleeding with alpha channel
	var wx = ((drawdat.reso*canvasW)/360) * bleed,
		wy = ((drawdat.reso*canvasH)/180) * bleed, 
		//rx = ((drawdat.reso*canvasW)/360/2) * bleed,
		//ry = ((drawdat.reso*canvasH)/180/2) * bleed;
		rx = wx/2,
		ry = wy/2;

	drawdat.wx = wx;
	drawdat.wy = wy;
	drawdat.rx = rx;
	drawdat.ry = ry;

	var i= -1, n = drawdat.draw.length, d, cx, cy, fc, gradient; // TODO keep only what is used

  	mapctx.translate(lastTransformState.translate[0],lastTransformState.translate[1]);
  	mapctx.scale(lastTransformState.scale, lastTransformState.scale);

  	if(typeof clear === "number") {
  		clearTile(clear);
  	}

	while(++i < n) {
		d = drawdat.draw[i];
		cx = d[0][0];
		cy = d[0][1];
		mapctx.fillStyle = 
		//fc = 
		/*"rgb("+
			Math.floor(rmax -Math.floor(Math.log(d[1])*rlog_factor))+","+
			Math.floor(gmax -Math.floor(Math.log(d[1])*glog_factor))+","+
			Math.floor(bmax -Math.floor(d[1]*blog_factor))+")";//,"+
			//".85)";//((d[1]/drawdat.max)/4+0.6)+")";*/
		colorScale(d[1]);

		/*gradient = ctx.createRadialGradient(cx,cy,rx,cx,cy,0);
		gradient.addColorStop(0,fc+"0)");
		gradient.addColorStop(0.6, fc+"0.4)");
		gradient.addColorStop(0.7, fc+"1)");
		gradient.addColorStop(1,fc+"1)");*/
		//ctx.fillStyle = gradient;

		//ctx.fillRect(cx-rx,cy-rx,wx,wy);
		mapctx.fillRect(cx,cy-wy,wx,wy);/*
		ctx.beginPath();
		//ctx.moveTo(cx,cy);
		//ctx.arc(cx, cy, rx, 0, 2 * Math.PI);
		ctx.ellipse(cx, cy, rx, ry, 0, 0, 2*Math.PI);
		//ctx.stroke();
		ctx.fill();
		//*/
	}
	/*if(highlight !== undefined) {
		if(reso === undefined) { reso = drawdat.reso; }
		var c = index2canvasCoord(highlight, reso);

		/*ctx.fillStyle = "rgba(150,250,150,0.3)";
		ctx.beginPath();
		ctx.arc(c[0]+rx,c[1]-ry,rx*2,0,TPI);
		ctx.fill();* /

		mapctx.lineWidth = 2/lastTransformState.scale;
		mapctx.strokeStyle = "rgba(255,127,0,0.75)"; //orange";
		mapctx.strokeRect(c[0],c[1]-wy,wx,wy);
	}*/

	if(typeof clear !== "number") {
		console.log("  |BM| canvas rendering of "+drawdat.draw.length+" shapes took "+(new Date()-canvasRenderBM)+"ms");
	}
	mapctx.restore();
	// todo - return benchmark
	return (new Date()-canvasRenderBM);
}


function highlightCell(c) {

	var x,y,p,
		linewidth = 2;

	var wx = drawdat.wx,
		wy = drawdat.wy,
		rx = drawdat.rx,
		ry = drawdat.ry;


	overctx.save();
	overctx.clearRect(0,0,canvasW,canvasH);

	overctx.translate(lastTransformState.translate[0],lastTransformState.translate[1]);
  	overctx.scale(lastTransformState.scale, lastTransformState.scale);

	
	if(selectedCell !== false) {
  		p = index2canvasCoord(selectedCell);
  		x = p[0];
  		y = p[1];

  		overctx.fillStyle = "rgba(255,120,0,0.8)";
		overctx.fillRect(x,y-wy,wx,wy);

		overctx.strokeStyle = "rgba(255,255,255,0.4)";
		overctx.lineWidth = 3/lastTransformState.scale * linewidth;
		overctx.beginPath();
		overctx.ellipse(x+rx,y-ry,rx*1.5,ry*1.5,0,0,TPI);
		overctx.stroke();
		overctx.strokeStyle = "rgba(0,0,0,0.5)";
		overctx.lineWidth = 1/lastTransformState.scale * linewidth;
		overctx.beginPath();
		overctx.ellipse(x+rx,y-ry,rx*1.5,ry*1.5,0,0,TPI);
		overctx.stroke();
  	}

  	/*if(c.constructor === Array) {
		x = c[0];
		y = c[1];
	} else if (typeof c === "number") {*/
	if(c === false) { 
		overctx.restore();
		return false; 
	}
	
	p = index2canvasCoord(c);
	x = p[0];
	y = p[1];

/*	} else {
		console.warn("highlightCell: invalid first argument");
		return false;
	}*/


  	// highlight cell rect
  	overctx.fillStyle = "rgba(255,130,0,0.7)";
	overctx.fillRect(x,y-wy,wx,wy);

	// glow circle
	var gradient = overctx.createRadialGradient(x+rx,y-ry,0, x+rx, y-ry, rx*4);
	gradient.addColorStop(0,"rgba(255,255,255,0.6");
	gradient.addColorStop(0.25, "rgba(255,255,255,0.5");
	gradient.addColorStop(1,"rgba(255,255,255,0.1");
	overctx.fillStyle = gradient;
	overctx.beginPath();
	overctx.ellipse(x+rx,y-ry,rx*4,ry*4,0,0,TPI);
	overctx.fill();

	// text bubble?..
	/*overctx.fillStyle = "rgba(0,0,0,.9)";
	overctx.font = "sans-serif 12pt";
	overctx.fillText("blabla", x, y);*/
	
	overctx.restore();
}