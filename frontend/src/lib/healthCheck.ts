// Health check utility to keep API alive in production
export const startHealthCheck = () => {
  // Only run in production (when not on localhost/dev server)
  const isProduction = !window.location.hostname.includes('localhost') && 
                      !window.location.hostname.includes('127.0.0.1') &&
                      !window.location.port;

  if (!isProduction) {
    console.log('Health check skipped - running in development mode');
    return;
  }

  const healthCheckInterval = setInterval(async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Health check: ${response.status} at ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Health check failed:`, error);
    }
  }, 600000); // Every 10 minutes

  // Cleanup function
  return () => clearInterval(healthCheckInterval);
};