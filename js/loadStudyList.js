function loadXnatPatientList(baseUrl, callback) {
    var callback_stored = callback;
    listAllSubjects(baseUrl, function(subjectList) {
        assemblePatientListFromXnatSubjects(subjectList, callback_stored);
    });
}

function listAllSubjects(baseUrl, callback) {
    $.ajax({
        crossDomain: true,
        url: baseUrl + "REST/subjects?format=json&columns=DEFAULT",
        type: "GET",
        dataType: 'json',
        async: true,
        xhrFields: {
               withCredentials: true
        },
        success: function(subjectList) {
            callback(subjectList.ResultSet.Result);
        },
        error: function(xhr, status, error) {
            var err = eval("(" + xhr.responseText + ")");
            console.log(err.Message);
        }
    });
}

function listExperimentsForSubject(baseUrl, projectLabel, subjectLabel, callback) {
    $.ajax({
        crossDomain: true,
        url: baseUrl + "REST/projects/" + projectLabel + "/subjects/" + subjectLabel + "/experiments?format=json",
        type: "GET",
        dataType: 'json',
        async: false,
        xhrFields: {
               withCredentials: true
        },
        success: function(experimentList) {
            experimentList.ResultSet.Result.forEach(function(experiment) {
                experiment.xnatSubjectLabel = subjectLabel;
                experiment.xnatProjectLabel = experiment.project;
                experiment.xnatExperimentLabel = experiment.label;

            });
            callback(experimentList.ResultSet.Result);            
        },
        error: function(xhr, status, error) {
            var err = eval("(" + xhr.responseText + ")");
            console.log(err.Message);
        }
    });
}

function getScansForThisSubject(baseUrl, auth, subject) {
    $.ajax({
        crossDomain: true,
         url: baseUrl + "REST/projects/" + subject.xnatProject + "/subjects/" + subject.subjectXnatID + "/scans?format=json",
        type: "GET",
        dataType: 'json',
        async: true,
        xhrFields: {
               withCredentials: true
        },
        success: function(scanList) {
            scanList.ResultSet.Result.forEach(function(scan) {
                scan.xnatSubjectLabel = subject.xnatSubjectLabel;
                scan.xnatProjectLabel = subject.project;
                scan.xnatExperimentLabel = subject.label;
            });
            return scanList.ResultSet.Result;
        },
        error: function(xhr, status, error) {
            var err = eval("(" + xhr.responseText + ")");
            console.log(err.Message);
        }
    });
}

function getScansForThisExperiment(baseUrl, experiment) {
    var scans = [];
    $.ajax({
        crossDomain: true,
        url: baseUrl + "REST/projects/" + experiment.project + "/subjects/" + experiment.xnatSubjectLabel + "/experiments/" + experiment.label + "/scans?format=json",
        type: "GET",
        dataType: 'json',
        async: false,
        xhrFields: {
               withCredentials: true
        },
        success: function(scanList) {
            scanList.ResultSet.Result.forEach(function(scan) {
                scan.xnatSubjectLabel = experiment.xnatSubjectLabel;
                scan.xnatProjectLabel = experiment.project;
                scan.xnatExperimentLabel = experiment.label;
            });
            scans = scanList.ResultSet.Result;
        },
        error: function(xhr, status, error) {
            var err = eval("(" + xhr.responseText + ")");
            console.log(err.Message);
        }
    });
    return scans;
}

function listResources(baseUrl, scanList, callback) {
    var allResources = [];
    scanList.forEach(function(r) { console.log("Scans: " + r.label); });
    scanList.forEach(function(scan) {
        $.ajax({
            crossDomain: true,
            url: baseUrl + "REST/projects/" + scan.xnatProjectLabel + "/subjects/" + scan.xnatSubjectLabel + "/experiments/" + scan.xnatExperimentLabel + "/scans/" + scan.ID + "/resources?format=json",
            type: "GET",
            dataType: 'json',
            async: false,
            xhrFields: {
                   withCredentials: true
            },
            success: function(resourceList) {
                resourceList.ResultSet.Result.forEach(function(resource) {
                    resource.xnatSubjectLabel = scan.xnatSubjectLabel;
                    resource.xnatProjectLabel = scan.xnatProjectLabel;
                    resource.xnatExperimentLabel = scan.xnatExperimentLabel;
                    resource.xnatScanLabel = scan.ID;
                    resource.xnatResourceLabel = resource.label;
                });
                allResources = allResources.concat(resourceList.ResultSet.Result);
            },
            error: function(xhr, status, error) {
                var err = eval("(" + xhr.responseText + ")");
                console.log(err.Message);
            }
        });
    });
    callback(allResources);
}

