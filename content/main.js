let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;
let Cr = Components.results;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Lazily-loaded browser scripts:
[
  ["UserAgent", "chrome://readability/content/UserAgent.js"],
  ["Readability", "chrome://readability/content/Readability.js"]
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

var Browser = function () {
  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  let browser = document.createElementNS(XUL_NS, "browser");
  browser.setAttribute("type", "content");
  document.documentElement.appendChild(browser);
  this._browser = browser;
};

Browser.prototype = {
  onLoad: function (callback) {
    this._browser.addEventListener("DOMContentLoaded", function (evt) {
      let doc = evt.originalTarget;

      if (doc.location == "about:blank")
        return;

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
    xhr.overrideMimeType("application/json");
    xhr.addEventListener("readystatechange", function () {
      if (xhr.readyState == 4) {
        callback(JSON.parse(xhr.responseText));
      }
    }, false);
    xhr.send();
  },

  getReaderURI: function (uri) {
    let pathBase;
    try {
      pathBase = Services.io.newURI(".", null, uri).spec
    } catch (e) {
      dump("Reader: could not get pathBase: " + e);
    }

    return {
      spec: uri.spec,
      host: uri.host,
      prePath: uri.prePath,
      scheme: uri.scheme,
      pathBase: pathBase
    };
  },

  _id: 0,
  
  _callbacks: {},

  _getWorker: function () {
    if (!this._worker) {
      this._worker = new ChromeWorker("readerWorker.js");
      this._worker.onmessage = function (evt) {
        let id = evt.data.id;
        this._callbacks[id](evt.data);
        delete this._callbacks[id];
      }.bind(this);
    }

    return this._worker;
  },

  _parseInWorker: function Reader_parseInWorker(uri, doc, callback) {
    let worker = this._getWorker();
    let id = ++this._id;
    this._callbacks[id] = callback;

    worker.postMessage({
      id: id,
      uri: this.getReaderURI(uri),
      doc: new XMLSerializer().serializeToString(doc)
    });
  },

  checkReadability: function (url, td1, td2) {
    let fullBrowser = new Browser();
    let uri = Services.io.newURI(url, null, null);

    fullBrowser.onLoad(function (doc) {
      this._parseInWorker(uri, doc, function (result) {
        let article = result.article;
        td2.textContent = result.time;
        td1.textContent = (article != null);
        if (article != null) {
          td1.parentNode.onclick = function () {
            var doc = document.getElementById("preview").contentDocument;
            var elems = document.getElementById("frame").contentDocument.getElementsByTagName("tr");
            for (let i = 0; i < elems.length; i++) {
              elems[i].style.backgroundColor = "";
            }
            td1.parentNode.style.backgroundColor = "#abc";
            var header = doc.getElementById("reader-header");
            var content = doc.getElementById("reader-content");
            content.innerHTML = article.content;
            header.textContent = article.title;
          };
        }
        fullBrowser.remove();
      });
    }.bind(this));

    fullBrowser.loadURI(url);
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

      driver.checkReadability(url, td1, td2);
    }
  });
}, false);

