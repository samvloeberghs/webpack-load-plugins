'use strict';
var assert = require('assert');
var sinon = require('sinon');

//====================================================================

var webpackLoadPlugins = (function() {
  var wrapInFunc = function(value) {
    return function() {
      return value;
    };
  };

  var proxyquire = require('proxyquire').noCallThru();

  return proxyquire('../', {
    'foo-webpack-plugin': wrapInFunc({ name: 'foo' }),
    'bar-webpack-plugin': wrapInFunc({ name: 'bar' }),
    'foo-bar-webpack-plugin': wrapInFunc({ name: 'foo-bar' }),
    'jack-foo': wrapInFunc({ name: 'jack-foo' }),
    'insert-webpack-plugin': {
      'append':  wrapInFunc({ name: 'insert.append' }),
      'wrap':   wrapInFunc({ name: 'insert.wrap' })
    },
    'findup-sync': function() { return null; },
    '@savl/test-plugin-webpack-plugin': wrapInFunc({ name: 'test-plugin' })
  });
})();

//====================================================================

describe('configuration', function() {
  it('throws a nice error if no configuration is found', function() {
    assert.throws(function() {
      webpackLoadPlugins({
        config: null
      });
    }, /Could not find dependencies. Do you have a package.json file in your project?/);
  });
});


// Contains common tests with and without lazy mode.
var commonTests = function(lazy) {
  it('loads things in', function() {
    var x = webpackLoadPlugins({
      lazy: lazy,
      config: {
        dependencies: {
          'foo-webpack-plugin': '1.0.0',
          'bar-webpack-plugin': '*',
          'insert-webpack-plugin': '*'
        }
      }
    });

    assert.deepEqual(x.foo(), {
      name: 'foo'
    });
    assert.deepEqual(x.bar(), {
      name: 'bar'
    });
    assert.deepEqual(x.insert.wrap(), {
      name: 'insert.wrap'
    });
  });

  it('can take a pattern override', function() {
    var x = webpackLoadPlugins({
      lazy: lazy,
      pattern: 'jack-*',
      replaceString: 'jack-',
      config: {
        dependencies: {
          'jack-foo': '1.0.0',
          'bar-webpack-plugin': '*'
        }
      }
    });

    assert.deepEqual(x.foo(), {
      name: 'jack-foo'
    });
    assert(!x.bar);
  });

  it('allows camelizing to be turned off', function() {
    var x = webpackLoadPlugins({
      lazy: lazy,
      camelize: false,
      config: {
        dependencies: {
          'foo-bar-webpack-plugin': '*'
        }
      }
    });

    assert.deepEqual(x['foo-bar'](), {
      name: 'foo-bar'
    });
  });

  it('camelizes plugins name by default', function() {
    var x = webpackLoadPlugins({
      lazy: lazy,
      config: {
        dependencies: {
          'foo-bar-webpack-plugin': '*'
        }
      }
    });

    assert.deepEqual(x.fooBar(), {
      name: 'foo-bar'
    });
  });

  it('lets something be completely renamed', function() {
    var x = webpackLoadPlugins({
      lazy: lazy,
      config: { dependencies: { 'foo-webpack-plugin': '1.0.0' } },
      rename: { 'foo-webpack-plugin': 'bar' }
    });

    assert.deepEqual(x.bar(), { name: 'foo' });
  });

  it('supports loading scopped package', function() {
    var x = webpackLoadPlugins({
      lazy: lazy,
      config: { dependencies: { '@savl/test-plugin-webpack-plugin': '1.0.0' } }
    });

    assert.deepEqual(x.savl.testPlugin(), { name: 'test-plugin' });
  });

  it('supports custom rename functions', function () {
    var x = webpackLoadPlugins({
      renameFn: function () {
        return 'baz';
      },
      config: {
        dependencies: {
          'foo-bar-webpack-plugin': '*'
        }
      }
    });

    assert.throws(function () {
      x.fooBar();
    });

    assert.deepEqual(x.baz(), {
      name: 'foo-bar'
    });
  });
};

describe('no lazy loading', function() {
  commonTests(false);

  var x, spy;
  before(function() {
    spy = sinon.spy();
    x = webpackLoadPlugins({
      lazy: false,
      config: {
        dependencies: {
          'insert-webpack-plugin': '*'
        }
      },
      requireFn: function() {
        spy();
        return function() {};
      }
    });
  });

  it('does require at first', function() {
    assert(spy.called);
  });
});

describe('with lazy loading', function() {
  commonTests(true);

  var x, spy;
  before(function() {
    spy = sinon.spy();
    x = webpackLoadPlugins({
      lazy: true,
      config: {
        dependencies: {
          'insert-webpack-plugin': '*'
        }
      },
      requireFn: function() {
        spy();
        return function() {};
      }
    });
  });

  it('does not require at first', function() {
    assert(!spy.called);
  });

  it('does when the property is accessed', function() {
    x.insert();
    assert(spy.called);
  });
});

describe('common functionality', function () {
  it('throws a sensible error when not found', function () {
    var x = webpackLoadPlugins({ config: __dirname + '/package.json' });

    assert.throws(function () {
      x.oops();
    }, /Cannot find module 'oops-webpack-plugin'/);
  });

  it('allows you to use in a lower directory', function() {
    var plugins = require('../')();
    assert.ok(typeof plugins.test === 'function');
  });
});
