var request = require('request'),
    API_VERSION = '2.0';

module.exports = function () {
    var self = this,
        makeUrl = function (resource, odata) {
            var baseUrl = self.configuration.projectUrl + '/_apis/build/' + resource + '?api-version=' + API_VERSION;

            if (odata) {
                baseUrl += '&' + odata;
            }

            return baseUrl;
        },
        makeRequest = function (url, callback) {
            request({
                'url': url,
                'rejectUnauthorized': false,
                'headers': { 'Accept': 'application/json' },
                'json' : true,
                'auth': { 'user': self.configuration.username, 'pass': self.configuration.personalAccessToken }
                },
                function(error, response, body) {
                    console.log(url);
                    callback(error, body);
            });
        },
        parseDate = function (dateAsString) {
            return dateAsString ? new Date(dateAsString) : null;
        },
        forEachResult = function (body, callback) {
            for (var i = 0; i < body.value.length; i++) {
                callback(body.value[i]);
            }
        },
        isNullOrWhiteSpace = function (string) {
            if(!string) {
                return true;
            }

            return string === null || string.match(/^ *$/) !== null;
        },
        getStatus = function (statusText, resultText) {
            if (statusText === "completed" && resultText === "succeeded") return "Green";
            if (statusText === "completed" && resultText === "failed") return "Red";
            if (statusText === "completed" && resultText === "canceled") return "Gray";
            if (statusText === "inProgress") return "Blue";
            if (statusText === "stopped") return "Gray";

            return "'#FFA500'";
        },
        getStatusText = function (statusText, resultText) {
            if (statusText === "completed" && resultText === "succeeded") return "Succeeded";
            if (statusText === "completed" && resultText === "failed") return "Failed";
            if (statusText === "inProgress") return "In Progress";
            if (statusText === "stopped") return "Stopped";

            return statusText + "/" + resultText;
        },
        simplifyBuild = function (res) {
            return {
                id: res.id,
                project: res.project.name,
                definition: res.definition.name,
                number: res.buildNumber,
                isRunning: !res.finishTime,
                startedAt: parseDate(res.startTime),
                finishedAt: parseDate(res.finishTime),
                requestedFor: res.requestedFor.displayName,
                statusText: getStatusText(res.status, res.result),
                status: getStatus(res.status, res.result),
                reason: res.reason,
                hasErrors: !isNullOrWhiteSpace(res.Errors),
                hasWarnings: !isNullOrWhiteSpace(res.Warnings),
                url: res._links.web.href
            };
        },
        getBuilds = function (definitionIds, callback) {
            var definitions = '';
            if (definitionIds.length > 0) {
                definitions = '&maxBuildsPerDefinition=1&definitions=' + definitionIds.join(',');
            }
            console.log(definitions);

            makeRequest(makeUrl('builds', '$top=30' + definitions), function (error, body) {
                if (error) {
                  callback(error);
                  return;
                }

                var builds = [];

                forEachResult(body, function (res) {
                    builds.push(simplifyBuild(res));
                });

                callback(error, builds);
            });
        }
        queryBuilds = function (callback) {
            if (self.configuration.definitionIds.length === 0) {
                makeRequest(makeUrl('definitions', ''), function (error, body) {
                    if (error) {
                        callback(error);
                        return;
                    }
                    
                    var ids = [];
                    forEachResult(body, function (res) {
                        ids.push(res.id);
                    });

                    getBuilds(ids, callback);
                });
            }
            else {
                getBuilds(self.configuration.definitionIds, callback);
            }
        };

    self.configure = function (config) {
        self.configuration = config;

        // TODO cleaner 'reason'
        // TODO validate projectUrl
        // TODO multiple sames together?

        if (!self.configuration.username) {
            throw new Error('Vsts configuration is missing `username`.');
        }

        if (!self.configuration.personalAccessToken) {
            throw new Error('Vsts configuration is missing `personalAccessToken`.');
        }
    };

    self.check = function (callback) {
        queryBuilds(callback);
    };
};
