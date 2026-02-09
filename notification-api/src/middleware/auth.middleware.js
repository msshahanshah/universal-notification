const jwt = require("jsonwebtoken");
const { verifyToken, TOKEN_TYPES } = require("../../helpers/jwt.helper");
const globalDatabaseManager = require("../utillity/mainDatabase");

const auth = async (req, res, next) => {
    try {

        const internalKey = req.header("x-internal-key");
        if (internalKey === process.env.INTERNAL_SERVICE_TOKEN) {
            req.user = { service: "internal" };
            return next();
        }
        let token = "";

        if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(" ")[1]
        }

        if (!token) {
            throw { statusCode: 401, message: "Authorization denied" }
        }
        const decodedData = verifyToken(token, TOKEN_TYPES.ACCESS);

        const globalDb = await globalDatabaseManager.getModels();

        const user = await globalDb.User.findOne({
            where: { username: decodedData.username },
        });

        if (!user) {
            throw { statusCode: 404, message: "User not found" }
        }

        req.user = decodedData;
        next();

    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Token is not valid or has expired" });
        }
        return res.status(error.statusCode || 500).json({ success: false, message: error.message || "Internal Server Error" });
    }
}

module.exports = auth;