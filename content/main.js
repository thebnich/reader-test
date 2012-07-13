let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;
let Cr = Components.results;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Lazily-loaded browser scripts:
[
  ["Readability", "chrome://readability/content/Readability.js"],
  ["UserAgent", "chrome://readability/content/UserAgent.js"]
].forEach(function (aScript) {
  let [name, script] = aScript;
  XPCOMUtils.defineLazyGetter(window, name, function() {
    let sandbox = {};
    Services.scriptloader.loadSubScript(script, sandbox);
    return sandbox[name];
  });
});

// Request mobile versions of sites
let ua = new UserAgent("Mozilla/5.0 (Android; Mobile; rv:15.0) Gecko/15.0 Firefox/15.0");
ua.override();

// A full-featured browser, equivalent to what's used by the user.
var Browser = function () {
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  let browser = document.createElementNS(XUL_NS, "browser");
  browser.setAttribute("type", "content");
  document.documentElement.appendChild(browser);
  this._browser = browser;
};

// A stripped down browser with JS, images, etc. removed. This is what we're
// currently using to parse readability in Fennec.
var StrippedBrowser = function () {
  let browser = document.createElement("browser");
  browser.setAttribute("type", "content");

  document.documentElement.appendChild(browser);
  browser.webNavigation.allowAuth = false;
  browser.webNavigation.allowImages = false;
  browser.webNavigation.allowJavascript = false;
  browser.webNavigation.allowMetaRedirects = true;
  browser.webNavigation.allowPlugins = false;
  this._browser = browser;
};

Browser.prototype = StrippedBrowser.prototype = {
  onLoad: function (callback) {
    this._browser.addEventListener("DOMContentLoaded", function (evt) {
      let doc = evt.originalTarget;
      // ignore on frames
      if (doc.defaultView != this._browser.contentWindow)
        return;

      callback(doc);
    }.bind(this));
  },

  loadURI: function (url) {
    this._browser.loadURI(url, null, null);
  },

  remove: function () {
    this._browser.parentNode.removeChild(this._browser);
  }
};

let Driver = function (url) {
  this.url = url;
};

Driver.prototype = {
  loadTestPages: function (callback) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", this.url, true);
    xhr.addEventListener("readystatechange", function () {
      if (xhr.readyState == 4) {
        callback(JSON.parse(xhr.responseText));
      }
    }, false);
    xhr.send();
  },

  checkReadability: function (url, td1, td2, td3, td4) {
    function getReadability(doc) {
      let uri = Services.io.newURI(doc.location, null, null);
      let clone = doc.cloneNode(true);
      return new Readability(uri, clone);
    }

    function updateRowColor() {
      if (td1.textContent && td3.textContent) {
        let bg;
        bg = (td1.textContent == td3.textContent) ? "#4b6" : "b64";
        td1.parentNode.style.backgroundColor = bg;
      }
    }
    
    let fullBrowser = new Browser();
    fullBrowser.onLoad(function (doc) {
      let start = Date.now();
      let readability = getReadability(doc);
      td1.textContent = readability.parse() != null;
      td2.textContent = (Date.now() - start);
      updateRowColor();
      fullBrowser.remove();
    });

    let strippedBrowser = new StrippedBrowser();
    strippedBrowser.onLoad(function (doc) {
      let start = Date.now();
      let readability = getReadability(doc);
      td3.textContent = readability.check();
      td4.textContent = (Date.now() - start);
      updateRowColor();
      strippedBrowser.remove();
    });

    fullBrowser.loadURI(url);
    strippedBrowser.loadURI(url);
  }
};

window.addEventListener("load", function () {
  let driver = new Driver("chrome://readability/content/sites.json");
  driver.loadTestPages(function (urls) {
    let frame = document.getElementById("frame");
    let table = frame.contentDocument.getElementById("results");
    for (let i = 0; i < urls.length; i++) {
      let url = urls[i];
      let tr = frame.contentDocument.createElement("tr");
      table.appendChild(tr);

      let siteTd = frame.contentDocument.createElement("td");
      tr.appendChild(siteTd);
      siteTd.textContent = url;

      let td1 = frame.contentDocument.createElement("td");
      tr.appendChild(td1);
      let td2 = frame.contentDocument.createElement("td");
      tr.appendChild(td2);
      let td3 = frame.contentDocument.createElement("td");
      tr.appendChild(td3);
      let td4 = frame.contentDocument.createElement("td");
      tr.appendChild(td4);

      driver.checkReadability(url, td1, td2, td3, td4);
    }
  });
}, false);

