var testingParameters = {xnatServer: "xxxx", username: "xxxx", password: "xxxx", project: "xxxx"};


function loadStudyList(callback) {

    // Get study list from XNAT server
    loadXnatStudyList(callback);
}

function getStudyInfo(study, callback) {

    // Get study info from XNAT server
    getStudyInfoXnat(study, callback);
}

function loadXnatStudyList(callback) {
    var auth = btoa(testingParameters.username + ":" + testingParameters.password);
    var baseUrl = testingParameters.xnatServer;
    var callback_stored = callback;
    project = testingParameters.project;
    listSubjects(baseUrl, auth, project, function(subjectList) {
        listExperiments(baseUrl, auth, project, subjectList, function(experimentList) {
            assembleStudyListFromExperiments(baseUrl, auth, experimentList, callback_stored);
        });
    });
}

function listSubjects(baseUrl, auth, projectLabel, callback) {
    var allSubjects = [];    
    $.ajax({
        url: baseUrl + "REST/projects/" + projectLabel + "/subjects?format=json&columns=DEFAULT",
        type: "GET",
        dataType: 'json',
        async: false,
        headers: {
            "Authorization": "Basic " + auth
        },
        success: function(subjectList) {
                allSubjects = allSubjects.concat(subjectList.ResultSet.Result);
        },
        error: function(xhr, status, error) {
            var err = eval("(" + xhr.responseText + ")");
            console.log(err.Message);
        }
    });
    callback(allSubjects);
}

function listExperiments(baseUrl, auth, projectLabel, subjectList, callback) {
    var allExperiments = [];
    subjectList.forEach(function(r) { console.log("Subject: " + r.label); });
    subjectList.forEach(function(subject) {
        $.ajax({
            url: baseUrl + "REST/projects/" + projectLabel + "/subjects/" + subject.label + "/experiments?format=json",
            type: "GET",
            dataType: 'json',
            async: false,
            headers: {
                "Authorization": "Basic " + auth
            },
            success: function(experimentList) {
                allExperiments = allExperiments.concat(experimentList.ResultSet.Result);
                experimentList.ResultSet.Result.forEach(function(experiment) {
                    experiment.xnatSubjectLabel = subject.label;
                    experiment.xnatProjectLabel = experiment.project;
                    experiment.xnatExperimentLabel = experiment.label;
                    
                });
            },
            error: function(xhr, status, error) {
                var err = eval("(" + xhr.responseText + ")");
                console.log(err.Message);
            }
        });
    });
    callback(allExperiments);
}

function listScans(baseUrl, auth, experimentList, callback) {
    var allScans = [];
    experimentList.forEach(function(r) { console.log("Experiment: " + r.label); });
    experimentList.forEach(function(experiment) {
        allScans = allScans.concat(getScansForThisExperiment(baseUrl, auth, experiment));
    });
    callback(allScans);    
}

function getScansForThisExperiment(baseUrl, auth, experiment) {
    var scans = [];
    $.ajax({
        url: baseUrl + "REST/projects/" + experiment.project + "/subjects/" + experiment.xnatSubjectLabel + "/experiments/" + experiment.label + "/scans?format=json",
        type: "GET",
        dataType: 'json',
        async: false,
        headers: {
            "Authorization": "Basic " + auth
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
            url: baseUrl + "REST/projects/" + scan.xnatProjectLabel + "/subjects/" + scan.xnatSubjectLabel + "/experiments/" + scan.xnatExperimentLabel + "/scans/" + scan.ID + "/resources?format=json",
            type: "GET",
            dataType: 'json',
            async: false,
            headers: {
                "Authorization": "Basic " + auth
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
        url: baseUrl + "data/archive/projects/" + resource.xnatProjectLabel + "/subjects/" + resource.xnatSubjectLabel + "/experiments/" + resource.xnatExperimentLabel + "/scans/" + resource.xnatScanLabel + "/resources/" + resource.xnatResourceLabel + "/files?format=json",
        type: "GET",
        dataType: 'json',
        async: false,
        headers: {
            "Authorization": "Basic " + auth
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

function assembleStudyListFromExperiments(baseUrl, auth, experimentList, callback) {
    outputData = [];
    outputData.studyList = [];
    experimentList.forEach(function(r) { console.log("Experiment: " + r.label); });
    experimentList.forEach(function(experiment) {
        newStudy = [];
        scans = getScansForThisExperiment(baseUrl, auth, experiment);
        newStudy.patientName = experiment.xnatSubjectLabel;
        newStudy.patientId = experiment.xnatSubjectLabel;
        newStudy.studyId = experiment.label;
        newStudy.studyDate = experiment.date;
        newStudy.numImages = scans.length;
        newStudy.xnatSubjectLabel = experiment.xnatSubjectLabel;
        newStudy.xnatProjectLabel = experiment.xnatProjectLabel;
        newStudy.xnatExperimentLabel = experiment.xnatExperimentLabel;
        if(scans.length > 0) {
            newStudy.studyDescription = scans[0].series_description;
            switch(scans[0].xsiType) {
                case "xnat:mrScanData":
                    newStudy.modality = "MR";
                    break;
                case "xnat:usScanData":
                    newStudy.modality = "US";
                    break;
                case "xnat:ctScanData":
                    newStudy.modality = "CT";
                    break;
                default:
                    newStudy.modality = "unknown";
            }            
        } else {
            newStudy.studyDescription = "unknown";
            newStudy.modality = "unknown";
        }
        outputData.studyList.push(newStudy);
    });
    callback(outputData);
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