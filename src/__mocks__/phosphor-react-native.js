// Plain CommonJS so jest needs no transform. Any `<Name>Icon` export resolves to a
// string-rendering stub, so the mock never drifts from the icon registry.
const React = require('react');

const cache = {};
const stub = name =>
  cache[name] ||
  (cache[name] = Object.assign(props => React.createElement('PhosphorIcon', { ...props, name }), { displayName: name }));

module.exports = new Proxy(
  { __esModule: true, IconContext: React.createContext({}) },
  { get: (target, key) => (key in target ? target[key] : typeof key === 'string' ? stub(key) : undefined) },
);
