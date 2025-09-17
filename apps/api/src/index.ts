import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error';
import { requestId } from './middleware/requestId';
import { auth } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import statusRoutes from './routes/status';
import qrRoutes from './routes/qr';
import groupsRoutes from './routes/groups';
import messagesRoutes from './routes/messages';
import activityRoutes from './routes/activity';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.APP_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing and cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request ID middleware
app.use(requestId);

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

// Public routes (no auth required)
app.use('/auth', authRoutes);

// Protected routes (auth required)
app.use('/api', auth);
app.use('/api', statusRoutes);
app.use('/api', qrRoutes);
app.use('/api', groupsRoutes);
app.use('/api', messagesRoutes);
app.use('/api', activityRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`WA Monitor API server running on port ${PORT}`);
});

export default app;
