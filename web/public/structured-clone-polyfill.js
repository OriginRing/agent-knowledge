(function (root) {
  if (typeof root.structuredClone === "function") return;

  function clone(value, seen) {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);

    var result;
    if (value instanceof Date) {
      result = new Date(value.getTime());
    } else if (value instanceof RegExp) {
      result = new RegExp(value.source, value.flags);
      result.lastIndex = value.lastIndex;
    } else if (value instanceof Map) {
      result = new Map();
      seen.set(value, result);
      value.forEach(function (entryValue, entryKey) {
        result.set(clone(entryKey, seen), clone(entryValue, seen));
      });
      return result;
    } else if (value instanceof Set) {
      result = new Set();
      seen.set(value, result);
      value.forEach(function (entryValue) {
        result.add(clone(entryValue, seen));
      });
      return result;
    } else if (value instanceof ArrayBuffer) {
      result = value.slice(0);
    } else if (ArrayBuffer.isView(value)) {
      result = value instanceof DataView
        ? new DataView(value.buffer.slice(0), value.byteOffset, value.byteLength)
        : new value.constructor(value);
    } else if (value instanceof Error) {
      result = new value.constructor(value.message);
      result.name = value.name;
      result.stack = value.stack;
    } else {
      result = Array.isArray(value)
        ? []
        : Object.create(Object.getPrototypeOf(value));
    }

    seen.set(value, result);
    Reflect.ownKeys(value).forEach(function (key) {
      if (key !== "length") result[key] = clone(value[key], seen);
    });
    return result;
  }

  root.structuredClone = function (value) {
    return clone(value, new Map());
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
