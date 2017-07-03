'use strict';

module.exports.voicebasehook = (event, context, callback) => {
  var AWS = require('aws-sdk');
  var request = require('request');
  AWS.config.update({ accessKeyId: process.env.SERVERLESS_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.SERVERLESS_AWS_SECRET_ACCESS_KEY });
  var mediaId = JSON.parse(event.body).media.mediaId;
  var s3 = new AWS.S3();

  console.log(event.body);

  var content = JSON.parse(event.body).media.transcripts.text;
  createTranscriptionLog(content, s3, mediaId, 'voicebase');

  var getFileOptions = {
    url: 'https://apis.voicebase.com/v2-beta/media/' + mediaId + "/streams",
    method: 'GET',
    headers: {
      'Authorization': process.env.VOICEBASE_BEARER_TOKEN
    }
  };

  function getFileCallback(error, response, body) {
    var REDACTED_FILE = JSON.parse(body).streams.original;
    request({
      uri: REDACTED_FILE,
      encoding: null
    }, function(error, response, body) {
      if (error || response.statusCode !== 200) {
        console.log("failed to get file");
        console.log(error);
      } else {
        s3.putObject({
          Body: body,
          Key: mediaId + '-redacted.wav',
          Bucket: 'voxrec-voicebase-poc-redacted'
        }, function(error, data) {
          if (error) {
            console.log("error uploading redacted file to s3");
          } else {
            console.log("success uploading redacted file to s3");
          }
        });
      }
    });
  }

  request(getFileOptions, getFileCallback);

  const response = {
    statusCode: 200
  };

  callback(null, response);
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
        Key: FILE_NAME.replace(".wav", "") + '.flac',
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
  var AWS = require('aws-sdk');
  AWS.config.update({ accessKeyId: process.env.SERVERLESS_AWS_ACCESS_KEY_ID, secretAccessKey: process.env.SERVERLESS_AWS_SECRET_ACCESS_KEY });
  var s3 = new AWS.S3();
  var speech = require('@google-cloud/speech');

  const RESOURCE_URL = 'https://s3.amazonaws.com/' + event.Records[0].s3.bucket.name + '/' + event.Records[0].s3.object.key;

  var speechClient = speech({
    projectId: '',
    keyFilename: ''
  });

  const options = {
    encoding: 'FLAC',
    languageCode: 'en-US'
  };

  speechClient.recognize(RESOURCE_URL, options)
  .then((results) => {
    const transcription = results[0];
    createTranscriptionLog(transcription, s3, event.Records[0].s3.object.key, 'googlespeech');
  });
};

function createTranscriptionLog(content, s3, filename, identifier) {
  s3.putObject({
    Body: JSON.stringify(content),
    Key: filename + '-' + identifier + '-transcription.json',
    Bucket: 'voxrec-voicebase-proof-of-concept'
  }, function(error, data) {
    if (error) {
      console.log("error uploading log to s3");
      console.log(error);
    } else {
      console.log("success uploading log to s3");
    }
  });
}
