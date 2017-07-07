/**
 * Triggered from a message on a Cloud Storage bucket.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */

var request = require('request');

//********************functions********************************

function createTranscriptEntry(callId, mediaId, finishedCallback) {

  const options = {
    method: 'POST',
    url: 'https://voicebase.ngrok.io/insertTranscript.php',
    json: {
      mediaId: mediaId,
      callId: callId
    },
  };

  request(options, function(error, response, body) {

    if (!error)
      console.log("API endpoint reached successfuly");
    else
      console.log("API endpoint couldn't be reached");

    finishedCallback();
   });

}

function uploadToVoiceBase(event, finishedCallback) {
  var options = {
    url: 'https://apis.voicebase.com/v2-beta/media',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer '
    }
  };

  const configuration = {
    "configuration": {
      "executor": "v2",
      "predictions":[{"model":"0b5679d7-70da-4644-85d4-7fecb36a2368" }],
      "keywords": { "semantic": true},
      "topics": {"semantic": true},
      "language" : "en-US",
      "transcripts":{
        "formatNumbers":["digits"],
        "swearFilter":false,
        "vocabularies": [{"terms" : ["VoiceBase", "Voxbone"]}]},
      "ingest": {
        "channels": {
          "left": {
            "speaker": "Caller"},
          "right": {"speaker": "Agent"}
        },
        "priority":"high"
      }
    }
  };

  var vbRequest = request(options, voiceBaseCallback);
  var form = vbRequest.form();
  form.append('media', event.data.mediaLink);
  form.append('configuration', JSON.stringify(configuration));

  function voiceBaseCallback(error, response, body) {
    const callId = event.data.metadata['call-id'];

    try {
      const mediaId = JSON.parse(body).mediaId;
      console.log("call Id:" + callId + "->" + mediaId);
      createTranscriptEntry(callId, mediaId, function() {
        finishedCallback();
      });
    } catch(e) {
      console.log("There was an error on voicebase api call");
      console.log(body + error);
      finishedCallback();
    }

  }
}

//*********************************************************

exports.processFile = function(event, callback) {

  console.log('Processing file: ' + event.data.name);
  console.log(event);

  if (event.data.resourceState === 'exists'
      && event.data.metageneration === '2'
      && event.data.metadata['participant-id'] === 'none'
      && event.data.metadata['profile-id']
      && event.data.metadata['call-id']) {

    uploadToVoiceBase(event, function() {
      callback();
    });

  } else {
    callback();
  }

};
