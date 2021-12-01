/*
Class:
    df.WebListModel

The model for the WebList its mini MVC system. It stores the data and and triggers onDataUpdate when 
needed to notify the view of changes. It contains logic for sorting the data.

Revision:
    2017/02/10  (HW, DAW) 
        Initial version.
*/


df.WebListModel = function WebListModel(oList){
    this.oL = oList;
    this.bPaged = false;
    
    this.sCurrentRowId = oList.psCurrentRowId;
    this.iCurrentRow = -1;
    this.aData = [];
    
    this.onDataUpdate = new df.events.JSHandler();
    this.onBeforeDataUpdate = new df.events.JSHandler();
    
    this.onBeforeRowChange = new df.events.JSHandler();
    this.onRowChange = new df.events.JSHandler();
    this.onAfterRowChange = new df.events.JSHandler();
    
    oList._onSettingChange.on(this.onSettingChange, this);
};
df.defineClass("df.WebListModel", {

handleData : function(aRows){
    this.onBeforeDataUpdate.fire(this);
    
    this.aData =  aRows;
    
    //    Sort data (if needed)
    this.sortData();
    
    //    Refind current row
    this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
    
    //    Always select row if there is a row
    if(this.iCurrentRow < 0 && this.aData.length > 0){
        this.iCurrentRow = 0;
        this.sCurrentRowId = this.aData[0].sRowId;
    }
    
    this.onDataUpdate.fire(this, { sType : "full" });
},

sortData : function(){
    var oL = this.oL;
    
    //  Only sort if a sort column is set
    if(oL.piSortColumn >= 0){
        var iCol, bRev, aCompare, i;
        
        //  Determine sort column & order
        iCol = oL._aColumns[oL.piSortColumn]._iColIndex;
        bRev = oL.pbReverseOrdering;
        
        //  Generate array of comparison methods for each column based on the type
        aCompare = [];
        for(i = 0; i < oL._aColumns.length; i++){
            aCompare[i] = df.sys.data.compareFunction(oL._aColumns[i].peDataType);
        }
        
        //  Sort the cache using the standard JS sort algoritm
        this.aData.sort(function(oItem1, oItem2){
            var i, x;
            
            
            if(oItem1.aCells[iCol].sValue !== oItem2.aCells[iCol].sValue){  //  If the sort column values are different we only compare those
                //  Call comparison function for this column
                x = aCompare[iCol](oItem1.aCells[iCol].sValue, oItem2.aCells[iCol].sValue);
                
                return (bRev ? -x : x);
            }  
            //  If the sort column values are equal we are going to look at other columns starting at the first column
            for(i = 0; i < oItem1.aCells.length; i++){
                if(oItem1.aCells[i].sValue !== oItem2.aCells[i].sValue){
                    x = aCompare[i](oItem1.aCells[i].sValue, oItem2.aCells[i].sValue);
            
                    return (bRev ? -x : x);
                }
            }
            return 0;
        });
        
        return true;
    }
    
    return false;
},

rowIndexByRowId : function(sRowId){
    var i;
    
    for(i = 0; i < this.aData.length; i++){
        if(this.aData[i].sRowId === sRowId){
            return i;
        }
        
    }
    
    return -1;
},

rowIdByRowIndex : function(iRowIndex){
    return (this.aData[iRowIndex] ? this.aData[iRowIndex].sRowId : null);
},

setCurrentRowId : function(sRowId){
    if(this.sCurrentRowId !== sRowId){
        var oOptions = {
            sPrevRowId : this.sCurrentRowId,
            iPrevRowIndex : this.iCurrentRow,
            sGotoRowId : sRowId,
            iGotoRowIndex : this.rowIndexByRowId(sRowId)
        };

        this.sCurrentRowId = oOptions.sGotoRowId;
        this.iCurrentRow = oOptions.iGotoRowIndex;

        this.onRowChange.fire(this, oOptions);
    }
},

updateRow : function(sRowId, tRow){
    var iRow = this.rowIndexByRowId(sRowId);
    if(iRow >= 0){
        this.onBeforeDataUpdate.fire(this);
        
        this.aData[iRow] = tRow;
        
        //  If we are changing the current row we should also update sCurrentRowId, appendNewRow will handle the case where this shouldn't happen (tab from new row into another new row)
        //    Note that sometimes (cell save example) the sCurrentRowId already contains the new rowid.
        if(this.sCurrentRowId === sRowId || this.sCurrentRowId === tRow.sRowId){
            this.sCurrentRowId = tRow.sRowId;
            this.iCurrentRow = iRow;
        }
        
        //this.sortData();    // This would cause issues, if the ordering changes we need a full refresh
        
        this.onDataUpdate.fire(this, { sType : "row",  sUpdateRowId : sRowId, sNewRowId : tRow.sRowId });
    }
},


removeRow : function(sRowId){
    var iRow = this.rowIndexByRowId(sRowId);
    if(iRow >= 0){
        if(this.iCurrentRow > iRow){
            this.iCurrentRow--;
        }
        
        this.aData.splice(iRow, 1);
        
        this.onDataUpdate.fire(this, {
            sType :"remrow",
            sRowId : sRowId,
            iRowIndex : iRow
        });
    }
},

appendRow : function(tRow){
    //  Insert at the end
    this.aData.push(tRow);
    
    if(this.sortData()){
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
    }
    
    this.onDataUpdate.fire(this, {
        sType :"newrow",
        sRowId : tRow.sRowId
    });
},

insertBefore : function(sBeforeRowId, tRow){
    var iBefore = this.rowIndexByRowId(sBeforeRowId);
    
    if(iBefore < 0){
        iBefore = this.aData.length;
    }
    if(iBefore <= this.iCurrentRow){
        this.iCurrentRow++;
    }
     
    this.aData.splice(iBefore, 0, tRow);
     
    if(this.sortData()){
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
    }
    
    this.onDataUpdate.fire(this, {
        sType :"newrow",
        sRowId : tRow.sRowId
    });  
},

insertAfter : function(sAfterRowId, tRow){
    var iAfter = this.rowIndexByRowId(sAfterRowId);

    
    if(iAfter < 0 || iAfter + 1== this.aData.length){
        this.appendRow(tRow);
    }else{
        this.insertBefore(this.aData[iAfter + 1].sRowId, tRow);
    }
},

updateCell : function(oCol, sVal){
    if(this.iCurrentRow >= 0){
        this.onBeforeDataUpdate.fire(this);
        
        this.aData[this.iCurrentRow].aCells[oCol._iColIndex].sValue = sVal;
        //this.sortData();    // This would cause issues, if the ordering changes we need a full refresh
        
        this.onDataUpdate.fire(this, { 
            sType : "cell", 
            sUpdateRowId : this.sCurrentRowId, 
            oCol : oCol
        });
    }
},

updateSorting : function(){
    var oL = this.oL;
    
    if(!this.bPaged && oL.piSortColumn >= 0){
        this.handleData(this.aData, "page", "", true, true);
    }
},

onSettingChange : function(oEv){
    if(oEv.sType === "prop"){
        switch(oEv.sProp){
            case "piSortColumn":
            case "pbReverseOrdering":
                this.updateSorting();
                break;
        }
    }    
    if(oEv.sType === "sorting"){
        this.updateSorting();
    }
}

});