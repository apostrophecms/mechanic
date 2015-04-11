// boring is an argv parser that doesn't
// do too many things, so you can implement
// strictness your own way without being
// confused by magic intercap aliases, etc.
//
// There is no support for single-hyphen
// options, because that requires a strict
// specification to distinguish boolean
// options from those that take an argument.

module.exports = function() {
  var args = process.argv.slice(2);
  var result = {
    _ = []
  };
  var i;
  for (i = 0; (i < args.length); i++) {
    var matches = args[i].match(/^--(\S+)=(.*)$/);
    if (matches) {
      result[matches[1]] = result[matches[2]];
      continue;
    }
    matches = args[i].match(/^--(\S+)$/);
    if (matches) {
      result[matches[1]] = true;
      continue;
    }
    result._.push(args[i]);
  }
  return result;
};
