/*
Client-side JavaScript for the cLeafletMappingControl component.

Copyright:  Mike Peat, Unicorn InterGlobal, 2021/09/29
License: MIT License http://www.opensource.org/licenses/mit-license.php
*/

if (!dfcc) {       // if there is *not* already an dfcc (object!)...
    var dfcc = {}; // create it now to act as a module to hold our stuff
}

// We are going to use this array (a property of our namespace) to hold
// references to objects of this class.  If it doesn't already exist,
// create it now.
if (!dfcc.hideObjs) {
    dfcc.hideObjs = [];
}

dfcc.leafletMappingControl = function leafletMappingControl(sName, oParent) {
    // Forward send constructor
    dfcc.leafletMappingControl.base.constructor.call(this, sName, oParent);

    // Properties:
    this.prop(df.tInt,    "piMinHeight",            0);
    this.prop(df.tNumber, "pnNorth",                0);
    this.prop(df.tNumber, "pnEast",                 0);
    this.prop(df.tInt,    "piInitialZoom",          0);
    this.prop(df.tInt,    "piMaxZoom",              0);
    this.prop(df.tString, "psTileLayer",            "");
    this.prop(df.tString, "psTileSize",             "");
    this.prop(df.tString, "psAccessToken",          "");
    this.prop(df.tString, "psLayerID",              "");
    this.prop(df.tString, "psAttribution",          "");
    this.prop(df.tBool,   "pbAttribution",          true);
    this.prop(df.tBool,   "pbZoomControl",          true);
    this.prop(df.tString, "psMarkers",              "");
    this.prop(df.tString, "psPolygons",             "");
    this.prop(df.tString, "psPolylines",            "");
    this.prop(df.tString, "psCircles",              "");
    this.prop(df.tString, "psCurrentMapInfo",       "");
    this.prop(df.tBool,   "pbServerOnClick",        false);
    this.prop(df.tBool,   "pbServerOnDblClick",     false);
    this.prop(df.tString, "piMapResolution",        0);
    this.prop(df.tBool,   "pbShowScale",            true);  // default to true
    this.prop(df.tBool,   "pbShowPrint",            true);  // default to true
    this.prop(df.tBool,   "pbServerOnMapClick",     false);
    this.prop(df.tBool,   "pbServerOnMapDblClick",  false);

    this.addSync("psCurrentMapInfo");
    
    // Private:
    this._eWrap         = null;
    this._eMap          = null;
    this._eLayer        = null;
    this._eMarkers      = [];
    this._ePolygons     = [];
    this._ePolylines    = [];
    this._eCircles      = [];

    // Properties involved in hiding/unhiding maps:
    this._hiddenBy      = null;
    this._prevVis       = null;

    //  Configure super classes
    this._sControlClass = "leafletMappingControl";
};