function listFiles(baseUrl, resource) {
    files = [];
    $.ajax({
        crossDomain: true,
        url: baseUrl + "data/archive/projects/" + resource.xnatProjectLabel + "/subjects/" + resource.xnatSubjectLabel + "/experiments/" + resource.xnatExperimentLabel + "/scans/" + resource.xnatScanLabel + "/resources/" + resource.xnatResourceLabel + "/files?format=json",
        type: "GET",
        dataType: 'json',
        async: false,
        xhrFields: {
               withCredentials: true
        },
        success: function(fileList) {
            files = fileList.ResultSet.Result;
        },
        error: function(xhr, status, error) {
            var err = eval("(" + xhr.responseText + ")");
            console.log(err.Message);
        }
    });
    return files;
}


function assemblePatientListFromXnatSubjects(xnatSubjectList, callback) {
    outputData = [];
    outputData.subjectList = [];
    xnatSubjectList.forEach(function(subject) {
        newSubject = [];
        newSubject.subjectName = subject.label;
        newSubject.subjectXnatID = subject.ID;
        newSubject.xnatProject = subject.project;
        newSubject.xnatUri = subject.URI;
        newSubject.xnatInsertDate = subject.insert_date;
        outputData.subjectList.push(newSubject);
    });
    callback(outputData);
}

function getSubjectInfoXnat(baseUrl, subject, callback) {
    makeSeriesListForSubject(baseUrl, subject, function(seriesList) {
        output = [];
        output.patientName = subject.subjectName;
        output.xnatProject = subject.xnatProject;
        output.patientId = subject.subjectXnatID;
        output.studyDate = subject.xnatInsertDate;
        output.modality = [];
        output.studyDescription = subject.subjectName;
        output.studyId = subject.subjectXnatID;
        output.seriesList = seriesList;
        output.numImages = output.seriesList.length;
        callback(output);        
    });
}

function makeSeriesListForSubject(baseUrl, subject, callback) {
    listExperimentsForSubject(baseUrl, subject.xnatProject, subject.subjectXnatID, function(experimentList) {
        listScansForExperimentList(baseUrl, experimentList, function(scans) {
            seriesList = [];
            scanNumber = 1;
            scans.forEach(function(scan) {
                nextSeries = [];
                nextSeries.seriesDescription = scan.series_description;
                nextSeries.seriesNumber = scanNumber;
                nextSeries.instanceList = makeInstanceList(baseUrl, scan); 
                scanNumber++;
                seriesList.push(nextSeries);
            });
            callback(seriesList);            
        });
    });    
}

 

function listScansForExperimentList(baseUrl, experimentList, callback) {
    allScans = [];
    experimentList.forEach(function(experiment) {
        allScans = allScans.concat(getScansForThisExperiment(baseUrl, experiment));
    });
    callback(allScans);
}

function makeInstanceList(baseUrl, scan) {
    instanceList = [];
    listResources(baseUrl, [scan], function(resourceList) {
        resourceList.forEach(function(resource) {
            files = listFiles(baseUrl, resource);
            files.forEach(function(file) {
                instanceEntry = [];
                instanceEntry.imageId = "dicomweb:" + stripTrailingSlash(baseUrl) + file.URI;            
                instanceList.push(instanceEntry);
            });
        });
    });
    return instanceList;
}

function stripTrailingSlash(str) {
    if (str.endsWith('/')) {
        return str.slice(0, -1);
    }
    return str;
}