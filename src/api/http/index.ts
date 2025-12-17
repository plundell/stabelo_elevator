import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

export function createHttpApp(): Express {
	const app: Express = express();

	// Middleware
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));

	// Routes
	app.use('/health', healthRouter);

	// Root route
	app.get('/', (_req, res) => {
		res.json({
			message: 'Stabelo Elevator API',
			version: '1.0.0',
		});
	});

	// Error handling middleware (must be last)
	app.use(errorHandler);

	return app;
}

export function startHttpServer(): void {
	const app = createHttpApp();
	const PORT = process.env.PORT || 3000;

	app.listen(PORT, () => {
		console.log(`🚀 HTTP Server running on port ${PORT}`);
		console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
	});
}

// For backward compatibility - can be imported directly
export default createHttpApp();