df.defineClass("dfcc.leafletMappingControl", "df.WebBaseControl", {

    openHtml : function(aHtml) {

        // Forward send
        dfcc.leafletMappingControl.base.openHtml.call(this, aHtml);
        
        aHtml.push('<div class="leafletMappingControl-wrp">');     
        aHtml.push('    <div id="', this._sControlId, '"', ' style="height: 100%;"></div>');
        aHtml.push('</div>');
    },
    
    afterRender : function() {
        this._eControl = df.dom.query(this._eElem, "div.leafletMappingControl-wrp > div");
        this._eWrap = df.dom.query(this._eElem, "div.leafletMappingControl-wrp");
        
        // Add the object to the list of things which need to be hidden if popped-up over:
        dfcc.hideObjs.push(this);
    
        // Forward send
        dfcc.leafletMappingControl.base.afterRender.call(this);
    },

    adjustResolution : function(layer) {
        var size = this.psTileSize, bDouble;

        if (size !== "") {

            if (size === "1024") {
                size = "512";
                bDouble = true;
            }

            layer = layer.replace("tiles", "tiles/" + size);

            if (bDouble) {
                layer = layer.replace("{y}", "{y}@2x");
            }

        }

        return layer;
    },
    
    drawMap : function() {
        var sID = this._sControlId, that = this;
        
        // Remove any existing map first:
        this.undrawMap();
        
        // Create new map
        this._eMap = L.map(sID).setView([Number(this.pnNorth), Number(this.pnEast)], this.piInitialZoom);
        
        var layer = this.adjustResolution(this.psTileLayer);

        this._eLayer = L.tileLayer(layer, {
           attribution: this.psAttribution,
           maxZoom: this.piMaxZoom,
           id: this.psLayerID,
           accessToken: this.psAccessToken,
           attributionControl: this.pbAttribution,
           zoomControl: this.pbZoomControl,
           fadeAnimation: false
        }).addTo(this._eMap);
        
        if (this.pbShowScale) {
            L.control.scale({
                maxWidth : 250
            }).addTo(this._eMap);
        }
        
        if (this.pbShowPrint) {
            L.control.browserPrint({
                text       : "Print Map",
                position   : "topright",
                printModes : ["Portrait"]
            }).addTo(this._eMap);
        }
        
        this._eMap.on("click", function(evt) {
                that.sendClick(evt);
        });
        
        this._eMap.on("dblclick", function(evt) {
            that.sendDblClick(evt);
        });
        
    },
    
    undrawMap : function() {
        var i;
    
        if (this._eMap) {
        
            for (i = 0; i < this._ePolygons.length; i++) {
                if (this._ePolygons[i]) {
                    this._ePolygons[i].remove();
                    this._ePolygons[i] = null;
                }
            }
            this._ePolygons = [];  // clear the array
            
            for (i = 0; i < this._eMarkers.length; i++) {
                if (this._eMarkers[i]) {
                    this._eMarkers[i].remove();
                    this._eMarkers[i] = null;
                }
            }
            this._eMarkers = [];  // clear the array
            
            for (i = 0; i < this._ePolylines.length; i++) {
                if (this._ePolylines[i]) {
                    this._ePolylines[i].remove();
                    this._ePolylines[i] = null;
                }
            }
            this._ePolylines = [];  // clear the array
            
            for (i = 0; i < this._eCircles.length; i++) {
                if (this._eCircles[i]) {
                    this._eCircles[i].remove();
                    this._eCircles[i] = null;
                }
            }
            this._eCircles = [];  // clear the array
            
            if (this._eLayer) {
                this._eLayer.remove();
                this._eLayer = null;
            }
            
            this._eMap.remove();
            this._eMap = null;            
        }
        
    },

    fitBounds : function(minN, minE, maxN, maxE) {
        if (this._eMap) {
            this._eMap.fitBounds([[minN, minE],[maxN, maxE]]);
        }
    },
    
    // changeLayer
    // ===========
    // This function changes the background map layer, for instance from a map
    // view to a satellite view.
    //
    // We use it here to toggle between two layer IDs:
    //    "mapLayerId" : "mapbox/outdoors-v11",
    //    "satLayerId" : "mapbox/satellite-streets-v11"
    //
    // mapbox/outdoors-v11 seems to offer more detail than mapbox/streets-v11
    // which is the obvious alternative.
    //
    // mapbox/satellite-streets-v11 gives us street names, etc. on the sat
    // view where mapbox/satellite-v9 does not.
    //
    // The list of available MapBox styles is at:
    // https://docs.mapbox.com/api/maps/styles
    //
    changeLayer : function(layerID) {
        
        if (this._eMap && this._eLayer) {            
            this._eLayer.remove();
            this._eLayer = null;            
            
            this.psLayerID = layerID;

            var layer = this.adjustResolution(this.psTileLayer);
            
            this._eLayer = L.tileLayer(layer, {
               attribution: this.psAttribution,
               maxZoom: this.piMaxZoom,
               id: this.psLayerID,
               accessToken: this.psAccessToken,
               attributionControl: this.pbAttribution,
               zoomControl: this.pbZoomControl,
               fadeAnimation: false
            }).addTo(this._eMap);

        }

    },
    
    // changeResolution
    // ================
    // This function changes the tile layer (and for our purposes, the
    // resolution of those tiles).  See:
    //     https://docs.mapbox.com/api/maps/#retrieve-raster-tiles-from-styles
    //
    // 256x256 pixel tiles (tiles/256/1/1/0?) are the lowest supported and offer
    // the most readable text; 512x512 pixel tiles (tiles/1/1/0?) are harder to
    // read; 1024x1024 tiles (tiles/512/1/1/0@2x?) are the same for reading, 
    // but require to make four times as many requests to the service, so are
    // slower to load.
    //
    // The only advantage of Medium resolution (512x512) I can actualy see is 
    // that in satellite view it is sometimes more seamless then Low resolution
    // (256x256), but then you need teeny-weeny eyes to read the streetnames and
    // such.  I can see no advantage of High resolution (1024x1025).
    //
    changeResolution : function() {
        var layer = this.adjustResolution(this.psTileLayer);

        if (this._eMap && this._eLayer) {
            this._eLayer.remove();
            this._eLayer = null;
            
            this._eLayer = L.tileLayer(layer, {
               attribution: this.psAttribution,
               maxZoom: this.piMaxZoom,
               id: this.psLayerID,
               accessToken: this.psAccessToken,
               attributionControl: this.pbAttribution,
               zoomControl: this.pbZoomControl,
               fadeAnimation: false
            }).addTo(this._eMap);
        
        }
        
    },
    
    // sendClick and sendDblclick
    // ==========================
    // These two functions will, if the appropriate pbServerOn{eventName}
    // property is set in the dataflex object, fire the appropriate server-side
    // procedures: MapClick and MapDblClick.
    //
    // The double-click is a bit problematic as it seems to also trigger a map
    // zoom in addition to this, which I have not found a way to cancel.
    //
    sendClick : function(evt) {
        if (this.pbServerOnMapClick) {
            this.serverAction("OnMapClick", [evt.latlng.lat, evt.latlng.lng]);
        }
    },
    
    sendDblClick : function(evt) {
        if (this.pbServerOnMapDblClick) {
            this.serverAction("OnMapDblClick", [evt.latlng.lat, evt.latlng.lng]);
        }
    },
    
    // draw{shape} and undraw{shape}
    // =============================
    // There are (ATM) four shapes: polygon, polyline, marker and circle.
    //
    // I have preferred circles to markers, as markers seem to be a bit vague
    // about exactly where they are on the map - circles (actually circleMarkers)
    // seem better at staying where you put them.  The downside is that markers
    // support custom icons, which would be nice.  Swings and Roundabouts. :-(
    //
    // The mechanism from the DataFlex side is to deal with an array of the 
    // appropriate structs (stPolygon[], etc.), then when we need to pass that
    // to the JavaScript, that is first turned into a JSON object, which is then
    // serialised (Stringify) into a JSON string and the appropriate WebProperty
    // (psPolygons, psMarkers, etc.) set to that.  On the JavaScript side that
    // property is then parsed (JSON.parse) to create the JavaScript object we
    // can work with.
    //
    // The rationale for using arrays of these is that there may be a need to
    // support multiple shapes of the same type on any given map.

    drawPolygon : function(iIdx) {
        var polygons = JSON.parse(this.psPolygons);
        
        if (this._eMap && polygons.atPolygons[iIdx]) {
    
            this._ePolygons[iIdx] = L.polygon(polygons.atPolygons[iIdx].aPoints, {
                color       : polygons.atPolygons[iIdx].sLineColor, 
                weight      : polygons.atPolygons[iIdx].iLineWeight,
                opacity     : polygons.atPolygons[iIdx].nLineOpacity,
                fillColor   : polygons.atPolygons[iIdx].sFillColor,
                fillOpacity : polygons.atPolygons[iIdx].nFillOpacity,
                stroke      : polygons.atPolygons[iIdx].bStroke}
            ).addTo(this._eMap);        
           
            if (polygons.atPolygons[iIdx].bFitMap) {
                this._eMap.fitBounds(this._ePolygons[iIdx].getBounds());
            }
            
            if (polygons.atPolygons[iIdx].sText) {
                this._ePolygons[iIdx].bindTooltip(polygons.atPolygons[iIdx].sText);
            }
            
        }

    },
    
    undrawPolygon : function(iIdx) {
    
        if (this._ePolygons[iIdx]) {
            this._ePolygons[iIdx].remove();
            this._ePolygons.splice(iIdx, 1);
        }
    
    },
        

    drawPolyline : function(iIdx) {
        var polylines = JSON.parse(this.psPolylines);

        if (this._eMap && polylines.atPolylines[iIdx]) {
            this._ePolylines[iIdx] = L.polyline(polylines.atPolylines[iIdx].aPoints, {
                color   : polylines.atPolylines[iIdx].sLineColor,
                weight  : polylines.atPolylines[iIdx].iLineWeight,
                opacity : polylines.atPolylines[iIdx].nOpacity,
                stroke  : polylines.atPolylines[iIdx].bStroke
            }).addTo(this._eMap);
        
            if (polylines.atPolylines[iIdx].bFitMap) {
                this._eMap.fitBounds(this._ePolylines[iIdx].getBounds());
            }
            
            if (polylines.atPolylines[iIdx].sText) {
                this._ePolylines[iIdx].bindTooltip(polylines.atPolylines[iIdx].sText);
            }
            
        }
        
    },
    
    undrawPolyline : function(iIdx) {
        var polylines = JSON.parse(this.psPolylines);
        
        if (polylines.atPolylines[iIdx]) {
            this._ePolylines[iIdx].remove();
            this._ePolylines.splice(iIdx, 1);
        }
    
    },
    
    drawCircle : function(iIdx) {
        var circles = JSON.parse(this.psCircles);
        
        if (this._eMap && circles.atCircles[iIdx]) {
            this._eCircles[iIdx] = L.circleMarker(circles.atCircles[iIdx].anCenter, {
                radius      : circles.atCircles[iIdx].nRadius,
                color       : circles.atCircles[iIdx].sColor,
                weight      : circles.atCircles[iIdx].iWeight,
                opacity     : circles.atCircles[iIdx].nOpacity,
                fillColor   : circles.atCircles[iIdx].sFillColor,
                fillOpacity : circles.atCircles[iIdx].nFillOpacity
            }).addTo(this._eMap);
            
            if (circles.atCircles[iIdx].sText) {
                this._eCircles[iIdx].bindTooltip(circles.atCircles[iIdx].sText);
            }
            
        }
    },
    
    undrawCircle : function(iIdx) {
        var circles = JSON.parse(this.psCircles);
        
        if (circles.atCircles[iIdx]) {
            this._eCircles[iIdx].remove();
            this._eCircles.splice(iIdx, 1);
        }    
    
    },
    
    drawMarker : function (iIdx) {
        var markers = JSON.parse(this.psMarkers), icon;        
        
        if (this._eMap && markers.atMarkers[iIdx]) {
        
            if (markers.atMarkers[iIdx].sIcon !== "") {
                icon = L.icon({
                    iconUrl    : markers.atMarkers[iIdx].sIcon,

                    // Ideally the iconAnchor should be defined for 
                    // each icon, being the offset [x,y] from the center
                    // of the icon image to where you want the icon
                    // placed in relation to the location it is pointing
                    // to, but for now I am just using the dafault [12,40].
                    //   iconAnchor : markers.atMarkers[iIdx].anAnchor
                    iconAnchor : [12, 40]
                });
            } else {
                icon = L.icon({
                    iconUrl    : "https://unpkg.com/leaflet@1.6.0/dist/images/marker-icon.png",
                    iconAnchor : [12, 40]
                });  // The Leaflet default
            }
                    
            this._eMarkers[iIdx] = L.marker(markers.atMarkers[iIdx].aPoint, {
                title       : markers.atMarkers[iIdx].sText,
                icon        : icon,
                opacity     : markers.atMarkers[iIdx].nOpacity,
                riseOnHover : markers.atMarkers[iIdx].bRise
               }).addTo(this._eMap);
        }
    
    },
    
    undrawMarker : function (iIdx) {
        var markers = JSON.parse(this.psMarkers), icon;
        
        if (markers.atMarkers[iIdx]) {
            this._eMarkers[iIdx].remove();
            this._eMarkers.splice(iIdx, 1);
        }
    
    },

    // centerOn
    // ========
    // This is probably a bit redundant, as it turns out that calling
    // fitBounds() of the map object does the same trick.
    centerOn : function(nNorth, nEast) {
        
        if (this._eMap) {
            this._eMap.panTo([nNorth, nEast], {
                animate: false
            });
        }
        
    },
    
    // get_psCurrentMapInfo
    // ====================
    // This allows the synchronised property psCurrentMapInfo to provide the
    // server-side with a JSON string, which can be used to create a JSON object,
    // which can then be used to populate a struct (stMapInfo) which will then
    // contain the current Northings (lat), Eastings (lng) and zoom level of the
    // map's current center.  That's the theory anyway.  Seems to work.
    //
    get_psCurrentMapInfo : function () {
        var info = {};
        
        if (this._eMap) {
            info.lat  = this._eMap.getCenter().lat;
            info.lng  = this._eMap.getCenter().lng;
            info.zoom = this._eMap.getZoom();
        
            return JSON.stringify(info);
        }
        
    },

    getCurrentLoc : function() {
        that = this;
        navigator.geolocation.getCurrentPosition(function(loc){
            that.serverAction("MyLocation", [loc.coords.latitude, loc.coords.longitude]);
        });

    }
   
});

