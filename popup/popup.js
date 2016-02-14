var sendCommand = function sendCommand(commandName, responseHandler) {
        (function (commandName, responseHandler) {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
              console.assert(tabs.length == 1);
              var tab  = tabs[0];
              if (typeof responseHandler === "undefined") {
                  responseHandler = null;
              }
              chrome.tabs.sendMessage(tab.id, { command: commandName }, responseHandler);
            });
        })(commandName, responseHandler);
    }

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

var BackgroundInterface;
(function (BackgroundInterface) {
    function getTabStateManager() {
        return chrome.extension.getBackgroundPage()["BackgroundScript"].getTabStateManager();
    }
    BackgroundInterface.getTabStateManager = getTabStateManager;
})(BackgroundInterface || (BackgroundInterface = {}));

var Popup;
(function (Popup) {
    var prevButton = document.getElementById("prev");
    var nextButton = document.getElementById("next");
    var copyButton = document.getElementById("copy");
    var queryInput = document.getElementById("query");
    var caseInsensitiveCheckbox = document.getElementById("case-insensitive");

    var chromeStoreURL = "https://chrome.google.com/webstore/";

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      console.assert(tabs.length == 1);
      var tab = tabs[0];
      var id = tab.id;
      var tabStates = BackgroundInterface.getTabStateManager();

      if (!tabStates.exists(id)) {
          tabStates.resetState(id);
          var tabState = tabStates.get(id);
      }

      addListeners(id, tabStates);
      restoreState(id, tabStates);

      setNextButtonState(id, tabStates);
      setPrevButtonState(id, tabStates);
      setCopyButtonState(id, tabStates);
      console.log(JSON.stringify(tabStates));

      if (tab.url.indexOf(chromeStoreURL) == 0) {
          document.getElementById("chrome-store-warning").style.display = "block";
      }
    });

    function setNextButtonState(tabId, tabStates) {
        if(tabStates !== undefined) {
            if (tabStates.isSearching(tabId)) {
                nextButton.disabled = false;
            } else {
                nextButton.disabled = true;
            }
        } else {
            nextButton.disabled = true;
        }
    }

    function setPrevButtonState(tabId, tabStates) {
        if(tabStates !== undefined) {
            if (tabStates.isSearching(tabId)) {
                prevButton.disabled = false;
            } else {
                prevButton.disabled = true;
            }
        } else {
            prevButton.disabled = true;
        }
    }

    function setCopyButtonState(tabId, tabStates) {
      console.log("Setting copy button state with tabStates = " + JSON.stringify(tabStates));
      if(tabStates !== undefined) {
          if (tabStates.isSearching(tabId)) {
              copyButton.disabled = false;
          } else {
              copyButton.disabled = true;
          }
      } else {
          copyButton.disabled = true;
      }
    }

    function addListeners(id, tabStates) {
        var prevButtonClick = function () {
            if (tabStates.isSearching(id)) {
                sendCommand("prev");
            } else {
                search(id, tabStates);
            }
        };

        var nextButtonClick = function () {
            if (tabStates.isSearching(id)) {
                sendCommand("next");
            } else {
                search(id, tabStates);
            }
        };

        var copyButtonClick = function () {
          if (tabStates.isSearching(id)) {
            sendCommand("copy");
          }
        };

        var queryInputKeyDown = function (event) {
            if (event.keyCode == 13) {
                if (!(tabStates.isSearching(id))) {
                    search(id, tabStates);
                }
            } else if (event.keyCode == 27) {
                setSearching(id, false, tabStates);
                sendCommand("clear");
            }
        };

        var queryInputInput = function () {
            tabStates.set(id, "query", queryInput.value);

            if (tabStates.isSearching(id)) {
                setSearching(id, false, tabStates);
                sendCommand("clear");
            }

            queryInput.className = '';

            copyButton.disabled = true;
            nextButton.disabled = true;
            prevButton.disabled = true;
        };

        var checkboxClick = function () {
            tabStates.set(id, "caseInsensitive", caseInsensitiveCheckbox.checked);

            if (tabStates.isSearching(id)) {
                setSearching(id, false, tabStates);
                sendCommand("clear");
            }
        };

        prevButton.addEventListener("click", prevButtonClick);
        nextButton.addEventListener("click", nextButtonClick);
        copyButton.addEventListener("click", copyButtonClick);
        queryInput.addEventListener("keydown", queryInputKeyDown);
        queryInput.addEventListener("input", queryInputInput);
        caseInsensitiveCheckbox.onclick = checkboxClick;
    }

    function restoreState(tabId, tabStates) {
        queryInput.value = tabStates.get(tabId, "query");
        caseInsensitiveCheckbox.checked = tabStates.get(tabId, "caseInsensitive");
    }

    function search(tabId, tabStates) {
        if (validate(queryInput.value)) {
            queryInput.className = '';
            var insensitive = caseInsensitiveCheckbox.checked;

            chrome.tabs.sendMessage(tabId, {
                command: "search",
                caseInsensitive: insensitive,
                regexp: queryInput.value
            });
            setSearching(tabId, true, tabStates);
        } else {
            queryInput.className = 'invalid';
        }
    }

    function setSearching(tabId, val, tabStates) {
        tabStates.set(tabId, "searching", val);
        // setPrevButtonState(tabId, tabStates);
        // setNextButtonState(tabId, tabStates);
        // setCopyButtonState(tabId, tabStates);
    }

    function validate(regexp) {
        if (regexp != "") {
            try  {
                "".match(regexp);
                return true;
            } catch (e) {
            }
        }
        return false;
    }

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if(request.resultsCount !== undefined) {
            if(request.resultsCount > 0) {
                copyButton.disabled = false;
                nextButton.disabled = false;
            } else {
                copyButton.disabled = true;
                nextButton.disabled = true;
                prevButton.disabled = true;
            }
        }
       console.log("i received something..")
    });

})(Popup || (Popup = {}));
