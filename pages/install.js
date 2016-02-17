document.addEventListener("DOMContentLoaded", function(){
  console.log("setVersion called");
  var versionElement = document.getElementById("version");
  var version = chrome.runtime.getManifest().version;
  versionElement.innerHTML = version;
}, false);
