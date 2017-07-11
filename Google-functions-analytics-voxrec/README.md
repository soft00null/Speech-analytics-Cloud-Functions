# Google Function

This google function makes requests to the proper speech analytics engine when a new file has been uploaded to a specified Google Cloud Storage Bucket. This bucket trigger needs to be setup within Google Cloud functions config.

When the function is triggered, it will try to get the metadata of the uploaded file. According to the profileId specified in the metadata it will grab the analytics settings for that profile and then it will trigger a call to the proper speech engine.
Every speech analytics API answers back with a confirmation if the POST was successful. In that case this function grabs the process mediaId from that answer and it makes a new POST request to voxrec analytics, which will be encharged of storing this mediaId for displaying the results later.

# Simple Deployment Tutorial

To integrate this function to your Google Cloud environment follow this simple steps:
First of all you'll need to create a bucket into Google Cloud Storage. Named functions-deployment-bucket (or something similar). This bucket will contain the deployed function.

1 - Click on Google Cloud Functions for your account. Probably you'll need to enable them previously.

2 - On the top bar click on 'Create function'

3 - *Name it whatever you want

    *Allocate memory. 128Mb should be enough

    *Trigger: select 'Cloud Storage Bucket' and select your desired bucket from the dropdown. This bucket should be the same bucket where your recordings end up after they finish. Set this bucket into voxrec.

    *We will just use the inline editor: All you need to do is copy and paste the content of this two files (index.js and package.json) into each respective tab. Make sure to have filled index.js with your analytics partners credentials!

    *Stage bucket: select the deployment bucket we set up at the begining of this tutorial.

    *Function to execute: processFile
