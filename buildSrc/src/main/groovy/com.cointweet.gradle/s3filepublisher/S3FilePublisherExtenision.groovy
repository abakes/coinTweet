package com.cointweet.gradle.s3filepublisher

class S3FilePublisherExtension {
    String bucketName
    String prefix
    String branch
    List<String> includes
    boolean sync
    Closure s3FilePublisher
    Closure s3Synchronizer

    def S3FilePublisherExtension() {
        sync = false
        bucketName = "cointweet-code"
        prefix = "CoinTweet/Lambda"
        includes = new ArrayList<>()
        includes.add('build/distributions/*.zip')
    }

    def include(String pattern) {
        includes.add(pattern)
    }
}
