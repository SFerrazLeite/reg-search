var TabStateManager = (function () {
    function TabStateManager() {
        this.tabStates = {};
    }
    TabStateManager.prototype.remove = function (tabId) {
        delete this.tabStates[tabId];
    };

    TabStateManager.prototype.exists = function (tabId) {
        return typeof (this.tabStates[tabId]) !== "undefined";
    };

    TabStateManager.prototype.resetState = function (tabId) {
        var caseInsensitiveVal = localStorage["caseInsensitive"] == "true";
        this.set(tabId, { query: "", searching: false, caseInsensitive: caseInsensitiveVal });
    };

    TabStateManager.prototype.isSearching = function (tabId) {
        return this.get(tabId, "searching");
    };

    TabStateManager.prototype.set = function (tabId, stateOrPropName, propVal) {
        if (typeof propVal === "undefined") {
            this.tabStates[tabId] = stateOrPropName;
        } else {
            this.tabStates[tabId][stateOrPropName] = propVal;
        }
    };

    TabStateManager.prototype.get = function (tabId, propName) {
        if (typeof propName === "undefined") {
            return this.tabStates[tabId];
        } else {
            return this.tabStates[tabId][propName];
        }
    };
    return TabStateManager;
})();

var TabState = (function () {
    function TabState() {
    }
    return TabState;
})();

//keyboard handler is used to receive events as specified in the manifest.
//proper events, e.g., "next" are forwarded to the content.js using the
//chrome.tabs API
var KeyboardHandler;
(function (KeyboardHandler) {
    var lastCalled = 0;

    function init(tabStates) {
        //Add listeners to keyboard input for shortcut operations
        chrome.commands.onCommand.addListener(function (commandName) {
            //Select tab with content to be parsed - and add callback function
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
                console.assert(tabs.length == 1);
                var tab = tabs[0];
                var id = tab.id;

                var d = new Date();
                if (tabStates.exists(id) && tabStates.get(id, "searching") && d.getTime() - lastCalled > 50) {
                    if (commandName == "next" || commandName == "prev") {
                      chrome.tabs.sendMessage(tab.id, { command: commandName }, null);
                    }
                    lastCalled = d.getTime();
                }
            });
        });
    }
    KeyboardHandler.init = init;
})(KeyboardHandler || (KeyboardHandler = {}));

var BackgroundScript;
(function (BackgroundScript) {
    var tabStates;

    function getTabStateManager() {
        console.log("getTabStateManager called in background");
        console.log(JSON.stringify(tabStates));
        return tabStates;
    }
    BackgroundScript.getTabStateManager = getTabStateManager;

    function init() {
        tabStates = new TabStateManager();
        addTabStateListeners(tabStates);

        KeyboardHandler.init(tabStates);

    }

    function addTabStateListeners(tabStates) {
        console.log("addTabStateListeners called in background");
        chrome.runtime.onMessage.addListener(function (request, sender) {
            console.log("event received - " + JSON.stringify(request.event));
            var id = sender.tab.id;

            if (request.event == "loaded") {
                if (!tabStates.exists(id)) {
                    tabStates.resetState(id);
                } else {
                    tabStates.set(id, "searching", false);
                }
            }
        });

        chrome.tabs.onRemoved.addListener(function (id) {
            tabStates.remove(id);
        });
    }

    init();
})(BackgroundScript || (BackgroundScript = {}));
