var testingParameters = {xnatServer: "xxxx", username: "xxxx", password: "xxxx", project: "xxxx"};

function loadXnatPatientList(callback) {
    var auth = btoa(testingParameters.username + ":" + testingParameters.password);
    var baseUrl = testingParameters.xnatServer;
    var callback_stored = callback;
    project = testingParameters.project;
    listAllSubjects(baseUrl, auth, function(subjectList) {
        assemblePatientListFromXnatSubjects(baseUrl, auth, subjectList, callback_stored);
    });
}

function getStudyInfo(study, callback) {

    // Get study info from XNAT server
    getStudyInfoXnat(study, callback);
}

function listAllSubjects(baseUrl, auth, callback) {
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

function listExperimentsForSubject(baseUrl, auth, projectLabel, subjectLabel, callback) {
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

function getScansForThisExperiment(baseUrl, auth, experiment) {
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

function listResources(baseUrl, auth, scanList, callback) {
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

function listFiles(baseUrl, auth, resource) {
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


function assemblePatientListFromXnatSubjects(baseUrl, auth, xnatSubjectList, callback) {
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

function getSubjectInfoXnat(subject, callback) {
    makeSeriesListForSubject(subject, function(seriesList) {
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

function getStudyInfoXnat(study, callback) {
    output = [];
    output.patientName = study.patientName;
    output.patientId = study.patientId;
    output.studyDate = study.studyDate;
    output.modality = study.modality;
    output.studyDescription = study.studyDescription;
    output.numImages = study.numImages;
    output.studyId = study.studyId;
    output.seriesList = makeSeriesList(study);
    callback(output);
}

function makeSeriesListForSubject(subject, callback) {
    var auth = btoa(testingParameters.username + ":" + testingParameters.password);
    var baseUrl = testingParameters.xnatServer;
    
    listExperimentsForSubject(baseUrl, auth, subject.xnatProject, subject.subjectXnatID, function(experimentList) {
        listScansForExperimentList(baseUrl, auth, subject, experimentList, function(scans) {
            seriesList = [];
            scanNumber = 1;
            scans.forEach(function(scan) {
                nextSeries = [];
                nextSeries.seriesDescription = scan.series_description;
                nextSeries.seriesNumber = scanNumber;
                nextSeries.instanceList = makeInstanceList(baseUrl, auth, scan); 
                scanNumber++;
                seriesList.push(nextSeries);
            });
            callback(seriesList);            
        });
    });    
}

 

function listScansForExperimentList(baseUrl, auth, subject, experimentList, callback) {
    allScans = [];
    experimentList.forEach(function(experiment) {
        allScans = allScans.concat(getScansForThisExperiment(baseUrl, auth, experiment));
    });
    callback(allScans);
}

function makeSeriesList(study) {
    var auth = btoa(testingParameters.username + ":" + testingParameters.password);

    var baseUrl = testingParameters.xnatServer;
    experiment = [];
    experiment.project = study.xnatProjectLabel;
    experiment.xnatSubjectLabel = study.xnatSubjectLabel;
    experiment.label = study.xnatExperimentLabel;
    scans = getScansForThisExperiment(baseUrl, auth, experiment);
    
    seriesList = [];
    scanNumber = 1;
    scans.forEach(function(scan) {
        nextSeries = [];
        nextSeries.seriesDescription = scan.series_description;
        nextSeries.seriesNumber = scanNumber;
        nextSeries.instanceList = makeInstanceList(baseUrl, auth, scan); 
        scanNumber++;
        seriesList.push(nextSeries);
    });
    return seriesList;
}

function makeInstanceList(baseUrl, auth, scan) {
    instanceList = [];
    listResources(baseUrl, auth, [scan], function(resourceList) {
        resourceList.forEach(function(resource) {
            files = listFiles(baseUrl, auth, resource);
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