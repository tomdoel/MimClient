function loadXnatPatientList(baseUrl, callback) {
    var callback_stored = callback;
    Mim.getSingleton().addListener('MimSubjectList', function(subjectList) {
        assemblePatientListFromMimSubjects(subjectList, callback_stored);
    });
}



function assemblePatientListFromMimSubjects(xnatSubjectList, callback) {
    outputData = [];
    outputData.subjectList = [];
    xnatSubjectList.forEach(function(subject) {
        newSubject = [];
        newSubject.modelUid = subject.modelUid;
        newSubject.subjectName = subject.label;
        newSubject.subjectXnatID = subject.ID;
        newSubject.xnatProject = subject.project;
        newSubject.xnatUri = subject.URI;
        newSubject.xnatInsertDate = subject.insert_date;
        outputData.subjectList.push(newSubject);
    });
    callback(outputData);
}

function getMimBackgroundImage(seriesListEntry, dataCallback, segmentationCallback) {
    Mim.getSingleton().addListener(seriesListEntry.modelUid, function(series) {
        output = [];
        output.backgroundViewModelUid = series.backgroundViewModelUid;
        output.segmentationViewModelUid = series.segmentationViewModelUid;
        Mim.getSingleton().addListener(series.backgroundViewModelUid, function(backgroundDataView) {
            dv = [];
            dv.instanceList = backgroundDataView.instanceList;
            dataCallback(dv);
        });
        Mim.getSingleton().addListener(series.backgroundViewModelUid, function(segmentationDataView) {
            dv = [];
            dv.instanceList = segmentationDataView.instanceList;
            segmentationCallback(dv);
        });
    });
};
     

function getMimSubjectInfo(baseUrl, subject, callback) {
//    var callback_stored = callback;
    Mim.getSingleton().addListener(subject.modelUid, function(subjectInfo) {
        output = [];
        output.patientName = subjectInfo.subjectName;
        output.xnatProject = subjectInfo.xnatProject;
        output.patientId = subjectInfo.subjectXnatID;
        output.studyDate = subjectInfo.xnatInsertDate;
        output.modality = [];
        output.studyDescription = subjectInfo.subjectName;
        output.studyId = subjectInfo.subjectXnatID;
        output.seriesList = subjectInfo.seriesList;
        output.numImages = output.seriesList.length;
        callback(output);        
    });
    
}

function stripTrailingSlash(str) {
    if (str.endsWith('/')) {
        return str.slice(0, -1);
    }
    return str;
}