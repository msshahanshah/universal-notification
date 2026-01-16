export const serializeLogs = (rows) => {
    return rows.map(log => {
        return {
            id: log.id,
            messageId: log.messageId,
            service: log.service,
            destination: log.destination,
            message: log.content?.message || null,
            status: log.status,
            attempts: log.attempts,
        };
    });
};
