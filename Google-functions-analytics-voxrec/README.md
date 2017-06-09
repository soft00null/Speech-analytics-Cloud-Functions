# Google Function

This google function makes requests to the proper speech analytics engine when a new file has been uploaded to a specified Google Cloud Storage Bucket. This bucket trigger needs to be setup within Google Cloud functions config.

When the function is triggered, it will try to get the metadata of the uploaded file. According to the profileId specified in the metadata it will grab the analytics settings for that profile and then it will trigger a call to the proper speech engine.
Every speech analytics API answers back with a confirmation if the POST was successful. In that case this function grabs the process mediaId from that answer and it makes a new POST request to voxrec analytics, which will be encharged of storing this mediaId for displaying the results later.


