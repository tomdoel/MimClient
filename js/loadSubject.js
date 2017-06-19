
// Load JSON study information for each study
function loadSubject(baseUrl, studyViewer, viewportModel, subject) {

    // Get the JSON data for the selected studyId
    getMimSubjectInfo(baseUrl, subject, function(data) {

        var imageViewer = new ImageViewer(studyViewer, viewportModel);
        imageViewer.setLayout('1x1'); // default layout

        function initViewports() {
            imageViewer.forEachElement(function(el) {
                cornerstone.enable(el);
                $(el).droppable({
                    drop : function(evt, ui) {
                        var fromStack = $(ui.draggable.context).data('stack'), toItem = $(this).data('index');
                        useItemStack(toItem, fromStack);
                    }
                });
            });            
        }

        // setup the tool buttons
        setupButtons(studyViewer);

        // layout choose
        $(studyViewer).find('.choose-layout a').click(function(){
            var previousUsed = [];
            imageViewer.forEachElement(function(el, vp, i){
                if (!isNaN($(el).data('useStack'))) {
                    previousUsed.push($(el).data('useStack'));
                }
            });

            var type = $(this).text();
            imageViewer.setLayout(type);
            initViewports();
            resizeStudyViewer();
            if (previousUsed.length > 0) {
                previousUsed = previousUsed.slice(0, imageViewer.viewports.length);
                var item = 0;
                previousUsed.forEach(function(v){
                    useItemStack(item++, v);
                });
            }

            //return false;
        });

        // Load the first series into the viewport (?)
        //var stacks = [];
        //var currentStackIndex = 0;
        var nextSeriesIndex = 0;





        // START OF CODE MOVED UP

        // Resize the parent div of the viewport to fit the screen
        var imageViewerElement = $(studyViewer).find('.imageViewer')[0];
        var viewportWrapper = $(imageViewerElement).find('.viewportWrapper')[0];
        var parentDiv = $(studyViewer).find('.viewer')[0];

        //viewportWrapper.style.width = (parentDiv.style.width - 10) + "px";
        //viewportWrapper.style.height = (window.innerHeight - 150) + "px";

        var studyRow = $(studyViewer).find('.studyRow')[0];
        var width = $(studyRow).width();

        //$(parentDiv).width(width - 170);
        //viewportWrapper.style.width = (parentDiv.style.width - 10) + "px";
        //viewportWrapper.style.height = (window.innerHeight - 150) + "px";

        // Get the viewport elements
        var element = $(studyViewer).find('.viewport')[0];

        // Image enable the dicomImage element
        initViewports();
        //cornerstone.enable(element);

        // Get series list from the series thumbnails (?)
        var seriesList = $(studyViewer).find('.thumbnails')[0];
        
        
        
        // END OF CODE MOVED UP
        
        
        // Create a stack object for each series
        data.seriesList.forEach(function(series) {
            var stackIndex = nextSeriesIndex;
            nextSeriesIndex++;
            var stack = {
                seriesDescription: series.seriesDescription,
                stackId: series.seriesNumber,
                imageIds: [],
                overlayImageIds: [],
                seriesIndex: stackIndex,
                currentImageIdIndex: 0,
                frameRate: series.frameRate
            };
            // Add the series stack to the stacks array
            imageViewer.stacks.push(stack);
                
            getMimBackgroundImage(series, function(backgroundStack) {
                var stack = imageViewer.stacks[stackIndex];

                // Populate imageIds array with the imageIds from each series
                // For series with frame information, get the image url's by requesting each frame
                backgroundStack.instanceList.forEach(function(image) {
                    var imageId = image.imageId;
                    stack.imageIds.push(imageId);
                });
                
                // Code integrated from below
                var seriesEntry = '<a class="list-group-item" + ' +
                    'oncontextmenu="return false"' +
                    'unselectable="on"' +
                    'onselectstart="return false;"' +
                    'onmousedown="return false;">' +
                    '<div class="csthumbnail"' +
                    'oncontextmenu="return false"' +
                    'unselectable="on"' +
                    'onselectstart="return false;"' +
                    'onmousedown="return false;"></div>' +
                    "<div class='text-center small'>" + stack.seriesDescription + '</div></a>';

                // Add to series list
                var seriesElement = $(seriesEntry).appendTo(seriesList);

                // Find thumbnail
                var thumbnail = $(seriesElement).find('div')[0];

                // Enable cornerstone on the thumbnail
                cornerstone.enable(thumbnail);

                // Have cornerstone load the thumbnail image
                cornerstone.loadAndCacheImage(imageViewer.stacks[stack.seriesIndex].imageIds[0]).then(function(image) {
                    // Make the first thumbnail active
                    if (stack.seriesIndex === 0) {
                        $(seriesElement).addClass('active');
                    }
                    // Display the image
                    cornerstone.displayImage(thumbnail, image);
                    $(seriesElement).draggable({helper: "clone"});
                });

                // Handle thumbnail click
                $(seriesElement).on('click touchstart', function() {
                  useItemStack(0, stackIndex);
                }).data('stack', stackIndex);
                
  
            }, function(overlayStack) {
                stack = imageViewer.stacks[stackIndex];

                // Populate imageIds array with the imageIds from each series
                // For series with frame information, get the image url's by requesting each frame
                overlayStack.instanceList.forEach(function(image) {
                    var imageId = image.imageId;
                    stack.overlayImageIds.push(imageId);
                });
            });
        });

        function useItemStack(item, stack) {
            var imageId = imageViewer.stacks[stack].imageIds[0];
            var element = imageViewer.getElement(item);
            var overlayImageId = imageViewer.stacks[stack].overlayImageIds[0];
            if ($(element).data('waiting')) {
                imageViewer.viewports[item].find('.overlay-text').remove();
                $(element).data('waiting', false);
            }
            $(element).data('useStack', stack);

            displayThumbnail(seriesList, $(seriesList).find('.list-group-item')[stack], element, imageViewer.stacks[stack], function(image, el, stack){
                if (!$(el).data('setup')) {
                    setupViewport(el, stack, image);
                    setupViewportOverlays(el, data);
                    $(el).data('setup', true);
                }
            });

        }
        // Resize study viewer
        function resizeStudyViewer() {
            var studyRow = $(studyViewer).find('.studyContainer')[0];
            var height = $(studyRow).height();
            var width = $(studyRow).width();console.log($(studyRow).innerWidth(),$(studyRow).outerWidth(),$(studyRow).width());
            $(seriesList).height("100%");
            $(parentDiv).width(width - $(studyViewer).find('.thumbnailSelector:eq(0)').width());
            $(parentDiv).css({height : '100%'});
            $(imageViewerElement).css({height : $(parentDiv).height() - $(parentDiv).find('.text-center:eq(0)').height()});

            imageViewer.forEachElement(function(el, vp) {
                cornerstone.resize(el, true);

                if ($(el).data('waiting')) {
                    var ol = vp.find('.overlay-text');
                    if (ol.length < 1) {
                        ol = $('<div class="overlay overlay-text">Please drag a stack onto here to view images.</div>').appendTo(vp);
                    }
                    var ow = vp.width() / 2, oh = vp.height() / 2;
                    ol.css({top : oh, left : ow - (ol.width() / 2)}); 
                } 
            });
        }
        // Call resize viewer on window resize
        $(window).resize(function() {
            resizeStudyViewer();
        });
        resizeStudyViewer();
        if (imageViewer.isSingle())
            useItemStack(0, 0);

    });
}
