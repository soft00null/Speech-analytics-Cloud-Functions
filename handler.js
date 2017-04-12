'use strict';

module.exports.voicebasehook = (event, context, callback) => {
  var AWS = require('aws-sdk');
  var request = require('request');
  AWS.config.update({ accessKeyId: process.env.SERVERLESS_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.SERVERLESS_AWS_SECRET_ACCESS_KEY });
  var mediaId = JSON.parse(event.body).media.mediaId;

  var sendTranscriptOptions = {
    url: process.env.TRANSCRIPT_CALLBACK_URL,
    method: 'POST',
    json: JSON.parse(event.body)
  };

  console.log(sendTranscriptOptions);

  request(sendTranscriptOptions, function(error, response, body){
    if (!error)
      console.log("Successfully sent voicebase transcript to callback url");
  });

  var getFileOptions = {
    url: 'https://apis.voicebase.com/v2-beta/media/' + mediaId + "/streams",
    method: 'GET',
    headers: {
      'Authorization': process.env.VOICEBASE_BEARER_TOKEN
    }
  };

  function callback(error, response, body) {
    var REDACTED_FILE = JSON.parse(body).streams.original;
    request({
      uri: REDACTED_FILE,
      encoding: null
    }, function(error, response, body) {
      if (error || response.statusCode !== 200) {
        console.log("failed to get file");
        console.log(error);
      } else {
        var s3 = new AWS.S3();
        s3.putObject({
          Body: body,
          Key: mediaId + '-redacted.wav',
          Bucket: 'voxrec-voicebase-poc-redacted'
        }, function(error, data) {
          if (error) {
            console.log("error downloading image to s3");
          } else {
            console.log("success uploading to s3");
          }
        });
      }
    });
  }

  request(getFileOptions, callback);
};

module.exports.voicebase = (event, context, callback) => {
  var AWS = require('aws-sdk');
  AWS.config.update({ accessKeyId: process.env.SERVERLESS_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.SERVERLESS_AWS_SECRET_ACCESS_KEY });
  var request = require('request');
  console.log("New file in bucket voicebase-voxrec-poc");
  const RESOURCE_URL = 'https://s3.amazonaws.com/' + event.Records[0].s3.bucket.name + '/' + event.Records[0].s3.object.key;

  var options = {
    url: 'https://apis.voicebase.com/v2-beta/media',
    method: 'POST',
    headers: {
      'Authorization': process.env.VOICEBASE_BEARER_TOKEN
    }
  };

  function callback(error, response, body) {
    console.log(body);
    if (!error && response.statusCode == 200) {
      console.log("Success");
    } else {
      console.log("Failure");
    }
  }

  const configuration = {
    "configuration" : {
      "detections": [
        { "model": "PCI",
          "redact": {
            "transcripts": "[redacted]",
            "audio": {
              "tone": 270,
              "gain": 0.5
            }
          }
        },
        { "model": "SSN",
          "redact": {
            "transcripts": "[redacted]",
            "audio": {
              "tone": 270,
              "gain": 0.5
            }
          }
        },
        { "model": "Number",
          "redact": {
            "transcripts": "[redacted]",
            "audio": {
              "tone": 270,
              "gain": 0.5
            }
          }
        }
      ],
      "publish": {
        "callbacks": [
          {
            "url" : process.env.HOOK_URL,
            "method" : "POST",
            "include" : [ "transcripts"]
          }
        ]
      }
    }
  };

  var request = request(options, callback);
  var form = request.form();
  form.append('media', RESOURCE_URL);
  form.append('configuration', JSON.stringify(configuration));

  const FILE_NAME = event.Records[0].s3.object.key;

  //trigger transcoding to flac
  const elastictranscoder = new AWS.ElasticTranscoder();
  const params = {
    //audiotranscoder pipeline
    PipelineId: '1491924039069-q5xvuc',
    Input: {
      AspectRatio: 'auto',
      Container: 'auto',
      FrameRate: 'auto',
      Interlaced: 'auto',
      Key: FILE_NAME,
      Resolution: 'auto'
    },
    Outputs: [
      {
        Key: FILE_NAME + '.flac',
        PresetId: '1491945029791-ltldjb'
      }
    ]
  };

  elastictranscoder.createJob(params, function(err, data) {
    console.log("TRANSCODER RESPONSE");
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
};


module.exports.googlespeech = (event, context, callback) => {
  var speech = require('@google-cloud/speech');
  var request = require('request');
  const RESOURCE_URL = 'https://s3.amazonaws.com/' + event.Records[0].s3.bucket.name + '/' + event.Records[0].s3.object.key
  console.log(RESOURCE_URL);

  var speechClient = speech({
    projectId: 'voxbone-workshop',
    keyFilename: 'Workshop-c5795abec2f2.json'
  });

  const options = {
    encoding: 'FLAC',
    languageCode: 'en-US'
  };

  speechClient.recognize(RESOURCE_URL, options)
  .then((results) => {
    const transcription = results[0];
    var sendTranscriptOptions = {
      url: process.env.TRANSCRIPT_CALLBACK_URL,
      method: 'POST',
      json: {transcription}
    };

    console.log(sendTranscriptOptions);

    request(sendTranscriptOptions, function(error, response, body){
      if (!error)
        console.log("Successfully sent googlespeech transcript to callback url");
      else
        console.log(error);
    });
  });
};
