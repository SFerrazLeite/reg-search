var Content;
(function (Content) {
    var jsonMatches = [];
    var marks = [];
    var cur = 0;

    chrome.runtime.sendMessage({ event: "loaded" });

    var JsonStoreField = (function() {
      function JsonStoreField() {
        this.jsonField = document.createElement('textarea');
        this.jsonField.style.display = "none";
        document.getElementsByTagName('body')[0].appendChild(this.jsonField);

      }

      JsonStoreField.prototype.setJson = function(text) {
        this.jsonField.innerHTML = text;
      }

      JsonStoreField.prototype.copyJsonToClipboard = function() {
        this.jsonField.style.display = "block";
        this.jsonField.select();
        document.execCommand('copy');
        this.jsonField.style.display = "none";
      }
      return JsonStoreField;
    })();
    var jsonStoreField = new JsonStoreField();

    var InfoSpan = (function () {
        function InfoSpan() {
            var _this = this;
            this.span = document.createElement('span');
            
            // to move to the class name __regexp_search_count ...when i sober up
            this.span.style.fontFamily = "Helvetica, sans-serif";
            this.span.style.fontSize = "13px";
            this.span.style.cursor = "pointer";

            this.span.className = "__regexp_search_count";

            this.span.addEventListener('mouseover', function (event) {
                // _this.span.style.opacity = "0";
                _this.span.style.right = "0";
                _this.span.style.left = "initial";
            });
            this.span.addEventListener('mouseout', function (event) {
                // _this.span.style.opacity = "1";
                _this.span.style.right = "initial";
                _this.span.style.left = "0";
            });
        }
        InfoSpan.prototype.setText = function (text) {
            this.span.innerHTML = text;
        };

        InfoSpan.prototype.remove = function () {
            if (this.span.parentNode) {
                this.span.parentNode.removeChild(this.span);
            }
        };

        InfoSpan.prototype.add = function () {
            if (!this.span.parentNode) {
                document.getElementsByTagName('body')[0].appendChild(this.span);
            }
        };

        return InfoSpan;
    })();

    var infoSpan = new InfoSpan();

    function makeTimeoutCall(fn, data, timeout) {
        setTimeout(function () {
            fn.call(null, data);
        }, timeout);
    }

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.command == "search") {
            var flags = "g";
            if (request.caseInsensitive === true) {
                flags = "gi";
            }
            clear();
            infoSpan.add();
            infoSpan.setText("Searching...");
            var re = new RegExp(request.regexp, flags);

            makeTimeoutCall(function (re) {
                delayedSearch(re);
            }, re, 10);
        } else if (request.command == "clear") {
            clear();
        } else if (request.command == "copy") {
            copyToClipboard();
        } else if (request.command == "prev") {
            move(false);
        } else if (request.command == "next") {
            move(true);
        }
        if (request.command != "search") {
            if (marks.length > 0) {
                marks[cur].className = "__regexp_search_selected";
                if (!elementInViewport(marks[cur])) {
                    $('body').scrollTop($(marks[cur]).offset().top - 20);
                }
            }
        }
    });

    function delayedSearch(re) {
        jsonMatches = [];
        var html = document.getElementsByTagName('body')[0];
        html.normalize();

        recurse(html, re);

        chrome.runtime.sendMessage({
            from: "content",
            resultsCount: marks.length,
            position: null
        });

        displayCount();
        if (marks.length > 0) {
            marks[cur].className = "__regexp_search_selected";

            if (!elementInViewport(marks[cur])) {
                $('body').scrollTop($(marks[cur]).offset().top - 20);
            }
        }
    }

    function recurse(element, regexp) {
        if (element.nodeName == "MARK" || element.nodeName == "SCRIPT" || element.nodeName == "NOSCRIPT" || element.nodeName == "STYLE" || element.nodeType == Node.COMMENT_NODE) {
            return;
        }

        if (element.id == '_regexp_search_count') {
            return;
        }

        if (element.nodeType != Node.TEXT_NODE) {
            var disp = $(element).css('display');
            if (disp == 'none' || disp == 'hidden') {
                return;
            }
        }

        if (element.childNodes.length > 0) {
            for (var i = 0; i < element.childNodes.length; i++) {
                recurse(element.childNodes[i], regexp);
            }
        }

        if (element.nodeType == Node.TEXT_NODE && element.nodeValue.trim() !== '') {
            var str = element.nodeValue;
            var matches = str.match(regexp);
            var parent = element.parentNode;

            if (matches !== null) {
                var pos = 0;
                var mark;
                for (var i = 0; i < matches.length; i++) {
                    var index = str.indexOf(matches[i], pos);
                    var before = document.createTextNode(str.substring(pos, index));
                    pos = index + matches[i].length;

                    if (element.parentNode == parent) {
                        parent.replaceChild(before, element);
                    } else {
                        parent.insertBefore(before, mark.nextSibling);
                    }

                    mark = document.createElement('mark');
                    mark.appendChild(document.createTextNode(matches[i]));

                    jsonMatches.push(matches[i]);

                    parent.insertBefore(mark, before.nextSibling);
                    marks.push(mark);
                }
                var after = document.createTextNode(str.substring(pos));
                parent.insertBefore(after, mark.nextSibling);
                jsonStoreField.setJson(JSON.stringify(jsonMatches));
            }
        }
    }

    function clear() {
        infoSpan.setText("Clearing...");
        setTimeout(function () {
            cur = 0;
            for (var i = 0; i < marks.length; i++) {
                var mark = marks[i];
                mark.parentNode.replaceChild(mark.firstChild, mark);
            }
            marks.length = 0;
            infoSpan.remove();
        }, 10);
    }

    function displayCount() {
        var num;
        if (marks.length > 0) {
            num = cur + 1;
        } else {
            num = 0;
        }
        infoSpan.setText(num + " of " + marks.length + " matches.");
        infoSpan.add();
    }

    function move(next) {
        if (marks.length > 0) {
            console.assert(cur >= 0 && cur < marks.length);
            marks[cur].className = "";
            if (next) {
                nextMatch();
            } else {
                prevMatch();
            }
            marks[cur].className = "__regexp_search_selected";
            if (!elementInViewport(marks[cur])) {
                $('body').scrollTop($(marks[cur]).offset().top - 20);
            }
            infoSpan.setText((cur + 1) + " of " + marks.length + " matches.");
        }
    }

    function nextMatch() {
        cur++;
        cur %= marks.length;

        chrome.runtime.sendMessage({
            from: "content",
            resultsCount: marks.length,
            position: cur
        });
    }

    function prevMatch() {
        cur--;
        if (cur < 0) {
            cur += marks.length;
        }

        chrome.runtime.sendMessage({
            from: "content",
            resultsCount: marks.length,
            position: cur
        });
    }


    function copyToClipboard() {
      jsonStoreField.copyJsonToClipboard();
    }


    function elementInViewport(el) {
        var top = el.offsetTop;
        var left = el.offsetLeft;
        var width = el.offsetWidth;
        var height = el.offsetHeight;

        while (el.offsetParent) {
            el = el.offsetParent;
            top += el.offsetTop;
            left += el.offsetLeft;
        }

        return top >= window.pageYOffset && left >= window.pageXOffset && (top + height) <= (window.pageYOffset + window.innerHeight) && (left + width) <= (window.pageXOffset + window.innerWidth);
    }
})(Content || (Content = {}));
