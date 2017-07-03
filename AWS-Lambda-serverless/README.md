# AWS-Lambda-serverless

Serverless project for AWS Lambda functions in NodeJs

Fires a request to Voicebase or Google Speech APIS when a new object is created in the bucket defined in serverless.yml. If it doesn't exist, this APP will create it automatically for you.
Voicebase will reply back to 'HOOK_URL' with the transcription of the file when processing is ready and will place the redacted file into a new bucket (a redacted file is the same as the original audio file but with a sinus tone replacing sensitive information).

Basic use case: setup your voxrec.me transfer settings to point to the bucket specificed in serverless.yml. When your recording finishes you will get the transcription of your recording into your HOOK_URL as a POST request and you will be able to get the redacted file in another bucket you specify (It must be different).

### Install

To install serverless run `npm install -g serverless`

Run `npm install` in this project's folder to install its node dependencies.

### Auth against aws

serverless config credentials --provider aws --key 'Access key ID' --secret 'Secret access key'

### Setup

You will need to edit the serveless.yml file with your desired settings

`VOICEBASE_BEARER_TOKEN`: The Bearer token that you get from voicebase to access their API.

`HOOK_URL`: The URL where voicebase api will return the completion status after processing our file. This normally will match the AWS CloudFormation URL where this function is deployed. Should point to "voicebase" endpoint.

`SERVERLESS_AWS_ACCESS_KEY_ID`: Your Amazon AWS access key id.

`SERVERLESS_AWS_SECRET_ACCESS_KEY`: Your Amazon AWS secret access key.

`TRANSCRIPT_CALLBACK_URL`: A publicly accessible url where you want to get the transcript of your recording. This service will make a POST to this URL, when transcription is complete. It will include the transcript in the request's body as JSON.

### Deployment

`serveless deploy`

`serverless deploy --stage production`
