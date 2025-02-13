const { connectToDatabase } = require('../config/db.config');

const dbMiddleware = async (req, res, next) => {
    try {
        req.db = await connectToDatabase();
        next();
    } catch (error) {
        res.status(500).send({ message: 'Database connection error', error });
    }
};

module.exports = dbMiddleware;