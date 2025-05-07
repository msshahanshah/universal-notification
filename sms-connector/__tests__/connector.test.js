// connector.test.js
const { processMessage } = require('../src/connector');
const config = require('../src/config');
const logger = require('../src/logger');

// Mock the logger module
const originalLoggerWarn = logger.warn;
const originalLoggerError = logger.error;

logger.warn = jest.fn();
logger.error = jest.fn();

// Import the assert module
const assert = require('assert');

describe('processMessage', function() {
  let mockChannel;
  let mockTransaction;

  beforeEach(function() {
    logger.warn.mockClear();
    logger.error.mockClear();
     // Mock RabbitMQ channel
    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };

    // Mock Sequelize transaction
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
      LOCK: { UPDATE: 'UPDATE' },
    };

    // Mock database and models
     this.mockDb = {
         sequelize: {
           transaction: jest.fn(() => mockTransaction),
         },
         Notification: {
           findOne: jest.fn(),
           update: jest.fn(),
         },
       };

    this.mockDb.Notification.findOne.mockClear();
    this.mockDb.Notification.update.mockClear();
    mockChannel.ack.mockClear();
    mockChannel.nack.mockClear();
    mockTransaction.commit.mockClear();

  });

  afterAll(() => {
    logger.warn = originalLoggerWarn; // Restore the original function
    logger.error = originalLoggerError; // Restore the original function
  });

  it('should handle null message', async function() {
    await processMessage(null, mockChannel,this.mockDb);
    assert.strictEqual(logger.warn.mock.calls.length, 1);
    assert.strictEqual(logger.warn.mock.calls[0][0], 'Consumer received null message, possibly cancelled.');
  });

  it('should handle invalid message format', async function() {
    const invalidMsg = { content: Buffer.from(JSON.stringify({})) };
    await processMessage(invalidMsg, mockChannel, this.mockDb);
    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.strictEqual(mockChannel.nack.mock.calls.length, 1);
    assert.deepStrictEqual(mockChannel.nack.mock.calls[0][0], invalidMsg);
    assert.strictEqual(mockChannel.nack.mock.calls[0][1], false);
    assert.strictEqual(mockChannel.nack.mock.calls[0][2], false);
  });

  it('should handle notification record not found', async function() {
    const messageId = 'some-message-id';
    const dbId = 123;
    const msg = { content: Buffer.from(JSON.stringify({ dbId, messageId, channel: 'some-channel', message: 'some-message', templateId: 'some-template' })) };

    this.mockDb.Notification.findOne.mockResolvedValueOnce(null);

    await processMessage(msg, mockChannel, this.mockDb);

    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.ok(logger.error.mock.calls[0][0].includes('Notification record not found'));
    assert.strictEqual(mockTransaction.commit.mock.calls.length, 1);
    assert.strictEqual(mockChannel.nack.mock.calls.length, 1);
    assert.deepStrictEqual(mockChannel.nack.mock.calls[0][0], msg);
    assert.strictEqual(mockChannel.nack.mock.calls[0][1], false);
    assert.strictEqual(mockChannel.nack.mock.calls[0][2], false);
  });

  it('should handle idempotency check (already sent)', async function() {
    const messageId = 'some-message-id';
    const dbId = 123;
    const msg = { content: Buffer.from(JSON.stringify({ dbId, messageId, channel: 'some-channel', message: 'some-message', templateId: 'some-template' })) };
    const mockNotification = { id: dbId, messageId, status: 'sent', attempts: 0, save: jest.fn() };

    this.mockDb.Notification.findOne.mockResolvedValueOnce(mockNotification);

    await processMessage(msg, mockChannel, this.mockDb);

    assert.strictEqual(logger.warn.mock.calls.length, 1);
    assert.ok(logger.warn.mock.calls[0][0].includes('Notification already marked as sent'));
    assert.strictEqual(mockTransaction.commit.mock.calls.length, 1);
    assert.strictEqual(mockChannel.ack.mock.calls.length, 1);
    assert.deepStrictEqual(mockChannel.ack.mock.calls[0][0], msg);
  });

});