var mimConfig = new function() {
    this.url = "ws://localhost:30000";
};

function MimWebSocket(url)
{    
    var localCache = new MimLocalModelCache();
    var remoteCache = new MimModelCache();
    var self = this;

    // Check that websockets are supported by this browser
    if ("WebSocket" in window) {

        // Open a websocket
        var mimSocket = new WebSocket(url);

        mimSocket.onopen = function() {
            console.log("Websocket open");
        };
        
        
        mimSocket.onmessage = function(event) {
            if (event.data instanceof Blob) {
//                console.log("About to parse blob");
                parseBlob(event.data, self.parseMessage);
            } else if (typeof event.data === "string") {
//                console.log("About to parse JSON");
                parseJson(event.data, self.parseMessage);
            }
        };

        mimSocket.onclose = function() {
            console.log("Websocket closed");
        };
    } else {
        alert("This browser does not support WebSocket");
    }
    
    this.updateModelHashes = function(modelName, currentHash, remoteHash, metaData) {
        mimSocket.send(makeJsonHashUpdate(modelName, currentHash, remoteHash, metaData));        
    };

    this.updateModelValue = function(modelName, currentHash, remoteHash, metaData, value) {
        mimSocket.send(makeJsonValueUpdate(modelName, currentHash, remoteHash, metaData, value));        
    };
    
    this.parseMessage = function(parsedMessage) {
//        console.log("Blob message received: version:" + parsedMessage.version + " software version:" + parsedMessage.softwareversion + " model:" + parsedMessage.modelName + " hash server:" + parsedMessage.localHash + " hash last client:" + parsedMessage.lastRemoteHash + " value:" + parsedMessage.value);
        
        // Get the remote model cache
        var remoteModelCache = remoteCache.getModelCacheEntry(parsedMessage.modelName);
        
        // Get the local model cache
        var localModelCache = localCache.getModelCacheEntry(parsedMessage.modelName);
        
        //Update the remote model cache
        remoteModelCache.updateHashes(parsedMessage.localHash, parsedMessage.lastRemoteHash);
        
        updateModel(localModelCache, new MimRemoteModelProxy(self, parsedMessage.modelName, parsedMessage.value, parsedMessage.metaData, parsedMessage.payloadType, remoteModelCache));
    };
    
    this.addListener = function(modelName, listener) {
        localCache.getModelCacheEntry(modelName).addListener(listener);
        
        // Get the remote model cache
        var remoteModelCache = remoteCache.getModelCacheEntry(modelName);
        
        // Get the local model cache
        var localModelCache = localCache.getModelCacheEntry(modelName);
        
        // Send the current hashes to the remote server, which will trigger a value update if they are not arleady up to date.
        this.updateModelHashes(modelName, localModelCache.currentHash, localModelCache.remoteHash, localModelCache.getCurrentMetaData());
    };
    
    this.executeWhenConnected = function(callback) {
        setTimeout(function () {
            if (mimSocket.readyState === 1) {
                callback();
                return;
            } else {
                self.executeWhenConnected(callback);
            }
        }, 5); // wait 5 miliseconds
    };
    
}

 var Mim = (function () {
     var mimSingleton;

     function createInstance() {
         var mim = new MimSingleton();
         return mim;
     }

     return {
         getSingleton: function () {
             if (!mimSingleton) {
                 mimSingleton = createInstance();
             }
             return mimSingleton;
         }
     };
 })();


function MimSingleton() {
    var mimWebSocket = new MimWebSocket(mimConfig.url);

    this.addListener = function(modelName, listener) {
        mimWebSocket.executeWhenConnected(function() {
            mimWebSocket.addListener(modelName, listener);
        });
    };
    
};

//function LocalModelProxy(clientCacheEntry) {
//    this.clientCacheEntry = clientCacheEntry;
//    this.hashes = this.clientCacheEntry.hashes;
//}
//
//LocalModelProxy.prototype = {
//    updateCurrentHash: function(currentHash) {
//        this.hashes.updateCurrent(currentHash);
//    },
//    
//    updateLastRemoteHash: function(remoteHash) {
//        this.hashes.updateRemote(remoteHash);
//    },
//
//    updateCurrentValueToRemoteValue: function(currentHash, value) {
//        this.hashes.updateCurrentAndRemote(currentHash);
//        this.clientCacheEntry.notify(value);
//    },
//
//    getCurrentValue: function() {
//        return this.clientCacheEntry.cachedValue;
//    },
//    
//    getHashes: function() {
//        return this.hashes;
//    }
// };

