const accessControl = (req, res, next) => {
    const X_Client_ID = req.headers["x-client-id"];

    const user = req.user.username;

    if (req.user.service === 'internal'){
        return next();
    }
    if (
        typeof X_Client_ID === 'string' &&
        typeof user === 'string' &&
        user.toLowerCase().includes(X_Client_ID.toLowerCase())
    ) {
        req.user.clientId = X_Client_ID.toLowerCase();
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Permission Denied' });
    }
}

module.exports = accessControl; 