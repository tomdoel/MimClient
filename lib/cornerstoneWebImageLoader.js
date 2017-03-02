/*! cornerstoneWebImageLoader - v0.5.2 - 2015-09-06 | (c) 2015 Chris Hafey | https://github.com/chafey/cornerstoneWebImageLoader */
cornerstoneWebImageLoader = {};
//
// This is a cornerstone image loader for web images such as PNG and JPEG
//

(function ($, cornerstone, cornerstoneWebImageLoader) {

    "use strict";

    var canvas = document.createElement('canvas');
    var lastImageIdDrawn = "";


    var options = {
      // callback allowing customization of the xhr (e.g. adding custom auth headers, cors, etc)
      beforeSend : function(xhr) {}
    };

    function createImageObject(image, imageId)
    {
        // extract the attributes we need
        var rows = image.naturalHeight;
        var columns = image.naturalWidth;

        function getPixelData()
        {
            var imageData = getImageData();
            var imageDataData = imageData.data;
            var numPixels = image.naturalHeight * image.naturalWidth;
            var storedPixelData = new Uint8Array(numPixels * 4);
            var imageDataIndex = 0;
            var storedPixelDataIndex = 0;
            for(var i=0; i < numPixels; i++) {
                storedPixelData[storedPixelDataIndex++] = imageDataData[imageDataIndex++];
                storedPixelData[storedPixelDataIndex++] = imageDataData[imageDataIndex++];
                storedPixelData[storedPixelDataIndex++] = imageDataData[imageDataIndex++];
                storedPixelData[storedPixelDataIndex++] = 255; // alpha
                imageDataIndex++;
            }
            return storedPixelData;
        }

        function getImageData()
        {
            var context;
            if(lastImageIdDrawn !== imageId) {
                canvas.height = image.naturalHeight;
                canvas.width = image.naturalWidth;
                context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                lastImageIdDrawn = imageId;
            }
            else {
                context = canvas.getContext('2d');
            }
            var imageData = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
            return imageData;
        }

        function getCanvas()
        {
            if(lastImageIdDrawn === imageId) {
                return canvas;
            }

            canvas.height = image.naturalHeight;
            canvas.width = image.naturalWidth;
            var context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            lastImageIdDrawn = imageId;
            return canvas;
        }

        function getImage()
        {
            return image;
        }

        // Extract the various attributes we need
        var imageObject = {
            imageId : imageId,
            minPixelValue : 0, // calculated below
            maxPixelValue : 255, // calculated below
            slope: 1.0,
            intercept: 0,
            windowCenter : 127,
            windowWidth : 256,
            render: cornerstone.renderColorImage,
            getPixelData: getPixelData,
            getImageData: getImageData,
            getCanvas: getCanvas,
            getImage: getImage,
            //storedPixelData: extractStoredPixels(image),
            rows: rows,
            columns: columns,
            height: rows,
            width: columns,
            color: true,
            columnPixelSpacing: 1.0,
            rowPixelSpacing: 1.0,
            invert: false,
            sizeInBytes : rows * columns * 4 // we don't know for sure so we over estimate to be safe
        };

        return imageObject;
    }
        
    function loadMimImage(imageId) {
        // Create a deferred object, resolve it with the image object we just created and return the
        // deferred to cornerstone.  Cornerstone will get the image object by calling then() on the
        // deferred
        var deferred = $.Deferred();
        var imageIdStripped = imageId.substring(imageId.indexOf(":") + 1);
        
        Mim.getSingleton().addListener(imageIdStripped, function(mimimage) {
            var width = mimimage.dimensions[0];
            var height = mimimage.dimensions[1];
            var numPixels = width * height;
            var min;
            var max;
            var estWindowCenter = Math.round(min + (max - min)/2);
            var estWindowWidth = Math.round(max - min);
            var imageType = mimimage.imageType;
            var render;
            var color;
            var canvasContext = canvas.getContext('2d');
            var imageData = canvasContext.createImageData(width, height);
            var pixelData = imageData.data;
            
            if (imageType === 1) {
                render = cornerstone.renderGrayscaleImage;
                pixelData = mimimage.data;
                max = Math.max.apply(null, pixelData);
                min = Math.min.apply(null, pixelData);                
                estWindowCenter = Math.round(min + (max - min)/2);
                estWindowWidth = Math.round(max - min);
                color = false;
                
            } else {
                render = cornerstone.renderColorImage;

                var index = 0;
                var sourceIndex = 0;
                for (sourceIndex = 0; sourceIndex < numPixels; sourceIndex++) {
                    pixelData[index++] = Math.min(255, 255*mimimage.data[sourceIndex]); // RED
                    pixelData[index++] = 0; // GREEN
                    pixelData[index++] = 0; // BLUE
                    pixelData[index++] = 180; // ALPHA
                }
                max = 255;
                min = 0;
                estWindowCenter = 128;
                estWindowWidth = 255;
                color = true;
            }
            canvasContext.putImageData(imageData, 0, 0);
            
            var bytesPerPixel;
            switch(mimimage.dataType) {
                case 'uint8':
                    bytesPerPixel = 4; //RGBA
                    break;
                case 'uint16':
                    bytesPerPixel = 2;
                    break;
                case 'uint32':
                    bytesPerPixel = 4;
                    break;
                case 'int8':
                    bytesPerPixel = 4; //RGBA
                    break;
                case 'int16':
                    bytesPerPixel = 2;
                    break;
                case 'int32':
                    bytesPerPixel = 4;
                    break;
                default:
                    console.log("Unknown data format: " + mimimage.dataType); 
            }
            
            function getPixelData() {
                return pixelData;
            }
            
            function getCanvas()
            {
                return canvas;
            }            
            
            var image = {
                imageId: imageId,
                minPixelValue: min,
                maxPixelValue: max,
                slope: 1.0,
                intercept: 0,
                windowCenter: estWindowCenter,
                windowWidth: estWindowWidth,
                render: render,
                getPixelData: getPixelData,
                getCanvas: getCanvas,
                rows: height,
                columns: width,
                height: height,
                width: width,
                color: color,
                columnPixelSpacing: 1.0,
                rowPixelSpacing: 1.0,
                invert: false,
                bytesPerPixel: bytesPerPixel,
                sizeInBytes: width * height * bytesPerPixel,
                imageType: imageType
            };
            deferred.resolve(image);        
        });
        
        return deferred;
    }
        
    // Loads an image given a url to an image
    function loadImage(imageId) {

      // create a deferred object
      var deferred = $.Deferred();

      var image = new Image();

      var xhr = new XMLHttpRequest();
      xhr.responseType = "arraybuffer";
      xhr.open("GET", imageId, true);
      options.beforeSend(xhr);
      xhr.onload = function(e) {
        var arrayBufferView = new Uint8Array(this.response);
        var blob = new Blob([arrayBufferView], {type: "image/jpeg"});
        var urlCreator = window.URL || window.webkitURL;
        var imageUrl = urlCreator.createObjectURL(blob);
        image.src = imageUrl;
        image.onload = function() {
          var imageObject = createImageObject(image, imageId);
          deferred.resolve(imageObject);
          urlCreator.revokeObjectURL(imageUrl);
        };
        image.onerror = function() {
          urlCreator.revokeObjectURL(imageUrl);
          deferred.reject();
        };
      }
      xhr.onprogress = function(oProgress) {

        if (oProgress.lengthComputable) {  //evt.loaded the bytes browser receive
            //evt.total the total bytes seted by the header
            //
            var loaded = oProgress.loaded;
            var total = oProgress.total;
            var percentComplete = Math.round((loaded / total)*100);

            $(cornerstone).trigger('CornerstoneImageLoadProgress', {
                imageId: imageId,
                loaded: loaded,
                total: total,
                percentComplete: percentComplete
            });
        }
      };   
      xhr.send();
      return deferred;
    }

    function configure(opts) {
      options = opts;
    }

    // steam the http and https prefixes so we can use standard web urls directly
    cornerstone.registerImageLoader('http', loadImage);
    cornerstone.registerImageLoader('https', loadImage);
    cornerstone.registerImageLoader('mim', loadMimImage);
    cornerstoneWebImageLoader.configure = configure;
    return cornerstone;
}($, cornerstone, cornerstoneWebImageLoader));
