'use strict'

const { test } = require('node:test')
const proxyquire = require('proxyquire')
const { Readable } = require('node:stream')
const { kTestInternals, kRouteContext, kRequestPayloadStream } = require('../../lib/symbols')
const Request = require('../../lib/request')
const Reply = require('../../lib/reply')

test('rawBody function', t => {
  t.plan(2)

  const internals = require('../../lib/content-type-parser')[kTestInternals]
  const body = Buffer.from('你好 世界')
  const parser = {
    asString: true,
    asBuffer: false,
    fn (req, bodyInString, done) {
      t.assert.strictEqual(bodyInString, body.toString())
      t.assert.strictEqual(typeof done, 'function')
      return {
        then (cb) {
          cb()
        }
      }
    }
  }
  const res = {}
  res.end = () => { }
  res.writeHead = () => { }

  res.log = { error: () => { }, info: () => { } }
  const context = {
    Reply,
    Request,
    preHandler: [],
    onSend: [],
    _parserOptions: {
      limit: 1024
    }
  }
  const rs = new Readable()
  rs._read = function () { }
  rs.headers = { 'content-length': body.length }
  const request = new Request('id', 'params', rs, 'query', 'log', context)
  const reply = new Reply(res, request)
  const done = () => { }

  internals.rawBody(
    request,
    reply,
    reply[kRouteContext]._parserOptions,
    parser,
    done
  )
  rs.emit('data', body.toString())
  rs.emit('end')
})

test('Should support Webpack and faux modules', t => {
  t.plan(2)

  const internals = proxyquire('../../lib/content-type-parser', {
    'toad-cache': { default: () => { } }
  })[kTestInternals]

  const body = Buffer.from('你好 世界')
  const parser = {
    asString: true,
    asBuffer: false,
    fn (req, bodyInString, done) {
      t.assert.strictEqual(bodyInString, body.toString())
      t.assert.strictEqual(typeof done, 'function')
      return {
        then (cb) {
          cb()
        }
      }
    }
  }
  const res = {}
  res.end = () => { }
  res.writeHead = () => { }

  res.log = { error: () => { }, info: () => { } }
  const context = {
    Reply,
    Request,
    preHandler: [],
    onSend: [],
    _parserOptions: {
      limit: 1024
    }
  }
  const rs = new Readable()
  rs._read = function () { }
  rs.headers = { 'content-length': body.length }
  const request = new Request('id', 'params', rs, 'query', 'log', context)
  const reply = new Reply(res, request)
  const done = () => { }

  internals.rawBody(
    request,
    reply,
    reply[kRouteContext]._parserOptions,
    parser,
    done
  )
  rs.emit('data', body.toString())
  rs.emit('end')
})

test('rawBody avoids Buffer.concat for buffer parsers on the raw payload when content-length is known', t => {
  t.plan(2)

  const internals = require('../../lib/content-type-parser')[kTestInternals]
  const body = Buffer.from('hello world')
  const parser = {
    asString: false,
    asBuffer: true,
    fn (req, bodyInBuffer) {
      t.assert.ok(bodyInBuffer instanceof Buffer)
      t.assert.deepStrictEqual(bodyInBuffer, body)
    }
  }
  const originalConcat = Buffer.concat
  const res = {}
  res.end = () => { }
  res.writeHead = () => { }

  t.after(() => {
    Buffer.concat = originalConcat
  })

  Buffer.concat = () => {
    throw new Error('Buffer.concat should not be called for the preallocated buffer path')
  }

  res.log = { error: () => { }, info: () => { } }
  const context = {
    Reply,
    Request,
    preHandler: [],
    onSend: [],
    _parserOptions: {
      limit: 1024
    }
  }
  const rs = new Readable()
  rs._read = function () { }
  rs.headers = { 'content-length': body.length }
  const request = new Request('id', 'params', rs, 'query', 'log', context)
  const reply = new Reply(res, request)
  const done = () => { }

  internals.rawBody(
    request,
    reply,
    reply[kRouteContext]._parserOptions,
    parser,
    done
  )
  rs.emit('data', body.subarray(0, 5))
  rs.emit('data', body.subarray(5))
  rs.emit('end')
})

test('rawBody keeps the concat path for transformed payload streams', t => {
  t.plan(3)

  const internals = require('../../lib/content-type-parser')[kTestInternals]
  const encodedLength = 5
  const body = Buffer.from('hello world')
  const parser = {
    asString: false,
    asBuffer: true,
    fn (req, bodyInBuffer) {
      t.assert.ok(bodyInBuffer instanceof Buffer)
      t.assert.deepStrictEqual(bodyInBuffer, body)
      t.assert.strictEqual(concatCalls, 1)
    }
  }
  const originalConcat = Buffer.concat
  let concatCalls = 0
  const res = {}
  res.end = () => { }
  res.writeHead = () => { }

  t.after(() => {
    Buffer.concat = originalConcat
  })

  Buffer.concat = function (...args) {
    concatCalls++
    return originalConcat.apply(this, args)
  }

  res.log = { error: () => { }, info: () => { } }
  const context = {
    Reply,
    Request,
    preHandler: [],
    onSend: [],
    _parserOptions: {
      limit: 1024
    }
  }
  const rs = new Readable()
  rs._read = function () { }
  rs.headers = { 'content-length': encodedLength }
  const request = new Request('id', 'params', rs, 'query', 'log', context)
  const reply = new Reply(res, request)
  const transformed = new Readable()
  transformed._read = function () { }
  transformed.receivedEncodedLength = encodedLength
  request[kRequestPayloadStream] = transformed
  const done = () => { }

  internals.rawBody(
    request,
    reply,
    reply[kRouteContext]._parserOptions,
    parser,
    done
  )
  transformed.emit('data', body.subarray(0, 5))
  transformed.emit('data', body.subarray(5))
  transformed.emit('end')
})
