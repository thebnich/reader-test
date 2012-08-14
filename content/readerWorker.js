importScripts("JSDOMParser.js", "Readability.js");

self.onmessage = function (msg) {
  var uri = msg.data.uri;
  var doc = new JSDOMParser().parse(msg.data.doc);
  var article = new Readability(uri, doc).parse();
  postMessage(article);
};
