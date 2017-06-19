mimImageLoader = {};
//
// Author: Tom Doel
// This is a cornerstone image loader for MIM-websocket images
//

(function ($, cornerstone, mimImageLoader) {

    "use strict";

    var canvas = document.createElement('canvas');
    var lastImageIdDrawn = "";


    var options = {
      // callback allowing customization of the xhr (e.g. adding custom auth headers, cors, etc)
      beforeSend : function(xhr) {}
    };

    function createImageObject(mimimage, imageId)
    {
        var rescaleGrayToColor = false;
        var imageType = mimimage.imageType;
        var width = mimimage.dimensions[0];
        var height = mimimage.dimensions[1];
        var numPixels = width * height;        
        var rows = height;
        var columns = width;
        var rgba;
        var color;
        var render;
        var origPixelData = mimimage.data;
        var minPixelValue = getMin(origPixelData);
        var maxPixelValue = getMax(origPixelData);
        var estWindowCenter = 127;
        var estWindowWidth = 256;
        var bytesPerPixel;
        var canvasContext = canvas.getContext('2d');
        var imageData = canvasContext.createImageData(width, height);
        var rgbaImageData = imageData.data;
        var colormapR = new Uint8Array([0,   0,   255, 0,   170, 170]);
        var colormapG = new Uint8Array([0,   128, 0,   170, 0,   170]);
        var colormapB = new Uint8Array([255, 0,   0,   170, 170, 0  ]);
        
        var dataForDisplay;

        if (imageType == 1) {
            if (rescaleGrayToColor) {
                rgba = true;
                color = true;
                render = cornerstone.renderColorImage;
                bytesPerPixel = 4;
                minPixelValue = 0;
                maxPixelValue = 255;
                estWindowCenter = 128;
                estWindowWidth = 256;
                
                var scale = maxPixelValue-minPixelValue;
                var sourceIndex = 0;
                var destIndex = 0;
            
                dataForDisplay = rgbaImageData;
                for (sourceIndex = 0; sourceIndex < numPixels; sourceIndex++) {
                    var scaledValue = Math.max(0, Math.min(255, (255*(origPixelData[sourceIndex] - minPixelValue)/scale)));
                    dataForDisplay[destIndex++] = scaledValue; // R
                    dataForDisplay[destIndex++] = scaledValue; // G
                    dataForDisplay[destIndex++] = scaledValue; // B
                    dataForDisplay[destIndex++] = 255; // ALPHA        
                }
                
            } else {
                render = cornerstone.renderGrayscaleImage;
                color = false;
                rgba = false;
                bytesPerPixel = getBytesPerPixel(mimimage.dataType);
                estWindowCenter =  Math.round(minPixelValue + (maxPixelValue - minPixelValue)/2);
                estWindowWidth = Math.round(maxPixelValue - minPixelValue);
                dataForDisplay = origPixelData;
            }
            
        } else {
            rgba = true;
            color = true;
            render = cornerstone.renderColorImage;
            bytesPerPixel = 4;
            minPixelValue = 0;
            maxPixelValue = 255;
            estWindowCenter =  128;
            estWindowWidth = 256;

            dataForDisplay = new Uint8Array(numPixels * bytesPerPixel);
            var sourceIndex = 0;
            var destIndex = 0;            
            for (sourceIndex = 0; sourceIndex < numPixels; sourceIndex++) {
                if (origPixelData[sourceIndex] == 0) {
                    dataForDisplay[destIndex++] = 0; // R
                    dataForDisplay[destIndex++] = 0; // G
                    dataForDisplay[destIndex++] = 0; // B
                    dataForDisplay[destIndex++] = 0; // ALPHA                        
                } else {
                    var colourIndex = (origPixelData[sourceIndex] - 1) % 6; 
                    dataForDisplay[destIndex++] = colormapR[colourIndex]; // R
                    dataForDisplay[destIndex++] = colormapG[colourIndex]; // G
                    dataForDisplay[destIndex++] = colormapB[colourIndex]; // B
                    dataForDisplay[destIndex++] = 128; // ALPHA
                }
            }
        }

        function getPixelData()
        {
            if (rgba) {
                return rgbaImageData;
            } else {
                return origPixelData;
            }
        }

        function getImageData()
        {
            return imageData;
        }
        
        function getCanvas()
        {
            if(lastImageIdDrawn === imageId) {
                return canvas;
            }

            canvas.height = rows;
            canvas.width = columns;
            var context = canvas.getContext('2d');
            context.putImageData(imageData, 0, 0 );
            lastImageIdDrawn = imageId;
            return canvas;
        }

        // Extract the various attributes we need
        var imageObject = {
            imageId : imageId,
            minPixelValue : minPixelValue,
            maxPixelValue : maxPixelValue,
            slope: 1.0,
            intercept: 0,
            windowCenter : estWindowCenter,
            windowWidth : estWindowWidth,
            render: render,
            getPixelData: getPixelData,
            getImageData: getImageData,
            getCanvas: getCanvas,
            rows: rows,
            columns: columns,
            height: rows,
            width: columns,
            color: color,
            rgba : rgba,
            columnPixelSpacing: 1.0,
            rowPixelSpacing: 1.0,
            invert: false,
            bytesPerPixel: bytesPerPixel,
            sizeInBytes: width * height * bytesPerPixel
        };
        
        return imageObject;
    }
    
    function getMax(array) {
        var max = -Infinity; 
        for(var i = 0; i < array.length; i++ ) if (array[i] > max) max = array[i];
        return max;
    }
    
    function getMin(array) {
        var min = Infinity; 
        for(var i = 0; i < array.length; i++ ) if (array[i] < min) min = array[i];
        return min;
    }
    
    function getBytesPerPixel(dataType) {
        switch(dataType) {
            case 'uint8':
                return 1;
            case 'uint16':
                return 2;
            case 'uint32':
                return 4;
            case 'int8':
                return 1;
            case 'int16':
                return 2;
            case 'int32':
                return 4;
            default:
                console.log("Unknown data format: " + dataType); 
                return None;
        }
    }

    // Loads an image given a url to an image
    function loadMimImage(imageId) {

      // create a deferred object
      var deferred = $.Deferred();
      
      // Get the image ID without the prefix
      var imageIdStripped = imageId.substring(imageId.indexOf(":") + 1);

      // Request the image via MIM 
      Mim.getSingleton().addListener(imageIdStripped, function(mimimage) {
        var imageObject = createImageObject(mimimage, imageId);
        deferred.resolve(imageObject);
      });
      
      return deferred;
    }

    function configure(opts) {
      options = opts;
    }

    // register mim prefix
    cornerstone.registerImageLoader('mim', loadMimImage);
    mimImageLoader.configure = configure;
    return cornerstone;
}($, cornerstone, mimImageLoader));
