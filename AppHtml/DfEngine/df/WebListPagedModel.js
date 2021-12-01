/*
Class:
    df.WebListPagedModel
Extends:
    df.WebListModel

Extends the model of the WebList its mini MVC system with logic for paged data loading.

Revision:
    2017/02/10  (HW, DAW) 
        Initial version.
*/


df.WebListPagedModel = function WebListPagedModel(oList){
    df.WebListPagedModel.base.constructor.call(this, oList);
    
    this.bFirst = false;
    this.bLast = false;
    this.bPaged = true;
    
    this.iPrefCacheOffset = 25;    //  The preferred amount of rows in the cache above and below the rendered rows

};
df.defineClass("df.WebListPagedModel", "df.WebListModel", {



handleData : function(aRows, sType, sStartRowId, bFirst, bLast){
    var oOptions = { sType : "", iOffsetChange : 0, sUpdateRowId : "" };
        
    this.onBeforeDataUpdate.fire(this);
    
    
    
    if(sType === "page"){
        //  Update cache
        this.aData = aRows;
        this.bLast = bLast;
        this.bFirst = bFirst;
        
        //    Refind current row
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
        
        //    Always select row if there is a row
        if(this.iCurrentRow < 0 && bLast && bFirst){
            if(this.aData.length > 0){
                this.iCurrentRow = 0;
                this.sCurrentRowId = this.aData[0].sRowId;
            }
        }
        
        oOptions.sType = "full";
    }
    
    
    if(sType === "first"){
        //  Update cache
        this.aData = aRows;
        this.bLast = bLast;
        this.bFirst = bFirst;
                            
        //    Refind current row
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
        
        oOptions.sType = "full";
    }
    
    if(sType === "last"){
        //  Update cache
        aRows.reverse();
        this.aData = aRows;
        this.bLast = bLast;
        this.bFirst = bFirst;
                            
        //  Update display
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
        
        oOptions.sType = "full";
    }
    
    if(sType === "next"){
        //  Update cache
        this.aData = this.aData.concat(aRows);
        this.bLast = bLast;
        
        oOptions.sType = "next";
    }
    
    if(sType === "prev"){
        //  Update cache
        aRows.reverse();
        this.aData = aRows.concat(this.aData);
        this.bFirst = bFirst;
        
        oOptions.iOffsetChange = aRows.length;
        oOptions.sType = "prev";
        
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
    }
    
    this.onDataUpdate.fire(this, oOptions);
},

updateSorting : function(){
    //  With paged lists the sorting is always done on the server
},


sortData : function(){
    //    Sorting data always happens on the server when paging data
}



});

