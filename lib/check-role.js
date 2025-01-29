exports.validateAdmin = function(role) {
  if (role !== 'admin') throw new Error('403 Forbidden');
}