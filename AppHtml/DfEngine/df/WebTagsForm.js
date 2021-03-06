/*
Class:
    df.WebTagsForm
Extends:
    df.WebBaseSelectionForm

The WebTagsForm is an extension on the selection form. Able to select multiple items. Compositions can be made.

Revision:
    2020/09/25  (HW, DAW)
        Initial version.
*/

const wbtgOperation = {
    wbtgAdded: 0,
    wbtgRemoved: 1
};

df.WebTagsForm = function WebTagsForm(sName, oParent) {
    df.WebTagsForm.base.constructor.call(this, sName, oParent);

    this.prop(df.tInt, "piTagTruncateAt", 60);
    this.prop(df.tBool, "pbTagOnSpace", false);
    this.prop(df.tBool, "pbAllowTagSelection", true);
    this.prop(df.tString, "psSeparator", ",");

    this.event("OnTagClick", df.cCallModeDefault, "privateOnTagClick");
    this.event("OnAddTag", df.cCallModeDefault, "privateOnAddTag");
    this.event("OnRemoveTag", df.cCallModeDefault, "privateOnRemoveTag");
    
    this._aSelectedSuggestions = [];
    this._sSelectedTag = null;
    this._oSelectedTag = null;
    this._aTagCssClass = {};
};
df.defineClass("df.WebTagsForm", "df.WebBaseSelectionForm", {

    openHtml: function (aHtml) {
        df.WebForm.base.openHtml.call(this, aHtml);

        aHtml.push('<div class="WebFrm_Wrapper"><div class="WebFrm_PromptSpacer">',
            '<span class="WebDynFrm WebTgf_Placeholder">',
            (this.peLabelPosition != df.ciLabelFloat ? df.dom.encodeAttr(this.encode(this.psPlaceHolder)) : ''),
            '</span>',
            '<span class="WebDynFrm WebTgfInput" name="',
            this._sName,
            '" id="',
            this._sControlId,
            '" role="textbox" tabindex="0"',
            ' contenteditable="true"></span>');
    },

    closeHtml: function (aHtml) {
        aHtml.push('</div><span class="WebFrm_Prompt"></span></div>');

        df.WebForm.base.closeHtml.call(this, aHtml);
    },

    setPlaceHolderVisibility: function (bVisible) {
        this.setVisibility(this._hPlaceHolder, bVisible);
    },

    setInputVisibility: function (bVisible) {
        this.setVisibility(this._hInputField, bVisible);
    },

    setVisibility: function (hElem, bVisible) {
        hElem.style.display = (!bVisible ? "none" : "");
    },

    getVisibility: function (hElem) {
        return hElem.style.display != "none";
    },

    focusInputField: function () {
        if (this.pbReadOnly || !this.isEnabled()) {
            return;
        }

        if (this._aSelectedSuggestions.length === 0 || this.getVisibility(this._hPlaceHolder)) {
            this.setPlaceHolderVisibility(false);
        }

        // IE Fix: reset the focus to the input field.
        var that = this;
        if (!this._tFocus) {
            this._tFocus = setTimeout(function () {
                if (!that._tFocus) return;
                that._hInputField.focus();
                that._tFocus = null;
            }, 1);
        }
    },

    blurInputField: function () {
        this._tFocus = null;
        if ((this._hInputField.value.length === 0 && this._aSelectedSuggestions.length === 0) ||
            this.getVisibility(this._hPlaceHolder)) {
            this.setPlaceHolderVisibility(true);
        }
    },

    afterRender: function () {
        // Create elem.
        this._eSuggestions = df.dom.create('<div class="WebBaseSelectionForm WebSuggestions' +
            ((this.psCSSClass.length > 0) ? " " + this.psCSSClass : '') + ' WebSug_Hidden"><div class="WebSug_Content"></div></div>');
        this._eSugContent = df.dom.query(this._eSuggestions, "div.WebSug_Content");
        this._eSugSuggestions = df.dom.create('<div class="WebSug_Suggestions"></div>');
        this._eSugControls = df.dom.create('<div class="WebSug_Controls"></div>');

        this._eSugContent.appendChild(this._eSugSuggestions);
        this._eSugContent.appendChild(this._eSugControls);

        this._hInputBox = df.dom.query(this._eElem, ".WebFrm_PromptSpacer");
        this._hPlaceHolder = df.dom.query(this._eElem, ".WebTgf_Placeholder");

        /* 
        For the WebTagsform we use a dynamic input field.
        To make this growing we use a span, we need to add a couple of properties to make it function as such.
        Using these function we pass for the BaseDEO api's.
        */
        var that = this;
        this._eControl = this._hInputField = df.dom.query(this._hInputBox, ".WebTgfInput");
        Object.defineProperty(this._hInputField, "value", {
            get: function () { return that._hInputField.innerText; },
            set: function (val) { that._hInputField.innerText = val; }
        });
        Object.defineProperty(this._hInputField, "keypress", {
            get: function () { return that._hInputField.keydown; },
            set: function (val) { that._hInputField.keydown = val; }
        });
        this._hInputField.select = function () { that._hInputField.focus(); };

        df.dom.on("focusin", this._hInputBox, this.focusInputField, this);
        df.dom.on("click", this._hInputBox, this.focusInputField, this);
        df.dom.on("blur", this._hInputField, this.blurInputField, this);
        this.blurInputField();

        this._ePrompt = df.dom.query(this._eElem, "div.WebFrm_Wrapper span.WebFrm_Prompt");
        this._eWrap = df.dom.query(this._eElem, "div.WebFrm_Wrapper");

        df.WebForm.base.afterRender.call(this);

        //  Attach event handlers
        df.dom.on("click", this._ePrompt, this.onPromptClick, this);

        //  Set properties
        this.set_pbPromptButton(this.pbPromptButton);

        // Insert.
        df.dom.addClass(this._eElem, "WebSelectionForm");
        document.body.appendChild(this._eSuggestions);
        // Setup event handlers.
        df.dom.on("keyup", this._eControl, this.onSuggestKey, this);
        df.dom.on("click", this._eSuggestions, this.onSuggestClick, this);
        df.dom.on("click", this._hInputBox, this.inputBoxOnClick, this);
        df.dom.on("resize", window, this.onWindowResize, this);

        df.dom.addClass(this._eElem, "WebTagsForm");

        // If the values are pre-set implement them now.
        if (this.aSelectionCache) this.setCachedTags();

        df.dom.on("click", this._hInputBox, this.removeTagSelection, this);

        this.set_pbReadOnly(this.pbReadOnly);
        this.set_pbEnabled(this.isEnabled());

        this.validateAsSeparator(this.psSeparator);

        this.dragDropInit();
    },

    set_pbEnabled : function (bVal) {
        let bChanged = bVal !== this.isEnabled();
        df.WebTagsForm.base.set_pbEnabled.call(this, bVal);
        if (bChanged) this.setControlValue(this.getControlValue());
    },

    validateAsSeparator : function (sVal) {
        if (sVal.length !== 1) {
            throw new df.Error(871, "Invalid psSeparator; requires length of just one character.");
        }
        return true;
    },

    set_psSeparator : function (sVal) {
        if (sVal !== this.psSeparator && this.validateAsSeparator(sVal)) {
            this.psSeparator = sVal;
        }
    },

    set_pbReadOnly : function(bVal){
        let bChanged = bVal !== this.pbReadOnly;
        df.WebTagsForm.base.set_pbReadOnly.call(this, bVal);
        if (bChanged) this.setControlValue(this.getControlValue());
    },

    removeTagSelection: function () {
        if (this._sSelectedTag || this._oSelectedTag) {
            df.dom.removeClass(this._oSelectedTag, "WebTgf_Focus");
            this._sSelectedTag = null;
            this._oSelectedTag = null;
        }
    },

    setTagSelection: function (tRow) {
        this.removeTagSelection();
        this._sSelectedTag = tRow;
        this._oSelectedTag = df.dom.query(this._hInputBox, ".WebTgf_Tag[data-dfrowid='" + this._sSelectedTag.aValues[0].replaceAll("'", "\\'") + "']");
        df.dom.addClass(this._oSelectedTag, "WebTgf_Focus");
    },

    /*
    Get the value from the inputfield.
    */
    getSearchValue: function () {
        let sValue = this._hInputField.value;
        return (this.pbCapslock ? sValue.toUpperCase() : sValue);
    },

    /*
    Called by the baseDEO, it serializes the selected tag datasets.

    @private
    */
    getControlValue: function () {
        let aData = [];
        let sEscapedSeperator = "\\" + this.psSeparator;

        for (let i = 0; i < this._aSelectedSuggestions.length; i++) {
            if (!this._aSelectedSuggestions[i].control) {
                aData.push(this._aSelectedSuggestions[i].aValues[0].replaceAll(this.psSeparator, sEscapedSeperator));
            }
        }
        return aData.join(this.psSeparator);
    },

    /*
    Called by the baseDEO, it de-serializes the selected tag datasets and adds them one-by-one.

    @private
    */
    setControlValue: function (sVal) {
        this.aSelectionCache = [];

        /*
        iIndex = The found end index of a string; which is an operator thus +1.
        iLastIndex = The last found iIndex.
        iBegin = The last begin of a string; commonly iIndex+1.
        */
        let iIndex = -1, iLastIndex = -1, iBegin = 0;
        while ((iIndex = sVal.indexOf(this.psSeparator, iLastIndex + 1)) >= 0) {
            let bEven = true;
            let j = iIndex;
            // Check if the operator is escaped.
            while (--j >= 0 && sVal.charAt(j) === '\\') {
                bEven = !bEven;
            }

            // If its even it means its not escaped.
            if (bEven) {
                let sValue = sVal.substr(iBegin, iIndex - iBegin);
                sValue = sValue.replaceAll("\\" + this.psSeparator, this.psSeparator).trim();
                if (sValue.length > 0) {
                    this.aSelectionCache.push(sValue);
                    iBegin = iIndex + 1;
                }
            }
            
            iLastIndex = iIndex;
        }

        // Do the last one too.
        let sValue = sVal.substr(iBegin, sVal.length - iBegin);
        sValue = sValue.replaceAll("\\" + this.psSeparator, this.psSeparator).trim();
        if (sValue.length > 0) this.aSelectionCache.push(sValue);

        if (this._hInputBox) this.setCachedTags();
    },

    suggestHandle: function (sVal, bLast) {
        df.WebTagsForm.base.suggestHandle.call(this, sVal, bLast);
        if (this._aSuggestRows.length - this._aSelectedSuggestions.length < this.piPageSize && !this._bLastItemOnServer && this.pbPaged) {
            this.handleMoreButton();
        }
    },

    /*
    Intermediate event during handling of incoming lists.
    Currently adding control rows.
    */
    AddControlSuggestions: function (aList) {
        let iAdded = aList.length;
        let sValue = this.getSearchValue().trim();
        if (!this._bLastItemOnServer && this.pbPaged && aList.length > 0 && !this.pbAllData) aList.push({ control: true, sRowId: "more", aValues: ["(" + this.psShowMoreText + ")"], sCssClassName: "Sugg_ControlSuggestion" });
        let bShow = true;
        if (this._aShownSuggestions) bShow = !(this._aShownSuggestions.length > 0 && this._aShownSuggestions[0].aValues[0] == sValue);

        if (bShow) bShow = this.getSelectedSuggestionId(sValue) < 0;

        if (bShow && this.pbAllowCreate && sValue.length > 0) aList.push({ control: true, sRowId: "create", aValues: ["(" + this.psCreateNewItemText + (sValue.length > 0 ? " '" + sValue + "'" : "") + ")"], sCssClassName: "Sugg_ControlSuggestion" });

        return aList.length - iAdded;
    },

    afterSuggestRefine: function (sFilter) {
        if (this._aShownSuggestions.length - this._TotalOfControlRows - this._aSelectedSuggestions.length < this.piPageSize && !this._bLastItemOnServer && this.pbPaged) {
            this.handleMoreButton();
        }
    },

    // If a dd already a value in it the setControlValue is called before the render was completed.
    // Caching is thus required.
    setCachedTags: function () {
        this.clearTags();
        for (let i = 0; i < this.aSelectionCache.length; i++) {
            this.addTag({
                sRowId: i.toString(),
                aValues: [this.aSelectionCache[i]],
                sCssClassName: ""
            });
        }
        this.setPlaceHolderVisibility(this._hInputField.value.length === 0 &&this.aSelectionCache.length == 0);
        this.updateTypeVal();
    },

    /*
    This is a function to truncate the text in a tag. Based on spaces as well as the value itself.
    */
    truncate: function (sValue, iMaximumLength, bUseBoundary) {
        if (sValue.length <= iMaximumLength) return sValue;
        if (iMaximumLength == 0) return sValue;
        let subString = sValue.substr(0, iMaximumLength);
        return ((bUseBoundary && subString.lastIndexOf(" ") != -1)
            ? subString.substr(0, subString.lastIndexOf(" "))
            : subString) + "&hellip;";
    },

    /*
    Is called by the server, this puts a css classname on the value using a hashet.
    Afterwards a rerender is called thus causing the class to be applied.
    */
    setTagCssClass: function (sTag, sCssClass) {
        this._aTagCssClass[sTag] = " " + sCssClass.trim();
        this.updateTypeVal();
        this.refreshDisplay(this._tValue);
    },

    /*
    Selects the item by sending a call to the server with the selected suggestion details.
    */
    suggestSelect: function () {
        if (this._oSelectedSuggestion && !this._oSelectedSuggestion.control) {
            let tRow = this.findSuggestionByValue(this._oSelectedSuggestion.aValues[0]);
            if (tRow) {
                this.fireEx({
                    sEvent: "OnAddTag",
                    tActionData: tRow,
                    oEnv: this
                });
                this.addTag(tRow);
                this.updateTypeVal();
                this.focusInputField();
                this._hInputField.value = "";
                this.suggestHide();
                return;
            }
        }
        df.WebTagsForm.base.suggestSelect.call(this);
        this.focusInputField();
    },

    extraFilterOnHandle: function (aList) {
        // Filter out all selected values.
        this._aSelectedSuggestions.forEach(function (tRow) {
            for (let i = 0; i < aList.length; i++)
                if ((aList[i].aValues[0] == tRow.aValues[0]))
                    aList.splice(i--, 1);
        });
        return aList;
    },

    /*
    Used to add a selectiontag to the view.
    
    @private
    */
    addTag: function (tRow) {
        // Push the tRow onto the selection stack.
        this._aSelectedSuggestions.push(tRow);
        // A SetControlValue clears the focus, re-enable it
        let bHasFocus = false;
        if (this._sSelectedTag && this.isEnabled())
            if (this._sSelectedTag.aValues[0] == tRow.aValues[0])
                bHasFocus = true;

        // Create the element.
        var tag_elem = df.dom.create(
            '<div class="WebTgf_Tag' + ((bHasFocus) ? " WebTgf_Focus" : "") + (this._aTagCssClass[tRow.aValues[0]] ? this._aTagCssClass[tRow.aValues[0]] : "") + '" data-dfrowid="' + df.dom.encodeAttr(tRow.aValues[0]) + '"' + (this.pbDragDropEnabled && this.isSupportedDragAction(df.dragActions.WebTagsForm.ciDragTag) ? ' draggable="true"' : '') + '> \
                <span class="WebTgf_Text">' + this.encode(this.truncate(tRow.aValues[0], this.piTagTruncateAt, false)) + '</span>' +
                (this.isEnabled() && !this.pbReadOnly ? '<span class="WebTgf_CloseTag">x</span> ' : '') +
            '</div>'
        );

        // Insert the element into the DOM.
        let oTag = this._hInputBox.insertBefore(tag_elem, this._hInputField);

        if (bHasFocus) this._oSelectedTag = tag_elem;

        // Create a mouseup event to handle mouse clicks.
        df.dom.on("mouseup", oTag, function (oEvent) {
            if (window.getSelection().type == "Range") return;
            // Find valid targets either the tag itself or the close button.
            let target = oEvent.getTarget();
            while (!target.classList.contains("WebTgf_Tag") && !target.classList.contains("WebTgf_CloseTag"))
                target = target.parentNode;

            if (!this.isEnabled()) return;

            // If the close button was clicked.
            if (target.classList.contains("WebTgf_CloseTag")) {
                target = target.parentNode;

                this.removeTag(target.getAttribute("data-dfrowid"));
                this.blurInputField();

                // Deselect the if a selection was made using the keyboard since the numbers won't correspond.
                if (this._sSelectedTag) {
                    if (this._sSelectedTag) df.dom.removeClass(this._oSelectedTag, "WebTgf_Focus");
                    this._sSelectedTag = null;
                    this._oSelectedTag = null;
                }
            } else if (target.classList.contains("WebTgf_Tag")) {
                let iIndex = this.getSelectedSuggestionId(target.getAttribute("data-dfrowid"));
                if (this._sSelectedTag) df.dom.removeClass(this._oSelectedTag, "WebTgf_Focus");
                if (this.pbAllowTagSelection) {
                    this._sSelectedTag = this._aSelectedSuggestions[iIndex];
                    this._oSelectedTag = target;
                    this.focus();
                }
            }
        }, this);

        df.dom.on("mousedown", oTag, function (oEvent) {
            if (window.getSelection().type == "Range") return;
            // Find valid targets either the tag itself or the close button.
            let target = oEvent.getTarget();
            while (!target.classList.contains("WebTgf_Tag") && !target.classList.contains("WebTgf_CloseTag"))
                target = target.parentNode;

            if (!this.isEnabled()) return;

            if (target.classList.contains("WebTgf_Tag")) {
                let iIndex = this.getSelectedSuggestionId(target.getAttribute("data-dfrowid"));
                if (iIndex < 0) 
                    throw new df.Error(999, "Could not refind the clicked tag.");

                this.fireEx({
                    sEvent: "OnTagClick",
                    tActionData: this._aSelectedSuggestions[iIndex],
                    oEnv: this
                });
            }
        }, this);

        // For suggestionmode additional items are needed +1
        if (this.pbSuggestions) this._iAdditionalItems++;

        this.sizeChanged();
    },

    /*
    Clears the webtags
    */
    clearTags: function () {
        var that = this;
        this._aSelectedSuggestions = [];
        if (this._hInputBox) {
            this._hInputBox.querySelectorAll(".WebTgf_Tag").forEach(function (oTag) {
                that._hInputBox.removeChild(oTag);
            });
        }
        // For suggestionmode additional items back to 0;
        this._iAdditionalItems = 0;
    },

    /*
    Given the sValue it will remove the tag from the selected list.
    @private
    */
    removeTag: function (sValue) {
        let oRow = df.dom.query(this._hInputBox, ".WebTgf_Tag[data-dfrowid='" + sValue.replaceAll("'", "\\'") + "']");
        if (oRow) {
            let iIndex = this.getSelectedSuggestionId(sValue);
            let tRow = this._aSelectedSuggestions[iIndex];

            this._aSelectedSuggestions.splice(iIndex, 1);
            oRow.parentNode.removeChild(oRow);
            this.updateTypeVal();
            this.fireEx({
                sEvent: "OnRemoveTag",
                tActionData: tRow,
                oEnv: this
            });

            this.sizeChanged();
        }
        if (this._bSuggestVisible) this.suggestHide();

        if (this.pbSuggestions) this._iAdditionalItems--;
        this.suggestLoad();
    },

    /*
    Find a suggestion by sValue in the selected suggestions.
    returns index.
    @private
    */
    getSelectedSuggestionId: function (sValue) {
        for (let i = 0; i < this._aSelectedSuggestions.length; i++) {
            if (this._aSelectedSuggestions[i].aValues[0] == sValue) {
                return i;
            }
        }
        return -1;
    },

    /* 
    Augments the key handler and implements the key operations.
     
    NOTE: The WebColumnSuggestion has its own onKey handler!
     
    additions over base: Backspace/delete, left/right arrow keys for navigation through tags.
     
    @param  oEvent  Event object (see df.events.DOMEvent).
    @private
    */
    onKey: function (oEvent) {
        if (!this.isEnabled() || this.pbReadOnly) {
            oEvent.stop();
            return;
        }

        function setCaretPosition(el, pos) {
            var range = document.createRange();
            var sel = window.getSelection();
            if (el.childNodes.length == 0) return;
            range.setStart(el.childNodes[0], pos);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        function getCaretPosition(editableDiv) {
            var caretPos = 0,
                sel, range;
            if (window.getSelection) {
                sel = window.getSelection();
                if (sel.rangeCount) {
                    range = sel.getRangeAt(0);
                    if (range.commonAncestorContainer.parentNode == editableDiv) {
                        caretPos = range.endOffset;
                    }
                }
            } else if (document.selection && document.selection.createRange) {
                range = document.selection.createRange();
                if (range.parentElement() == editableDiv) {
                    var tempEl = document.createElement("span");
                    editableDiv.insertBefore(tempEl, editableDiv.firstChild);
                    var tempRange = range.duplicate();
                    tempRange.moveToElementText(tempEl);
                    tempRange.setEndPoint("EndToEnd", range);
                    caretPos = tempRange.text.length;
                }
            }
            return caretPos;
        }

        // Check if the key is not an auto-html-entity.
        if (oEvent.e.ctrlKey) {
            switch (oEvent.e.keyCode) {
                case 66: //ctrl+B or ctrl+b
                case 98:
                case 73: //ctrl+I or ctrl+i
                case 105:
                case 85: //ctrl+U or ctrl+u
                case 117:
                    oEvent.stop();
                    return false;
            }
        }

        // Check if it is not a html beginning entity.
        if ([
            '<',
            '>',
            "'",
            '/'
        ].indexOf(oEvent.e.key) > -1) {
            oEvent.stop();
            this._hInputField.value += oEvent.e.key;
            setCaretPosition(this._hInputField, this._hInputField.value.length);
            return;
        }

        var oKeys = df.settings.suggestionKeys;
        switch (oEvent.e.key) {
            case "Enter":
                if (!this._bSuggestVisible) {
                    oEvent.stop();
                    return;
                }
                if (oEvent.e.shiftKey) this._oSelectedSuggestion = null;
                this.suggestSelect();
                oEvent.stop();
                break;
            case " ":
            case "Spacebar":
                if (!this.pbTagOnSpace || oEvent.e.ctrlKey)
                    break;
                this.suggestSelect();
                oEvent.stop();
                break;
        }

        df.WebTagsForm.base.onKey.call(this, oEvent);
        if (!oEvent.bCanceled) {
            if ((oEvent.e.key == "Backspace" || oEvent.e.key == "Delete") && (this.getSearchValue().length == 0 || this._sSelectedTag) && this.pbAllowTagSelection) {
                if (this._sSelectedTag) {
                    this.removeTag(this._sSelectedTag.aValues[0]);
                    this.removeTagSelection();
                } else if (this._aSelectedSuggestions.length > 0) {
                    this.setTagSelection(this._aSelectedSuggestions[this._aSelectedSuggestions.length - 1]);
                }

                oEvent.stop();
            }
            else if ((oEvent.e.key == "ArrowLeft" || oEvent.e.key == "Left") && this.pbAllowTagSelection) {
                if (this._aSelectedSuggestions.length <= 0) return false;
                if (this._sSelectedTag) {
                    let i = this.getSelectedSuggestionId(this._sSelectedTag.aValues[0]);
                    this.removeTagSelection();
                    if (i > 0) i--;
                    else {
                        this.removeTagSelection();
                        this._hInputField.focus();
                        setCaretPosition(this._hInputField, this.getSearchValue().length);
                        oEvent.stop();
                        return;
                    }
                    this.setTagSelection(this._aSelectedSuggestions[i]);
                    oEvent.stop();
                }
                else if (getCaretPosition(this._hInputField) == 0) {
                    this.setTagSelection(this._aSelectedSuggestions[this._aSelectedSuggestions.length - 1]);
                    oEvent.stop();
                }
            }
            else if ((oEvent.e.key == "ArrowRight" || oEvent.e.key == "Right") && this.pbAllowTagSelection) {
                if (this._aSelectedSuggestions.length <= 0) return;
                if (this._sSelectedTag) {
                    let i = this.getSelectedSuggestionId(this._sSelectedTag.aValues[0]);
                    this.removeTagSelection();
                    if (i >= this._aSelectedSuggestions.length - 1) {
                        this.removeTagSelection();
                        this._hInputField.focus();
                        setCaretPosition(this._hInputField, 0);
                        oEvent.stop();
                        return;
                    }
                    else i++;
                    this.setTagSelection(this._aSelectedSuggestions[i]);
                    oEvent.stop();
                }
                else if (getCaretPosition(this._hInputField) == this.getSearchValue().length) {
                    this.setTagSelection(this._aSelectedSuggestions[0]);
                    oEvent.stop();
                }
            }
            else { // unkown key (Typing)
                this.removeTagSelection();
            }

            //  Make sure force display doesn't change value
            if (oEvent.matchKey(oKeys.forceDisplay)) {
                oEvent.stop();
            }
        }
    },

    createTag: function () {
        let tRow = this._tActionData;
        if (tRow.aValues[0] == -1) {
            tRow.aValues[0] = this._aSelectedSuggestions.length.toString();
        }
        if (this.getSelectedSuggestionId(tRow.aValues[0]) != -1) throw new df.Error(871, "Id already in use.");
        this.addTag(tRow);
        this.updateTypeVal();
        this.suggestDoLoad(this.getSearchValue());
        this.suggestHide();
    },

    afterBlur: function () {
        if (this._sSelectedTag) {
            var that = this;
            if (!this._tUnselectTag) {
                this._tUnselectTag = setTimeout(function () {
                    that._tUnselectTag = null;

                    if (!that._bHasFocus) {
                        df.dom.removeClass(that._oSelectedTag, "WebTgf_Focus");
                        that._sSelectedTag = null;
                        that._oSelectedTag = null;
                    }
                }, 500);
            }
        }
    },

    // WebUIContext

    determineSelectorForWebUIContext : function (eContext) {
        switch (eContext) {
            case df.WebUIContext.WebUIContextTagsFormTag:
                return ".WebTgf_Tag[data-dfrowid]";
        }
        return null;
    },

    retrieveValueFromWebUIContext : function (eElem, eContext) {
        switch (eContext) {
            case df.WebUIContext.WebUIContextTagsFormTag: {
                if (!eElem.hasAttribute('data-dfrowid')) 
                    break;
                return eElem.getAttribute('data-dfrowid')
            }
        }
        return null;
    },

    // === Drag & Drop ===

    getDragData : function (oEv, eDraggedElem) {
        try {
            let sTagText = eDraggedElem.getAttribute("data-dfrowid");
            return [{data : sTagText}, df.dragActions.WebTagsForm.ciDragTag]
        } catch (err) {
            // This can happen if the drag action is not supported, we don't want a nasty error if so.
            console.error("Attempt to perform unsupported drag action");
            return [null, null];
        }
    },

    getDropData : function (oDropZone, oPosition) {
        if (oDropZone && oDropZone._eDropElem) {
            const eTextElem = (df.dom.query(oDropZone._eDropElem, '.WebTgf_Text'));
            let sTagText = '';
            if (eTextElem) {
                sTagText = eTextElem.innerHTML;
            }

            const dropData = {
                data : sTagText,
                action : df.dropActions.WebTagsForm.ciDropOnInput
            }

            return dropData;
        }
        return null;
    },

    initDraggableElements : function() {
        // Done whenever a tag is added (draggble="true" attribute in addTag html)
    },

    initDropZones : function () {
        this._aDropZones = [];

        if (this.isSupportedDropAction(df.dropActions.WebTagsForm.ciDropOnInput)) {
            // Mark input as drop zone
            const eZone = (df.dom.query(this._eElem, '.WebFrm_Wrapper'));
            this.addDropZone(eZone);
        }
    },

    determineDropCandidate : function(oEv, aHelpers) {
        let eElem = document.elementFromPoint(oEv.e.x, oEv.e.y);
        let bSupported = false;

        for (let i = 0; i < aHelpers.length; i++) {
            if (aHelpers[i].supportsDropAction(this, df.dropActions.WebTagsForm.ciDropOnInput)) {
                bSupported = true;
                break;
            }
        }
        
        while (eElem != this._eElem) {
            if (eElem.hasAttribute('data-dfrowid') && bSupported) {
                return [eElem, df.dropActions.WebTagsForm.ciDropOnInput];
            }
            eElem = eElem.parentNode;
        }

        // We want to support being able to drop when hovering anywhere in the input
        // As a last-ditch effort, try to find the last tag and use that as the element
        const aElems = df.dom.query(this._eElem, '.WebTgf_Tag', true);
        if (aElems && aElems.length > 0 && bSupported) {
            eElem = aElems[(aElems.length -1)];
            if (eElem.hasAttribute('data-dfrowid')) {
                return [eElem, df.dropActions.WebTagsForm.ciDropOnInput];
            } else if (eElem.hasAttribute('data-dfdropplaceholder')) {
                return [aElems[(aElems.length - 2)], , df.dropActions.WebTagsForm.ciDropOnInput];
            }
        }
        return [null, null];
    },

    determineDropPosition : function(oEv, eElem) {
        const oRect = df.sys.gui.getBoundRect(eElem);
        // We want to check if we are more to the left or to the right of the hovered tag
        const iMid = (oRect.right - (oRect.width / 2));
        if (oEv.e.x >= iMid) {
            return df.dropPositions.ciDropAfter;
        } else {
            return df.dropPositions.ciDropBefore;
        }
    },

    interactWithDropElem : function(dropZone, eElem) {
        let eTempElem = document.createElement('div');
        eTempElem.innerHTML = 'DROP'; // ToDo: Translate?
        df.dom.addClass(eTempElem, 'WebTgf_Tag WebTgf_DropPlaceHolder');
        dropZone.insertElement(eTempElem, eElem);
    },

    doEmptyInteraction : function(dropZone) {
        let eTempElem = document.createElement('div');
        eTempElem.innerHTML = 'DROP'; // ToDo: Translate?
        df.dom.addClass(eTempElem, 'WebTgf_Tag WebTgf_DropPlaceHolder');
        const eTargetElem = (df.dom.query(this._eElem, '.WebFrm_PromptSpacer'));
        dropZone.insertElement(eTempElem, eTargetElem);

        return df.dropActions.WebTagsForm.ciDropOnInput;
    },

    hasData : function () {
        return (this.get('psValue') != '');
    },
});