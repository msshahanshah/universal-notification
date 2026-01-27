const jwt = require("jsonwebtoken");
const { verifyToken, TOKEN_TYPES } = require("../../helpers/jwt.helper");
const globalDatabaseManager = require("../utillity/mainDatabase");

const auth = async (req, res, next) => {
    try {
        let token = "";

        if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(" ")[1]
        }

        if (!token) {
            throw { statusCode: 403, message: "Authorization denied: No token provided" }
        }

        const decodedData = verifyToken(token, TOKEN_TYPES.ACCESS);

        const globalDb = await globalDatabaseManager.getModels();

        const user = await globalDb.User.findOne({
            where: { username: decodedData.username },
        });

        if (!user) {
            throw { statusCode: 404, message: "user does not found" }
        }

        req.user = decodedData;
        next();

    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            error.message = "Token is not valid or has expired"
        }
        return res.status(error.statusCode || 401).json({ success: false, message: error.message || "Token is not valid or has expired" });
    }
}

module.exports = auth;