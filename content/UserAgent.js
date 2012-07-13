var EXPORTED_SYMBOLS = ["UserAgent"];

var UserAgent = function (ua) {
  this._ua = ua;
};

UserAgent.prototype = {
  override: function () {
    Services.obs.addObserver(this, "http-on-modify-request", false);
  },

  _getRequestLoadContext: function ua_getRequestLoadContext(aRequest) {
    if (aRequest && aRequest.notificationCallbacks) {
      try {
        return aRequest.notificationCallbacks.getInterface(Ci.nsILoadContext);
      } catch (ex) { }
    }

    if (aRequest && aRequest.loadGroup && aRequest.loadGroup.notificationCallbacks) {
      try {
        return aRequest.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
      } catch (ex) { }
    }

    return null;
  },

  _getWindowForRequest: function ua_getWindowForRequest(aRequest) {
    let loadContext = this._getRequestLoadContext(aRequest);
    if (loadContext)
      return loadContext.associatedWindow;
    return null;
  },

  observe: function ua_observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "http-on-modify-request": {
        let channel = aSubject.QueryInterface(Ci.nsIHttpChannel);
        let channelWindow = this._getWindowForRequest(channel);
        channel.setRequestHeader("User-Agent", this._ua, false);
        break;
      }
    }
  }
};
