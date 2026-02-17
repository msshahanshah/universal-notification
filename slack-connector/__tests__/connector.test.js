// ./slack-connector/__tests__/connector.test.js
/**
 * @fileoverview Tests for the Slack Connector's processMessage function.
 * This suite focuses on unit testing the core logic of the `processMessage`
 * function, ensuring it correctly handles various scenarios like successful
 * message processing, idempotency, failures, and edge cases.
 */
const { processMessage } = require('../src/connector'); // Assuming processMessage is exported or accessible for testing
const db = require('../models'); // Import Sequelize instance and models
const Notification = db.Notification; // Get the Notification model
const slackSender = require('../src/slackSender');
const logger = require('../src/logger');
const config = require('../src/config'); // To access config like maxProcessingAttempts


// --- Mocks ---
// Mock Sequelize Notification model and transaction
jest.mock('../models', () => {
    /**
     * @typedef {Object} MockNotificationInstance
     * @property {number} id - Mock ID.
     * @property {string} messageId - Mock message ID.
     * @property {string} service - Mock service name.
     * @property {string} target - Mock target channel.
     * @property {string} content - Mock message content.
     */
    const mockNotificationInstance = {
        id: 1,
        messageId: 'test-msg-id',
        service: 'slack',
        target: '#test-channel',
        content: 'Test message',
        status: 'pending',
        attempts: 0,
        connectorResponse: null,
        save: jest.fn().mockResolvedValue(this), // Mock save method on instance
        update: jest.fn().mockResolvedValue(this), // Mock update method on instance (if used directly)
        // Add other fields/methods as needed by the code
    /**
     * @typedef {Object} MockNotificationModel
     * @property {Function} findOne - Mock findOne method.
     */
    };
    const mockNotificationModel = {
        findOne: jest.fn(),
        update: jest.fn(), // Mock static update method
        // Add other static methods if needed
    };
    const mockTransaction = {
        /**
         * @typedef {Object} MockTransaction - Mock transaction object
         */
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        LOCK: { UPDATE: 'UPDATE' } // Mock lock object if used
    };
    return {
        sequelize: {
            transaction: jest.fn().mockResolvedValue(mockTransaction), // Mock transaction creation
            authenticate: jest.fn().mockResolvedValue(true),
            close: jest.fn().mockResolvedValue(true),
        },
        Notification: mockNotificationModel,
        /**
        * @typedef {Object} Sequelize - Mock Sequelize object
        * @property {Object} Op - Mock Operator object
        */
        /**@type {Sequelize} */

        Sequelize: { Op: {} }, // Mock Op if needed
        // --- Helper to get a fresh mock instance for tests ---
        __getMockNotificationInstance: (overrides = {}) => ({
            ...mockNotificationInstance, // Start with defaults
            ...overrides, // Apply specific overrides for a test case
            save: jest.fn().mockResolvedValue(this), // Ensure save is always a fresh mock
            update: jest.fn().mockResolvedValue(this), // Ensure update is always a fresh mock
        }),
        __getMockTransaction: () => ({ // Helper for fresh transaction mock
             commit: jest.fn().mockResolvedValue(undefined),
             rollback: jest.fn().mockResolvedValue(undefined),
             LOCK: { UPDATE: 'UPDATE' }
        }),
    };
});

// Mock Slack Sender
jest.mock('../src/slackSender', () => ({
    sendSlackMessage: jest.fn(),
}));

