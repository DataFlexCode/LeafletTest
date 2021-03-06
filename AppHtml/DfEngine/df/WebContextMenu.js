/*
Class:
    df.WebContextMenu
Extends:
    df.WebFloatingPanel

This class represents a context menu that comes in place of the default context menu.
It can be filled like any cWebMenuList/CommandBar and uses a floating panel underneath.
    
Revision:
    2021/10/13  (BN, DAW)
        Initial Version.
*/
/* global df */

df.WebContextMenu = function WebContextMenu(sName, oParent){
    df.WebContextMenu.base.constructor.call(this, sName, oParent);

    this.prop(df.tInt, "piMaxHeight", 500);

    this.prop(df.tString, "psControlName", "");
    this.prop(df.tString, "psContextCSSSelector", "");

    this.prop(df.tInt, "peContext", df.WebUIContext.WebUIContextCustom);
    this.prop(df.tString, "psContextValue", "");

    // WebBaseMenu_Mixin.
    this.prop(df.tBool, "pbAllowHtml");
    this.prop(df.tString, "psGroupName");
    this.prop(df.tBool, "pbShowIcons", false);
    
    this.addSync("psContextCSSSelector");
    this.addSync("psContextValue");

    this.event("OnContextMenuOpen", df.cCallModeDefault, "privateOnContextMenuOpen");
    this.event("OnItemClick");

    this.pePosition = df.fpFloatFixed;
    this.piWidth = 200;
    this.piHeight = -1;
    this.piColumnCount = 1;
    this.pbHideOnEscape = true;
    
    this._bIsMenuProv = true;

    this._oRootControl = null;
    this._bRendered = false;
    this._oMenu = null;             // Is the handle to the generated cWebMenuList.
    this._oChildrenCache = [];      // Nessesary cache for the proxying of webchildren.
}
df.defineClass("df.WebContextMenu", "df.WebFloatingPanel", {

    set_psControlName : function (sControlName, bForceInit) {
        if (this.psControlName !== sControlName || bForceInit) {
            this.unbind();

            this.psControlName = sControlName;

            if (this.psControlName === "window") {
                this._oRootControl = { _eElem: document.documentElement };
            } else if (this.psControlName.length > 0) {
                this._oRootControl = this.getWebApp().findObj(this.psControlName);
            } else {
                throw new df.Error(999, "WebContextMenu requires either a set psControlName or a phoControl; if you wish to use the whole window, use the psControlName 'window'.");
            }

            if (!this._oRootControl)
                throw new df.Error(999, "WebContextMenu could not find the RootControl.");

            this.bind();
        }
    },

    set_peContext : function (eContext) {
        if (this.peContext !== eContext) {
            this.unbind();

            this.peContext = eContext;
            
            this.bind();
        }
    },

    set_psContextCSSSelector : function (sContextCSSSelector) {
        // Only update if the peContext is set to custom.
        if (this.psContextCSSSelector !== sContextCSSSelector && 
            this.peContext === df.WebUIContext.WebUIContextCustom) {
            this.unbind();

            this.psContextCSSSelector = sContextCSSSelector;
            
            this.bind();
        }
    },

    ////////////////////////////////////////////////////////////////
    // cWebBaseMenu_Mixin Proxies //////////////////////////////////
    ////////////////////////////////////////////////////////////////

    set_pbShowIcons : function (bVal) {
        this._oMenu?.set_pbShowIcons(this.pbShowIcons = bVal);
    },

    set_psGroupName : function(sVal){
        this._oMenu?.set_psGroupName(this.psGroupName = sVal);
    },
    
    set_pbAllowHtml : function(bVal) {
        this._oMenu?.set_pbAllowHtml(this.pbAllowHtml = bVal);
    },

    refresh : function() {
        if (this._oMenu) {
            this._oMenu._tActionData = this._tActionData;
            this._oMenu.refresh();
            this._oMenu._tActionData = null;
        }
    },
    
    updateItem : function(sId, bOverwriteSubs){
        if (this._oMenu) {
            this._oMenu._tActionData = this._tActionData;
            this._oMenu.updateItem(sId, bOverwriteSubs);
            this._oMenu._tActionData = null;
        }
    },
    
    insertItem : function(sParentId) {
        if (this._oMenu) {
            this._oMenu._tActionData = this._tActionData;
            this._oMenu.insertItem(sParentId);
            this._oMenu._tActionData = null;
        }
    },
    
    removeItem : function(sId) {
        this._oMenu?.removeItem(sId);
    },

    notifyChange : function() {
        this._oMenu?.notifyChange();
    },

    // Clears the menu cache and rerenders it.
    refreshMenu : function () {
        if (this._oMenu) {
            this._oMenu._aMenu = null;
            this._oMenu.refreshMenu();
        }
    },

    collapseAll : function () {
        this._oMenu?.collapseAll();
    },

    // Interface by the cWebMenuList that makes the floating panel hide after a click inside.
    hideMenu : function () {
        this.hide();
    },

    ////////////////////////////////////////////////////////////////

    create : function(){
        // Set the psControlName to the default value, if it is not null.
        if (this.psControlName.length > 0) 
            this.set_psControlName(this.psControlName, true);

        // Let's create our weblist.
        this._oMenu = new df.WebMenuList("MenuList", this);
        this._oMenu.objFocus = function() { // Please don't touch me!!!
            return;
        };
        this._oMenu._oMenuBtn = this;
        this._oMenu.pbShowCaption = false;
        this._oMenu.pbShowBackItem = true;
        this._oMenu.pbShowIcons = this.pbShowIcons;

        var that = this;
        this._oMenu.getMenuHeight = function(eElem){
            var iHeight = eElem.firstChild.offsetHeight;
            
            iHeight += df.sys.gui.getVertBoxDiff(eElem);
            
            return iHeight <= that.piMaxHeight ? iHeight : that.piMaxHeight;
        };
        
        // The behaviour of a menu click should be slightly altered.
        // After a click has been performed we should change the menu again to the root instead of keeping the current sublist.

        // Cache the original base function.
        var that = this;
        this._fMenuBaseClick = this._oMenu.onMenuClick;
        this._oMenu.onMenuClick = function (oEvent) {
            that._fMenuBaseClick.apply(this, arguments);
    
            let tItem, eElem = oEvent.getTarget();
    
            if (!eElem) return;
    
            // Determine the clicked element by bubbling up the DOM structure
            while(!tItem && eElem && eElem !== this._eElem && eElem.hasAttribute){
                if(eElem.hasAttribute("data-df-path")){
                    tItem = this.getItemByPath(eElem.getAttribute("data-df-path"));
                    if (tItem && tItem.bEnabled && tItem.aChildren.length === 0) {
                        if (!(tItem.hRef instanceof df.WebMenuItemCheckbox)) {
                            this._oMenuBtn.hideMenu();
                        }

                        that.fire("OnItemClick", [ tItem.sId, tItem.sCaption ]);
                    }                    
                    return;
                }
    
                eElem = eElem.parentNode;
            }
        };
    
        this._oMenu._hContextMenu = this;

        this._oMenu.create();

        // Unload cache.
        for (let i = 0; i < this._oChildrenCache.length; i++) {
            this.addChild(this._oChildrenCache[i]);
        }

        df.WebContextMenu.base.addChild.call(this, this._oMenu);
        df.WebContextMenu.base.create.call(this, arguments);
    },

    destroy : function () {
        this.unbind();
        df.WebContextMenu.base.destroy.apply(this, arguments);
    },

    // Let's add the context menu class.
    genClass : function(){
        var aClasses = [ "WebContextMenu", df.WebContextMenu.base.genClass.call(this) ];
        return aClasses.join(" ");
    },

    afterRender : function(){
        this._bRendered = true;
        df.WebContextMenu.base.afterRender.apply(this, arguments);

        // Create a context menu for the desired object and create a null-handler for a right click on self.
        this.bind();
    },

    bind : function () {
        // Safety net for the root element and whether it is rendered.
        // We need to do this since a set on the context properties causes a rebind(). This might happen before render.
        if (!this._oRootControl || !this._oRootControl._eElem || !this._eElem) {
            if (this._bRendered) 
                throw new df.Error(999, "WebContextMenu could not find an element for the RootControl.");
            return;
        }

        // Since the properties might not all be set;
        // Only go in once the properties have been synced (thus _bRendered).
        // If the peContext is not custom we try to determine the css selector.
        if (this._bRendered && this.peContext !== df.WebUIContext.WebUIContextCustom) {
            if (!this._oRootControl.determineSelectorForWebUIContext) 
                throw new df.Error(999, "WebContextMenu could not contact the assigned control since it does not support the required interface.");

            let sCSSSelector = this._oRootControl.determineSelectorForWebUIContext(this.peContext);
            if (sCSSSelector === null || sCSSSelector === undefined) 
                throw new df.Error(999, "WebContextMenu's assinged control does not support the desired peContext.");

            this.psContextCSSSelector = sCSSSelector;
        }

        // Attach
        df.dom.on("contextmenu", this._oRootControl._eElem, this.onContextMenuOpen, this);
        df.dom.on("contextmenu", this._eElem, function (oEv) { oEv.stop(); }, this);
    },

    unbind : function () {        
        // Safety net for the root element and whether it is rendered.
        // We need to do this since a set on the context properties causes a rebind(). This might happen before render.
        if (!this._oRootControl || !this._oRootControl._eElem || !this._eElem) {
            if (this._bRendered) 
                throw new df.Error(999, "WebContextMenu could not find a element for the RootControl.");
            return;
        }

        // Detach if they have a event handler.
        df.dom.off("contextmenu", this._oRootControl._eElem, this.onContextMenuOpen, this);
        df.dom.off("contextmenu", this._eElem, function (oEv) { oEv.stop(); }, this);
        df.events.removeDomCaptureListener("click", document, this.onClickGeneral, this);
        df.events.removeDomCaptureListener("contextmenu", document, this.hideMenu, this);

        this.hideMenu();
    },

    rebind : function () {
        this.unbind();
        this.bind();
    },

    // Creates a new WebMenuItem with the provided caption and adds it to the menu.
    createMenuItem : function (sCaption) {
        let oItem = new df.WebMenuItem(null, this);
        oItem.psCaption = sCaption;
        oItem.create();
        return oItem;
    },

    // Creates a new WebMenuItem with Checkbox and the provided caption and adds it to the menu.
    createCheckedMenuItem : function (sCaption, bChecked) {
        let oItem = new df.WebMenuItemCheckbox(null, this);
        oItem.psCaption = sCaption;
        oItem.pbChecked = bChecked;
        oItem.create();
        return oItem;
    },

    // Proxy the addChild (cWebObject) to a new list. These are later added to the generated cWebMenuList.
    addChild : function(oChild){
        if (!(oChild instanceof df.WebMenuItem)) throw new df.Error(999, "WebMenuContext only supports menu items/checkboxes (" + oChild.getLongName() + ").");
        
        if (this._oMenu) {
            this._oMenu.addChild(oChild);
        } else {
            this._oChildrenCache.push(oChild);
        }
    },

    /* 
    Handles the OnShow event of the view and makes sure the floating panel is displayed if it should.
    If we are not yet rendered it means we are attached to a control that is not a base of the WebContainer_mixin.
    Thus we render ourselves.

    We also rebind since views are cached and we are unbound in the OnHide.

    @param  oEvent  Event object.
    @private
    */
    showView : function(oEvent){
        if (!this._bRendered) {
            this.render();
            this.afterRender();
        }

        df.WebContextMenu.base.showView.apply(this, arguments);

        this.rebind();
    },

    /* 
    Handles the OnHide event of the view and makes sure the panel is hidden.
    If we hide our view we need to unbind since we have lost focus and don't want to trigger anything elsewhere.

    @param  oEvent  Event object.
    @private
    */
    hideView : function(oEvent){
        df.WebContextMenu.base.hideView.apply(this, arguments);

        this.unbind();
    },

    show : function(){
        if (this.isEnabled()) {
            this.pbVisible = true;
            
            if(this._bViewVisible){
                this.doShow();
            }
        }
    },

    isVisible : function() {
        return this.pbVisible === true;
    },

    // When the menu is opened a click in general should make the menu hide.
    // Whether it is a button or something else entirely.
    onClickGeneral : function (oEv) {
        if(this._eElem.contains(oEv.getTarget())){
            return;
        }
        df.dom.off("click", document, this.onClickGeneral, this);
        df.dom.off("contextmenu", document, this.hideMenu, this);
        this.hideMenu();
    },

    // If the menu is enabled we open.
    // We attach a general click event and open at the clicked location.
    onContextMenuOpen : function (oEvent) {
        // If we trigger for all elements then that's fine too.
        let bFound = this.psContextCSSSelector.length === 0;
        // Grab the element from the click.
        let eElem = document.elementFromPoint(oEvent.e.clientX, oEvent.e.clientY);

        // As long as we are in the root context and the object is not found we keep looking for the 
        // Context Query.
        while (eElem && eElem.matches && 
               eElem !== this._oRootControl._eElem &&
               !bFound) {
                  
            bFound = eElem.matches(this.psContextCSSSelector);

            if (bFound) break;

            eElem = eElem.parentNode;
        }

        let bValid = this._oRootControl.verifyElementForWebUIContext ?
                        this._oRootControl.verifyElementForWebUIContext(eElem, this.peContext) :
                        true;

        if (this.isEnabled() && bFound && bValid) {
            oEvent.stop();

            // First we get the desired data; since it might change with layoutChanges.
            if (this._oRootControl.retrieveValueFromWebUIContext && this.peContext > df.WebUIContext.WebUIContextCustom) {
                let vValue = this._oRootControl.retrieveValueFromWebUIContext(eElem, this.peContext);
                
                // Something is corrupted if the value is null or undefined.
                // Might be cause of DOM corruption or someone with a custom control.
                if (vValue === null || vValue === undefined) 
                    throw new df.Error(999, "WebContextMenu's assinged control does not support the desired peContext or we passed the wrong element.");

                // If the returned value is an object with strinify it to json.
                // Otherwise call the toString
                if (vValue instanceof Object) {
                    this.psContextValue = JSON.stringify(vValue);
                } else if (vValue.toString) {
                    this.psContextValue = vValue.toString();
                } else {
                    throw new df.Error(999, "WebContextMenu could not convert the determined Value returned by the assigned control.");
                }
            } else {
                this.psContextValue = "";
            }
            
            df.events.addDomCaptureListener("click", document, this.onClickGeneral, this);
            df.events.addDomCaptureListener("contextmenu", document, this.hideMenu, this);

            this.fire("OnContextMenuOpen", [], function (oServerEvent) {
                if (oServerEvent.sReturnValue === "1") return;
                
                if (this._oMenu._sCurrentMenu.length > 0) {
                    // Reset the menu path and regenerate it.
                    this._oMenu._sCurrentMenu = "";
                    this.refreshMenu();
                }

                // Set intial X & Y
                this.piLeft = oEvent.e.clientX;
                this.piTop = oEvent.e.clientY;
                this.show(); // Show it before we can calculate the height.

                // Get the rectangle
                let oRect = df.sys.gui.getBoundRect(this._oMenu._eCurrentMenu);

                if (oRect.right > window.innerWidth && // Check whether it fits on the left side of the cursor as to mimic windows.
                    window.innerWidth - oRect.left <= oRect.width) {
                    this.piLeft = oRect.left - oRect.width;
                } else if (oRect.right > window.innerWidth) { // Just put it were it should be available.
                    this.piLeft = window.innerWidth - oRect.width;
                }

                if (oRect.bottom > window.innerHeight && // Check whether it fits on top of the cursor as to mimic windows.
                    window.innerHeight - oRect.top >= oRect.height) {
                    this.piTop = oRect.top - oRect.height;
                } else if (oRect.bottom > window.innerHeight) { // Just put it were it should be available.
                    this.piTop = window.innerHeight - oRect.height;
                }

                this.positionPnl();
            });
        }
    },

    doHide : function(bNoPos, sReason){
        var oWebApp = this.getWebApp();
    
        if(this._tPositionInterval){
            clearInterval(this._tPositionInterval);
            this._tPositionInterval = null;
        }
        
        
        df.dom.addClass(this._eElem, "WebFP_Hidden");
        df.dom.removeClass(this._eElem, "WebFP_Visible");
        
        if(!bNoPos){
            this.positionPnl();
        }
        
        this.afterHide();
        
        //  Remove mobile mask that might have been created
        if(this._eMask){
            df.dom.off("click", this._eMask, this.onMaskTouch);
            this._eMask.parentNode.removeChild(this._eMask);
            this._eMask = null;
        }
        
        //  Detach blur listener from floatby control
        if(this._eBlurBuddy){
            df.events.removeDomCaptureListener("blur", this._eBlurBuddy, this.onCaptureBlur, this);
        }
        
        if(this.pePosition === df.fpFloatLeftSqueezeWebApp){
            if(oWebApp && oWebApp._eElem){
                oWebApp._eElem.style.marginLeft = "0px";
            }
        }
        
        this.fire("OnHide", [ sReason ]);
        
        if(!this.pbVisible && this._eElem){
            this._eElem.style.display = "none";
            this._bVisible = false;
        }
        
        // Reset the menu path and regenerate it.
        this._oMenu._sCurrentMenu = "";
        this.refreshMenu();
        
    },
    
    enable : function (bOptState) {
        this.pbEnabled = bOptState !== null ? bOptState : true;
    },
    
    disable : function () {
        this.pbEnabled = false;
    }
});