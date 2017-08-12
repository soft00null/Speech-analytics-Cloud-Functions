# Speech analytics Cloud Functions
This repository holds different cloud functions to be used in conjunction with voxrec environment for handling speech analytics.
This functions are tied to a specific object creation trigger in a specific bucket, which should be setup by the user at the moment at deploying them.
There are two options available: you can integrate this feature with your Google Cloud or AWS environment so far. More to come in the future.

### AWS-Lambda-serverless
Serverless Lambda function for AWS which includes voicebase and google speech apis.

### Google-functions-analytics-voxrec
Google Cloud function to handle speech analytics. Includes Voicebase, Google Speech and IBM Watson. This is currently in use by Voxbone.ai but it can be easily adapted to any other new environment.

### Google-functions-Voicebase-booth
Google Cloud function used for voicebase demo booth. Provides integration between their demo site and Voxbone dids.

### Google-functions-transcoder
Google Cloud function used for transcoding flac audio files available in a specific URL to another format