function MimRemoteModelProxy(websocket, modelName, modelValue, metaData, payloadType, modelCacheEntry) {
    this.websocket = websocket;
    this.modelName = modelName;
    this.modelValue = modelValue;
    this.metaData = metaData;
    this.payloadType = payloadType;
    this.modelCacheEntry = modelCacheEntry;
}

MimRemoteModelProxy.prototype = {
    updateHashes: function(currentHash, remoteHash, metaData) {
        this.websocket.updateModelHashes(this.modelName, currentHash, remoteHash, metaData);
    },
    
    updateAndNotify: function(currentHash, remoteHash, metaData, value) {
        this.websocket.updateModelValue(this.modelName, currentHash, remoteHash, metaData, value);
    },
        
    getCache: function() {
        return this.modelCacheEntry;
    },
    
    isValueProvided: function() {
        return this.payloadType === 'data'; 
    },
    
    getCurrentValue: function() {
        return this.modelValue;
    },
    
    getCurrentMetaData: function() {
        return this.metaData;
    }    
 };

function updateModel(localProxy, remoteProxy) {
        var localCache = localProxy.getCache();
        var remoteCache = remoteProxy.getCache();
        
        if (localCache.currentHash === remoteCache.currentHash) {
            // Model values are in sync
            
            if (localCache.currentHash && remoteCache.currentHash) {
                // If both undefined, then ignore
                
                // Update local cache if necessary. Do this before we update the server.
                if (localCache.remoteHash !== remoteCache.currentHash) {
                    localProxy.updateHash(localCache.currentHash, remoteCache.currentHash);
                }

                // Update remote cache if necessary.
                if (remoteCache.remoteHash !== localCache.currentHash) {
                    remoteProxy.updateHashes(localCache.currentHash, localCache.remoteHash, localProxy.getCurrentMetaData());
                }
            }
            
        } else {
            // Model values are out of sync
            
            if (!localCache.currentHash || (!localCache.hasChanged() && remoteCache.hasChanged())) {
                // Server value has changed, but client is unchanged, or client is undefined
                
                // If the server provided data then we can update the local value. If not, we can at least update the server about our current hashes which should trigger data sending
                if (remoteProxy.isValueProvided()) {
                    // Update local cache and value
                    localProxy.updateAndNotify(remoteCache.currentHash, remoteCache.currentHash, remoteProxy.getCurrentMetaData(), remoteProxy.getCurrentValue());
                }
                
                // Update remote cache if necessary.
                if (remoteCache.remoteHash !== localCache.currentHash) {
                    remoteProxy.updateHashes(localCache.currentHash, localCache.remoteHash,  localProxy.getCurrentMetaData());
                }

            } else if (!remoteCache.currentHash || localCache.hasChanged() && !remoteCache.hasChanged()) {
                // Client value has changed, but server is unchanged, or server is undefined

                // Update local cache if necessary. Do this before we update the server.
                if (localCache.remoteHash !== remoteCache.currentHash) {
                    localProxy.updateHashes(localCache.currentHash, remoteCache.currentHash, remoteProxy.getCurrentMetaData());
                }

                // Update remote cache and model value
                remoteProxy.updateCurrentValueToRemoteValue(localCache.currentHash, localCache.remoteHash, localCache.getCurrentValue());

            } else if (localCache.hasChanged() && remoteCache.hasChanged()) {
                // Both have changed -> conflict. We need to make some decision here
                console.log("Conflict");
                
            } else {
                console.log("Unexpected"); // Unexpected
            }        
            
        }
        
        
    };



