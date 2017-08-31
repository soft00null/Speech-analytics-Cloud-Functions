# AWS Lambda Function

This google function makes requests to Voicebase when a new file has been uploaded to a specified AWS S3 Bucket. This bucket trigger needs to be setup within Lambda config.

# Simple Deployment Tutorial

To integrate this function to your AWS environment follow this simple steps:
First of all you'll need to create a bucket into AWS where we will store the recordings.

1 - Navigate to https://console.aws.amazon.com/lambda/home and click on "Create function" on the top right.

2 - Select "Author from scratch". We don't need a blueprint.

3 - Click on the dotted line square and select "S3".

4 - A settings dialog will popup:
    Bucket: select the bucket where we store the recordings.
    Event Type: Object Created(all)
    Check "Enable trigger"
    Click Next

5 - A settings dialog will popup:
    Name: your desired name for this function
    Code entry type: Upload a ZIP file, upload the file "Amazon-functions-analytics-voxrec.zip" which you will find on this repo
    Environment variables: you'll need two variables. The first one is named "VOICEBASE_BEARER_TOKEN", It will contain your Voicebase bearer token (don't prepend the word "bearer"). The other environment variable is called "HOOK_URL". This is the endpoint the function will try to reach with its results. You can use http://mockbin.org for a simple test.
    Handler: handler.processFile
    Role: create a custom role. A new tab will pop up, just click "allow on the bottom right". Lambda_basic_execution should be selected
    Advanced settings: set the timeout to 1 minute and increase the memory assigned if desired. 256MB is enough.
    Click on "Next" and finally "Create function"

6 - Once you make a call and you get the information in your hook url. You can use the "mediaId" provided to make an API call to Voicebase and get the transcription.
Make a GET to "https://apis.voicebase.com/v2-beta/media/{mediaId}" add the header "Authorization" : "Bearer {voicebaseBearerToken}" to authenticate the request.
