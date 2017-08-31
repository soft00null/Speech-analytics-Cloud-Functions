'use strict';

const request = require('request');
const VOICEBASE_BEARER_TOKEN = process.env.VOICEBASE_BEARER_TOKEN;

//********************functions********************************

function createTranscriptEntry(data, finishedCallback) {

  const options = {
    method: 'POST',
    url: process.env.HOOK_URL,
    json: data,
    // headers: {
    //   "x-app-key": process.env.APP_KEY
    // }
  };

  request(options, function(error, response, body) {
    if (!error)
      finishedCallback(null, body);
    else
      finishedCallback(error, body);
  });
}

function uploadToVoiceBase(event, settings, metadata, finishedCallback) {
  var options = {
    url: 'https://apis.voicebase.com/v2-beta/media',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + VOICEBASE_BEARER_TOKEN
    }
  };

  const configuration = {
    "configuration" : {}
  };

  let redaction = [];

  if (settings.voiceBase.pciRedaction) {
    redaction.push({
      "model": "PCI",
      "redact": {
        "transcripts": "[PCI]",
        "audio": {
          "tone": 270,
          "gain": 0.5
        }
      }
    });
  }

  if (settings.voiceBase.ssnRedaction) {
    redaction.push({
      "model": "SSN",
      "redact": {
        "transcripts": "[SSN]",
        "audio": {
          "tone": 440,
          "gain": 0.5
        }
      }
    });
  }

  if (settings.voiceBase.numberRedaction) {
    redaction.push({
      "model": "Number",
      "redact": {
        "transcripts": "[Num]",
        "audio": {
          "tone": 200,
          "gain": 0.5
        }
      }
    });
  }

  if (settings.voiceBase.numberRedaction || settings.voiceBase.ssnRedaction || settings.voiceBase.pciRedaction)
    configuration.configuration.detections = redaction;

  if (settings.voiceBase.language === 'es-LA' || settings.voiceBase.language === 'pt-BR') {
    configuration.configuration.language = settings.voiceBase.language;
    configuration.configuration.keywords = {"semantic": false};
    configuration.configuration.topics = {"semantic": false};
  }

  if (settings.voiceBase.customVocabularyEnabled) {
    let vocabularies = {
      "vocabularies": [{
        "terms": settings.voiceBase.customVocabulary.replace(/ /g,'').split(",")
      }]
    }
    configuration.configuration.transcripts = vocabularies;
  }

  const mediaLink = 'https://s3.amazonaws.com/' + event.Records[0].s3.bucket.name + '/' + event.Records[0].s3.object.key;
  var vbRequest = request(options, voiceBaseCallback);
  var form = vbRequest.form();
  form.append('media', mediaLink);
  form.append('configuration', JSON.stringify(configuration));


  function voiceBaseCallback(error, response, body) {

    let transcriptData = {
      "service": 'voiceBase',
      "participantId": metadata['participant-id'],
      "profileId": metadata['profile-id'],
      "callId": metadata['call-id'],
      "redaction": !!configuration.configuration.detections
    };

    if (!error && !JSON.parse(body).errors) {
      try {
        transcriptData.mediaId = JSON.parse(body).mediaId;
      } catch (e) {
        transcriptData.failureReason = e;
      }
    } else {
      transcriptData.failureReason = JSON.parse(body).errors.error || error;
    }

    console.log(transcriptData);
    createTranscriptEntry(transcriptData, function() {
      finishedCallback();
    });
  }
}

function uploadToService(service, settings, event, metadata) {
  console.log("Upload to Service:" + service);
  return new Promise((resolve, reject) => {
    switch (service) {
      case 'voiceBase':
        uploadToVoiceBase(event, settings, metadata, function() {
          resolve("Done");
        });
        break;
    }
  });
}

//*********************************************************

module.exports.processFile = (event, context, callback) => {
  console.log('start!');
  console.log(JSON.stringify(event.Records[0]));
  var bucket = event.Records[0].s3.bucket.name;
  var fileName = event.Records[0].s3.object.key;

  console.log('Processing file in ' + bucket + ' with name: ' + fileName);

  var promises = [];

  var options = {
    url: 'https://s3.amazonaws.com/' + bucket + '/' + fileName,
    method: 'HEAD',
  };

  request(options, function(error, response, body) {
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

    const metadata = {
      'participant-id' : response.headers['x-amz-meta-participant-id'],
      'profile-id' : response.headers['x-amz-meta-profile-id'],
      'call-id' : response.headers['x-amz-meta-call-id']
    };

    if (error) {
      console.log("Error reading object metadata " + fileName + " from bucket " + bucket + ".");
      context.fail("Error: " + error);
    } else {
      if (metadata['participant-id'] !== 'none'
        && metadata['profile-id']
        && metadata['call-id']) {

        const settings = {
          "services": ["voiceBase"],
          "voiceBase" : {
            "language" : "en-US",
            "pciRedaction" : false,
            "ssnRedaction" : false,
            "numberRedaction" : false,
            "customVocabularyEnabled" : true,
            "customVocabulary" : "Globalscale"
          }
        };

        settings.services.forEach((service) => {
          promises.push(uploadToService(service, settings, event, metadata));
        });

        Promise.all(promises).then(() => {
          callback();
        }).catch((e) => {
          callback();
        });
      } else {
        callback();
      }
    }
  });

};
