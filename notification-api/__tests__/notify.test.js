// ./notification-api/__tests__/notify.test.js
/**
 * @fileoverview Tests for the /notify endpoint of the notification-api.
 */
const request = require('supertest');
const { v4: uuidv4 } = require('uuid'); // Import uuid
const app = require('../src/app'); // Express app
const rabbitMQClient = require('../src/rabbitMQClient');
const db = require('../models'); // Import Sequelize instance and models
const Notification = db.Notification; // Get the Notification model
const logger = require('../src/logger'); // Import logger

// --- Mocks ---
// Mock RabbitMQ client
jest.mock('../src/rabbitMQClient', () => ({
    connectRabbitMQ: jest.fn().mockResolvedValue({}),
    publishMessage: jest.fn().mockResolvedValue(undefined), // Default mock implementation
    closeConnection: jest.fn().mockResolvedValue(undefined),
}));

// Mock Sequelize Notification model methods
jest.mock('../models', () => {
    // Mock the Notification model specifically
    const mockNotification = {
        create: jest.fn(),
        update: jest.fn(),
        findOne: jest.fn(),
        // Add other methods if needed by tests
    };
    // Mock the overall db object structure expected by the app
    return {
        sequelize: {
            authenticate: jest.fn().mockResolvedValue(true), // Mock DB connection success
            close: jest.fn().mockResolvedValue(true),
        },
        Notification: mockNotification, // Use the mocked model
        Sequelize: { // Mock Sequelize static properties/classes if needed
            Op: {},
        },
        // Add other models if the app uses them
    };
});

// Mock UUID generation for predictable IDs
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

// Mock logger to prevent console noise during tests and allow assertions
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// --- Test Suite ---
/**
 * @description Test suite for the POST /notify endpoint.
 * Tests various scenarios including success, validation errors, database errors, and RabbitMQ publishing errors.
 */