// "Augmenting" _show and _hide in df.WebWindow to resolve the z-index issue:

df.WebWindow.prototype.__show = df.WebWindow.prototype._show; // clone the method
df.WebWindow.prototype._show = function(eRenderTo) {          // Now augment it

    if (this.pbModal) {                                       // If it is a modal popup

        for (var i = 0; i < dfcc.hideObjs.length; i++) {      // Loop through the objects
            var obj = dfcc.hideObjs[i];                       // "obj" as a reference to the current one

            if (!obj._hiddenBy && obj._eElem) {               // Must NOT be hidden AND have an _eElem
                obj._prevVis = obj._eElem.style.visibility;   // Store the current visibility
                obj._eElem.style.visibility = "hidden";       // Set visibility to "hidden"
                obj._hiddenBy = this;                         // Store what it got hidden by
            }

        }
        
    }
    
    this.__show(eRenderTo);                                   // Essentially a forward send
}

df.WebWindow.prototype.__hide = df.WebWindow.prototype._hide; // clone the method
df.WebWindow.prototype._hide = function(bNoServerEvents) {    // Now augment it
    this.__hide(bNoServerEvents);                             // Essentially a forward send

    if (this.pbModal) {                                       // If it is a modal popup

        for (var i = 0; i < dfcc.hideObjs.length; i++) {      // Loop through the objects
            var obj = dfcc.hideObjs[i];                       // "obj" as a reference to the current one

            if (obj._hiddenBy === this) {                     // If it was hidden by "this" popping up...
                obj._eElem.style.visibility = obj._prevVis;   // Reset its visibility
                obj._hiddenBy = null;                         // Unset these
                obj._prevVis = null;                          // properties again
            }

        }
        
    }
    
}

// Attempting to do the same trick with menu drop-downs, which have the same issue
// (the map overlays them), although strangely web combo drop-downs do not.  Weird!

// df.WebMenuItem.prototype._itemClick = df.WebMenuItem.prototype.itemClick;
// df.WebMenuItem.prototype.itemClick = function(tItem, fReturn, oEnv) {
//     df.WebMenuItem.prototype._itemClick(tItem, fReturn, oEnv);  // Forward send
// }
