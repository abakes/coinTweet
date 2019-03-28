package com.cointweet.gradle.s3filepublisher

import com.amazonaws.auth.BasicAWSCredentials
import com.amazonaws.services.s3.AmazonS3Client
import org.apache.commons.lang3.StringUtils
import org.gradle.api.Plugin
import org.gradle.api.Project

/**
 * A plugin for publishing files to S3.
 *
 * This plugin currently only works with a "flat" input directory (ie. it will not handle subdirectories within the
 * project directory).
 */
class S3FilePublisherPlugin implements Plugin<Project> {
    @Override
    void apply(Project project) {
        def publisherExt = project.extensions.create('s3FilePublisher', S3FilePublisherExtension)

        if(publisherExt.branch == null) {
            publisherExt.branch = VersionBuilder.getGitBranch()
        }

        if(publisherExt.s3FilePublisher == null) {
            publisherExt.s3FilePublisher = { s3, bucket, prefix, branch, file ->
                def key = "${prefix}/${branch}/${file.getName()}"
                println "Uploading ${file} to ${bucket}/${key}"
                s3.putObject(bucket, key, file)
            }
        }

        if(publisherExt.s3Synchronizer == null) {
            publisherExt.s3Synchronizer = { s3, bucket, prefix, branch ->
                def baseKey = "${prefix}/${branch}/"
                def objListing = null
                while(objListing == null || objListing.isTruncated()) {
                    if(objListing == null) {
                        objListing = s3.listObjects(bucket, baseKey)
                    }
                    else {
                        objListing = s3.listNextBatchOfObjects(objListing)
                    }

                    objListing.objectSummaries.each { objSummary ->
                        def s3Filename = objSummary.key.substring(objSummary.key.lastIndexOf('/') + 1)
                        def localFile = new File(project.projectDir, s3Filename)
                        if(!localFile.exists()) {
                            println "The S3 object ${objSummary.key} is not in local directory: it will be deleted"
                            s3.deleteObject(objSummary.bucketName, objSummary.key)
                        }
                    }
                }
            }
        }

        project.task('publishFilesToS3') {
            description = 'Publish files to S3'

            doLast {
                if(StringUtils.isEmpty(publisherExt.bucketName)) {
                    throw new Exception("'bucketName' property is not set")
                }

                if(StringUtils.isEmpty(publisherExt.prefix)) {
                    throw new Exception("'prefix' property is not set")
                }

                def s3 = new AmazonS3Client();

                def files = project.fileTree(project.projectDir) {
                    publisherExt.includes.each {
                        include it
                    }
                }

                // The strategy here is to first upload all files within the project directory that filters. This
                // will replace any existing files and upload any new files that didn't previously exist. Then, if
                // the 'sync' flag is set we will iterate through all of the files in S3 and see if there are any
                // that are not in the project directory and if so this these S3 objects will be deleted. This
                // latter step ensures that any existing (pre-existing) S3 objects that are deleted will be removed.

                files.findAll { f ->
                    publisherExt.s3FilePublisher.call(
                            s3,
                            publisherExt.bucketName,
                            publisherExt.prefix,
                            publisherExt.branch,
                            f)
                }

                if(publisherExt.sync) {
                    publisherExt.s3Synchronizer.call(
                            s3,
                            publisherExt.bucketName,
                            publisherExt.prefix,
                            publisherExt.branch)
                }
            }
        }
    }

    private static def verifyProperty(Project project, String propertyName) {
        if(!project.hasProperty(propertyName)) {
            throw new Exception("Property '${propertyName}' does not exist. Please check your gradle.properties file")
        }
    }
}
