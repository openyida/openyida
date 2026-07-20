'use strict';

function compareCodePoints(left, right) {
  const leftString = String(left);
  const rightString = String(right);
  const leftPoints = Array.from(leftString);
  const rightPoints = Array.from(rightString);
  const length = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < length; index++) {
    const leftCode = leftPoints[index].codePointAt(0);
    const rightCode = rightPoints[index].codePointAt(0);
    if (leftCode !== rightCode) {
      return leftCode - rightCode;
    }
  }

  return leftPoints.length - rightPoints.length;
}

function sortStrings(values) {
  return [...values].sort(compareCodePoints);
}

module.exports = {
  compareCodePoints,
  sortStrings,
};