function MimModelCache() {
    this.modelDictionary = {};
    
    this.getModelCacheEntry = function(modelName) {
        if (!this.modelDictionary.hasOwnProperty(modelName)) {
            this.modelDictionary[modelName] = new MimModelCacheEntry();
        }
        return this.modelDictionary[modelName];
    };
}

function MimModelCacheEntry(currentHash, remoteHash) {
    if (currentHash) {
        this.currentHash = currentHash;
    } else {
        this.currentHash = null;
    }
    if (remoteHash) {
        this.remoteHash = remoteHash;
    } else {
        this.remoteHash = null;
    }
}

MimModelCacheEntry.prototype = {
     updateHashes: function(currentHash, remoteHash) {
         this.currentHash = currentHash;
         this.remoteHash = remoteHash;
     },
     
     hasChanged: function() {
        return !(this.currentHash === this.remoteHash);
     }
 };


function MimLocalModelCache() {
    this.modelDictionary = {};
    
    this.getModelCacheEntry = function(modelName) {
        if (!this.modelDictionary.hasOwnProperty(modelName)) {
            this.modelDictionary[modelName] = new MimLocalModelCacheEntry();
        }
        return this.modelDictionary[modelName];
    };
}

function MimLocalModelCacheEntry(currentHash, remoteHash) {
    if (currentHash) {
        this.currentHash = currentHash;
    } else {
        this.currentHash = null;
    }
    if (remoteHash) {
        this.remoteHash = remoteHash;
    } else {
        this.remoteHash = null;
    }
    this.listeners = [];
    this.cachedValue = [];
    this.metaData = [];
}

MimLocalModelCacheEntry.prototype = {
    updateHashes: function(currentHash, remoteHash) {
         this.currentHash = currentHash;
         this.remoteHash = remoteHash;
    },
     
    hasChanged: function() {
        return !(this.currentHash === this.remoteHash);
    },
    
    updateAndNotify: function(currentHash, remoteHash, metaData, value) {
        // Update and notify
        this.updateHashes(currentHash, remoteHash);
        this.cachedValue = value;
        this.metaData = metaData;
         
        this.notify(value);
    },

    modifyCurrentHashAndValue: function(newHash, newValue, metaData) {
        // Update and do not notify
        this.currentHash = newHash;
        this.cachedValue = newValue;
        this.metaData = metaData;
    },

    getCache: function() {
        return this;
    },
        
    getCurrentValue: function() {
        return this.cachedValue;
    },

    getCurrentMetaData: function() {
        return this.metaData;
    },

    addListener: function(callback) {
        this.listeners.push(callback);
    },

    removeListener: function (callback) {
        this.listeners = this.listeners.filter(
                function (item) {
                    if (item !== callback) {
                        return item;
                    }
                }
            );
    },
        
    notify: function (o, thisObj) {
        this.cachedValue = o;
        var scope = thisObj || window;
        this.listeners.forEach(function (item) {
            item.call(scope, o);
        });
    }
 };

//function MimHashes(currentHash, remoteHash) {
//    if (currentHash) {
//        this.currentHash = currentHash;
//    } else {
//        this.currentHash = undefined;
//    }
//    if (remoteHash) {
//        this.remoteHash = remoteHash;
//    } else {
//        this.remoteHash = undefined;
//    }
//}

//MimHashes.prototype = {
//     hasChanged: function() {
//        return !(this.currentHash === this.remoteHash);
//     },
//     
//     updateCurrent: function(remoteHash) {
//         this.currentHash = remoteHash.currentHash;
//     },
//     
//     updateRemote: function(remoteHash) {
//         this.remoteHash = remoteHash.currentHash;
//     },
//     
//     updateCurrentAndRemote: function(remoteHash) {
//         this.currentHash = remoteHash.currentHash;
//         this.remoteHash = remoteHash.currentHash;
//     }
// };
//


function parseBlob(blob, callback) {
    var fileReader = new FileReader();
    fileReader.onload = function() {
        var arrayBuffer = this.result;
        ParseArrayBuffer(arrayBuffer, callback);
    };
    fileReader.readAsArrayBuffer(blob);
}

