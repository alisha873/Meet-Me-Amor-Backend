module.exports = (err, req, res, next) => {
    const status = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(status).json({
        message: err.message || 'Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
};