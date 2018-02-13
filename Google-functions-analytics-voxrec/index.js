/**
 * Triggered from a message on a Cloud Storage bucket.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */

var request = require('request');
var SpeechToTextV1 = require('watson-developer-cloud/speech-to-text/v1');

const ANALYTICS_SERVICE_URL = '';
const SITE_BASE_URL = '';
const ANALYTICS_SERVICE_KEY = '';
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
    url: ANALYTICS_SERVICE_URL,
    json: data,
    headers: {
    "voxbone-ai-action": "create-analytics-doc",
      "x-analytics-service-key": ANALYTICS_SERVICE_KEY
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

  let model;
  const uriLang = event.data.metadata['lang'] === 'en-GB' ? 'en-UK' : event.data.metadata['lang'];

  if (uriLang)
    model = uriLang + '_BroadbandModel';
  else
    model = settings.ibmWatson.model;

  var params = {
    audio: request(event.data.mediaLink),
    content_type: 'audio/flac',
    timestamps: true,
    max_alternatives: 1,
    model: model,
    profanity_filter: settings.ibmWatson.profanityFilter,
    smart_formatting: settings.ibmWatson.smartFormatting,
    inactivity_timeout: 60
  };

  speech_to_text.createRecognitionJob(params, function(err, res) {

    let data = {
      "service": 'ibmWatson',
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id'],
      "language": model.split('_')[0],
      "analyticSettings": settings,
      "recordingMetadata": Object.assign(event.data.metadata, {'file-name': event.data.name, 'path': event.data.mediaLink})
    };

    if (!err && res) {
      data.mediaId = res.id;
    } else {
      console.log('IBM speech api error: ' + err);
      data.failureReason = err;
    }

    createTranscriptEntry(data, function(err, body) {

      if (err)
        console.log(err);

      finishedCallback();
    });
  });
}

function uploadToGoogleSpeech(event, settings, finishedCallback) {

  let language = event.data.metadata['lang'] || settings.googleSpeech.language;

  const configuration = {
    "config": {
      "encoding": "FLAC",
      "language_code": language,
      "enableWordTimeOffsets": true
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
      "callId": event.data.metadata['call-id'],
      "analyticSettings": settings,
      "language": language,
      "recordingMetadata": Object.assign(event.data.metadata, {'file-name': event.data.name, 'path': event.data.mediaLink})
    };

    if (!error && !body.error) {
      data.mediaId = body.name;
    } else {
      console.log('Google speech api error: ' + error);
      data.failureReason = error || body.error.message;
    }

    createTranscriptEntry(data, function(err, body) {

      if (err)
        console.log(err);

      finishedCallback();
    });
  });

}

function uploadToVoiceBase(event, settings, finishedCallback) {
  var options = {
    url: 'https://apis.voicebase.com/v3/media',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + VOICEBASE_BEARER_TOKEN
    }
  };

  const uriLang = event.data.metadata['lang'] === 'en-GB' ? 'en-UK' : event.data.metadata['lang'];
  let language = uriLang || settings.voiceBase.language;

  let configuration = {
    "speechModel": {
      "language": language
    }
  };

  /*if (language === 'en-US')
    configuration.speechModel.features = ["advancedPunctuation", "voiceFeatures"];
  */

  if (settings.voiceBase.customVocabularyEnabled) {

    const configTerms = settings.voiceBase.customVocabulary.replace(/ /g,',').split(",");
    let terms = [];

    configTerms.forEach((term) => {
      terms.push({term});
    });

    configuration.vocabularies = [{terms}];
  }

  var vbRequest = request(options, voiceBaseCallback);
  var form = vbRequest.form();
  form.append('mediaUrl', event.data.mediaLink);
  form.append('configuration', JSON.stringify(configuration));

  function voiceBaseCallback(error, response, body) {
    let data = {
      "service": 'voiceBase',
      "participantId": event.data.metadata['participant-id'],
      "profileId": event.data.metadata['profile-id'],
      "callId": event.data.metadata['call-id'],
      "redaction": false,
      "language": language,
      "analyticSettings": settings,
      "recordingMetadata": Object.assign(event.data.metadata, {'file-name': event.data.name, 'path': event.data.mediaLink})
    };

    if (!error && !JSON.parse(body).errors) {
      try {
        data.mediaId = JSON.parse(body).mediaId;
      } catch (e) {
        data.failureReason = e;
      }
    } else {
      data.failureReason = JSON.parse(body).errors || error;
    }

    createTranscriptEntry(data, function(err, body) {

      if (err)
        console.log(err);

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
    && event.data.name.split("-")[0] !== 'mixed'
    && event.data.metadata
    && ((event.data.metageneration === '1') || event.data.metadata.retried)
    && event.data.metadata['participant-id'] !== 'none'
    && event.data.metadata['profile-id']
    && event.data.metadata['call-id']) {

    const recordingMetadata = Object.assign(event.data.metadata, {'file-name': event.data.name, 'path': event.data.mediaLink});

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
    console.log("Function returned due to missing metadata or metadata missmatch for file: " + event.data.name);
    callback();
  }

};
