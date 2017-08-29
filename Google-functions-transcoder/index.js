/**
 * Responds to any HTTP POST request that can provide a "url" field in the body.
 * Will store in a bucket a mp3 transcoded version of the file available in the url
 *
 * @param {!Object} req Cloud Function request context.
 * @param {!Object} res Cloud Function response context.
 */

const request = require('request');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const FfmpegCommand = require('fluent-ffmpeg');
FfmpegCommand.setFfmpegPath(ffmpegPath);
const fs = require('fs');
const path = require('path');
const gcsStorage = require('@google-cloud/storage');

exports.transcodeAudio = function transcodeAudio(req, res) {
  var url;
  var bucketname = "janus";
  var destformat = 'mp3';

  if (req.method !== 'POST') res.status(404).send('Request is not a POST');
  else url = req.body.url;

  options = {
    url: url,
    method: 'GET',
    encoding: 'binary'
  };

  function uploadToGcs(stream, filedest_path, cb) {
    var buffer = stream;

    const gcs = gcsStorage({
      projectId: gcsCredentials.project_id,
      credentials: gcsCredentials
    });

    const bucket = gcs.bucket(bucketname);
    //const file = bucket.file(filename);

    bucket.upload(filedest_path, function(err, file) {
      if (!err) {
        console.log('file ' + filedest_path.substr(filedest_path.lastIndexOf('/') + 1) + ' in ' + bucketname + ' bucket');
        cb();
      } else {
        console.log(err);
      }
    });
  }

  request(options, function (err, response, body) {
    fs.writeFile("/tmp/audio.flac", body, 'binary', function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log("The file was saved!");
        try {
          var filedest = 'transcoded-' + options.url.substr(options.url.lastIndexOf('/') + 1).split('.')[0];
          var process = new FfmpegCommand('/tmp/audio.flac');

          process.on('start', function(commandLine) {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
          }).on('codecData', function(data) {
            console.log('Input is ' + data.audio + ' audio ');
          }).on('progress', function(progress) {
            console.log('Processing: ' + progress.percent + '% done');
          }).on('end', function(stdout, stderr) {
            console.log('transcoding ended');
            var filedest_path = '/tmp/' + filedest + '.' + destformat;
            // console.log(stdout);
            if (fs.existsSync(filedest_path)) {
              console.log('file exists, uploading...');
              var readStream = fs.createReadStream(filedest_path);
              uploadToGcs(readStream, filedest_path, function() {
                res.status(200).send('Success! Transcoded file in: '+filedest_path);
              });
            } else {
              res.status(200).send('Success importing file: ' + options.url + ' but could not upload file. ' + filedest + ' do not exist.');
            }
          }).on('error', function(err, stdout, stderr) {
            console.log('An error occurred: ' + err.message, err, stderr);
          //save file in /tmp with destformat (e.g.: mp3)
          }).save('/tmp/' + filedest + '.' + destformat);

        } catch (e) {
          console.log('error transcoding or uploading');
          console.log(e.code);
          console.log(e.msg);
        }
      }
    });
  });

}