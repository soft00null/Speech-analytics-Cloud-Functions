# voicebase-poc
Proof of concept - Integration between voxrec and voicebase

Serverless project for aws lambda nodejs

### Install

`npm install -g serverless`

### Auth against aws

serverless config credentials --provider aws --key 'Access key ID' --secret 'Secret access key'

### Deployment

`serveless deploy`
`serverless deploy --stage production`
