# voicebase-poc
Proof of concept - Integration between voxrec and voicebase

Serverless project for aws lambda nodejs

### Install

`npm install -g serverless`

### Auth against aws

serverless config credentials --provider aws --key 'Access key ID' --secret 'Secret access key'

### Setup
You will need to edit the serveless.yml file with your desired settings
`VOICEBASE_BEARER_TOKEN`: The Bearer token that you get from voicebase gives for access to their API.
`HOOK_URL`: The URL where voicebase api will return the completion status after processing our file. This normally will match the AWS CloudFormation URL where this is deployed. Should point to "voicebase" endpoint
`SERVERLESS_AWS_ACCESS_KEY_ID`: Your Amazon AWS access key id
`SERVERLESS_AWS_SECRET_ACCESS_KEY`: Your Amazon AWS secret access key
`TRANSCRIPT_CALLBACK_URL`: A publicly accessible url where you want to get the transcript of your recording. This service will make a POST to this URL, when transcription is complete. It will include the transcript in the request's body as JSON.

### Deployment

`serveless deploy`

`serverless deploy --stage production`