// Mock Logger
jest.mock('../src/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// --- Test Suite for processMessage ---
// NOTE: We are unit testing processMessage, not the full RabbitMQ consumption loop.
describe('Slack Connector - processMessage Function', () => {
    /**
     * @typedef {Object} BaseNotificationData
     * @property {number} dbId - Mock ID.
     * @property {string} messageId - Mock message ID.
     * @property {string} service - Mock service name.
     * @property {string} channel - Mock target channel.
     * @property {string} message - Mock message content.
     */

    let mockChannel; // Mock RabbitMQ channel object
    let mockMsg; // Mock RabbitMQ message object
    let mockTransaction; // Mock Sequelize transaction object

    const baseNotificationData = {
        dbId: 1,
        messageId: 'test-msg-id',
        service: 'slack',
        channel: '#test-channel',
        message: 'Test message',
        timestamp: new Date().toISOString(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Create fresh mocks for channel and message for each test
        mockChannel = {
            ack: jest.fn(),
            nack: jest.fn(),
        };
        mockMsg = {
            content: Buffer.from(JSON.stringify(baseNotificationData)),
            // Add other message properties if needed (e.g., fields, properties)
        };

        // Get a fresh mock transaction object for each test
        mockTransaction = db.__getMockTransaction();
        db.sequelize.transaction.mockResolvedValue(mockTransaction); // Ensure transaction() returns the fresh mock

        // Default successful mocks
        slackSender.sendSlackMessage.mockResolvedValue({ success: true, response: { ts: '12345.6789' } });
        Notification.findOne.mockResolvedValue(db.__getMockNotificationInstance()); // Default: Found record
        Notification.update.mockResolvedValue([1]); // Default: Update successful
    });

    // --- Success Path ---
     /**
      * Test case: should process valid message, send to Slack, update status to sent, and ACK message.
      *
      * Verifies that the `processMessage` function correctly handles a valid message by:
      * 1. Finding and locking the corresponding database record.
      * 2. Updating the record's status to 'processing'.
      * 3. Sending the message to Slack.
      */
    it('should process valid message, send to Slack, update status to sent, and ACK message', async () => {
        const mockRecord = db.__getMockNotificationInstance({ status: 'pending', attempts: 0 });
        Notification.findOne.mockResolvedValue(mockRecord); // Simulate finding the record

        await processMessage(mockMsg, mockChannel); // Pass mock channel

        // Verify DB find and lock
        expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
        expect(Notification.findOne).toHaveBeenCalledTimes(1);
        expect(Notification.findOne).toHaveBeenCalledWith({
            where: { messageId: baseNotificationData.messageId },
            lock: mockTransaction.LOCK.UPDATE, // Check if lock was used
            transaction: mockTransaction,
        });

        // Verify status update to 'processing' within transaction
        expect(mockRecord.save).toHaveBeenCalledTimes(1);
        expect(mockRecord.status).toBe('processing');
        expect(mockRecord.attempts).toBe(1);
        expect(mockTransaction.commit).toHaveBeenCalledTimes(1); // Commit after status update

        // Verify Slack call
        expect(slackSender.sendSlackMessage).toHaveBeenCalledTimes(1);
        expect(slackSender.sendSlackMessage).toHaveBeenCalledWith(
            baseNotificationData.channel,
            baseNotificationData.message,
            baseNotificationData.messageId
        );

        // Verify final status update to 'sent' (outside transaction in the code)
        expect(Notification.update).toHaveBeenCalledTimes(1);
        expect(Notification.update).toHaveBeenCalledWith(
             { status: 'sent', connectorResponse: JSON.stringify({ ts: '12345.6789' }) },
             { where: { id: mockRecord.id } }
        );

        // Verify RabbitMQ ACK
        expect(mockChannel.ack).toHaveBeenCalledTimes(1);
        expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    // --- Idempotency Scenarios ---
    /**
    * Test case: should ACK immediately if notification status is already "sent".
    *
    * Verifies that `processMessage` correctly identifies and handles idempotent
    * messages with a status of "sent", avoiding redundant processing.
    */
    it('should ACK immediately if notification status is already "sent"', async () => {
        const mockRecord = db.__getMockNotificationInstance({ status: 'sent', attempts: 1 });
        Notification.findOne.mockResolvedValue(mockRecord);

        await processMessage(mockMsg, mockChannel);

        expect(Notification.findOne).toHaveBeenCalledTimes(1);
        expect(mockRecord.save).not.toHaveBeenCalled(); // No status change
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled(); // No Slack call
        expect(Notification.update).not.toHaveBeenCalled(); // No final update
        expect(mockChannel.ack).toHaveBeenCalledTimes(1); // ACKed
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already marked as sent'), expect.any(Object));
    });

    /**
    * Test case: should ACK immediately if notification status is already "processing".
    *
    * Verifies that `processMessage` correctly identifies and handles idempotent
    * messages with a status of "processing", avoiding redundant processing.
    */
    it('should ACK immediately if notification status is already "processing"', async () => {
        const mockRecord = db.__getMockNotificationInstance({ status: 'processing', attempts: 1 });
        Notification.findOne.mockResolvedValue(mockRecord);

        await processMessage(mockMsg, mockChannel);

        expect(Notification.findOne).toHaveBeenCalledTimes(1);
        expect(mockRecord.save).not.toHaveBeenCalled();
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled();
        expect(Notification.update).not.toHaveBeenCalled();
        expect(mockChannel.ack).toHaveBeenCalledTimes(1); // ACKed
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already being processed'), expect.any(Object));
    });

    // --- Failure Scenarios ---
    /**
    * Test case: should NACK (no requeue) if message has invalid format (JSON parse error).
    *
    * Verifies that `processMessage` correctly handles messages with invalid JSON
    * format by NACKing them without requeueing and logging a critical error.
    *
    */
    it('should NACK (no requeue) if message has invalid format (JSON parse error)', async () => {
        mockMsg.content = Buffer.from('{invalid json'); // Malformed JSON

        await processMessage(mockMsg, mockChannel);

        expect(db.sequelize.transaction).not.toHaveBeenCalled();
        expect(Notification.findOne).not.toHaveBeenCalled();
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled();
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false); // false, false = don't requeue multiple, don't requeue single
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Critical error processing message'), expect.any(Object));
    });

    /**
    * Test case: should NACK (no requeue) if message has missing required fields.
    *
    * Verifies that `processMessage` correctly handles messages with missing
    * required fields by NACKing them without requeueing and logging an error.
    *
    */
    it('should NACK (no requeue) if message has missing required fields', async () => {
        mockMsg.content = Buffer.from(JSON.stringify({ /* missing dbId */ messageId: '123' }));

        await processMessage(mockMsg, mockChannel);

        expect(db.sequelize.transaction).not.toHaveBeenCalled();
        expect(Notification.findOne).not.toHaveBeenCalled();
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled();
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid message format received'), expect.any(Object));
    });

    /**
    * Test case: should NACK (no requeue) if notification record not found in DB.
    *
    * Verifies that `processMessage` correctly handles cases where the
    * corresponding database record is not found by NACKing without requeueing
    * and logging an error.
    */
    it('should NACK (no requeue) if notification record not found in DB', async () => {
        Notification.findOne.mockResolvedValue(null); // Simulate record not found

        await processMessage(mockMsg, mockChannel);

        expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
        expect(Notification.findOne).toHaveBeenCalledTimes(1);
        expect(mockTransaction.commit).toHaveBeenCalledTimes(1); // Commit transaction (as nothing was changed)
        expect(mockTransaction.rollback).not.toHaveBeenCalled();
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled();
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).toHaveBeenCalledTimes(1); // NACK after not finding
        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Notification record not found'), expect.any(Object));
    });

    /**
    * Test case: should NACK (no requeue) on DB error during pre-processing (find/update status).
    *
    * Verifies that `processMessage` correctly handles database errors during
    * pre-processing (finding or updating status) by NACKing without requeueing,
    * rolling back the transaction, and logging an error.
    */
    it('should NACK (no requeue) on DB error during pre-processing (find/update status)', async () => {
        const dbError = new Error('DB connection failed during find');
        Notification.findOne.mockRejectedValue(dbError); // Simulate error during find

        await processMessage(mockMsg, mockChannel);

        expect(db.sequelize.transaction).toHaveBeenCalledTimes(1);
        expect(Notification.findOne).toHaveBeenCalledTimes(1);
        expect(mockTransaction.rollback).toHaveBeenCalledTimes(1); // Should rollback
        expect(mockTransaction.commit).not.toHaveBeenCalled();
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled();
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false); // Don't requeue on DB error for now
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error during pre-processing'), expect.any(Object));
    });

    /**
    * Test case: should update status to failed and ACK if Slack sending fails.
    *
    * Verifies that `processMessage` correctly handles failures in sending messages
    * to Slack by updating the status to 'failed', logging the error, and ACK'ing
    * the message to avoid immediate requeueing.
    */
    it('should update status to failed and ACK if Slack sending fails', async () => {
        const slackError = { success: false, error: 'Slack API Error: channel_not_found' };
        slackSender.sendSlackMessage.mockResolvedValue(slackError); // Simulate Slack API failure
        const mockRecord = db.__getMockNotificationInstance({ status: 'pending', attempts: 0 });
        Notification.findOne.mockResolvedValue(mockRecord);

        await processMessage(mockMsg, mockChannel);

        expect(mockRecord.save).toHaveBeenCalledTimes(1); // Update to processing
        expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
        expect(slackSender.sendSlackMessage).toHaveBeenCalledTimes(1);

        // Verify final status update to 'failed'
        expect(Notification.update).toHaveBeenCalledTimes(1);
        expect(Notification.update).toHaveBeenCalledWith(
             { status: 'failed', connectorResponse: slackError.error },
             { where: { id: mockRecord.id } }
        );

        // Should ACK even on failure (to prevent immediate requeue) - rely on DLQ/retries later
        expect(mockChannel.ack).toHaveBeenCalledTimes(1);
        expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Slack send failed'), expect.any(Object));
    });

    /**
    * Test case: should NACK (no requeue) on unexpected error during processing or final update.
    *
    * Verifies that `processMessage` correctly handles unexpected errors during
    * message processing or the final database update by NACKing without requeueing,
    * logging the error, and attempting to update the database status to 'failed'
    * with the error details.
    */
    it('should NACK (no requeue) on unexpected error during processing or final update', async () => {
        const unexpectedError = new Error('Something weird happened');
        // Simulate error *after* Slack call but before final DB update
        slackSender.sendSlackMessage.mockResolvedValue({ success: true, response: { ts: '123' } });
        // Mock the *first* call to update to fail, the second one (to set failed) can succeed or fail (doesn't matter for this assertion)
        Notification.update
            .mockRejectedValueOnce(unexpectedError) // First call (setting to 'sent') fails
            .mockResolvedValue([1]);               // Second call (setting to 'failed') succeeds (or mock error if testing that path)

        const mockRecord = db.__getMockNotificationInstance({ status: 'pending', attempts: 0 });
        Notification.findOne.mockResolvedValue(mockRecord);

        await processMessage(mockMsg, mockChannel);

        expect(mockRecord.save).toHaveBeenCalledTimes(1); // Update to processing (instance save)
        expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
        expect(slackSender.sendSlackMessage).toHaveBeenCalledTimes(1);

        // --- CORRECTED ASSERTIONS for Notification.update ---
        // Verify Notification.update (static method) was called twice
        expect(Notification.update).toHaveBeenCalledTimes(2);

        // Check the arguments of the first call (attempting to set 'sent')
        expect(Notification.update).toHaveBeenNthCalledWith(1,
             { status: 'sent', connectorResponse: JSON.stringify({ ts: '123' }) },
             { where: { id: mockRecord.id } }
        );

         // Check the arguments of the second call (attempting to set 'failed' in catch block)
        expect(Notification.update).toHaveBeenNthCalledWith(2,
             { status: 'failed', connectorResponse: expect.stringContaining(unexpectedError.message) },
             { where: { id: mockRecord.id } }
         );
        // --- END CORRECTION ---


        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).toHaveBeenCalledTimes(1);
        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false); // Don't requeue
        // Check that the correct error was logged
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error during processing or final DB update'), expect.objectContaining({ error: unexpectedError.message }));
     });

    // --- Max Attempts Scenario ---
    /**
     * Test case: should ACK and stop processing if max attempts reached.
     *
     * Verifies that `processMessage` correctly stops processing a message and ACKs it
     * if the maximum number of processing attempts has been reached, updating
     * the status to 'failed' and logging an error.
     */
     it('should ACK and stop processing if max attempts reached', async () => {
        const maxAttempts = config.maxProcessingAttempts || 3; // Get from config
        const mockRecord = db.__getMockNotificationInstance({ status: 'failed', attempts: maxAttempts });
        Notification.findOne.mockResolvedValue(mockRecord);

        await processMessage(mockMsg, mockChannel);

        expect(Notification.findOne).toHaveBeenCalledTimes(1);
        // Verify it saved the "Max attempts reached" message
        expect(mockRecord.save).toHaveBeenCalledTimes(1);
        expect(mockRecord.connectorResponse).toContain('Max attempts reached');
        expect(mockRecord.status).toBe('failed'); // Ensure status is failed

        expect(mockTransaction.commit).toHaveBeenCalledTimes(1); // Commit the final failed state update
        expect(slackSender.sendSlackMessage).not.toHaveBeenCalled(); // No Slack call
        expect(Notification.update).not.toHaveBeenCalled(); // No separate update call
        expect(mockChannel.ack).toHaveBeenCalledTimes(1); // ACK to remove from queue
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('reached max processing attempts'), expect.any(Object));
    });

});

// --- Optional: Test Suite for slackSender ---
describe('Slack Connector - slackSender Function', () => {
      /**
    * Test suite for the slackSender functions.
    *
    * This suite contains tests for the `slackSender` functions, ensuring that
    * messages are correctly sent to Slack and errors are handled properly.
    */
    beforeEach(() => {
      jest.clearAllMocks();
      // Reset mock implementation for Slack WebClient if necessary
      // This requires mocking '@slack/web-api' itself
    });

    // Tests for slackSender (success, API error, config error) would go here
    // These would likely involve mocking the '@slack/web-api' WebClient directly
    it.todo('should call Slack API correctly on success');
    it.todo('should return error object on Slack API error');
    it.todo('should throw or return error if token is missing');
});