/*
Class:
    df.WebListScrollingView
Extends:
    df.WebListView

Extends the main view class of the WebList its mini MVC model with scrolling logic. It uses a 
virtual scrolling system where only the visible rows and a few above / below are rendered. This 
keeps the number of DOM elements low and the performance up. It also supports paged data loading 
(WebListPagedModel) to support 'endless scrolling' where data is only partially loaded and chuncks 
of data are requested when needed.

Revision:
    2017/02/10  (HW, DAW) 
        Initial version.
    2018/02/22  (HW, DAW)
        It now keeps track of independent row heights and calculates accordingly.
*/
/*global df*/

df.WebListScrollingView = function WebListScrollingView(oList, oModel, oController){
    df.WebListScrollingView.base.constructor.call(this, oList, oModel, oController);
    
    this.bScroll = true;

    this.bZebraTop = false;    //  Indicates wether the next row inserted on top should be a 'Odd' colored row
    this.bZebraBottom = false; //  Indicates wether the next row inserted at the bottom should be a 'Odd' colored row
    
    this.iTableOffset = 0;     //  The scrollOfset of the table (number of pixels between the first rendered row and the first visisble row)
    this.iScrollOffsetPx = 0;  //  The number of (virtual) pixels from the top of the list to the displayed part
    this.iRowDispOffset = 0;   //  The first row that is currently rendered
    this.iViewOffset = 0;      //  The number of rows rendered above the first visible row
    this.iRowsDispOffset = 0;  //  The total offset from the top of the cache to the first rendered row
    this.iRowDispLast = 0;     //  The last displayed row
    
    this.iPrefViewOffset = 8;      //  The preferred view offset (amount of rows rendered that are not visible)
    this.iMaxViewOffsetDiff = this.iPrefViewOffset / 2;      //  The preferred view offset (amount of rows rendered that are not visible)
    
    this.iLastScrollbarSet = 0;    //  The last scrollTop set to the scrollbar so we know if we need to redraw on this event
    this.bScrollbarDirty = false;  //  Sometimes when not rendered yet the scrollbar doesn't update properly, this property indicates that it is still off and needs to be corrected
    
    
    this.iAvgRowHeight = 0;     // Average row height used when a row is not rendered yet
    this.iTableHeight = 0;     //  The height of the table in pixels
    
    this.bNoRender = false;    //  Tempolary disables the rendering while initializing or updating the cache
    
    this.iAutoScroll = 0;      //  Used by the kinetic scrolling system to indicate that we are still "scrolling"
    
    this.oInitialFullEvent = null;
    this.bFirstFill = true;

    this.aRowHeightProcess = [];
    
    this.onHorizontalScroll = new df.events.JSHandler();
    this.onVerticalScroll = new df.events.JSHandler();

    this.bDelUpdDim = false;        //  If true a dimension update is scheduled
    this.bDelUpdDimForced = false;  //  If true the scheduled dimension updated is a forced update

    oList._onResize.on(this.onResize, this);
};
df.defineClass("df.WebListScrollingView", "df.WebListView", {

genHtml : function(aHtml){
    aHtml.push('<div class="WebList_BodyWrp">');
    
    aHtml.push('<div class="WebList_Scroll" tabindex="-1"><div class="WebList_Stretcher" style="width: 1px;"></div></div>');
    
    aHtml.push('<div class="WebList_Body', (this.oL.pbShowSelected ? ' WebList_ShowSelected' : ''), '">');
    
    aHtml.push('<div class="WebList_TableWrp', (this.oL.pbAutoColumnSizing ? " WebList_AutoSize" : " WebList_HorizScroll"), '">');
    aHtml.push('<div class="WebList_Table">');
    
    /* this.tableHtml(aHtml); */
    
    aHtml.push('</div></div></div>');
    aHtml.push('<div style="clear: both"></div>');
    aHtml.push('</div>');
},

afterRender : function(eList){
    this.eTableWrp = df.dom.query(eList, "div.WebList_TableWrp");
    this.eTable = df.dom.query(eList, "div.WebList_Table");
    this.eScrollbar = df.dom.query(eList, "div.WebList_Scroll");
    this.eScrollStretch = df.dom.query(eList, "div.WebList_Scroll > div.WebList_Stretcher");
    
    df.WebListScrollingView.base.afterRender.call(this, eList);
    
    
    df.events.addDomMouseWheelListener(this.eBody, this.onMouseWheelScroll, this);
    df.dom.on("scroll", this.eScrollbar, this.onScrollbarScroll, this);
    df.dom.on("scroll", this.eTableWrp, this.onHorizbarScroll, this);
    df.events.addDomCaptureListener("load", this.eTableWrp, this.onContentLoaded, this);
},

afterFirstFill : function(){
    df.dom.animFrame(function(){
        //  Scroll to the sort column
        if(this.oL.piSortColumn > 0){
            this.scrollToCol(this.oL.piSortColumn);
        }
    }, this);
},

onDataUpdate : function(oEv){
    var eRow, iOffsetTop;

    this.iMaxPX = null;
    if(oEv.sType === "full"){
        if(!this.eBody){
            this.oInitialFullEvent = oEv;
            return;
        }

        this.updateScrollbarSize();
        
        this.bNoRender = true;
        eRow = this.row(this.oM.sCurrentRowId);
        if(eRow){
            iOffsetTop = eRow.offsetTop - this.iTableOffset;
        }else{
            this.centerCurrentRow();
        }

    
        this.bNoRender = false;
        this.updatePosition(true);
        
        if(this.determineDimensions()){
            this.updateScrollbarSize();
            if (eRow){
                this.smartRepositionCurrentRow(iOffsetTop);
            }else{
                this.centerCurrentRow();
            }
        }
        //  If there is no table height this is probably the initial rendering of the list so we do call centerCurrentRow in the next animation frame when hopefully iTableHeight is figured out.
        if(this.iTableHeight <= 0){
            df.dom.animFrame(function(){
                if(this.iTableHeight > 0){
                    this.centerCurrentRow();
                }
            }, this);
        }

        //  First time trigger afterFirstFill
        if(this.bFirstFill){
            this.bFirstFill = false;
            this.afterFirstFill();
        }
    }
    if(oEv.sType === "next"){
       this.updateScrollbarSize();
    }
    if(oEv.sType === "prev"){
        //  Update display props
        this.iScrollOffsetPx += oEv.iOffsetChange * (this.iAvgRowHeight || 20);
        this.iRowDispOffset += oEv.iOffsetChange;
        this.iRowsDispOffset += oEv.iOffsetChange;
        this.iRowDispLast += oEv.iOffsetChange;
        
        //  Update display
        this.bNoRender = true;
        this.updateScrollbarSize();
        this.eScrollbar.scrollTop = this.eScrollbar.scrollTop  + oEv.iOffsetChange * (this.iAvgRowHeight || 20);
        this.bNoRender = false;
        this.updatePosition();
    }
    if(oEv.sType === "row"){
        this.refreshRow(oEv.sUpdateRowId, oEv.sNewRowId);
    }
    if(oEv.sType === "cell"){
        this.refreshCell(oEv.sUpdateRowId, oEv.oCol);
    }
    if(oEv.sType === "newrow"){
        this.bNoRender = true;
        this.updateScrollbarSize();
        this.scrollToCurrentRow();
        this.bNoRender = false;

        this.updatePosition(true);
    }
    if(oEv.sType === "remrow"){
        this.bNoRender = true;
        this.updateScrollbarSize();
        this.scrollToCurrentRow();
        this.bNoRender = false;

        this.updatePosition(true);
    }
},

onRowChange : function(oEv){
    if(this.eBody){
        this.scrollToCurrentRow();
        
        df.WebListScrollingView.base.onRowChange.call(this, oEv);
    }
},


onSettingChange : function(oEv){
    if(oEv.sType === "redraw"){
        this.updatePosition(true);
    }else if(oEv.sType === "prop" && oEv.sProp === "pbAutoColumnSizing"){
        df.dom.toggleClass(this.eTableWrp, "WebList_AutoSize", this.oL.pbAutoColumnSizing);
        df.dom.toggleClass(this.eTableWrp, "WebList_HorizScroll", !this.oL.pbAutoColumnSizing);
    }else{
        df.WebListScrollingView.base.onSettingChange.call(this, oEv);
    }
},

// - - - - - - - Display & scroll - - - - - - -

/* 
Scrolls the specified amount of pixels up or down.
*/
scroll : function(iDelta, bSnap, bFromScrollbar){
    var iOffset;
    
    //  Determine new offset
    iOffset = this.iScrollOffsetPx;
    iOffset += iDelta;

    //  We do not check the boundaries because ScrollTo will do that..
    
    //  Perform actual scrolling 
    this.scrollTo(iOffset, bSnap, bFromScrollbar);
},

/* 
Scrolls to the specified offset. It optionally snaps to the closest row. 
*/
scrollTo : function(iOffset, bSnap, bFromScrollbar, bNoBoundaries){
    if(iOffset !== this.iScrollOffsetPx){
        this.iScrollOffsetPx = iOffset;
        
        //  We do not check boundaries or do snapping as updatePosition does that now
        this.updatePosition(false, bSnap, !!bNoBoundaries);
    
        //  Update scrollbar 
        if(!bFromScrollbar){
            this.updateScrollbarPos(this.iScrollOffsetPx);
        }

        this.onVerticalScroll.fire(this, {
            iScrollOffsetPx : this.iScrollOffsetPx
        });

        this.updateCache();
    }
},

/* 
Updates the display. It calculates which rows should be rendered, updates or refreshes the view, 
and updates the scrollOffset.

@param  bForceRedraw    Enforces a full redraw of the view.
@param  bSnap           Snaps to a specific row.
*/
updatePosition : function(bForceRedraw, bSnap, bNoBoundaries){
    var oM = this.oM, iViewOffsetPx, iScrollOffsetPx, iRowViewLast = null, iRowDispLast, iRowDispOffset, iRowScrollOffset = null, 
        iEmptyRows = 0, i, iTotalPx = 0, iViewEndOffsetPx, iRowPx, iMaxPX, iInitScrollOffsetPx, iViewRowOffsetPx;

    if(!this.eBody || this.bNoRender){
        return;
    }
    bSnap = !!bSnap;
    bNoBoundaries = !!bNoBoundaries;
    bForceRedraw = !!bForceRedraw;

    iMaxPX = this.getMaxPX();
    iInitScrollOffsetPx = iScrollOffsetPx = this.iScrollOffsetPx;
    iViewEndOffsetPx = Math.max(iScrollOffsetPx, 0) + this.iTableHeight;
    
    //var sLog = "updatePosition(" + iScrollOffsetPx + ")";

    //  Loop over rows to determine the first & last rendered rows based on the height
    for(i = 0; i < oM.aData.length; i++){
        iRowPx = this.rowHeightPx(i);

        //  Snapping logic
        if(bSnap && iRowScrollOffset === null && iTotalPx + iRowPx > iScrollOffsetPx && iRowPx < (this.iAvgRowHeight * 1.5)){
            if((iScrollOffsetPx - iTotalPx) < (iRowPx / 2)){
                iScrollOffsetPx = iTotalPx;
            }else{
                iScrollOffsetPx = iTotalPx + iRowPx;
            }
        }

        iTotalPx += iRowPx;
        
        //  Find the first displayed row
        if(iRowScrollOffset === null && iTotalPx >= iScrollOffsetPx){
            if(bNoBoundaries){
                this.iScrollOffsetPx = iScrollOffsetPx;
            }else{
                this.iScrollOffsetPx = iScrollOffsetPx = Math.max(0, Math.min(iScrollOffsetPx, iMaxPX));
            }
            iViewEndOffsetPx = Math.max(iScrollOffsetPx, 0) + this.iTableHeight;

            iRowScrollOffset = i;
            iViewRowOffsetPx = iTotalPx - iRowPx;
        }

        //  Find the last displayed row
        if(iTotalPx >= iViewEndOffsetPx){
            iRowViewLast = i;
            break;
        }
    }

    //  Snap adjustment for the last row
    if(iMaxPX - iInitScrollOffsetPx < this.iAvgRowHeight * 0.5){
        iScrollOffsetPx = iMaxPX;
    }

    //  If we did not find a start offset
    if(iRowScrollOffset === null){
        if(bNoBoundaries){
            this.iScrollOffsetPx = iScrollOffsetPx;
        }else{
            this.iScrollOffsetPx = iScrollOffsetPx = Math.max(0, Math.min(iScrollOffsetPx, iMaxPX));
        }
        iViewEndOffsetPx = Math.max(iScrollOffsetPx, 0) + this.iTableHeight;

        iRowScrollOffset = 0;
        iViewRowOffsetPx = 0;
    }

    //  If we did not find an end offset
    if(iRowViewLast === null){
        iRowViewLast = Math.max(0, oM.aData.length - 1);
    }
    
    //  See if we need empty rows at the end..
    if(iTotalPx < this.iTableHeight){
        iEmptyRows = (this.iTableHeight - iTotalPx) / (this.iAvgRowHeight || 20) + this.iPrefViewOffset;
    }
    
    //  Calculate the target row offset
    iRowDispOffset = Math.max(iRowScrollOffset - this.iPrefViewOffset, 0);
    iRowDispLast = Math.min(iRowViewLast + this.iPrefViewOffset, oM.aData.length - 1);

    this.iCalcRowDispLast = iRowDispLast;
    
    //  Choose between full redraw and adjustment. Adjustment is possible if the rows are already in the rendered area. 
    if(bForceRedraw || (iRowScrollOffset < this.iRowDispOffset) || (iRowViewLast > this.iRowDispLast) ||  this.iCalcEmptyRows !== iEmptyRows){
        // sLog += " --refresh list! " + iRowDispOffset + " --> " + iRowDispLast + " --- " + iEmptyRows;
        this.iCalcEmptyRows = iEmptyRows;

        this.refreshDisplay(iRowDispOffset, iRowDispLast);
    }else{
        // sLog += " --adjust list! " + iRowDispOffset + " --> " + iRowDispLast;
        this.adjustDisplay(iRowDispOffset);
    }
    
    //  Calculate and update view scroll offset
    iViewOffsetPx = iScrollOffsetPx - (iViewRowOffsetPx - this.combinedRowHeightPx(this.iRowDispOffset, iRowScrollOffset));
    this.updateScrollOfset(iViewOffsetPx);
    // console.log(sLog + " --- iViewScrollOffsetPx: " + iViewOffsetPx);
},

/*
Refreshes the dispay completely by regenerating the table html.

@param  iRowDispOffset  The first row to be rendered.
*/
refreshDisplay : function(iRowDispOffset){
    var aHtml = [];
    
    this.iRowDispOffset = iRowDispOffset;
    
    this.tableHtml(aHtml);
    
    if(df.sys.isIE){
        while(this.eTable.lastChild){
            this.eTable.removeChild(this.eTable.lastChild);
        }
    }

    this.eTable.innerHTML = aHtml.join('');
    
    //  Notify other modules
    this.onRowsRendered.fire(this);

    this.delayUpdateDimensions(true);
},

/* 
Augments rowHtml and queues the generated row for height calculation once it is has been rendered.

@param  tRow    Row object from the model (null if empty row).
@param  aHtml   Array used as string builder.
@param  bZebra  Indicates an off or even row for zebra striping style.
*/
rowHtml : function(tRow, aHtml, bZebra){
    df.WebListScrollingView.base.rowHtml.call(this, tRow, aHtml, bZebra);

    if(tRow){
        if(!tRow._iRowHeight){
            this.aRowHeightProcess.push(tRow.sRowId);
        }
    }
},

/* 
Overrides the tableHtml function as it now only renders the rows in the current view. It depends on
this.iRowDispOffset, this.iCalcRowDispLast and this.iCalcEmptyRows to be properly set by 
updatePosition.
*/
tableHtml : function(aHtml){
    var oM = this.oM, i, bZebra = !this.bZebraTop;
    
    //  Loop rows
    for(i = this.iRowDispOffset; i <= this.iCalcRowDispLast && i < oM.aData.length; i++){
        this.rowHtml(oM.aData[i], aHtml, bZebra);
        
        this.iRowDispLast = i;
        bZebra = !bZebra;
    }
    
    //  Generate "empty" rows
    for(i = 0; i < this.iCalcEmptyRows; i++){
        this.rowHtml(null, aHtml, bZebra);
        
        bZebra = !bZebra;
    }
    
    this.bZebraBottom = bZebra;


},

/* 
Adjusts the display by adding / removing rows on top or the bottom. This is done to improve scroll
performance (instead of full refresh).

@param  iRowDispOffset  The first row to be rendered.
@param  iRowDispLast    The last row to be rendered.
*/
adjustDisplay : function(iRowDispOffset, iRowDispLast){
    var oM = this.oM, iAllowedDiff = this.iMaxViewOffsetDiff, bAdd = false;
    
    if(this.iRowDispOffset > iRowDispOffset){
        //  Add rows on top
        if(this.iRowDispOffset > (iRowDispOffset + iAllowedDiff)){
            while(this.iRowDispOffset > iRowDispOffset){
                this.iRowDispOffset--;
                this.insertRow(oM.aData[this.iRowDispOffset], true);
                
                bAdd = true;
                // console.log("Insert top row!");
            }
        }
        
        //  Remove rows on the bottom
        if(this.iRowDispLast > (iRowDispLast + iAllowedDiff)){
            while(this.iRowDispLast > iRowDispLast){
                this.removeBottomRow();
                // console.log("Remove bottom row!");
            }
        }
    }else{
                
        //  Add rows on the bottom
        if(this.iRowDispLast < (iRowDispLast - iAllowedDiff)){
            while(this.iRowDispLast < iRowDispLast){
                this.iRowDispLast++;
                this.insertRow(oM.aData[this.iRowDispLast], false);

                bAdd = true;                
                // console.log("Insert bottom row!");
            }
        }
        
        // Remove rows on top
        if(this.iRowDispOffset < (iRowDispOffset - iAllowedDiff)){
            while(this.iRowDispOffset < iRowDispOffset){
                this.removeTopRow();
                
                // console.log("Remove top row!");
            }
        }
    }

    if(bAdd){
        //  Notify other modules
        this.onRowsRendered.fire(this);
    }
},

/*
This method removes a single row from the display table. It makes sure the _iRowDispOffset and 
_iViewOffset are properly updated. It is called by the adjustDisplay method.

@private
*/
removeTopRow : function(){
    this.iRowDispOffset++;
    this.bZebraTop = !this.bZebraTop;
    
    //  Remove things that are not rows on top first
    while(this.eTable.firstChild.className.indexOf("WebList_Row") < 0){
        this.eTable.removeChild(this.eTable.firstChild);
    }
    this.eTable.removeChild(this.eTable.firstChild);
},

/*
This method removes a single row from the top of the display table. It is called by the 
adjustDisplay method.

@private
*/
removeBottomRow : function(){
    this.iRowDispLast--;

    //  Remove things that are not rows on top first
    while(this.eTable.lastChild.className.indexOf("WebList_Row") < 0){
        this.eTable.removeChild(this.eTable.lastChild);
    }
    this.eTable.removeChild(this.eTable.lastChild);
    this.bZebraBottom = !this.bZebraBottom;
},

/* 
There are more rows rendered than there are visible. We hide the first extra top rows visible using
CSS translateY.

@param  
*/
updateScrollOfset : function(iOffset){
    if(this.eTable){
        this.iTableOffset = iOffset;

        df.dom.translateY(this.eTable, -iOffset, true);
        
        if(this.eTableWrp.scrollTop > 0){
            this.eTableWrp.scrollTop = 0;  //  Reset this as it somehow gets scrolled :S
        }
    }
},

/* 
This function inserts a single row into the list using DOM object creation. This is slower as using 
innerHTML but is faster as refreshing the entire table (which needs to be done using innerHTML).

@param  tRow    Row data.
@param  bTop    True if the row needs to be inserted at the top, false for the bottom.
@private
*/
insertRow : function(tRow, bTop){
    var eRow, bZebra, aHtml = [];
    
    //  Determine row zebra
    if(bTop){
        bZebra = this.bZebraTop;
        this.bZebraTop = !this.bZebraTop;
    }else{
        bZebra = this.bZebraBottom;
        this.bZebraBottom = !this.bZebraBottom;
    }
    
    //  Generate row element
    this.rowHtml(tRow, aHtml, bZebra); 
    eRow = df.dom.create(aHtml.join(''));
    if(bTop && this.eTable.firstChild){
        this.eTable.insertBefore(eRow, this.eTable.firstChild);
    }else{
        this.eTable.appendChild(eRow);
    }
},

/*
Updates the cached row height for the specified row (stored as _iRowHeight on the row data).

@param  sRowId  Row ID of the row to update.
*/
updateRowHeight : function(sRowId){
    var oM = this.oM, eRow, iHeight, iMarginTop, iMarginBottom, oStyle, iRow, rect;

    iRow = oM.rowIndexByRowId(sRowId);
    if(iRow >= 0){
        eRow = this.row(sRowId);
    }


    if(eRow){
        rect = eRow.getBoundingClientRect();
        iHeight = rect.height; 

        oStyle = df.sys.gui.getCurrentStyle( eRow);
        
        iMarginTop = parseFloat(oStyle.marginTop);
        iMarginBottom = parseFloat(oStyle.marginBottom);

        //  Assume that margins are combined between rows (except for the last row)
        if(eRow === eRow.parentNode.lastChild && this.iRowDispLast === oM.aData.length - 1 && (oM.bLast || !oM.bPaged)){
            iHeight += iMarginTop + iMarginBottom;
        }else{
            iHeight += Math.max(iMarginTop, iMarginBottom);
        }

        //console.log("updateRowHeight(sRowId:" + sRowId + " iRow:" + iRow + " iHeight:" + iHeight + ", from: " + oM.aData[iRow]._iRowHeight + ")");
        oM.aData[iRow]._iRowHeight = iHeight;
    }
},

/*
Calculates the average row height and stores it in iAvgRowHeight.
*/
updateAvgRowHeight : function(){
    var iSum = 0, iCount = 0;

    this.oM.aData.forEach(function(tRow){
        if(tRow._iRowHeight){
            iCount++;
            iSum += tRow._iRowHeight;
        }
    });

    if(iCount){
        this.iAvgRowHeight = iSum / iCount;
    }
},

/*
Processes row height calculations that need to be perfomed.

@return True if row heights have been recalculated.
*/
processRowHeights : function(){
    var sRowId, bChange = false;

    while(sRowId = this.aRowHeightProcess.pop()){
        bChange = true;
        this.updateRowHeight(sRowId);
    }
    
    if(bChange){
        this.iMaxPX = null;
        this.updateAvgRowHeight();
    }

    return bChange;
},

/*
Determines the row height for a specific row by looking at the cached value (or it takes the average).

@param  iRow    The row index.
@return Row height in pixels.
*/
rowHeightPx : function(iRow){
    var iHeightPx, tRow = this.oM.aData[iRow];

    if(tRow._iRowHeight){
        iHeightPx = tRow._iRowHeight;
    }else{
        iHeightPx = this.iAvgRowHeight || 20;
    }

    if(tRow._iRowHeightExtra){
        iHeightPx += tRow._iRowHeightExtra;
    }

    return iHeightPx;
},

/*
Calculates the height of multiple rows.

@param  iStart  Start row index.
@param  iTo     End row index.
@return    Total height in pixels.
*/
combinedRowHeightPx : function(iStart, iTo){
    var oM = this.oM, i, iHeightPx = 0;

    for(i = iStart; i < oM.aData.length && i < iTo; i++){
        iHeightPx += this.rowHeightPx(i);
    }

    return iHeightPx;
},

/* 
Snaps the specific offset to the closest row position and returns the snapped offset. Used by touch handler.

@param  iOffsetPx   Offset in pixels.
@return Snapped offset (closest row).
*/
snapToRow : function(iOffsetPx){
    var oM = this.oM, iRowPx, iTotalPx = 0, i;

    for(i = 0; i < oM.aData.length; i++){
        iRowPx = this.rowHeightPx(i);

        //  Snapping logic
        if(iTotalPx + iRowPx > iOffsetPx){
            if((iOffsetPx - iTotalPx) < (iRowPx / 2)){
                return iTotalPx;
            }else{
                return iTotalPx + iRowPx;
            }
        }

        iTotalPx += iRowPx;
    }

    return iTotalPx;
},


/* 
Determines the maximum scrolling offset in pixels. It looks the height of the list and the height 
per row. It takes extra margin space into account for rows with an margin.
*/
getMaxPX : function(){
    if(this.iMaxPX){
        return this.iMaxPX;
    }
    return (this.iMaxPX = Math.max(this.combinedRowHeightPx(0, this.oM.aData.length) - this.iTableHeight, 0));
},

/*
Updates the size of the stretch element defining the size of the scrollbar thingy based on the 
current cache.
*/
updateScrollbarSize : function(){
    var iHeight = this.combinedRowHeightPx(0, this.oM.aData.length);
    
    if(this.eScrollStretch && this.eScrollStretch.clientHeight !== iHeight){
        this.eScrollStretch.style.height = iHeight + "px";
    }
},

/* 
Updates the position displayed by the scrollbar.

@param  iOffset     Offset in pixels from the top of the cache to the first displayed row.
*/
updateScrollbarPos : function(iOffset){
    var bDirty, that = this;
    
    if(this.eScrollbar){
        this.eScrollbar.scrollTop = this.iLastScrollbarSet = iOffset;
        this.bScrollbarDirty = bDirty = Math.abs(this.eScrollbar.scrollTop - this.iLastScrollbarSet) > 5;
        
        if(bDirty){
            setTimeout(function(){
                if(that.bScrollbarDirty && that.eScrollbar.scrollTop !== that.iLastScrollbarSet){
                    that.eScrollbar.scrollTop = that.iLastScrollbarSet;
                }
                
                that.bScrollbarDirty = false;
            }, 300);
        }  
    }
},

/* 
Handles the scroll event of the scrollbar and will update the scroll position.

@param  oEv     Event object.
*/
onScrollbarScroll : function(oEv){
    var iOffset = this.eScrollbar.scrollTop;
    
    //  Ignore rounding changes up to 2 pixels and dirty scorllbar events
    if(Math.abs(iOffset - this.iLastScrollbarSet) > 2 && !this.bScrollbarDirty){
        // console.log("Scrollbar scroll: " + iOffset + "   max px: " + this.getMaxPX());

        this.iAutoScroll = 0;
        this.iLastScrollbarSet = iOffset;
        // df.debug("scrollbar interfered!");
        this.scrollTo(iOffset, true, true);
    }
},

/* 
Handles the mousewheel event and scrolls the list accordingly. It relies on the scroll function it
snapping logic.

@param  oEv     Event object.
*/
onMouseWheelScroll : function(oEv){
    var iDelta = oEv.getMouseWheelDelta();
    
    this.iAutoScroll = 0;
    
    if(iDelta > 0){
        //  Scroll up
        this.scroll(-((this.iAvgRowHeight || 20) * 2), true);
        
    }else if(iDelta < 0){
        //  Scroll down
        this.scroll((this.iAvgRowHeight || 20) * 2, true);
    }
    
    oEv.stop();
},

/* 
Triggers a cache update based on the current display boundaries by calling the controller object 
passing the currently displayed rows. The controller wil load extra rows if nessecary. 
*/
updateCache : function(){
    this.oC.triggerCacheUpdate(this.iRowDispOffset, this.iRowDispLast);
},

/* 
Centers the currently selected row on the screen.
*/
centerCurrentRow : function(){
    var oM = this.oM, iOffsetPx, iRow;
    
    iRow = oM.iCurrentRow;
    if(iRow >= 0 && this.iTableHeight > 0){
        iOffsetPx = this.combinedRowHeightPx(0, iRow);

        iOffsetPx = iOffsetPx - (this.iTableHeight / 2) + (this.rowHeightPx(iRow) / 2);


       
        this.scrollTo(iOffsetPx, true, false);
    }
},

/*
Repositions the selected row based on the passed top offset that was stored before a refresh. This 
top offset is the number of pixels to the first rendered row.

@param  iOffsetTop  Offset to the first rendeeed row we try to restore.
*/
smartRepositionCurrentRow : function(iOffsetTop){
    var iRow, iOffsetPx;
    iRow = this.oM.iCurrentRow;
    if(iRow >= 0){
        iOffsetPx = this.combinedRowHeightPx(0, iRow);
        iOffsetPx -= iOffsetTop;

        if(iOffsetPx > 0){
            this.scrollTo(iOffsetPx, true, false);
        }

        this.scrollToCurrentRow();
    }
},

/* 
Scrolls to the currently selected row. Note that if the row is already on the screen it does nothing 
so it doesn't always refresh the display.
*/
scrollToCurrentRow : function(){
    var oM = this.oM, iOffsetPx, iRow, iRowPx;
    
    iRow = oM.iCurrentRow;
    if(iRow >= 0){
        iOffsetPx = this.combinedRowHeightPx(0, iRow);
        iRowPx = this.rowHeightPx(iRow);

        if(iOffsetPx < this.iScrollOffsetPx){
            this.scrollTo(iOffsetPx, true, false);
        }else if(iOffsetPx + iRowPx > this.iScrollOffsetPx + this.iTableHeight){
            iOffsetPx = iOffsetPx + iRowPx - this.iTableHeight; 

            this.scrollTo(iOffsetPx, false, false);
        }
    }
},

scrollToCol : function(iCol){
    var oL = this.oL, eCell;

    if(!oL.pbAutoColumnSizing){
        //  Get a cell element for this col (first try the current row, if not available try the first one available)
        eCell = this.colCellByIndex(iCol);
        if(!eCell){
            eCell = (this.eBody && df.dom.query(this.eBody, "td[data-dfcol='" + iCol + "']")) || null;
        }

        if(eCell){
            if(eCell.offsetLeft < this.eTableWrp.scrollLeft){
                oL._oBody.scrollToHoriz(eCell.offsetLeft);
            }else if(eCell.offsetLeft + eCell.offsetWidth > (this.eTableWrp.clientWidth + this.eTableWrp.scrollLeft)){
                oL._oBody.scrollToHoriz(Math.min(eCell.offsetLeft, (eCell.offsetLeft + eCell.offsetWidth - this.eTableWrp.clientWidth)));
            }
        }
    }
},

scrollToHoriz : function(iScrollX){
    this.eTableWrp.scrollLeft = iScrollX;
},

/* 
Gets called during the resize process to set the height of the list. It updates the height of the 
body and scrollbar element.

@param  iHeight     Height to be set in pixels.
*/
setHeight : function(iHeight){
    iHeight -= df.sys.gui.getVertBoxDiff(this.eBody);
    iHeight -= df.sys.gui.getVertBoxDiff(this.eBodyWrp);
    
    iHeight = Math.max(iHeight, 0);
    
    //  Set the height on the grid body
    this.eBody.style.height = iHeight + "px";
    this.eScrollbar.style.height = (df.dom.clientHeight(this.eTableWrp) || iHeight || 0) + "px";
},

/* 
Determines the dimensions (table height) and detects a change in those. Also triggers a 
processRowHeights to be sure.

@return True if dimensions did change.
*/
determineDimensions : function(){
    var bChanged = false;
    
    if(this.eBody){
        this.iPrevTableHeight = this.iTableHeight;
        this.iTableHeight = this.eTableWrp.clientHeight || this.iTableHeight;
        bChanged = bChanged || this.iPrevTableHeight !== this.iTableHeight;
        
        bChanged = bChanged || this.processRowHeights();
    }
    
    return bChanged;
},

/* 
Updates the dimensions and if they changed it will trigger a redraw.

@param  bForceRedraw    If true we enforce a full redraw, if false we do a lazy update.
*/
updateDimensions : function(bForceRedraw){
    if(this.determineDimensions()){
        //  Clear row height cache as force redraw indicates a resize meaning that they might have changed
        if(bForceRedraw){
            this.oM.aData.forEach(function(tRow){
                tRow._iRowHeight = null;
            });
        }

        //  Update display
        this.updateScrollbarSize();
        this.updatePosition(bForceRedraw);
    }
},

/*
Performs a delayed (next animation frame) update of the dimensions. If one is already scheduled it will 
only execute once.

@param  bForceRedraw    If true a full redraw is enforced.
*/
delayUpdateDimensions : function(bForceRedraw){
    this.bDelUpdDimForced = this.bDelUpdDimForced || !!bForceRedraw;
    if(!this.bDelUpdDim){
        df.dom.animFrame(function(){
            this.updateDimensions(this.bDelUpdDimForced);
            this.bDelUpdDim = false;
            this.bDelUpdDimForced = false;
        }, this);
        this.bDelUpdDim = true;
    }
},

/* 
Handles the onResize event and makes sure the dimensions are read from the DOM. If they change we 
trigger a redraw.

@param  oEv Event object.
*/
onResize : function(oEv){
    if(this.oInitialFullEvent){
        //  Render for the first time
        this.determineDimensions();
        this.onDataUpdate(this.oInitialFullEvent);
        this.oInitialFullEvent = null;
    }else{
        this.updateDimensions(true);
    }
},

/*
Captures the load event and makes sure that the size of the row containing the target element gets 
redetermined. This should solve issues with images inside lists that load slower. Unfortunately it
can also cause unnessecary resize operations, but only when a cWebImageColumn is used.

@param  oEv Event object.
*/
onContentLoaded : function(oEv){
    var sRowId, eElem = oEv.getTarget();

    while(eElem && eElem !== this.eTableWrp){
        if(eElem.hasAttribute("data-dfrowid")){
            sRowId = eElem.getAttribute("data-dfrowid");
            if(this.aRowHeightProcess.indexOf(sRowId) <= 0){
                this.aRowHeightProcess.push(sRowId);
                this.delayUpdateDimensions(false);
            }
            
            return;
        }
        eElem = eElem.parentNode;
    }
},

/* 
Used by the header view to determine the scrollbar width.
*/
scrollbarWidth : function(){
    return (this.eBody && this.eBody.clientWidth - this.eTableWrp.clientWidth) || 0;
},

/* 
Used by WebListController to determine page size for page up and page down.
*/
getViewSize : function(){
    if(this.iTableHeight && this.iAvgRowHeight){
        return this.iTableHeight / this.iAvgRowHeight;
    }
    return 10;
},

/* 
Sets an extra (temporary) row height for a specific row, this is added to the existing row height. 
The cWebListExpandPanel uses this when expanding a row.

@param  sRowId  RowId of row to set extra height on.
@param  iExtra  The extra height to add to the administration.
*/
setExtraRowHeight : function(sRowId, iExtra){
    var oM = this.oM, iRow;

    iRow = oM.rowIndexByRowId(sRowId);
    if(iRow >= 0){
        oM.aData[iRow]._iRowHeightExtra = iExtra;
        this.iMaxPX = null;
        this.updateScrollbarSize();
    }
},

/* 
Determines the extra height that is set for a specific row. 

@param  sRowId  RowId of the row to get the extra height of.
@return Extra height in pixels.
*/
getExtraRowHeight : function(sRowId){
    var oM = this.oM, iRow;

    iRow = oM.rowIndexByRowId(sRowId);
    if(iRow >= 0){
        return oM.aData[iRow]._iRowHeightExtra || 0;
    }
},

/* 
Handles the scroll event of the WebList_TableWrp and triggers the onHorizontalScroll event allowing
the header to update its scroll position.

@param  oEv     Event object.
*/
onHorizbarScroll : function(oEv){
    this.onHorizontalScroll.fire(this, {
        nScrollX : this.eTableWrp.scrollLeft
    });
}



});