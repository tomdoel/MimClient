// Load in HTML templates

var viewportTemplate; // the viewport template
loadTemplate("templates/viewport.html", function(element) {
    viewportTemplate = element;
});

var studyViewerTemplate; // the study viewer template
loadTemplate("templates/studyViewer.html", function(element) {
    studyViewerTemplate = element;
});

var xnatUrl = [];
    

load();

// Show tabs on click
$('#tabs a').click (function(e) {
  e.preventDefault();
  $(this).tab('show');
});

// Resize main
function resizeMain() {
  var height = $(window).height();
  $('#main').height(height - 50);
  $('#tabContent').height(height - 50 - 42);
}


// Call resize main on window resize
$(window).resize(function() {
    resizeMain();
});
resizeMain();


// Prevent scrolling on iOS
document.body.addEventListener('touchmove', function(e) {
  e.preventDefault();
});

var getParameterFromUrl = function(parameterName) {
    var rx = new RegExp('[\&|\?]' + parameterName + '=([^\&\#]+)'),
        paramVal = window.location.search.match(rx);
    return !paramVal ? '' : paramVal[1];
}

function newUrl(inputvalue) {
    xnatUrl = inputvalue;
    if (xnatUrl.substr(-1) !== '/') {
        xnatUrl += '/';
        $("#inputUrl").val(xnatUrl);
    }
    $("#studyListData").empty();
    setCookieParameter("xnatUrl", xnatUrl);
    load();
}

$(document).ready(function(){

    // If URL input is specified as a parameter, it cannot be changed by the user
    var requestedUrl = getParameterFromUrl("url");
    if (requestedUrl) {
        $("#inputUrl").val(requestedUrl);
        $("#inputUrl").prop('disabled', true);
        $("#inputUrl").hide();
        $("#go").hide();
        newUrl(requestedUrl);
    } else {
        $("#inputUrl").val(getCookieParameter("xnatUrl"));
    }

    $("#go").click(function() {
        var inputvalue = $("#inputUrl").val();
        newUrl(inputvalue);
    });

    $("#login").click(function() {
        var inputvalue = $("#inputUrl").val();
        xnatUrl = inputvalue;
        if (xnatUrl.substr(-1) !== '/') {
            xnatUrl += '/';
            $("#inputUrl").val(xnatUrl);
        }
        setCookieParameter("xnatUrl", xnatUrl);
        window.open(xnatUrl, '_blank').focus();
    });
});

function load() {
    // Get study list from JSON manifest
    loadXnatPatientList(xnatUrl, function(data) {
      data.subjectList.forEach(function(subject) {

        // Create one table row for each study in the manifest
        var studyRow = '<tr><td>' +
        subject.xnatProject + '</td><td>' +
        subject.subjectName + '</td><td>' +
        subject.label + '</td><td>' +
        '</tr>';

        // Append the row to the study list
        var studyRowElement = $(studyRow).appendTo('#studyListData');

        // On study list row click
        $(studyRowElement).click(function() {

          // Add new tab for this study and switch to it
          var studyTab = '<li><a href="#x' + subject.modelUid + '" data-toggle="tab">' + subject.subjectName + '</a></li>';
          $('#tabs').append(studyTab);

          // Add tab content by making a copy of the studyViewerTemplate element
          var studyViewerCopy = studyViewerTemplate.clone();

          /*var viewportCopy = viewportTemplate.clone();
          studyViewerCopy.find('.imageViewer').append(viewportCopy);*/


          studyViewerCopy.attr("id", 'x' + subject.modelUid);
          // Make the viewer visible
          studyViewerCopy.removeClass('hidden');
          // Add section to the tab content
          studyViewerCopy.appendTo('#tabContent');

          // Show the new tab (which will be the last one since it was just added
          $('#tabs a:last').tab('show');

          // Toggle window resize (?)
          $('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
            $(window).trigger('resize');
          });

          // Now load the subject data
          loadSubject(xnatUrl, studyViewerCopy, viewportTemplate, subject);
        });
      });
    });

}

function setCookieParameter(name, value) {
    var date = new Date();
    var expireTime = 24*60*60*1000;
    date.setTime(date.getTime() + expireTime);
    var expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookieParameter(name) {
    var name = name + "=";
    var splitCookies = document.cookie.split(';');
    for (var i = 0; i < splitCookies.length; i++) {
        var cookieValue = splitCookies[i];
        while (cookieValue.charAt(0)==' ') {
            cookieValue = cookieValue.substring(1);
        }
        if (cookieValue.indexOf(name) == 0) {
            return cookieValue.substring(name.length, cookieValue.length);
        }
    }
    return "";
}