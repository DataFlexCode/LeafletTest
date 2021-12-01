/*
Mixin:
    df.WebGridModel_mixin
Used by:
    df.WebGridModel (df.WebListModel)
    df.WebGridPagedModel (df.WebListPagedModel)

Extends the list model classes with the logic to maintain the current column on top of the current 
row needed by the Grid as it works with a specific edit cell.

Revision:
    2017/02/10  (HW, DAW) 
        Initial version.
*/
df.WebGridModel_mixin = function WebGridModel_mixin(oList){
    this.getBase("df.WebGridModel_mixin").constructor.call(this, oList);
    
    this.iCurrentColumn = oList.piCurrentColumn;
    
    this.onColChange = new df.events.JSHandler();
};
df.defineClass("df.WebGridModel_mixin", {

appendRow : function(tRow){
    //  Check if last row is a new row
    if(this.aData.length > 0 && this.aData[this.aData.length - 1].sRowId === ""){
        //  Insert before the new row
        this.aData.splice(this.aData.length - 1, 0, tRow);
        this.iCurrentRow++;
    }else{
        //  Insert at the end
        this.aData.push(tRow);
    }
    
    if(this.sortData()){
        this.iCurrentRow = this.rowIndexByRowId(this.sCurrentRowId);
    }
    
    this.onDataUpdate.fire(this, {
        sType :"newrow",
        sRowId : tRow.sRowId
    });
}

});

df.WebGridModel = df.mixin("df.WebGridModel_mixin", "df.WebListModel");
df.WebGridPagedModel = df.mixin("df.WebGridModel_mixin", "df.WebListPagedModel");