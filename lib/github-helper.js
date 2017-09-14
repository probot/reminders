module.exports = {
  isLabelOnIssue(issue, labelName) {
    const currentLabels = issue.labels.find(elm => {
      return typeof (elm) === 'object' && Object.prototype.hasOwnProperty.call(elm, 'name') && elm.name === labelName;
    });
    return currentLabels;
  }
};
