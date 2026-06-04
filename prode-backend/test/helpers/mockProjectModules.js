const path = require("node:path");

const backendRoot = path.resolve(__dirname, "../..");

function backendPath(relativePath) {
  return path.join(backendRoot, relativePath);
}

function clearSrcModules() {
  for (const id of Object.keys(require.cache)) {
    if (id.startsWith(path.join(backendRoot, "src") + path.sep)) {
      delete require.cache[id];
    }
  }
}

function mockProjectModule(relativePath, exports) {
  const filename = backendPath(relativePath);
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
  };
}

function requireProject(relativePath) {
  return require(backendPath(relativePath));
}

module.exports = {
  backendPath,
  clearSrcModules,
  mockProjectModule,
  requireProject,
};
