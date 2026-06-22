// Stateless matchmaking helpers — all state lives in Redis
exports.queueKey = (mode) => `waiting:${mode}`;
exports.roomKey = (roomId) => `room:${roomId}`;
