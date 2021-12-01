/*
Mixin:
    df.WebGridView_mixin
Used by:
    df.WebGridView (df.WebListView)
    df.WebGridScrollingView (df.WebListScrollingView)

Extends the listview classes with data editing capabilities. It replaces the current cell with the 
DOM elements of the DEO base class of the column objects. It does require the one of the 
WebGridModel classes to be used.

Revision:
    2017/02/10  (HW, DAW) 
        Initial version.
*/
/* global df */
df.WebGridView_mixin = function WebGridView_mixin(oList, oModel, oController){
    this.getBase("df.WebGridView_mixin").constructor.call(this, oList, oModel, oController);
    
    this.eEditCell = null;
    this.oEditCol = null;
    this.sEditRowId = null;
    
    this.bCellEdit = false;
    this.bStopFocus = false;        //  Prevents the focus function from actually setting focus which is needed during rowchange to prevent 'flickering' as the focus is called during this process
    
    oModel.onColChange.on(this.onColChange, this);
    oModel.onBeforeRowChange.on(this.onBeforeRowChange, this);
    oModel.onAfterRowChange.on(this.onAfterRowChange, this);
};
df.defineClass("df.WebGridView_mixin",{

afterRender : function(eList){
    this.getBase("df.WebGridView_mixin").afterRender.call(this, eList);
    
    this.editCell();
},

refreshDisplay : function(iRowDispOffset){
    if(this.eBody){
        //  Unedit cell
        this.unEditCell(false);
        
        //  Refresh
        this.getBase("df.WebGridView_mixin").refreshDisplay.call(this, iRowDispOffset);
        
        //  Edit cell
        this.editCell();
    }
},


refreshRow : function(sRowId, sNewRowId){
    var bIsRow = (sRowId === this.sEditRowId);
    
    if(this.eBody){
        if(bIsRow){
            this.unEditCell(false);
            bIsRow = true;
        }
        
        this.getBase("df.WebGridView_mixin").refreshRow.call(this, sRowId, sNewRowId);
        
        if(bIsRow){
            this.editCell();
        }
    }
},

refreshCell : function(sRowId, oCol){
    if(this.oEditCol !== oCol || this.sEditRowId !== sRowId){
        this.getBase("df.WebGridView_mixin").refreshCell.call(this, sRowId, oCol);
    }
},

/*
This method augments the insertRow method and adds support for the editcell of the grid. That means 
that I will insert the edit cell when the inserted row is the current row.

@param  tRow       The row object from the cache.
@param  bTop       If true the row is inserted at the top of the table.
*/
insertRow : function(tRow, bTop){
    this.getBase("df.WebGridView_mixin").insertRow.call(this, tRow, bTop);
    
    if(tRow && tRow.sRowId === this.oM.sCurrentRowId){
        this.editCell();
    }
},

/*
Augments the removeTopRow method and properly removes the element from the DOM and moves the focus 
if the deleted row contains the edit cell.

@private
*/
removeTopRow : function(){
    if(this.eEditCell && this.oM.iCurrentRow === this.iRowDispOffset){
        /* if(this.bCellEdit){
            this.eEditCell.removeChild(this.oEditCol._eElem);
        }
        this.eEditCell = this.oEditCol = this.sEditRowId = null; */
        
        this.unEditCell(false);
        this.oL._eFocus.focus();
    }
    
    this.getBase("df.WebGridView_mixin").removeTopRow.call(this);
},

/*
Augments the removeBottomRow method and properly removes the element from the DOM and moves the 
focus if the deleted row contains the edit cell.

@private
*/
removeBottomRow : function(){
    if(this.eEditCell && this.iRowDispLast === this.oM.iCurrentRow){
/*         if(this.bCellEdit){
            this.eEditCell.removeChild(this.oEditCol._eElem);
        }
        this.eEditCell = this.oEditCol = this.sEditRowId = null; */
        
        this.unEditCell(false);
        this.oL._eFocus.focus();
    }
    
    this.getBase("df.WebGridView_mixin").removeBottomRow.call(this);
},


/*
This method replaces the content of a cell with the edit DOM elements. The column object generates 
the DOM elements.

@param  iCol    The number of the column
@private
*/
editCell : function(){
    var oL = this.oL, oM = this.oM, eElem, eCell, oCol, bEdit, eFocus, iCol = oM.iCurrentColumn, iRow = oM.iCurrentRow;

    //  Check if the row is being displayed
    if((!this.bScroll || iRow >= this.iRowDispOffset && iRow <= this.iRowDispLast) && iCol >= 0){
        oCol = oL._aColumns[iCol];
        
        if(!oCol || !oCol.pbEditable){
            return;
        }
        
        this.bCellEdit = bEdit = oCol._bCellEdit;
        
        //  Get the edit DOM elements from the column object
        eElem = oCol._eElem;
        
        oCol._bIgnoreOnChange = true;
        
        //  Replace cell content with edit elements
        eCell = this.cell(oM.sCurrentRowId, iCol);
        if(eCell){
            if(eCell !== this.eEditCell){  // FIX: Moving to / from the newrow calls this method twice which triggers IE innerHTML / input bug
                if(bEdit){
                    eCell.innerHTML = "";
                    eCell.appendChild(eElem);
                }
                df.dom.addClass(eCell, "WebGrid_EditCell");
            }
            
            oCol.cellEdit();
            
            if(oL.hasFocus()){
                if(oCol.isEnabled()){
                    if(bEdit){
                        oCol.focus(true);
                        
                        //  FIX: Do again after a small timeout to fix IE issues with masked fields
                        if(df.sys.isIE || (df.sys.isEdge && df.sys.iVersion < 13)){
                            setTimeout(function(){
                                if(df.sys.isEdge){
                                    oCol.focus(true);
                                }else if(oCol instanceof df.WebColumn){   //  Make sure to select the text
                                    oCol._eControl.select();
                                }
                            }, 10);
                        }
                    }else{
                        eFocus = df.dom.getFirstFocusChild(eCell);
                        if(eFocus){
                            eFocus.focus();
                        }else{
                            oL._eFocus.focus();
                        }
                    }
                }else{
                    oL._eFocus.focus();
                }
            }
            
            
            this.eEditCell = eCell;
            this.oEditCol = oCol;
            this.sEditRowId = oM.sCurrentRowId;
            
        }
        
        oCol._bIgnoreOnChange = false;
    }
},

/*
This method replaces the content of the edit cell with its value.

@param  bUpdate     If true the cache value is updated.
@private
*/
unEditCell : function(bUpdate){
    var oR = this.oR, oM = this.oM, oCol, bEdit, iRow;
    
    if(this.oEditCol){
        oCol = this.oEditCol;
        bEdit = oCol._bCellEdit;
        iRow = oM.rowIndexByRowId(this.sEditRowId);
        
        if(bUpdate && bEdit && iRow >= 0){
            if(oCol.get('pbChanged')){
                oM.aData[iRow].aCells[oCol._iColIndex].sValue =  oCol.get_psValue();
            }
        }

        //  Force blur first (needed by WebSuggestionForm on Edge & FireFox)
        if (oCol._eControl && oCol._eControl.blur){
            oCol._eControl.blur();
        }
        
        //  Remove gently from the DOM (IE doesn't like it rough)
        if(bEdit){
            if(oCol._eElem.parentNode){
                oCol._eElem.parentNode.removeChild(oCol._eElem);
            }
        }
        
        if(iRow >= 0){
            this.eEditCell.innerHTML = oR.cellHtml(oCol, oM.aData[iRow], oM.aData[iRow].aCells[oCol._iColIndex]);
        }
        df.dom.removeClass(this.eEditCell, "WebGrid_EditCell");
        this.eEditCell = null;
        this.oEditCol = null;
        this.iEditRowId = null;
    }
},

focus : function(){
    var eFocus, oM = this.oM;
    
    //  Check if the row is being displayed
    if(!this.bStopFocus && (!this.bScroll || oM.iCurrentRow >= this.iRowDispOffset && oM.iCurrentRow <= this.iRowDispLast)){
        if(this.oEditCol){
            if(this.oEditCol._bCellEdit){
                if(this.oEditCol.focus(true)){
                    return true;
                }
            }else{
                eFocus = df.dom.getFirstFocusChild(this.eEditCell);
                if(eFocus){
                    eFocus.focus();
                    return true;
                }
            }
        }
    }
    
    return false;
},

onColChange : function(oEv){
    if(!oEv.bRowChange){
        this.unEditCell(true);
        this.editCell();
    }
},

onRowChange : function(oEv){
    this.unEditCell(!this.oL.pbDataAware);
    
    this.getBase("df.WebGridView_mixin").onRowChange.call(this, oEv);
    
    this.editCell();
},

onBeforeRowChange : function(oEv){
    this.bStopFocus = true;
},
onAfterRowChange : function(oEv){
    this.bStopFocus = false;

    //  Explicitly set the focus after a row change to make sure the value is selected
    if(this.oL.hasFocus()){
        this.focus();
    }
}

});

df.WebGridView = df.mixin("df.WebGridView_mixin", "df.WebListView");
df.WebGridScrollingView = df.mixin("df.WebGridView_mixin", "df.WebListScrollingView");