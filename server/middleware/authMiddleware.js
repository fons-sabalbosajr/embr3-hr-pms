import jwt from 'jsonwebtoken';

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ message: 'Unauthorized: No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // For richer context (name/email) look up user once and cache minimal fields
    // Only if id exists; fallback to decoded for legacy tokens.
    if (decoded?.id) {
      try {
        // Lazy load to avoid circular deps at import time
        const { default: User } = await import('../models/User.js');
        const u = await User.findById(decoded.id).select('name email').lean();
        if (u) {
          req.user = { ...decoded, name: u.name, email: u.email };
        } else {
          req.user = decoded;
        }
      } catch (e) {
        req.user = decoded;
      }
    } else {
      req.user = decoded; // attach decoded token to request
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export default verifyToken;