function parseJson(jsonMessage, callback) {
//    console.log("String message received:" + jsonMessage);
    var parsed = JSON.parse(jsonMessage);
    var parsedMessage = new ParsedMessage(parsed.version, parsed.softwareVersion, parsed.modelName, parsed.localHash, parsed.lastRemoteHash, parsed.metaData, parsed.payloadType, parsed.value);
    callback(parsedMessage);
}

function makeJsonHashUpdate(modelName, currentHash, remoteHash, metaData) {
    var jsonMessage = {};
    jsonMessage.version = 1;
    jsonMessage.softwareVersion = 1;
    jsonMessage.modelName = modelName;
    jsonMessage.localHash = currentHash;
    jsonMessage.lastRemoteHash = remoteHash;
    jsonMessage.payloadType = 'hashes';
    jsonMessage.metaData = metaData;
    return JSON.stringify(jsonMessage);
}

function makeJsonValueUpdate(modelName, currentHash, remoteHash, metaData, value) {
    var jsonMessage = {};
    jsonMessage.version = 1;
    jsonMessage.softwareVersion = 1;
    jsonMessage.modelName = modelName;
    jsonMessage.localHash = currentHash;
    jsonMessage.lastRemoteHash = remoteHash;
    jsonMessage.payloadType = 'data';
    jsonMessage.metaData = metaData;
    jsonMessage.data = value;
    return JSON.stringify(jsonMessage);
}

function ParseArrayBuffer(data, callback) {
    var bytes = new Uint8Array(data);
    var version = bytes[0];
    var headerLengthBytes = bytes.buffer.slice(1, 5);
    var headerLength = new Uint32Array(headerLengthBytes)[0];
    var dataLengthBytes = bytes.buffer.slice(5, 9);
    var dataLength = new Uint32Array(dataLengthBytes)[0];

    // Decode the header
    var headerBytes = bytes.slice(9, 9 + headerLength);
    var headerString = new TextDecoder("utf-8").decode(headerBytes);
    var header = JSON.parse(headerString);
    var metaData = header.metaData;
    
    // Decode the data
    var dataBytes = bytes.buffer.slice(9 + headerLength, 9 + headerLength + dataLength);
    var dataType = header.dataType;
    var dataDims = header.dataDims;
    var imageType = header.imageType;
    var dataArray;
    
    switch(dataType) {
        case 'MimImageStorage':
            parsedData = decodeMimImageStorage(metaData, dataBytes);
        break;
        default:
            console.log("Unknown data format: " + dataType);            
            throw("Unknown data format: " + dataType);
    }
    
    var parsedMessage = new ParsedMessage(version, header.softwareVersion, header.modelName, header.localHash, header.lastRemoteHash, metaData, header.payloadType, parsedData);

    callback(parsedMessage);
}

function decodeMimImageStorage(metaData, dataBytes) {
    var dataArray;
    switch(metaData.dataType) {
        case 'uint8':
            dataArray = new Uint8Array(dataBytes);
            break;
        case 'uint16':
            dataArray = new Uint16Array(dataBytes);
            break;
        case 'uint32':
            dataArray = new Uint32Array(dataBytes);
            break;
        case 'int8':
            dataArray = new Int8Array(dataBytes);
            break;
        case 'int16':
            dataArray = new Int16Array(dataBytes);
            break;
        case 'int32':
            dataArray = new Int32Array(dataBytes);
            break;
        case 'float':
            dataArray = new Int32Array(dataBytes);
            break;
        default:
            console.log("Unknown data format: " + dataType);
            dataArray = dataBytes;
    }
    
    return new MimImage(dataArray, metaData.dataDims, metaData.dataType, metaData.imageType);
}

function MimImage(data, dimensions, dataType, imageType) {
    this.data = data;
    this.dimensions = dimensions;
    this.dataType = dataType;
    this.imageType = imageType;
    
}

function ParsedMessage(version, softwareVersion, modelName, localHash, lastRemoteHash, metaData, payloadType, value) {
    this.version = version;
    this.softwareVersion = softwareVersion;
    this.modelName = modelName;
    this.localHash = localHash;
    this.lastRemoteHash = lastRemoteHash;
    this.metaData = metaData;
    this.payloadType = payloadType;
    this.value = value;
}

