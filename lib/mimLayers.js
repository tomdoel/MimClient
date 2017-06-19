(function (cornerstone) {

    "use strict";

    // This is used to keep each of the layers' viewports in sync with the base layer
    var viewportRatio = {};
    
    function guid() {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
          .toString(16)
          .substring(1);
      }
      return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
    }

    function indexOfInObjectArray(array, property, value) {
        var found = -1;
        array.forEach(function(object, index) {
            if (object[property] === value) {
                found = index;
                return false;
            }
        });

        return found;
    }

    function addBackgroundLayer(element, image) {
        element.backgroundLayerId = addLayer(element, image);
    }
    
    function addOverlayLayer(element, image) {
        element.overlayLayerId = addLayer(element, image, {
                opacity: 0.5
            });
    }

    function addLayer(element, image, options) {
        var enabledElement = cornerstone.getEnabledElement(element);
        
        var layerId = guid();

        // Set syncViewports to true by default when a new layer is added
        if (enabledElement.syncViewports === undefined) {
            enabledElement.syncViewports = true;
        }

        enabledElement.layers = enabledElement.layers || [];

        var layerEnabledElement = {
            image: image,
            layerId: layerId,
            options: options || {}
        };

        enabledElement.layers.push(layerEnabledElement);

        console.log('Layer added: ' + layerId);
        return layerId;
    }

    function removeLayer(element, layerId) {
        var enabledElement = cornerstone.getEnabledElement(element);
        var index = indexOfInObjectArray(enabledElement.layers, 'layerId', layerId);
        if (index !== -1) {
            enabledElement.layers.splice(index, 1);
            console.log('Layer removed: ' + layerId);
        }
    }

    function getLayers(element, layerId) {
        var enabledElement = cornerstone.getEnabledElement(element);
        
        // If a layer ID is provided, return the details of that layer
        if (layerId) {
            var index = indexOfInObjectArray(enabledElement.layers, 'layerId', layerId);
            if (index !== -1) {
                return enabledElement.layers[index];
            }
        }

        return enabledElement.layers;
    }
    
    function updateBackgroundLayer(element, image) {
        getLayers(element, element.backgroundLayerId).image = image;
    }
    
    function updateOverlayLayer(element, image) {
        getLayers(element, element.overlayLayerId).image = image;
    }
    
    function getDrawImageOffset(targetImageId, referenceImageId) {
        var offset = {
            x: 0,
            y: 0
        };

        var targetImagePlane = cornerstoneTools.metaData.get('imagePlane', targetImageId);
        if (!targetImagePlane ||
            !targetImagePlane.imagePositionPatient ||
            !targetImagePlane.rowCosines ||
            !targetImagePlane.columnCosines) {
            return offset;
        }

        var referenceImagePlane = cornerstoneTools.metaData.get('imagePlane', referenceImageId);
        if (!referenceImagePlane ||
            !referenceImagePlane.imagePositionPatient ||
            !referenceImagePlane.rowCosines ||
            !referenceImagePlane.columnCosines) {
            return offset;
        }

        // TODO: Add Image Orientation check between layers
        var pos = stringToFloatArray(targetImagePlane.imagePositionPatient);
        var origPos = stringToFloatArray(referenceImagePlane.imagePositionPatient)

        offset.x = pos[0] - origPos[0];
        offset.y = pos[1] - origPos[1];
        return offset;
    }
    
    function renderCompositeImage(enabledElement, invalidated) {
        // Calculate the base layer's default viewport parameters if they don't already exist
        // and store them
        var baseLayer = enabledElement.layers[0];
        baseLayer.viewport = baseLayer.viewport || cornerstone.internal.getDefaultViewport(enabledElement.canvas, baseLayer.image);

        // Store the base layer's viewport and image data on the enabled element so that tools can interact with it
        enabledElement.viewport = baseLayer.viewport;
        enabledElement.image = baseLayer.image;

        // Make an array of only the visible layers to save time
        var visibleLayers = enabledElement.layers.filter(function(layer) {
            if (layer.options && layer.options.visible !== false && layer.options.opacity !== 0) {
                return true;
            }
        });

        // If we intend to keep the viewport's scale and translation in sync,
        // loop through the layers 
        if (enabledElement.syncViewports === true) {
            viewportRatio[baseLayer.layerId] = 1;
            visibleLayers.forEach(function(layer, index) {
                // Don't do anything to the base layer
                if (index === 0) {
                    return;
                }

                // If no viewport has been set yet for this layer, calculate the default viewport
                // parameters
                if (!layer.viewport) {
                    layer.viewport = cornerstone.internal.getDefaultViewport(enabledElement.canvas, layer.image);
                    viewportRatio[layer.layerId] = layer.viewport.scale / baseLayer.viewport.scale;   
                }

                // Update the layer's translation and scale to keep them in sync with the first image
                // based on the stored ratios between the images
                layer.viewport.scale = baseLayer.viewport.scale * viewportRatio[layer.layerId];
                layer.viewport.rotation = baseLayer.viewport.rotation;
                layer.viewport.translation = {
                    x: baseLayer.viewport.translation.x * layer.image.width / baseLayer.image.width,
                    y: baseLayer.viewport.translation.y * layer.image.height / baseLayer.image.height
                };
            });    
        }

        // Get the enabled element's canvas so we can draw to it
        var context = enabledElement.canvas.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0);

        // Clear the canvas
        context.fillStyle = 'black';
        context.fillRect(0, 0, enabledElement.canvas.width, enabledElement.canvas.height);

        // Loop through each layer and draw it to the canvas
        visibleLayers.forEach(function(layer, index) {
            context.save();

            // Set the layer's canvas to the pixel coordinate system
            layer.canvas = enabledElement.canvas;
            cornerstone.setToPixelCoordinateSystem(layer, context);

            // Render into the layer's canvas
            if (layer.image.color === true) {
                cornerstone.addColorLayer(layer, invalidated);
            } else {
                cornerstone.addGrayscaleLayer(layer, invalidated);    
            }

            // Apply any global opacity settings that have been defined for this layer
            if (layer.options && layer.options.opacity) {
                context.globalAlpha = layer.options.opacity;
            } else {
                context.globalAlpha = 1;    
            }
            
            // Calculate any offset between the position of the base layer and the current layer
            var offset = getDrawImageOffset(layer.image.imageId, baseLayer.image.imageId);

            // Draw from the current layer's canvas onto the enabled element's canvas
            context.drawImage(layer.canvas, 0, 0, layer.image.width, layer.image.height, offset.x, offset.y, layer.image.width, layer.image.height);

            context.restore();
        });
    }


    /**
     * Internal API function to draw a composite image to a given enabled element
     * @param enabledElement
     * @param invalidated - true if pixel data has been invalidated and cached rendering should not be used
     */
    function drawCompositeImage(enabledElement, invalidated) {

        var start = new Date();

        renderCompositeImage(enabledElement, invalidated);

        var context = enabledElement.canvas.getContext('2d');

        var end = new Date();
        var diff = end - start;
        //console.log(diff + ' ms');

        var eventData = {
            viewport : enabledElement.viewport,
            element : enabledElement.element,
            layers : enabledElement.layers,
            enabledElement : enabledElement,
            canvasContext: context,
            renderTimeInMs : diff
        };

        $(enabledElement.element).trigger("CornerstoneImageRendered", eventData);
        enabledElement.invalid = false;
    }
    
    function addColorLayer(layer, invalidated) {
        if(layer === undefined) {
            throw "drawImage: layer parameter must not be undefined";
        }

        var image = layer.image;
        if(image === undefined) {
            throw "drawImage: image must be loaded before it can be drawn";
        }


        layer.canvas = cornerstone.getRenderCanvas(layer, image, invalidated);
        var context = layer.canvas.getContext('2d');

        // turn off image smooth/interpolation if pixelReplication is set in the viewport
        if(layer.viewport.pixelReplication === true) {
            context.imageSmoothingEnabled = false;
            context.mozImageSmoothingEnabled = false; // firefox doesn't support imageSmoothingEnabled yet
        } else {
            context.imageSmoothingEnabled = true;
            context.mozImageSmoothingEnabled = true;
        }

        cornerstone.lastRenderedImageId = image.imageId;
        cornerstone.lastRenderedViewport.windowCenter = layer.viewport.voi.windowCenter;
        cornerstone.lastRenderedViewport.windowWidth = layer.viewport.voi.windowWidth;
        cornerstone.lastRenderedViewport.invert = layer.viewport.invert;
        cornerstone.lastRenderedViewport.rotation = layer.viewport.rotation;
        cornerstone.lastRenderedViewport.hflip = layer.viewport.hflip;
        cornerstone.lastRenderedViewport.vflip = layer.viewport.vflip;
        cornerstone.lastRenderedViewport.modalityLUT = layer.viewport.modalityLUT;
        cornerstone.lastRenderedViewport.voiLUT = layer.viewport.voiLUT;
    }

    function addGrayscaleLayer(layer, invalidated) {
        if(layer === undefined) {
            throw "drawImage: layer parameter must not be undefined";
        }

        var image = layer.image;
        if(image === undefined) {
            throw "drawImage: image must be loaded before it can be drawn";
        }


        layer.canvas = cornerstone.getRenderCanvas(layer, image, invalidated);
        var context = layer.canvas.getContext('2d');

        // turn off image smooth/interpolation if pixelReplication is set in the viewport
        if(layer.viewport.pixelReplication === true) {
            context.imageSmoothingEnabled = false;
            context.mozImageSmoothingEnabled = false; // firefox doesn't support imageSmoothingEnabled yet
        } else {
            context.imageSmoothingEnabled = true;
            context.mozImageSmoothingEnabled = true;
        }

        cornerstone.lastRenderedImageId = image.imageId;
        cornerstone.lastRenderedViewport.windowCenter = layer.viewport.voi.windowCenter;
        cornerstone.lastRenderedViewport.windowWidth = layer.viewport.voi.windowWidth;
        cornerstone.lastRenderedViewport.invert = layer.viewport.invert;
        cornerstone.lastRenderedViewport.rotation = layer.viewport.rotation;
        cornerstone.lastRenderedViewport.hflip = layer.viewport.hflip;
        cornerstone.lastRenderedViewport.vflip = layer.viewport.vflip;
        cornerstone.lastRenderedViewport.modalityLUT = layer.viewport.modalityLUT;
        cornerstone.lastRenderedViewport.voiLUT = layer.viewport.voiLUT;
    }

    // Module exports
    cornerstone.addColorLayer = addColorLayer;
    cornerstone.addGrayscaleLayer = addGrayscaleLayer;    
    cornerstone.addLayer = addLayer;
    cornerstone.removeLayer = removeLayer;
    cornerstone.getLayers = getLayers;
    cornerstone.addBackgroundLayer = addBackgroundLayer;
    cornerstone.addOverlayLayer = addOverlayLayer;
    cornerstone.updateBackgroundLayer = updateBackgroundLayer;
    cornerstone.updateOverlayLayer = updateOverlayLayer;
    cornerstone.internal.drawCompositeImage = drawCompositeImage;
    cornerstone.internal.renderCompositeImage = renderCompositeImage;
    cornerstone.drawCompositeImage = drawCompositeImage;

}(cornerstone));
