const accessControl = (req, res, next) => {
    const X_Client_ID = req.headers["x-client-id"];

    const user = req.user.username;
    if (
        typeof X_Client_ID === 'string' &&
        typeof user === 'string' &&
        user.toLowerCase().includes(X_Client_ID.toLowerCase())
    ) {
        req.user.clientId = X_Client_ID.toLowerCase();
        next();
    } else {
        return res.status(401).json({ message: 'Invalid client ID' });
    }
}

module.exports = accessControl;