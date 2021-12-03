/*
Name:
    df.WebTreeView
Type:
    Class

Implementation of the treeview control. This controls is capable of rendering a treeview using HTML 
based on information received from the server.
    
Revisions:
    2009/10/07  (HW, DAE)
        Created the initial version. 
    2012/04/03  (HW, DAW)
        Refactored the original AjaxTreeView and TreeView classes from the AJAX Library into a 
        single WebTreeView class. The new class is part of the new web framework for VDF 17.1.
*/

df.tWebTreeItem = {
    sId             : df.tString,
    sParentId       : df.tString, 
    sName           : df.tString, 
    sAltText        : df.tString, 

    sValue          : df.tString, 
    sCSSClass       : df.tString, 
    sIcon           : df.tString, 
    bFolder         : df.tBool, 
 
    bLoadChildren   : df.tBool, 
    bExpanded       : df.tBool
};

df.WebTreeView = function WebTreeView(sName, oParent){
    df.WebTreeView.base.constructor.call(this, sName, oParent);
    
    //  Web Properties
    this.prop(df.tBool, "pbShowIcons", true);
    this.prop(df.tBool, "pbAllowHtml", false);
    this.prop(df.tString, "psSelectedId", "");
    this.prop(df.tString, "psSelectedValue", "");
    
    //  Events
    this.event("OnSelect", df.cCallModeWait);
    this.event("OnExpand", df.cCallModeDefault);
    this.event("OnCollapse", df.cCallModeDefault);
    
    // @privates
    this._aRootItems = [];
    this._aItems = [];
    this._iAutoNum = 1000;
    this._tSelectedNode = null;
    
    this._bRedraw = false;
    
    this._eRootTable = null;

    this._eCurHoveredElem = null;
    this._fHoverTimeOut = null;
    
    this._sControlClass = "WebTreeView";
};
df.defineClass("df.WebTreeView", "df.WebBaseControl",{

/*
This method generates the wrapping HTML of the treeview. This includes an hidden anchor used for 
receiving and keeping the focus.

@param  aHtml   Stringbuilder array to which the HTML can be added.
@private
*/
openHtml : function(aHtml){
    df.WebTreeView.base.openHtml.call(this, aHtml);
    //aHtml.push('<a href="javascript: void(0);" style="position: absolute; left: -3000px; text-decoration: none;">&nbsp;</a>');
    aHtml.push('<div class="WebTree_Body" style="height: 10px;" ',
        (!this.isEnabled() ? 'tabindex="-1"' : 'tabindex="0"'), '>');
},

/*
This method generates the HTML that closes the wrapping elements of the treeview.

@param  aHtml   Stringbuilder array to which the HTML can be added.
@private
*/
closeHtml : function(aHtml){
    aHtml.push('</div>');
    df.WebTreeView.base.closeHtml.call(this, aHtml);
},

/*
This method gathers references to the HTML elements and attaches DOM listeners.

@private
*/
afterRender : function(){
    var that = this;

    //  Get references
    this._eControl = df.dom.query(this._eElem, 'div.WebTree_Body');
    this._eFocus = this._eControl; //df.dom.query(this._eElem, 'a');
    
    df.WebTreeView.base.afterRender.call(this);
    
    //  Attach event listeners
    df.dom.on("click", this._eControl, this.onBodyClick, this);
    df.dom.on("dblclick", this._eControl, this.onBodyDblClick, this);
    df.events.addDomKeyListener(this._eElem, this.onKey, this);
    
    //  Render the initial tree
    this.redraw();
    setTimeout(function(){
        if(that._tSelectedNode){
            that.scrollToElement(that._tSelectedNode._eElem);
        }
    }, 50);

    setTimeout(function(){
        that.dragDropCleanup();
        that.dragDropInit();
    }, 50);
},

/* 
Augments applyEnabled to set the tabindex attribute of the focus element.

@param  bVal    The enabled state.
*/
applyEnabled : function(bVal){
    df.WebTreeView.base.applyEnabled.call(this, bVal);
    
    if(this._eFocus){
        this._eFocus.tabIndex = (bVal ? 0 : -1);
    }
},


// - - - - - - - - - Public API - - - - - - - - - -

/*
Getter method that determines the currently selected id.

@return The ID of the currently selected node or "" if no node is selected.
*/
get_psSelectedId : function(){
    if(this._tSelectedNode){
        return this._tSelectedNode.sId;
    }
    return "";
},

/*
Getter method that determines the currently selected value.

@return The value of the currently selected node or "" if no node is selected.
*/
get_psSelectedValue : function(){
    if(this._tSelectedNode){
        return this._tSelectedNode.sValue;
    }
    return "";
},


/* 
Setter method for the pbShowIcons property that redraws the tree based on the new setting. 

@param  bVal    New value.
@private
*/
set_pbShowIcons : function(bVal){
    this.pbShowIcons = bVal;
    
    this.redraw();
},

/*
This method selects the node with the passed ID. Nothing happens if the ID is not found which can 
happen because the tree doesn't always load all items.

@param  sNodeId     ID of the tree node.
@client-action
*/
select : function(sNodeId){
    var tNode = this.getNodeById(sNodeId);
    
    if(tNode){
        this.doSelect(tNode, false);
    }
},

/*
This method expands the node with the passed ID. Nothing happens if the ID is not found which can 
happen because the tree doesn't always load all items.

@param  sNodeId     Unique ID of the tree node.
@client-action
*/
expand : function(sNodeId){
    var tNode = this.getNodeById(sNodeId);
    
    if(tNode && tNode.bFolder){
        this.expandNode(tNode);
    }
},

/*
This method collapses the node with the passed ID. Nothing happens if the ID is not found which can 
happen because the tree doesn't always load all items.

@param  sNodeId     Unique ID of the tree node.

@client-action
*/
collapse : function(sNodeId){
    var tNode = this.getNodeById(sNodeId);
    
    if(tNode){
        this.collapseNode(tNode);
    }
},

/*
This method will collapse all nodes.

@client-action
*/
collapseAll : function(){
    var i;

    for(i = 0; i < this._aItems.length; i++){
        if(this._aItems[i].bExpanded){
            this.collapseNode(this._aItems[i]);
        }
    }
    
    //this.redraw();
},

/*
This method refreshes the tree with the tree items encoded in the action data. The action data is a 
two dimensional array that is used for sending 'complex data' with client actions. If a parent id is 
provided then the nodes will be inserted as children of the parent node. If no parent id is provided 
then the entire tree will be cleared and nodes will be inserted at the root of the tree.

@param  sParentId     (optional) Unique ID of the parent tree node.


@client-action
*/
refresh : function(sParentId){
    var i, tNode, aNodes = this.deserializeVT(this._tActionData), sSelectedId;
    
    //  Remeber selected item
    sSelectedId = this._tSelectedNode && (this._tSelectedNode.sId || "");
    if(!sSelectedId && this.psSelectedId){
        sSelectedId = this.psSelectedId;
        this.psSelectedId = "";
    }
    
    if(sParentId){
        //  Remove the sub nodes of the parent node first
        tNode = this.getNodeById(sParentId);
        
        if(tNode){
            while(tNode._aChildren.length > 0){
                this.doRemove(tNode._aChildren[0], true);
            }
        }
    }else{
        //  Clear current tree
        this.clear();
        this.displayLoading();        
    }
    
    for(i = 0; i < aNodes.length; i++){
        tNode = this.initNode(aNodes[i]);
    
        //  No parent id makes it a child of the parent we are loading for (root / "" if loading entire tree)
        if(!tNode.sParentId){
            tNode.sParentId = sParentId || "";
        }

        
        //  Insert
        this.insert(tNode);
    }
    
    //  Try to reselect the selected item
    if(sSelectedId){
        tNode = this.getNodeById(sSelectedId);
        if(tNode){
            this._tSelectedNode = tNode;
        }
    }else{
        this._tSelectedNode = null;
    }
    //  Redraw
    this.redraw();
    this.hideLoading();
},

/*
This method is called to update a node. The node should be sent as client-data (two dimensional 
array). If the node is found using its ID it will be updated and the display will be refreshed.

@client-action
*/
updateNode : function(){
    var tNewNode, tOrigNode, aNodes = this.deserializeVT(this._tActionData);

    if(aNodes.length > 0){
        //  Convert from data to node
        tNewNode = this.initNode(aNodes[0]);
        
        tOrigNode = this.getNodeById(tNewNode.sId);
        
        if(tOrigNode){
            //  Update the node
            tOrigNode.sName         = tNewNode.sName;
            tOrigNode.sAltText      = tNewNode.sAltText;
            tOrigNode.sValue        = tNewNode.sValue;
            tOrigNode.sCSSClass     = tNewNode.sCSSClass;
            tOrigNode.sIcon         = tNewNode.sIcon;
            tOrigNode.bFolder       = tNewNode.bFolder;
            tOrigNode.bLoadChildren = tNewNode.bLoadChildren;
            
            //  Update display
            this.redraw();
        }
    }
},

/*
This method is called to insert a new node. The node should be sent as client-data (two dimensional 
array). 

@client-action
*/
insertNode : function(){
    var tNewNode, aNodes = this.deserializeVT(this._tActionData);

    if(aNodes.length > 0){
        //  Convert from data to node
        tNewNode = this.initNode(aNodes[0]);
        
        this.insert(tNewNode);
        
        this.redraw();
    }
},

/*
This method will remove a node from the tree. If the node is not found then nothing will happen.

@param  sNodeId     The unique id of the node to remove.
@client-action
*/
removeNode : function(sNodeId){
    var tNode = this.getNodeById(sNodeId);
    
    if(tNode){
        this.doRemove(tNode);
        this.redraw();
    }
},


// - - - - - - - - - Engine - - - - - - - - - -

/* 
Generates a deserializer function that deserializes a value tree in an array of tree items with 
optimal performance.

@param  tVT     Value tree with data.
@return Array of tree item objects.
*/
deserializeVT : df.sys.vt.generateDeserializer([ df.tWebTreeItem ]),

/*
This method is called to load the children of tree nodes that are expanded. A server-action is fired 
to the server to load the nodes. The server will call a client-action called addSubItems to pass the 
new items. The node is expanded when finished.

@param  tParentNode     The node of which the child nodes need to be loaded.
@private
*/
loadSubNodes : function(tParentNode){
    var sParentId = "", sParentValue = "", iParentLevel = 0;
    
    //  Display loading and determine call details
    if(tParentNode){
        tParentNode._bIsLoading = true;
        this.displayLoading(tParentNode);
        
        sParentId = tParentNode.sId;
        sParentValue = tParentNode.sValue; 
        iParentLevel = this.getLevel(tParentNode);
    }else{
        this.clear();
        this.displayLoading();        
        
    }
    
    //  Perform the server-action
    this.serverAction("LoadSubNodes", [ sParentId, sParentValue, iParentLevel ], null, function(oEvent){
        //  Update the parent node
        if(tParentNode){
            tParentNode._bIsLoading = false;
            this.updateNodeCSS(tParentNode);
        }
        
        //  Expand the node or redraw the tree
        if(!oEvent.bError){
            if(tParentNode){
                tParentNode._bIsLoaded = true;
                this.expandNode(tParentNode);
            }else{
                this.redraw();
            }
        }
        
        //  Hide loading
        this.hideLoading(tParentNode);
    }, this);
},

/*
This client-action is called by the LoadSubNodes server-action to insert new nodes. The nodes will 
be encoded into the action data (two dimensional array). The new nodes will be initialized and 
inserted into the tree.

@param  sParentId   Unique ID of the parent node indicating where to insert the ndoes.

@client-action
@private
*/
addSubItems : function(sParentId){
    var i, tNode, aNodes = this.deserializeVT(this._tActionData);
    
    for(i = 0; i < aNodes.length; i++){
        tNode = this.initNode(aNodes[i]);
    
        //  No parent id makes it a child of the parent we are loading for (root / "" if loading entire tree)
        if(!tNode.sParentId){
            tNode.sParentId = sParentId || "";
        }

        
        //  Insert
        this.insert(tNode);
    }
},

/*
This method initializes a new node based on the passed raw data. The raw data is an array which 
represents the node. This array is used when sending nodes from the server to client.

@param  aRaw     Raw array representing the node.
@return Node object.
@private
*/
initNode : function(tNode){

    tNode._aChildren      = [];
    tNode._tParent        = null;
    tNode._eElem          = null;
    tNode._eSubMenuRow    = null;
    tNode._eSubMenuTable  = null;

    tNode._bIsLoading     = false;
    tNode._bIsLoaded      = tNode.bExpanded; // Assume that if an item is expanded its sub nodes are provided
    
    
    //  Autonumber if needed
    if(!tNode.sId){
        this._iAutoNum++;
        tNode.sId = this._iAutoNum.toString();
    }
    
    
    
    return tNode;
},

/*
The node will be inserted into the tree based on its settings. If no (correct) 
parent ID is found it will be added to the root. The display won't be updated so 
the refresh method should be called.

@param  tNode   New node (see: df.dataStructs.TAjaxTreeNode).
*/
insert : function(tNode){
    var tParent;

    //  Check if item doesn't already exist
    if(this.getNodeById(tNode.sId)){
        throw new df.Error(5151, "Node IDs must be unique (ID: '{{0}}')", this, [ tNode.sId ]);
    }
    
    //  Search for parent
    if(tNode.sParentId){
        tParent = this.getNodeById(tNode.sParentId);
    }
    
    //  Add to its parent
    if(tParent){
        tNode._tParent = tParent;
        tParent._aChildren.push(tNode);
    }else{
        this._aRootItems.push(tNode);
    }
    
    //  Add to the full item list
    this._aItems.push(tNode);
},

/*
All the nodes will be removed from the tree. The display is updated.
*/
clear : function(){
    var i;

    if(this._eRootTable){
        this._eControl.removeChild(this._eRootTable);
        
        for(i = 0; i < this._aItems.length; i++){
            if(this._aItems[i]._eElem){
                this._aItems[i]._eElem.tNode = null;
            }
            this._aItems[i]._eElem = null;
            this._aItems[i]._eSubMenuRow = null;
            this._aItems[i]._eSubMenuTable = null;
        }
    }
    
    this._tSelectedNode = null;
    this._aItems = [];
    this._aRootItems = [];
    
    if(this._eControl){
        this._eRootTable = this.constructTable();
        this._eControl.appendChild(this._eRootTable);
    }
},

/*
Updates the display based on the internal node structure. Newly inserted nodes 
will be displayed correctly. Expanded items stay expanded and the selected node 
will still be selected.
*/
redraw : function(){
    var i;
    
    if(this._eControl){
        this._bRedraw = true;
        
        if(this._eRootTable){
            this._eControl.removeChild(this._eRootTable);
            
            for(i = 0; i < this._aItems.length; i++){
                this._aItems[i]._eElem = null;
                this._aItems[i]._eSubMenuRow = null;
                this._aItems[i]._eSubMenuTable = null;
            }
        }
        this._eRootTable = this.constructTable();
        
        this.constructMenu(this._aRootItems, this._eRootTable);
        
        this._eControl.appendChild(this._eRootTable);
        
        this._bRedraw = false;
    }
},

/*
Constructs a tree table (root or subitems).

@private
*/
constructTable : function(){
    var eTable = document.createElement("table");
    
    return eTable;
},

/*
Constructs a node row at the given position in the table.

@param  tNode       Node struct.
@param  eTable      Table element to which the node row needs to be added.
@param  iPos        Position in the table.
@param  bIsStart    True if the node is the first node on his level.
@param  bIsLast     True if the node is the last node on his level.
@private
*/
constructNode : function(tNode, eTable, iPos, bIsStart, bIsLast){
    var bDoSub, eRow, eCell, sName;
    
    //  Determine if node has sub menu
    bDoSub = tNode._aChildren.length > 0 || tNode.bLoadChildren;
    
    //  Create row
    eRow = eTable.insertRow(iPos);
    eRow.setAttribute("data-dftree-id", tNode.sId);
    if (this.pbDragDropEnabled) {
        if (tNode.bFolder) {
            if (this.isSupportedDragAction(df.dragActions.WebTreeView.ciDragFolder)) {
                eRow.setAttribute('draggable', true);
            }
        } else {
            if (this.isSupportedDragAction(df.dragActions.WebTreeView.ciDragItem)) {
                eRow.setAttribute('draggable', true);
            } 
        }
        
    }
    tNode._eElem = eRow;
    
    //  Tree cell
    eCell = eRow.insertCell(0);
    eCell.innerHTML = "<div>&nbsp;</div>";
    
    //  Content cell
    eCell = eRow.insertCell(eRow.cells.length);
    
    //  Text span
    sName = (this.pbAllowHtml ? tNode.sName : df.dom.encodeHtml(tNode.sName));
    eCell.innerHTML = '<span class="WebTree_Text" title="' + df.dom.encodeAttr(tNode.sAltText) + '">' + sName + '</span>';
    
    this.updateNodeCSS(tNode);
    
    //  Add listener(s)
    if(bDoSub){
        // df.dom.on("click", eRow, this.onExpandClick, this);
        
        if(tNode.bExpanded){
            iPos++;
            this.constructSubmenu(tNode, eTable, iPos, bIsLast);
        }
    }
    
    return iPos;
},

/*
Generates the DOM elements for the given list of nodes on the given table.

@param  aNodes  Array with nodes.
@param  eTable  Table element.
@private
*/
constructMenu : function(aNodes, eTable){
    var iNode, iPos = 0;

    for(iNode = 0; iNode < aNodes.length; iNode++){
        iPos = this.constructNode(aNodes[iNode], eTable, iPos, (iNode === 0 && eTable === this.eRootTable), (iNode === aNodes.length - 1));
        iPos++;
    }
},

/*
Constructs the submenu that belongs to the given node.

@param  tNode       Node element.
@param  eTable      Table element in which the node is located.
@param  iPos        Position to generate submenu on.
@param  bIsLast     Determines wether the node is the last on this level.
@private
*/
constructSubmenu : function(tNode, eTable, iPos, bIsLast){
    var eRow, eCell, eNewTable;

    eRow = eTable.insertRow(iPos);
    eRow.className = "WebTree_SubRow" + (!this._bRedraw ? " WebTree_HiddenSubRow" : "");

    eCell = eRow.insertCell(0);
    eCell.className = (bIsLast ? "WebTree_ConLast" : "WebTree_Con");
    
    eCell = eRow.insertCell(1);
    eCell.innerHTML = "<table></table>";
    
    eNewTable = df.dom.query(eCell, "table"); //this.constructTable();
    
    tNode._eSubMenuRow = eRow;
    tNode._eSubMenuTable = eNewTable;
    
    this.constructMenu(tNode._aChildren, eNewTable, false);
    
    //  Make visible after small timeout for possible animation
    if(!this._bRedraw){
        setTimeout(function(){
            if(tNode._eSubMenuRow){
                df.dom.removeClass(tNode._eSubMenuRow, "WebTree_HiddenSubRow");
            }
        }, 20);
    }
},

/*
Redefines the CSS classes set on the node elements.

@private
*/
updateNodeCSS : function(tNode){
    var bFirst, bLast, bRoot, bSub, eCell;

    if(tNode._eElem){
        //  Update node CSS
        tNode._eElem.className = (tNode.bExpanded ? "WebTree_Expanded" :  "WebTree_Collapsed") + (tNode === this._tSelectedNode ? " WebTree_Selected" : "") + " " +  tNode.sCSSClass;

        bFirst = this.isFirst(tNode);
        bLast = this.isLast(tNode);
        bRoot = this.isRoot(tNode);
        bSub = this.hasChildren(tNode);
        
        tNode._eElem.cells[0].className = "WebTree_Item WebTree_" + ((bFirst && bRoot) || bLast ? (bFirst && bRoot ? "Start" : "") + (bLast ? "End" : "") : "Entry") + (bSub ? "Sub" : "");
        
        if(this.pbShowIcons){
            eCell = tNode._eElem.cells[1];
            
            if(tNode.sIcon && !tNode._bIsLoading){
                eCell.style.backgroundImage = "url('" + tNode.sIcon + "')";
                eCell.style.backgroundRepeat = "no-repeat";
                eCell.className = (tNode.bFolder ? "WebTree_Folder " : "WebTree_Icon ") + "WebTree_HasIcon";
            }else{
                eCell.className = (tNode._bIsLoading ? "WebTree_IconLoading " : "WebTree_NoIcon ") + (tNode.bFolder ? "WebTree_Folder " : "WebTree_Icon ");
                eCell.style.backgroundImage = "";
                //  FIX: Internet Explorer 8 won't go back to CSS setting, this can cause problems when dynamically changing the icon at runtime
                // eCell.style.backgroundPosition = "";
            }
        }
    }
},

// - - - - - - - Navigation - - - - - - - - -

/*
If the node is expanded it will be collapsed or the other way around.

@param  tNode   Node to toggle (see: df.dataStructs.TAjaxTreeNode).
*/
toggle : function(tNode){
    if(tNode.bExpanded){
        this.collapseNode(tNode);
    }else{
        this.expandNode(tNode);
    }
},

/*
The node will be expanded.

@param  tNode   Node to expand (see: df.dataStructs.TAjaxTreeNode).
*/
expandNode : function(tNode){
    tNode.bExpanded = true;
    
    if(tNode._bIsLoading){
        return;
    }
    
    this.fire("OnExpand", [ tNode.sId, tNode.sValue, this.getLevel(tNode) ]);
    
    if(!tNode._bIsLoaded && tNode.bLoadChildren){
        this.loadSubNodes(tNode);
    }else{
        if(tNode._eElem){
            if(tNode._eSubMenuRow){ //  Unhide if DOM elements are already there
                //   Display by removing CSS class (so a CSS3 transition can be used for animation)
                df.dom.removeClass(tNode._eSubMenuRow, "WebTree_HiddenSubRow");
            }else{  //  Generate DOM elements
                this.constructSubmenu(tNode, (tNode._tParent ? tNode._tParent._eSubMenuTable : this._eRootTable), tNode._eElem.rowIndex + 1, this.isLast(tNode));
            }
        }
        
        this.updateNodeCSS(tNode);
    }
},

/*
The node will be collapsed.

@param  tNode   Node to toggle (see: df.dataStructs.TAjaxTreeNode).
*/
collapseNode : function(tNode){
    tNode.bExpanded = false;
    
    this.fire("OnCollapse", [ tNode.sId, tNode.sValue, this.getLevel(tNode) ]);
    
    if(tNode._eSubMenuRow){ 
       //   Hide by setting CSS class (so a CSS3 transition can be used for animation)
       df.dom.addClass(tNode._eSubMenuRow, "WebTree_HiddenSubRow");
    }
    
    //  If the selected item is now hidden we select the collapsed one
    if(this.isParent(this._tSelectedNode, tNode)){
        while(tNode && !this.doSelect(tNode)){
            tNode = tNode._tParent;
        }
    }
    
    this.updateNodeCSS(tNode);
},

/*
The node above the currently selected node will be selected.
*/
moveUp : function(){
    var aList, iPos, tNode;
    
    if(this._tSelectedNode){
        tNode = this._tSelectedNode;
        iPos = this.getPosition(tNode);
        if(iPos > 0){   //  Select the previous node on this level
            aList = (tNode._tParent ? tNode._tParent._aChildren : this._aRootItems);
            
            //  If this node is expanded move down till the last end node
            tNode = aList[iPos - 1];
            while(tNode.bExpanded && tNode._aChildren.length > 0){
                tNode = tNode._aChildren[tNode._aChildren.length - 1];
            }
            
            this.doSelect(tNode);
            }else{  //  Select the parent if available
            if(tNode._tParent){
                this.doSelect(tNode._tParent);
            }
        }
    }
},

/*
The node below the currently selected node will be selected.
*/
moveDown : function(){
    var tNode, aList, iPos;
    
    if(this._tSelectedNode){
        tNode = this._tSelectedNode;
        if(tNode.bExpanded && tNode._aChildren.length > 0){  //  Select the first child
            this.doSelect(tNode._aChildren[0]);
        }else{  
            while(tNode){   //  Keep on moving levels up until a next node on the level is available or the root is reached
                aList = (tNode._tParent ? tNode._tParent._aChildren : this._aRootItems);
                iPos = this.getPosition(tNode);
            
                if(iPos < aList.length - 1){
                    this.doSelect(aList[iPos + 1]);
                    break;
                }else{
                    tNode = tNode._tParent;
                }
            }
        }
    }else if(this._aRootItems.length > 0){
        this.doSelect(this._aRootItems[0]);
    }

},

/*
The currently selected node will be collapsed. 
*/
doCollapse : function(){
    var tNode;
    
    if(this._tSelectedNode){
        tNode = this._tSelectedNode;
        
        if(tNode.bExpanded && this.hasChildren(tNode)){
            this.collapseNode(tNode);
        }else{
            if(tNode._tParent){
                this.doSelect(tNode._tParent);
            }
        }
    }
},

/*
The currently selected node will be extended.
*/
doExpand : function(){
    var tNode;
    
    if(this._tSelectedNode){
        tNode = this._tSelectedNode;
        
        if(!tNode.bExpanded && this.hasChildren(tNode)){
            this.expandNode(tNode);
        }else{
            if(tNode._aChildren.length > 0){
                this.doSelect(tNode._aChildren[0]);
            }
        }
    }else if(this._aRootItems.length > 0){
        this.doSelect(this._aRootItems[0]);
    }
},

/*
The first node will be selected.
*/
moveFirst : function(){
    if(this._aRootItems.length > 0){
        this.doSelect(this._aRootItems[0]);
    }
},

/*
The last node will be selected.
*/
moveLast : function(){
    var tNode;
    
    if(this._aRootItems.length > 0){
        tNode = this._aRootItems[this._aRootItems.length - 1];
        
        while(tNode.bExpanded && tNode._aChildren.length > 0){
            tNode = tNode._aChildren[tNode._aChildren.length - 1];
        }
        
        this.doSelect(tNode);
    }
},

/*
This method will select the node that is passed.

@param  tNode           Node to select.
@param  bOptNoOnSelect  If true the OnSelect event is not fired.
@return True if the node was successfully selected.
*/
doSelect : function(tNode, bOptNoOnSelect){
    var tPrevSelected, bChanged;
    
    //  When the selection changes then psSelectedId and psSelectedValue become synchronized
    this.addSync("psSelectedId");
    this.addSync("psSelectedValue");
    
    tPrevSelected = this._tSelectedNode;

    //  Select the new node
    this._tSelectedNode = tNode;
    bChanged = (this.psSelectedId !== tNode.sId);
    this.psSelectedId = tNode.sId;
    
    if(tPrevSelected){
        this.updateNodeCSS(tPrevSelected);
    }
    this.updateNodeCSS(tNode);
    
    if(tNode._eElem){
        this.scrollToElement(tNode._eElem);
    }
    
    if(!bOptNoOnSelect && bChanged){
        this.fire("OnSelect", [ tNode.sId, tNode.sValue, this.getLevel(tNode) ]);
    }
    
    return true;
},

doRemove : function(tNode, bOptNoSelect){
    var i, aList, bSelect = false;

    function removeSub(tNode){
        //  Move into subnodes
        while(tNode._aChildren.length > 0){
            removeSub.call(this, tNode._aChildren.pop());
        }
        
        tNode._eElem = null;
        tNode._eSubMenuRow = null;
        tNode._eSubMenuTable = null;
        
        //  De-select if it is the selected node
        if(tNode === this._tSelectedNode){
            this._tSelectedNode = null;
            bSelect = true;
        }
        
        //  Remove from global list
        df.sys.data.removeFromArray(this._aItems, tNode);
    }
    
    removeSub.call(this, tNode);
    
    
    //  Remove from tree
    aList = (tNode._tParent ? tNode._tParent._aChildren : this._aRootItems);
    if(aList){
        //  Remove from structure
        for(i = 0; i < aList.length; i++){
            if(aList[i] === tNode){
                aList.splice(i, 1);
                break;
            }
        }
    }
    
    //  Reselect a node if needed
    if(bSelect && !bOptNoSelect){
        if(aList && aList.length > 0){
            this.doSelect(aList[i] || aList[i - 1]);
        }else{
            this.doSelect(tNode._tParent || this._aItems[0]);
        }
    }

},

// - - - - - - - Tree functions - - - - - - - -

/*
Determines the position of the nod on its level.

@param  tNode   Node
@return Position of the node on its level (-1 if not in the structure).
@private
*/
getPosition : function(tNode){
    var aList, iPos;
    
    aList = (tNode._tParent ? tNode._tParent._aChildren : this._aRootItems);
    
    for(iPos = 0; iPos < aList.length; iPos++){
        if(aList[iPos] === tNode){
            return iPos;
        }
    }
    
    return -1;
},

/*
Determines if the node is the last of its level.

@param  tNode   Node
@return True if the node is the last.
@private
*/
isLast : function(tNode){
    var aList = (tNode._tParent ? tNode._tParent._aChildren : this._aRootItems);
    
    return (aList[aList.length - 1] === tNode);
},

/*
Determines if the node is the first of its level.

@param  tNode   Node
@return True if the node is the first.
@private
*/
isFirst : function(tNode){
    var aList = (tNode._tParent ? tNode._tParent._aChildren : this._aRootItems);
    
    return (aList[0] === tNode);
},

/*
Determines if the node is in the root of the tree.

@param  tNode   Node
@return True if the node is in the root.
@private
*/
isRoot : function(tNode){
    return (tNode._tParent ? false : true);
},

/*
Determines if the node is a child of the parent node.

@param  tNode   Node.
@param  tParent Parent to determine.
@returns    True if the parent is a parent of the child.
@private
*/
isParent : function(tNode, tParent){
    while(tNode){
        if(tNode === tParent){
            return true;
        }
        
        tNode = tNode._tParent;
    }

    return false;
},

/*
Determines the level of the node in the tree.

@param  tNode   Node.
@return Level (first level is 1).
@private
*/
getLevel : function(tNode){
    var iLevel = 1;
    
    while(tNode._tParent){
        iLevel++;
        tNode = tNode._tParent;
    }
    
    return iLevel;
},

/*
Can be used to obtain a reference to a node struct.

@param  sNodeId     Unique ID of the node.
@return Reference to the node struct (see: df.dataStructs.TAjaxTreeNode).
*/
getNodeById : function(sNodeId){
    var i;

    for(i = 0; i < this._aItems.length; i++){
        if(this._aItems[i].sId === sNodeId){
            return this._aItems[i];
        }
    }
    
    return null;
},

/*
Determines if the node has children.

@param  tNode   Node
@return True if the node has children.
@private
*/
hasChildren : function(tNode){
    return (tNode.bLoadChildren && !tNode._bIsLoaded) || tNode._aChildren.length > 0;
},

// - - - - - - - Supportive - - - - - - - -

/*
Scrolls to the element if the

@private
*/
scrollToElement : function(eElem){
    var iTop, oElem, oDiv;
    
    oElem = df.sys.gui.getAbsoluteOffset(eElem);
    oDiv = df.sys.gui.getAbsoluteOffset(this._eControl);
    
    iTop = oElem.top - oDiv.top;
    
    if(iTop < this._eControl.scrollTop){
        this._eControl.scrollTop = iTop;
    }else if(iTop + eElem.offsetHeight > this._eControl.scrollTop + this._eControl.clientHeight){
        this._eControl.scrollTop = iTop + eElem.offsetHeight - this._eControl.clientHeight;
    }
},

/*
This method handles the onclick event of the body. It first determines which tree item is clicked 
and it makes a difference between clicking the expand / collapse button or the item itself. With 
that information it will expand / collapse and / or select the tree item.

@param  oEvent  The event object (see: df.events.DOMEvent).
@private
*/
onBodyClick : function(oEvent){
    var sNodeId = null, bSelect = true, tNode, eElem = oEvent.getTarget();
    
    if(this.isEnabled()){
        //  Bubble up in the DOM finding the Node ID and checking if text or tree is clicked
        while(eElem && !sNodeId && eElem !== this._eElem){
            if(eElem.className.indexOf("WebTree_Item") >= 0){
                bSelect = false;
            }
            
            sNodeId = eElem.getAttribute("data-dftree-id");
            
            eElem = eElem.parentNode;
        }
        
        //  Get node object
        tNode = this.getNodeById(sNodeId);
        
        if(tNode){
            if(bSelect){
                //  Select and expand
                if(this._tSelectedNode !== tNode){
                    // this.returnFocus();
                    //  Expand the node if we want to
                    if(!tNode.bExpanded && this.hasChildren(tNode)){
                        this.expandNode(tNode);
                    }
                    
                    this.doSelect(tNode);
                }else{
                    this.toggle(tNode);
                }
            
            }else{
                //  Switch expanded
                this.toggle(tNode);
                
                
            }
            
            oEvent.stop();
        }
        
        this.focus();
    }
},

onBodyDblClick : function(oEvent){
    var sNodeId = null, tNode, eElem = oEvent.getTarget();
    
    if(this.isEnabled()){

        //  Bubble up in the DOM finding the Node ID and checking if text or tree is clicked
        while(eElem && !sNodeId && eElem !== this._eElem){
            sNodeId = eElem.getAttribute("data-dftree-id");
            
            eElem = eElem.parentNode;
        }
        
        //  Get node object
        tNode = this.getNodeById(sNodeId);
        
        if(tNode){
            if(this.fireSubmit()){
                oEvent.stop();
            }
        }
    }
},

/*
Handles the keypress event of the hidden focus anchor. Compares the event 
details to the oKeyActions and executes the action if a match is found.

@param  oEvent  Event object.
@private
*/
onKey : function(oEvent){
    if(this.isEnabled()){
    
        if(oEvent.matchKey(df.settings.treeKeys.moveUp)){ 
            this.moveUp();
            oEvent.stop();
        }else if(oEvent.matchKey(df.settings.treeKeys.moveDown)){ 
            this.moveDown();
            oEvent.stop();
        }else if(oEvent.matchKey(df.settings.treeKeys.collapse)){ 
            this.doCollapse();
            oEvent.stop();
        }else if(oEvent.matchKey(df.settings.treeKeys.extend)){ 
            this.doExpand();
            oEvent.stop();
        }else if(oEvent.matchKey(df.settings.treeKeys.moveFirst)){ 
            this.moveFirst();
            oEvent.stop();
        }else if(oEvent.matchKey(df.settings.treeKeys.moveLast)){ 
            this.moveLast();
            oEvent.stop();
        }else if(oEvent.matchKey(df.settings.treeKeys.enter)){
            if(this.fireSubmit()){
                oEvent.stop();
            }
        }
    }
},

/*
Updates the node CSS and if null is received globally display loading.

@param  tNode   Node struct.
@private
*/
displayLoading : function(tNode){
    if(tNode){
        this.updateNodeCSS(tNode);
    }else{
        if(this._eControl){
            df.dom.addClass(this._eControl, "WebTree_Loading");
        }
    }    
},

/*
Updates the node CSS and if null is received globally hide loading.

@param  tNode   Node struct.
@private
*/
hideLoading : function(tNode){
    if(tNode){
        this.updateNodeCSS(tNode);
    }else{
        if(this._eControl){
            df.dom.removeClass(this._eControl, "WebTree_Loading");
        }
    }
},


// - - - - - - - Focus - - - - - - -

/*
We override the focus method and make it give the focus to the hidden focus holder element.

@return True if the List can take the focus.
*/
focus : function(){
    if(this._bFocusAble && this.isEnabled() && this._eFocus){
        this._eFocus.focus();
        
        this.objFocus();
        return true;
    }
    
    return false;
},

/*
Augments the onFocus event handler and cancel the blurring. This is because the focus can switch 
between elements within the treeview and we don't want that to cause a blur event.

@param oEvent   Event object.
@private
*/
onFocus : function(oEvent){
    df.WebTreeView.base.onFocus.call(this, oEvent);
    this._bLozingFocus = false;
},

/*
Augments the blur event and adds a little timeout before forwarding it. If we receive a focus event 
within timeout we do not forward it because is a focus change within the treeview itself.

@param  oEvent  Event object.
@private
*/
onBlur : function(oEvent){
    var that = this;
    
    this._bLozingFocus = true;
    
    setTimeout(function(){

        if(that._bLozingFocus){
            df.WebTreeView.base.onBlur.call(that, oEvent);
            
            that._bLozingFocus = false;
        }
    }, 100);
},

// WebUIContext

determineSelectorForWebUIContext : function (eContext) {
    switch (eContext) {
        case df.WebUIContext.WebUIContextTreeviewFolder:
        case df.WebUIContext.WebUIContextTreeviewItem:
            return "tr[data-dftree-id]";
    }
    return null;
},

verifyElementForWebUIContext : function (eElem, eContext) {
    switch (eContext) {
        case df.WebUIContext.WebUIContextTreeviewFolder: 
        case df.WebUIContext.WebUIContextTreeviewItem: {
            if (!eElem.hasAttribute('data-dftree-id')) return false;

            const iItemId = eElem.getAttribute("data-dftree-id");
            const hItem = this.getNodeById(iItemId);
            return  ((hItem.bFolder && eContext === df.WebUIContext.WebUIContextTreeviewFolder) ||
                    (!hItem.bFolder && eContext === df.WebUIContext.WebUIContextTreeviewItem));
        }
    }
    return true;
},

retrieveValueFromWebUIContext : function (eElem, eContext) {
    switch (eContext) {
        case df.WebUIContext.WebUIContextTreeviewFolder:
        case df.WebUIContext.WebUIContextTreeviewItem:  {
            if (!eElem.hasAttribute('data-dftree-id')) 
                break;
            return eElem.getAttribute('data-dftree-id')
        }
    }
    return null;
},

// === Drag & Drop ===

getDragData : function (oEv, eDraggedElem) {
    try {
        const itemId = eDraggedElem.getAttribute("data-dftree-id") || -1;
        let item, eAction;

        if (itemId && itemId != -1 && (itemId != '' || itemId >= 0)) {
            // Destructure object to create a clone, then remove any privates (prevent circular json error)
            item = {...this.getNodeById(itemId)};
            
            Object.keys(item).forEach(function(key){
                key.indexOf("_") == 0 && delete item[key];
            });

            if (item.bFolder) { 
                eAction = df.dragActions.WebTreeView.ciDragFolder;
            } else {
                eAction = df.dragActions.WebTreeView.ciDragItem;
            }
        }
        return [{data : item}, eAction]
    } catch (err) {
        // This can happen if the drag action is not supported, we don't want a nasty error if so.
        console.error("Attempt to perform unsupported drag action");
        return [null, null];
    }
},

getDropData : function (oDropZone, oPosition) {
    if (oDropZone && oDropZone._eDropElem) {
        const itemId = oDropZone._eDropElem.getAttribute("data-dftree-id") || -1;
        let item, eAction;

        if (itemId && itemId != -1 && (itemId != '' || itemId >= 0)) {
            // Destructure object to create a clone, then remove any privates (prevent circular json error)
            item = {...this.getNodeById(itemId)};
            
            Object.keys(item).forEach(function(key){
                key.indexOf("_") == 0 && delete item[key];
            });

            if (item.bFolder) { 
                eAction = df.dropActions.WebTreeView.ciDropOnFolder;
            } else {
                eAction = df.dropActions.WebTreeView.ciDropOnItem;
            }
        }

        const dropData = {
            data : item,
            action : eAction
        }

        return dropData;
    }
    return null;
},

initDraggableElements : function() {
    // because not all nodes / items are present at initialisation
    // setting draggable="true" is done constructNode
    // HR: Not sure if this is still needed
},

initDropZones : function () {
    this._aDropZones = [];

    if (this.isSupportedDropAction(df.dropActions.WebTreeView.ciDropOnFolder) || 
        this.isSupportedDropAction(df.dropActions.WebTreeView.ciDropOnItem)) {
            
        // Mark entire tree body as drop zone
        const eZone = (df.dom.query(this._eElem, '.WebTree_Body'));
        this.addDropZone(eZone);
    }
},

determineDropCandidate : function(oEv, aHelpers) {
    let eElem = document.elementFromPoint(oEv.e.x, oEv.e.y);

    if(this._eElem.contains(eElem)){
        while (eElem != this._eElem) {
            if (eElem.hasAttribute('data-dftree-id')) {
                let id = eElem.getAttribute('data-dftree-id');
                let item = this.getNodeById(id);
                if (item.bFolder) {
                    for (let i = 0; i < aHelpers.length; i++) {
                        if (aHelpers[i].supportsDropAction(this, df.dropActions.WebTreeView.ciDropOnFolder)) {
                            return [eElem, df.dropActions.WebTreeView.ciDropOnFolder];
                        }
                    }
                } else {
                    for (let i = 0; i < aHelpers.length; i++) {
                        if (aHelpers[i].supportsDropAction(this, df.dropActions.WebTreeView.ciDropOnItem)) {
                            return [eElem, df.dropActions.WebTreeView.ciDropOnItem];
                        }
                    }
                }      
            }
            eElem = eElem.parentNode;
        }
    }

    return [null, null];
},

determineDropPosition : function(oEv, eElem) {
    return df.dropPositions.ciDropOn;
},

doEmptyInteraction : function(dropZone) {
    // Insert empty tree item...

    return df.dropActions.ciDropOnRoot;
},

onControlDragOver : function (oEv, oDropZone, eDropElem) {
    // After 1 second, expand the currently hovered node
    if (eDropElem != this._eCurHoveredElem) {
        this._eCurHoveredElem = eDropElem;

        clearTimeout(this._fHoverTimeOut);

        if (this._eCurHoveredElem) {
            this._fHoverTimeOut = setTimeout(() => {
                this.expand(this._eCurHoveredElem.getAttribute('data-dftree-id'));
            }, 1000);
        }
    }
},

hasData : function () {
    return (this._aItems && this._aItems.length > 0);
},

});