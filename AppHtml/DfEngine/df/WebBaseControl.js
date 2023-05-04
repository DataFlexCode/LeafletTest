/* globals df */
/* 
Class:
    df.WebBaseControl
Extends:
    df.WebBaseUIObject

The WebBaseControl defines the API for all controls that participate within the column flow layout 
system. This makes it one of the core classes of the framework. It defines properties like 
piColumnIndex and piColumnSpan and has the API for setting the height of the controls. It can 
generate the wrapping DOM elements (several DIV�s) that almost all controls need where subclasses 
will usually fill these. As every control supports a label this class also generates and positions 
the label.

Revisions:
    2011/08/02 (HW, DAW)
        Initial version.
*/

df.WebBaseControl = function WebBaseControl(sName, oParent){
    df.WebBaseControl.base.constructor.call(this, sName, oParent);
    
    this.prop(df.tInt, "piColumnIndex", 0);
    this.prop(df.tInt, "piColumnSpan", 1);
    
    this.prop(df.tBool, "pbShowLabel", true);
    this.prop(df.tString, "psLabel", "");
    this.prop(df.tInt, "peLabelPosition", 0);
    this.prop(df.tInt, "peLabelAlign", -1);
    this.prop(df.tInt, "piLabelOffset", -1);
    this.prop(df.tString, "psLabelColor", "");
    
    this.prop(df.tString, "psToolTip", "");
    
    this.prop(df.tBool, "pbFillHeight", false);
    this.prop(df.tInt, "piHeight", -1);
    this.prop(df.tInt, "piMinHeight", 0);
    
    this.event("OnFocus", df.cCallModeDefault);
    this.event("OnBlur", df.cCallModeDefault);
        
    //  @privates
    this._eInner = null;
    this._eLbl = null;
    this._eControlWrp = null;
    this._eControl = null;
    
    this._oInfoBalloon = null;
    
    this._sControlId = df.dom.genDomId();
    
    //  Configure super classes
    this._bFocusAble = true;
    this._bHasFocus = false;
    this._sBaseClass = "WebControl";
    
};
df.defineClass("df.WebBaseControl", "df.WebBaseUIObject", {

openHtml : function(aHtml){
    //  Outermost div for positioning by parent, inner div for margins / paddings
    aHtml.push('<div class="', this.genClass(), '"');
    if(this.psHtmlId){
        aHtml.push(' id="', this.psHtmlId, '"');
    }
    
    //  Insert the object name so the HTML element can be traced back to the right object
    aHtml.push(' data-dfobj="', this.getLongName(), '"' );
    
    aHtml.push(' style=" ',  (this.pbRender ? '' : 'display: none;'), (this.pbVisible ? '' : 'visibility: hidden;'), '"');
    aHtml.push('>');
    
    //  Optionally label
    if(this.pbShowLabel){
        aHtml.push('<div class="WebCon_Inner">');
        if(!df.sys.isMobile){
            aHtml.push('<label for="', this._sControlId, '" class="', ( (this.peLabelPosition == df.ciLabelFloat && this.psValue == '') ? 'WebCon_Unfloat' : 'WebCon_Float'), '" >', df.dom.encodeHtml(this.psLabel), '</label>');
        }else{
            aHtml.push('<label>', df.dom.encodeHtml(this.psLabel), '</label>');
        }
    }else{
        aHtml.push('<div class="WebCon_Inner">');
    }
    
    //  Wrapper div for positioning of control
    aHtml.push('<div>');
},

closeHtml : function(aHtml){
    aHtml.push('</div></div></div>');
},

/*
render : function(){
    return df.WebBaseControl.base.render.call(this);
},
*/
afterRender : function(){
    //  Get references
    this._eInner = df.dom.query(this._eElem, "div.WebCon_Inner");
    this._eControlWrp = df.dom.query(this._eElem, "div.WebCon_Inner > div");
    if(this.pbShowLabel){
        this._eLbl = df.dom.query(this._eElem, "div > label");
    }
    
    df.WebBaseControl.base.afterRender.call(this);
    if(this._eLbl){
        df.dom.on("click", this._eLbl, this.onLblClick, this);
    }
    
    //  Call setters to apply properties
    this.posLabel(true);
    this.set_psLabelColor(this.psLabelColor);
    this.set_peLabelAlign(this.peLabelAlign);
    
    this.set_psToolTip(this.psToolTip);
    
    this.sizeHeight(-1);
    
    if(this._oInfoBalloon){
        this._oInfoBalloon.init();
        if(this._bShowInfoBallon){
            this._oInfoBalloon.show();
        }
    }
},

/* 
Augment destroy to destroy the infoballoon that might have been created.

@private
*/
destroy : function(){
    df.WebBaseControl.base.destroy.call(this);    
    
    this._eLbl = null;
    this._eControlWrp = null;
    this._eInner = null;
    this._eControl = null;
    
    if(this._oInfoBalloon){
        this._oInfoBalloon.destroy();
        this._oInfoBalloon = null;
    }
},


/*
Handler for the click event on the label. It calls the focus method to pass the focus to the 
control. This is done manually here to emulate this behavior for controls with an artificial focus.

@param  oEvent      DOM Event Object.
@private
*/
onLblClick : function(oEvent){
    if(!df.sys.isMobile){
        this.focus();
    }
},



set_psLabel : function(sVal){
    if(this._eLbl){
        if(!sVal){
            sVal = " ";
        }
        df.dom.setText(this._eLbl, sVal);
    }
},

set_pbShowLabel : function(bVal){
    this.pbShowLabel = bVal;
    
    this.posLabel(false);
},

set_psLabelColor : function(sVal){
    if(this._eLbl){
        this._eLbl.style.color = sVal;
    }
},

set_peLabelAlign : function(iVal){
    if(this._eLbl){
        this._eLbl.style.textAlign = (iVal === df.ciAlignLeft ? "left" : (iVal === df.ciAlignCenter ? "center" : (iVal === df.ciAlignRight ? "right" : "")));
    }   
},

set_piLabelOffset : function(iVal){
    this.piLabelOffset = iVal;
    
    this.posLabel(false);
},

set_peLabelPosition : function(iVal){
    this.peLabelPosition = iVal;
    
    this.posLabel(false);
},

set_psToolTip : function(sVal){
    if(this._eControl){
        this._eControl.title = sVal;
    }
},

set_piColumnIndex : function(iVal){
    if(this.piColumnIndex !== iVal){
        this.piColumnIndex = iVal;
        
        this.sizeChanged(true);
    }
},

set_piColumnSpan : function(iVal){
    if(this.piColumnSpan !== iVal){
        this.piColumnSpan = iVal;
        
        this.sizeChanged(true);
    }
},

set_psTextColor : function(sVal){
    if(this._eControl){
        this._eControl.style.color = sVal || '';
    }
},

set_psBackgroundColor : function(sVal){
    if(this._eControl){
        this._eControl.style.background = sVal || '';
        // this._eControl.style.backgroundColor = sVal || '';
        // this._eControl.style.backgroundImage = (sVal ? 'none' :'');
    }
},

set_piMinHeight : function(iVal){
    if(this._eControl){
        if(this.piMinHeight !== iVal){
            this.piMinHeight = iVal;
            if(!this.pbFillHeight){
                this.sizeHeight(-1);
            }
            
            // Call sizing sytem to recalculate sizes
            this.sizeChanged();
        }
    }
},

set_piHeight : function(iVal){
    if(this._eControl){
        if(this.piHeight !== iVal){
            this.piHeight = iVal;
            if(!this.pbFillHeight){
                this.sizeHeight(-1);
            }
            
            // Call sizing sytem to recalculate sizes
            this.sizeChanged();
        }
    }
},

set_pbFillHeight : function(bVal){
    if(this._eControl){
        if(this.pbFillHeight !== bVal){
            this.pbFillHeight = bVal;
            if(!this.pbFillHeight){
                this.sizeHeight(-1);
            }
            
            // Call sizing sytem to recalculate sizes
            this.sizeChanged(true);
        }
    }
},

sizeHeight : function(iExtHeight){
    var iHeight = -1, bSense = false;
    
    //  Determine which height to use
    if(this.pbFillHeight){
        iHeight = iExtHeight;
        
        bSense = iExtHeight > 0;
    }else if(this.piHeight > 0){
        iHeight = this.piHeight;
        bSense = true;
    }
    
    //  Respect minimal height
    if(iHeight < this.piMinHeight){
        iHeight = this.piMinHeight;
        
        bSense = bSense || !this.pbFillHeight;
    }
    
    //  Update the height
    this.setHeight(iHeight, bSense);
    
    //  Return the final height
    if(iHeight > 0){
        return iHeight;
    }
},

/*
Sets the height of the control taking margins, borders and the label into account.

@param  iHeight     The height in pixels.
@param  bSense      If false the size is expected to not be the final size.
*/
setHeight : function(iHeight, bSense){
    if(this._eControl){
        //  If a negative value is given we should size 'naturalEly'
        if(iHeight > 0){
            iHeight -= this.getVertHeightDiff();
            
            iHeight = (iHeight < 0 ? 0 : iHeight);  //  FIX: IE8 doesn't handle negative values real well and this seems to happen somehow

            //  Set the height
            this._eControl.style.height = iHeight + "px";
        }else{
            this._eControl.style.height = "";
        }
    
    }
},

/*
Calculates the height difference that is substracted from the height before applied on _eControl. 
It looks at the vertical box difference of several elements and the label.

@return Number of pixels to substract from the height.
@private
*/
getVertHeightDiff : function(){
    var iResult = 0;

    //  If the label is on top we reduce that (note that this means that piMinHeight and piHeight are including the label)
    if((this.peLabelPosition === df.ciLabelTop || this.peLabelPosition === df.ciLabelFloat) && this._eLbl){
        iResult += this._eLbl.offsetHeight;
    }
    
    //  Substract the wrapping elements
    iResult += df.sys.gui.getVertBoxDiff(this._eInner);
    iResult += df.sys.gui.getVertBoxDiff(this._eControlWrp);
    iResult += df.sys.gui.getVertBoxDiff(this._eControl);
    
    return iResult;
},

/* 
Updates the control its label based on the pbShowLabel, psLabel, peLabelPostion and piLabelOffset 
properties. It will do this by setting CSS Classnames, calculating margins and removing / generating 
the label element. This method is called by the setters of these properties.

@private
*/
posLabel : function(bFirst){
    var iPos = this.peLabelPosition, sClass, sOffset, iOffset = this.piLabelOffset, iMargin, sMargin, oStyle;
    
    if(this._eElem){
        //  Remove all label classes
        if(!bFirst){
            df.dom.removeClass(this._eInner, "WebCon_HasLabel WebCon_TopLabel WebCon_RightLabel WebCon_LeftLabel");
        }
        
        if(!this.pbShowLabel){
            //  Remove from the DOM
            if(this._eLbl){
                df.dom.off("click", this._eLbl, this.onLblClick);
                this._eLbl.parentNode.removeChild(this._eLbl);
                this._eLbl = null;
            }
            
            this._eControlWrp.style.marginLeft = "";
            this._eControlWrp.style.marginTop = "";
            this._eControlWrp.style.marginRight = "";
        }else{
            //  Add to the DOM 
            if(!this._eLbl){
                if(!df.sys.isMobile){
                    this._eLbl = df.dom.create('<label for="' + this._sControlId + '" class="' + ( (this.peLabelPosition == df.ciLabelFloat && this.psValue == '') ? 'unfloat' : 'float') + '">&nbsp;</label>');
                }else{
                    this._eLbl = df.dom.create('<label>&nbsp;</label>');
                }
                
                this.set_psLabel(this.psLabel);
                this.set_psLabelColor(this.psLabelColor);
                this.set_peLabelAlign(this.peLabelAlign);
                
                this._eInner.insertBefore(this._eLbl, this._eInner.firstChild);
                
                df.dom.on("click", this._eLbl, this.onLblClick, this);
            }
            if(!bFirst){
                df.dom.addClass(this._eInner, "WebCon_HasLabel");
            }
            
            //  If there is no positions et explicitly we detect it (so we assume where the style sheet wants the label based on the margin it sets)
            if(this.peLabelPosition < 0){
                oStyle = df.sys.gui.getCurrentStyle(this._eLbl);
                
                iPos = (oStyle.marginLeft > 0 ? df.ciLabelLeft : (oStyle.marginRight > 0 ? df.ciLabelRight : df.ciLabelLeft));
            }
            
            //  Determine the classname and the required margin
            switch(iPos){
                case df.ciLabelLeft:
                    sClass = "WebCon_LeftLabel";
                    iMargin = (iOffset > 0 ? iOffset + df.sys.gui.getHorizBoxDiff(this._eLbl, 1) : 0);
                    break;
                case df.ciLabelTop:
                case df.ciLabelFloat:
                    sClass = ( (iPos == df.ciLabelFloat) ? "WebCon_TopLabel WebCon_FloatEnabled" : "WebCon_TopLabel");
                    iMargin = (iOffset > 0 ? iOffset + df.sys.gui.getVertBoxDiff(this._eLbl, 1) : 0);
                    break;
                case df.ciLabelRight:
                    sClass = "WebCon_RightLabel";
                    iMargin = (iOffset > 0 ? iOffset + df.sys.gui.getHorizBoxDiff(this._eLbl, 1) : 0);
                    break;
            }
            
            sOffset = (iOffset > 0 ? iOffset + "px" : "");
            sMargin = (iMargin > 0 ? iMargin + "px" : "");
              
            //  Make space
            this._eControlWrp.style.marginLeft = (iPos === df.ciLabelLeft ? sMargin : "");
            this._eControlWrp.style.marginTop = (iPos === df.ciLabelTop ? sMargin : "");
            this._eControlWrp.style.marginRight = (iPos === df.ciLabelRight ? sMargin : "");
            
            this._eLbl.style.width = (iPos === df.ciLabelLeft ||  iPos === df.ciLabelRight ? sOffset : "");
            this._eLbl.style.height = (iPos === df.ciLabelTop ? sOffset : "");
            
            //  Set CSS class on the inner div
            df.dom.addClass(this._eInner, sClass);
            
        }
    }
},


// - - - - - - - Information Balloon API - - - - - - - 
/* 
Used by the InfoBalloon class to determine where to align the info ballon on to.

@private
*/
getTooltipElem : function(){
    return this._eControlWrp;
},

/*
Shows the info balloon with the provided CSS classname and content (html). 

@param  sCssClass   The CSS classname applied to the balloon for styling.
@param  sText       The HTML content displayed inside the balloon.
@param  bShow       True if the the info balloon should be shown immediately
@client-action
*/
showInfoBalloon : function(sCssClass, sText, bShow){
    bShow = df.toBool(bShow);

    if(this._oInfoBalloon){
        this._oInfoBalloon.psCssClass = sCssClass;
        this._oInfoBalloon.psMessage = sText;
        this._oInfoBalloon.update();
    }else{
        this._oInfoBalloon = new df.InfoBalloon(this, sCssClass, sText);
    }
    if(this._eElem){
        this._oInfoBalloon.init();
        
        if(bShow){
            this._oInfoBalloon.show();
        }
    }else{
        this._bShowInfoBallon = bShow;
    }
},

/* 
Hides the info balloon that is shown using showInfoBalloon.

@client-action
*/
hideInfoBalloon : function(){
    if(this._oInfoBalloon){
        this._oInfoBalloon.hide();
    }
},

/*
Implement the resize method to resize & reposition the info balloon (if displayed).
*/
resize : function(){
    if(this._oInfoBalloon){
        this._oInfoBalloon.resize();
    }

    this._aChildren.forEach(function(oC){
        if(oC.resize){
            oC.resize();
        }
    })
},


// - - - - - - - - - Focus Handling - - - - - - - - - 
focus : function(){
    if(this._bFocusAble && this.isEnabled() && this._eControl && this._eControl.focus){
        try{
            this._eControl.focus();
        }catch (oErr){
            
        }
        
        this.objFocus();
        return true;
    }
    
    return false;
},

attachFocusEvents : function(){
    //  Every major browser now supports focusin & focusout, so we don't need to capture
    df.dom.on("focusin", this._eElem, this.onFocus, this);
    df.dom.on("focusout", this._eElem, this.onBlur, this);
},

onFocus : function(oEvent){
    df.WebBaseControl.base.onFocus.call(this, oEvent);
    
    if(this._eElem){
        df.dom.addClass(this._eElem, "WebCon_Focus");
    }
    
    this.fire("OnFocus");
    
    this._bHasFocus = true;
},

onBlur : function(oEvent){
    df.WebBaseControl.base.onBlur.call(this, oEvent);
    
    if(this._eElem){
        df.dom.removeClass(this._eElem, "WebCon_Focus");
    }
    
    this.fire("OnBlur");
    
    this._bHasFocus = false;
}

});