describe('POST /notify Endpoint', () => {
    const BASE_URL = '/notify';
    const validPayload = {
        service: 'slack',
        channel: '#general',
        message: 'Hello from tests!',
    };
    const testMessageId = 'test-uuid-1234'; // Predictable UUID

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Set default mock implementations
        rabbitMQClient.publishMessage.mockResolvedValue(undefined); // Default to success
        Notification.create.mockResolvedValue({ // Mock successful DB create
            id: 1, // Simulate DB primary key
            messageId: testMessageId,
            service: validPayload.service,
            target: validPayload.channel,
            templateId: undefined,
            content: validPayload.message,
            status: 'pending',
            attempts: 0,
            update: jest.fn().mockResolvedValue(this), // Mock update method on the instance
        });
        Notification.update.mockResolvedValue([1]); // Mock successful DB update (returns [1] for one row updated)

        // Mock uuidv4 to return a predictable value for this test run
        uuidv4.mockReturnValue(testMessageId);
    });

    // --- Success Scenario ---
    /**
     * @test {POST /notify}
     * @description Should return 202, create a 'pending' DB record, and publish a message for a valid request.
     * Verifies that the database record is created with the correct information,
     * the message is published to RabbitMQ, and the correct response is returned.
     */
    it('should return 202, create DB record (pending), and publish message for valid request', async () => {
        const response = await request(app)
            .post(BASE_URL)
            .send(validPayload)
            .expect('Content-Type', /json/)
            .expect(202);

        expect(response.body).toEqual({
            status: 'accepted',
            message: 'Notification request accepted and queued.',
            messageId: testMessageId, // Check if messageId is returned
        });

        // Verify DB Interaction
        expect(Notification.create).toHaveBeenCalledTimes(1);
        expect(Notification.create).toHaveBeenCalledWith({
            messageId: testMessageId,
            service: validPayload.service.toLowerCase(),
            templateId: undefined,
            target: validPayload.channel,
            content: validPayload.message,
            status: 'pending',
            templateId: undefined,
            attempts: 0,
        });

        // Verify RabbitMQ Interaction
        expect(rabbitMQClient.publishMessage).toHaveBeenCalledTimes(1);
        expect(rabbitMQClient.publishMessage).toHaveBeenCalledWith(
            validPayload.service.toLowerCase(), // routing key
            expect.objectContaining({ // message payload
                dbId: 1, // Check if DB ID is included
                templateId: undefined,
                messageId: testMessageId,
                service: validPayload.service.toLowerCase(),
                channel: validPayload.channel,
                message: validPayload.message,
                timestamp: expect.any(String),
            })
        );

        // Verify no update call happened on success path (status remains pending)
        expect(Notification.update).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled(); // Ensure no errors logged
    });

    // --- Validation Error Scenarios ---
    /**
     * @test {POST /notify}
     * @description Should return 400 if any of the required fields (service, channel, message) are missing.
     * @param {string} field - The missing field.
     * @param {object} payload - The payload with the missing field.
     */
    test.each([
        ['service', { channel: '#c', message: 'm' }],
        ['channel', { service: 's', message: 'm' }],
        ['message', { service: 's', channel: '#c' }],
    ])('should return 400 if %s field is missing', async (field, payload) => {
        await request(app)
            .post(BASE_URL)
            .send(payload)
            .expect('Content-Type', /json/)
            .expect(400, { error: 'Missing required fields: service, channel, message' });

        expect(Notification.create).not.toHaveBeenCalled();
        expect(rabbitMQClient.publishMessage).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Validation failed: Missing fields'), expect.any(Object));
    });

    /**
     * @test {POST /notify}
     * @description Should return 400 if an invalid service name is provided.
     * Verifies that the correct error message is returned and no database or RabbitMQ interaction occurs.
     */
    it('should return 400 Bad Request for invalid service name', async () => {
        const invalidPayload = { ...validPayload, service: 'invalidService' };
        await request(app)
            .post(BASE_URL)
            .send(invalidPayload)
            .expect('Content-Type', /json/)
            .expect(400, { error: 'Invalid service specified. Allowed services are: slack, email, telegram' });

        expect(Notification.create).not.toHaveBeenCalled();
        expect(rabbitMQClient.publishMessage).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Validation failed: Invalid service'), expect.any(Object));
    });

    // --- Database Error Scenario ---
    /**
     * @test {POST /notify}
     * @description Should return 500 if database create operation fails.
     * Simulates a database error and verifies that the correct error response is returned and no message is published.
     */
    it('should return 500 if database create fails', async () => {
        const dbError = new Error('DB Connection Error');
        Notification.create.mockRejectedValueOnce(dbError); // Simulate DB create failure

        const response = await request(app)
            .post(BASE_URL)
            .send(validPayload)
            .expect('Content-Type', /json/)
            .expect(500);

        expect(response.body).toEqual({ error: 'Failed to save notification request to database.' });
        expect(Notification.create).toHaveBeenCalledTimes(1);
        expect(rabbitMQClient.publishMessage).not.toHaveBeenCalled(); // Should not publish if DB fails
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error: Failed to create notification record'), expect.any(Object));
    });

    /**
     * @test {POST /notify}
     * @description Should return 409 if database create fails with a unique constraint error.
     * Simulates a database unique constraint error and verifies that the correct conflict response is returned
     * with the messageId, no message is published and that proper logging occurs.
     */
    it('should return 409 if database create fails with unique constraint error', async () => {
        const dbError = new Error('Unique constraint violation');
        dbError.name = 'SequelizeUniqueConstraintError'; // Simulate specific Sequelize error
        Notification.create.mockRejectedValueOnce(dbError);

        const response = await request(app)
            .post(BASE_URL)
            .send(validPayload)
            .expect('Content-Type', /json/)
            .expect(409); // Expect Conflict status

        expect(response.body).toEqual({
            error: 'Conflict: A notification with this identifier potentially exists.',
            messageId: testMessageId
        });
        expect(Notification.create).toHaveBeenCalledTimes(1);
        expect(rabbitMQClient.publishMessage).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Database error: Failed to create notification record'), expect.any(Object));

    });

    // --- RabbitMQ Publishing Error Scenario ---
    /**
     * @test {POST /notify}
     * @description Should return 500 and update the DB status to 'failed' if RabbitMQ publishing fails.
     * Simulates a RabbitMQ publish error and verifies that the correct error response is returned,
     * the database status is updated, and the error is logged.
     */
    it('should return 500 and update DB status to failed if publishing fails', async () => {
        const publishError = new Error('RabbitMQ unavailable');
        rabbitMQClient.publishMessage.mockRejectedValueOnce(publishError); // Simulate publish failure

        // Mock the update method specifically on the object returned by create
        const mockCreatedRecord = {
            id: 1,
            messageId: testMessageId,
            update: jest.fn().mockResolvedValue(this) // Mock update on the instance
        };
        Notification.create.mockResolvedValue(mockCreatedRecord);

        const response = await request(app)
            .post(BASE_URL)
            .send(validPayload)
            .expect('Content-Type', /json/)
            .expect(500);

        expect(response.body).toEqual({ error: 'Failed to queue notification request after saving.' });
        expect(Notification.create).toHaveBeenCalledTimes(1); // DB create should have succeeded
        expect(rabbitMQClient.publishMessage).toHaveBeenCalledTimes(1); // Publish should have been attempted

        // Verify DB status was updated to 'failed'
        expect(mockCreatedRecord.update).toHaveBeenCalledTimes(1); // Check update on the *instance*
        expect(mockCreatedRecord.update).toHaveBeenCalledWith({
            status: 'failed',
            connectorResponse: `Failed to publish to RabbitMQ: ${publishError.message}`
        });
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('RabbitMQ error: Failed to publish notification request'), expect.any(Object));
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Updated notification status to 'failed' due to publish error"), expect.any(Object));
    });

     /**
      * @test {GET /health}
      * @description Should return 200 OK when calling the health check endpoint.
      */
     // Test Health Check endpoint
     it('GET /health should return 200 OK', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);
        expect(response.text).toBe('OK');
     });

});