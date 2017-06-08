/**
 * Triggered from a message on a Cloud Storage bucket.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */

var request = require('request');

//********************functions********************************

function getAnalyticSettings(profileId, callback) {
  const options = {
    method: 'GET',
    url: 'https://analytics.voxrec.me/account/analyticSettings?profileId=' + profileId,
  };

  request(options, function(error, response, body) {
    if (!error)
      callback(null, JSON.parse(body));
    else
      callback(error, body);
   });
}

function sendMediaIdToVoxrec(data, voxrecCallback) {

  const options = {
    method: 'POST',
    url: 'https://analytics.voxrec.me/analytics/transcripts',
    json: data
  };

  request(options, function(error, response, body) {
    if (!error)
      voxrecCallback(null, body);
    else
      voxrecCallback(error, body);
   });
}

function uploadToGoogleSpeech(event, settings, finishedCallback) {

  const options = {
    method: 'POST',
    url: 'https://speech.googleapis.com/v1/speech:longrunningrecognize?key=AIzaSyAKqTZcnGwZtdZcKCaAPSn_lseunaWUw5U',
    json: {
      "config": {
        "encoding": "FLAC",
        "language_code": settings.googleSpeech.language
      },
      "audio":{
        "uri":"gs://" + event.data.bucket + "/" + event.data.name
      }
    }
  };

  request(options, function(error, response, body) {

    let data = {
      "service": 'googleSpeech',
      "mediaId": body.name,
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id']
    };

    sendMediaIdToVoxrec(data, function() {
      finishedCallback();
    });
  });

}

function uploadToVoiceBase(event, settings, finishedCallback) {
  var options = {
    url: 'https://apis.voicebase.com/v2-beta/media',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI3NmY5ZTZmMy02MmQyLTQ2OGQtOTczOS04MTc3MjMzMTI3MWIiLCJ1c2VySWQiOiJhdXRoMHw1OGU1NDk5MTZiZGYxMTZhOGM3NTM5MTIiLCJvcmdhbml6YXRpb25JZCI6IjkzODQ5ODQ1LTc0M2ItM2QzZS02NDllLTgwYmQxYWU0MDk2MyIsImVwaGVtZXJhbCI6ZmFsc2UsImlhdCI6MTQ5MTUxMDk0ODg3OCwiaXNzIjoiaHR0cDovL3d3dy52b2ljZWJhc2UuY29tIn0.r3tAS2X2D2hSSFFcPvmY6CHpbH1EVqkCWqD_DgrcK30'
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

  var vbRequest = request(options, voiceBaseCallback);
  var form = vbRequest.form();
  form.append('media', event.data.mediaLink);
  form.append('configuration', JSON.stringify(configuration));


  function voiceBaseCallback(error, response, body) {
    let data = {
      "service": 'voiceBase',
      "mediaId": JSON.parse(body).mediaId,
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id'],
      "redaction": !!configuration.configuration.detections
    };

    sendMediaIdToVoxrec(data, function() {
      finishedCallback();
    });
  }
}


//*********************************************************

exports.processFile = function(event, callback) {
  console.log('Processing file: ' + event.data.name);
  console.log(event);


  if (event.data.resourceState === 'exists'
      && event.data.metageneration === '2'
      && event.data.metadata['participant-id'] !== 'none'
      && event.data.metadata['profile-id']
      && event.data.metadata['call-id']) {


    getAnalyticSettings(event.data.metadata['profile-id'], function(error, settings) {

        switch (settings.service) {
          case 'googleSpeech':
            uploadToGoogleSpeech(event, settings, function() {
              callback();
            });
            break;
          case 'voiceBase':
            uploadToVoiceBase(event, settings, function() {
              callback();
            });
            break;
          default:
            callback();
        }
      });

  } else {
    callback();
  }

};
