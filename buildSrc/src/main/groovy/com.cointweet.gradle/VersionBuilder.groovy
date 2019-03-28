/**
 * Builds a version string as efficiently as possible by statically caching the result.
 */
class VersionBuilder {
    static String gitBranch
    static String buildNumber

    static String getBuildNumber() {
        if(buildNumber == null) {
            if (System.env.PREBUILT_TEST_BUILD_NUMBER != null) {
                buildNumber = "$System.env.PREBUILT_TEST_BUILD_NUMBER"
            }
            else if (System.env.BUILD_NUMBER != null) {
                buildNumber = "$System.env.BUILD_NUMBER"
            } else {
                buildNumber = "dev"
            }
        }
        return buildNumber
    }

    static String getGitBranch() {
        if(gitBranch == null) {
            if (System.env.GIT_BRANCH != null) {
                gitBranch = "$System.env.GIT_BRANCH".replace('origin/', "")
            } else {
                def gitout = new ByteArrayOutputStream()
                def proc = """git rev-parse --abbrev-ref HEAD""".execute()
                proc.waitFor()
                gitBranch = proc.in.text.trim()
            }
        }
        return gitBranch
    }

    static String buildSonarVersion(int major, int minor) {
        return sprintf("%d.%d", major, minor);
    }

    static String buildVersion(int major, int minor, int patch) {
        return sprintf("%d.%d.%d.%s-%s", major, minor, patch, getBuildNumber(), getGitBranch())
    }

    static String buildVersion(int major, int minor, int patch, String buildNumber) {
        return sprintf("%d.%d.%d.%s-%s", major, minor, patch, buildNumber, getGitBranch())
    }
}
