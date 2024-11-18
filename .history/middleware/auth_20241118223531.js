// middleware/auth.js

const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                status_code: '401',
                success: 'false',
                msg: 'Authentication token required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            status_code: '403',
            success: 'false',
            msg: 'Invalid or expired token'
        });
    }
};

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id,
            email: user.email,
            loginType: user.loginType
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

module.exports = {
    authenticateToken,
    generateToken
};