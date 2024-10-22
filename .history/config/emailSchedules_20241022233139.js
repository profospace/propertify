const scheduleConfig = {
    emailProcessor: {
      cron: '*/5 * * * *', // Every 5 minutes
      batchSize: 50,
      maxRetries: 3,
      retryDelay: 15 // minutes
    },
    dailySummary: {
      cron: '0 21 * * *', // 9 PM daily
      timezone: 'Asia/Kolkata'
    },
    ownerAlerts: {
      cron: '*/10 * * * *', // Every 10 minutes
      batchSize: 20
    },
    retention: {
      successfulEmails: 30, // days
      failedEmails: 90 // days
    }
  };
  
  module.exports = scheduleConfig;
  