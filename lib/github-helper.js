module.exports = {
  commentUrlToIssueRequest(url) {
    const match = url.match('https://api.github.com/repos/(.*)/(.*)/issues/(.*)/comments');
    if (match === null) {
      return {};
    } else {
      return {
        owner:match[1],
        repo:match[2],
        number:match[3]
      };
    }
  }

};
