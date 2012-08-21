importScripts("JSDOMParser.js", "Readability.js");

self.onmessage = function (msg) {
  var uri = msg.data.uri;
  var id = msg.data.id;
  var start = Date.now();
  try {
    var doc = new JSDOMParser().parse(msg.data.doc);
    var article = new Readability(uri, doc).parse();
    var time = Date.now() - start;
    postMessage({ article: article, id: id, time: time });
  } catch (e) {
    dump("Error in worker. URI: " + uri.spec + ", Error: " + e + "\n");
    var time = Date.now() - start;
    postMessage({ id: id, time: time });
  }
};
