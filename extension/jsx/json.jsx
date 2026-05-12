var AECreateJSON = AECreateJSON || {};

AECreateJSON.stringify = function (value) {
  if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(value);
  function esc(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }
  function write(v) {
    if (v === null) return 'null';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return '"' + esc(v) + '"';
    if (v instanceof Array) {
      var items = [];
      for (var i = 0; i < v.length; i++) items.push(write(v[i]));
      return '[' + items.join(',') + ']';
    }
    var props = [];
    for (var key in v) if (v.hasOwnProperty(key)) props.push('"' + esc(key) + '":' + write(v[key]));
    return '{' + props.join(',') + '}';
  }
  return write(value);
};

AECreateJSON.parse = function (text) {
  if (typeof JSON !== 'undefined' && JSON.parse) return JSON.parse(text);

  var source = String(text);
  var at = 0;

  function error(message) {
    throw new Error('Invalid JSON: ' + message + ' at character ' + at + '.');
  }

  function peek() {
    return source.charAt(at);
  }

  function next(expected) {
    var ch = source.charAt(at);
    if (expected && ch !== expected) error('expected "' + expected + '"');
    at += 1;
    return ch;
  }

  function white() {
    while (at < source.length) {
      var ch = peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\uFEFF') {
        at += 1;
      } else {
        break;
      }
    }
  }

  function parseString() {
    var result = '';
    next('"');
    while (at < source.length) {
      var ch = next();
      if (ch === '"') return result;
      if (ch === '\\') {
        var esc = next();
        if (esc === '"' || esc === '\\' || esc === '/') result += esc;
        else if (esc === 'b') result += '\b';
        else if (esc === 'f') result += '\f';
        else if (esc === 'n') result += '\n';
        else if (esc === 'r') result += '\r';
        else if (esc === 't') result += '\t';
        else if (esc === 'u') {
          var hex = source.substr(at, 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) error('invalid unicode escape');
          result += String.fromCharCode(parseInt(hex, 16));
          at += 4;
        } else {
          error('invalid escape');
        }
      } else {
        if (ch.charCodeAt(0) < 32) error('control character in string');
        result += ch;
      }
    }
    error('unterminated string');
  }

  function parseNumber() {
    var start = at;
    if (peek() === '-') at += 1;
    if (peek() === '0') {
      at += 1;
    } else if (/[1-9]/.test(peek())) {
      while (/[0-9]/.test(peek())) at += 1;
    } else {
      error('invalid number');
    }
    if (peek() === '.') {
      at += 1;
      if (!/[0-9]/.test(peek())) error('invalid number fraction');
      while (/[0-9]/.test(peek())) at += 1;
    }
    if (peek() === 'e' || peek() === 'E') {
      at += 1;
      if (peek() === '+' || peek() === '-') at += 1;
      if (!/[0-9]/.test(peek())) error('invalid number exponent');
      while (/[0-9]/.test(peek())) at += 1;
    }
    var value = Number(source.substring(start, at));
    if (!isFinite(value)) error('number out of range');
    return value;
  }

  function parseWord(word, value) {
    if (source.substr(at, word.length) !== word) error('expected ' + word);
    at += word.length;
    return value;
  }

  function parseArray() {
    var array = [];
    next('[');
    white();
    if (peek() === ']') {
      at += 1;
      return array;
    }
    while (at < source.length) {
      array.push(parseValue());
      white();
      if (peek() === ']') {
        at += 1;
        return array;
      }
      next(',');
      white();
    }
    error('unterminated array');
  }

  function parseObject() {
    var object = {};
    next('{');
    white();
    if (peek() === '}') {
      at += 1;
      return object;
    }
    while (at < source.length) {
      if (peek() !== '"') error('object keys must be strings');
      var key = parseString();
      white();
      next(':');
      white();
      object[key] = parseValue();
      white();
      if (peek() === '}') {
        at += 1;
        return object;
      }
      next(',');
      white();
    }
    error('unterminated object');
  }

  function parseValue() {
    white();
    var ch = peek();
    if (ch === '"') return parseString();
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();
    if (ch === '-' || /[0-9]/.test(ch)) return parseNumber();
    if (ch === 't') return parseWord('true', true);
    if (ch === 'f') return parseWord('false', false);
    if (ch === 'n') return parseWord('null', null);
    error('unexpected token');
  }

  var result = parseValue();
  white();
  if (at !== source.length) error('unexpected trailing content');
  return result;
};
