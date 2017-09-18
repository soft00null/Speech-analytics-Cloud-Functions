/**
 * Triggered from a message on a Cloud Storage bucket.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */

var request = require('request');
var SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');

const SITE_BASE_URL = '';
const VOXBONE_AI_APP_KEY = '';
const VOICEBASE_BEARER_TOKEN = '';
const WATSON_USERNAME = '';
const WATSON_PASSWORD = '';
const GOOGLE_SPEECH_KEY = '';

//********************functions********************************

function fetchAnalyticSettings(profileId, callback) {
  const options = {
    method: 'GET',
    url: SITE_BASE_URL + '/account/analyticSettings?profileId=' + profileId,
    headers: {
      "voxbone-ai-app-key": VOXBONE_AI_APP_KEY
    }
  };

  request(options, function(error, response, body) {
  console.log(error);
    if (!error) {
      try {
        callback(null, JSON.parse(body));
      } catch(e) {
        console.log("catch" + e);
        callback(e, null);
      }
    } else {
      callback(error, body);
    }

   });
}

function createTranscriptEntry(data, finishedCallback) {

  const options = {
    method: 'POST',
    url: SITE_BASE_URL + '/analytics/transcripts',
    json: data,
    headers: {
      "voxbone-ai-app-key": VOXBONE_AI_APP_KEY
    }
  };

  request(options, function(error, response, body) {
    if (!error)
      finishedCallback(null, body);
    else
      finishedCallback(error, body);
   });
}

function uploadToIbmWatson(event, settings, finishedCallback) {
  var speech_to_text = new SpeechToTextV1({
    username: WATSON_USERNAME,
    password: WATSON_PASSWORD
  });

  var params = {
    audio: request(event.data.mediaLink),
    content_type: 'audio/flac',
    max_alternatives: 1,
    model: settings.ibmWatson.model,
    profanity_filter: settings.ibmWatson.profanityFilter,
    smart_formatting: settings.ibmWatson.smartFormatting,
    inactivity_timeout: 60
  };

  speech_to_text.createRecognitionJob(params, function(err, res) {

    let data = {
      "service": 'ibmWatson',
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id']
    };

    if (!err && res) {
      data.mediaId = res.id;
    } else {
      console.log('IBM speech api error: ' + err);
      data.failureReason = err;
    }

    createTranscriptEntry(data, function() {
      finishedCallback();
    });
  });
}

function uploadToGoogleSpeech(event, settings, finishedCallback) {

  const configuration = {
    "config": {
      "encoding": "FLAC",
      "language_code": settings.googleSpeech.language
    },
    "audio":{
      "uri":"gs://" + event.data.bucket + "/" + event.data.name
    }
  };

  if (settings.googleSpeech.speechContexts && settings.googleSpeech.speechContextsEnabled)
    configuration.config.speechContexts = {
      "phrases": settings.googleSpeech.speechContexts.split(',')
    };

  const options = {
    method: 'POST',
    url: 'https://speech.googleapis.com/v1/speech:longrunningrecognize?key=' + GOOGLE_SPEECH_KEY,
    json: configuration
  };

  request(options, function(error, response, body) {

    let data = {
      "service": 'googleSpeech',
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id']
    };

    if (!error && !body.error) {
      data.mediaId = body.name;
    } else {
      console.log('Google speech api error: ' + error);
      data.failureReason = error || body.error.message;
    }

    createTranscriptEntry(data, function() {
      finishedCallback();
    });
  });

}

function uploadToVoiceBase(event, settings, finishedCallback) {
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

  if (settings.voiceBase.keywordSpottingEnabled) {
    let keywordsGroups = {
        "groups": [event.data.metadata['profile-id']]
    }
    configuration.configuration.keywords = keywordsGroups;
  }

  var vbRequest = request(options, voiceBaseCallback);
  var form = vbRequest.form();
  form.append('media', event.data.mediaLink);
  form.append('configuration', JSON.stringify(configuration));


  function voiceBaseCallback(error, response, body) {

    let data = {
      "service": 'voiceBase',
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id'],
      "redaction": !!configuration.configuration.detections
    };

    if (!error && !JSON.parse(body).errors) {
      try {
        data.mediaId = JSON.parse(body).mediaId;
      } catch (e) {
        data.failureReason = e;
      }
    } else {
      data.failureReason = JSON.parse(body).errors.error || error;
    }

    createTranscriptEntry(data, function() {
      finishedCallback();
    });
  }
}

function uploadToService(service, settings, event) {
  console.log("Upload to Service:" + service);
  return new Promise((resolve, reject) => {
    switch (service) {
      case 'googleSpeech':
        uploadToGoogleSpeech(event, settings, function() {
          resolve("Done");
        });
        break;
      case 'voiceBase':
        uploadToVoiceBase(event, settings, function() {
          resolve("Done");
        });
        break;
      case 'ibmWatson':
        uploadToIbmWatson(event, settings, function() {
          resolve("Done");
        });
        break;
    }
  });
}

//*********************************************************

exports.processFile = function(event, callback) {
  console.log('Processing file: ' + event.data.name);
  console.log(event);

  var promises = [];

  if (event.data.resourceState === 'exists'
      && event.data.metageneration === '2'
      && event.data.metadata['participant-id'] !== 'none'
      && event.data.metadata['profile-id']
      && event.data.metadata['call-id']) {

    fetchAnalyticSettings(event.data.metadata['profile-id'], function(error, settings) {

      if (!error && settings) {
        settings.services.forEach((service) => {
          promises.push(uploadToService(service, settings, event));
        });

        Promise.all(promises).then(() => {
          callback();
        }).catch((e) => {
          callback();
        })

      } else {
        console.log('No analytic settings found for ' + event.data.metadata['profile-id']);
        callback();
      }

    });

  } else {
    callback();
  }

};
