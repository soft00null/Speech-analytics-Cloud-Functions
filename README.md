# voicebase-poc
Proof of concept - Integration between voxrec and voicebase

Serverless project for aws lambda nodejs

Fires a request to voicebase api when a new object is created in the defined bucket (You can change it in serverless.yml). This bucket is named 'voxrec-voicebase-proof-of-concept' by default. If it doesn't exist, this APP will create it automatically for you.
Voicebase will reply back to 'HOOK_URL' with the transcription of the file when processing is ready. In that moment, a POST request will be made to 'TRANSCRIPT_CALLBACK_URL' where you will get the transcription.
After that, a new request to voicebase API is made, requesting the reducted file URL(a reducted file is the original file with a sinus tone replacing sensitive information). This service will get the file and upload it to 'voxrec-voicebase-poc-redacted' bucket.

Basic usecase: setup your voxrec.me transfer settings to point to 'voxrec-voicebase-proof-of-concept'. When your recording finishes you will get the transcription of your recording into your TRANSCRIPT_CALLBACK_URL and you will be able to get the reducted file in 'voxrec-voicebase-poc-redacted'.

### Install

`npm install -g serverless`

### Auth against aws

serverless config credentials --provider aws --key 'Access key ID' --secret 'Secret access key'

### Setup

Run `npm install` in this project's folder to install its node dependencies. I

You will need to edit the serveless.yml file with your desired settings

`VOICEBASE_BEARER_TOKEN`: The Bearer token that you get from voicebase to access their API.

`HOOK_URL`: The URL where voicebase api will return the completion status after processing our file. This normally will match the AWS CloudFormation URL where this is deployed. Should point to "voicebase" endpoint.

`SERVERLESS_AWS_ACCESS_KEY_ID`: Your Amazon AWS access key id.

`SERVERLESS_AWS_SECRET_ACCESS_KEY`: Your Amazon AWS secret access key.

`TRANSCRIPT_CALLBACK_URL`: A publicly accessible url where you want to get the transcript of your recording. This service will make a POST to this URL, when transcription is complete. It will include the transcript in the request's body as JSON.

### Deployment

`serveless deploy`

`serverless deploy --stage production`
