const cron = require('node-cron');
const scheduleConfig = require('../config/emailSchedules');

class ScheduleManager {
  constructor(emailScheduler) {
    this.emailScheduler = emailScheduler;
    this.jobs = new Map();
  }

  startAllJobs() {
    // Email processor job
    this.jobs.set('emailProcessor', cron.schedule(
      scheduleConfig.emailProcessor.cron,
      () => this.emailScheduler.processEmails(scheduleConfig.emailProcessor.batchSize),
      { timezone: scheduleConfig.dailySummary.timezone }
    ));

    // Daily summary job
    this.jobs.set('dailySummary', cron.schedule(
      scheduleConfig.dailySummary.cron,
      () => this.emailScheduler.scheduleDailySummaries(),
      { timezone: scheduleConfig.dailySummary.timezone }
    ));

    // Owner alerts job
    this.jobs.set('ownerAlerts', cron.schedule(
      scheduleConfig.ownerAlerts.cron,
      () => this.emailScheduler.processOwnerAlerts(scheduleConfig.ownerAlerts.batchSize),
      { timezone: scheduleConfig.dailySummary.timezone }
    ));
  }

  stopAllJobs() {
    for (const [name, job] of this.jobs) {
      console.log(`Stopping ${name} job`);
      job.stop();
    }
  }

  updateJobSchedule(jobName, newCron) {
    const existingJob = this.jobs.get(jobName);
    if (existingJob) {
      existingJob.stop();
      this.jobs.set(jobName, cron.schedule(newCron, 
        () => this.emailScheduler[jobName](),
        { timezone: scheduleConfig.dailySummary.timezone }
      ));
      return true;
    }
    return false;
  }
}

// Add these routes to your server.js
const emailMonitoring = require('./services/emailMonitoring');
const scheduleManager = new ScheduleManager(emailScheduler);

// Start all scheduled jobs
scheduleManager.startAllJobs();

// Monitoring endpoints
app.get('/api/email-monitoring/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await emailMonitoring.getEmailStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/email-monitoring/failed', async (req, res) => {
  try {
    const { page, limit } = req.query;
    const failedEmails = await emailMonitoring.getFailedEmails(
      parseInt(page) || 1,
      parseInt(limit) || 10
    );
    res.json(failedEmails);
  } catch (error) {
    console.error('Error fetching failed emails:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/email-monitoring/recipient/:userId', async (req, res) => {
  try {
    const stats = await emailMonitoring.getRecipientStats(req.params.userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching recipient stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule management endpoints
app.put('/api/email-schedules/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    const { cronExpression } = req.body;

    if (!cron.validate(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    const updated = scheduleManager.updateJobSchedule(jobName, cronExpression);
    if (updated) {
      res.json({ message: `Schedule updated for ${jobName}` });
    } else {
      res.status(404).json({ error: 'Job not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/email-schedules', (req, res) => {
  res.json(scheduleConfig);
});

// Cleanup old emails (run daily at midnight)
cron.schedule('0 0 * * *', async () => {
  try {
    const successfulCutoff = new Date();
    successfulCutoff.setDate(successfulCutoff.getDate() - scheduleConfig.retention.successfulEmails);

    const failedCutoff = new Date();
    failedCutoff.setDate(failedCutoff.getDate() - scheduleConfig.retention.failedEmails);

    await Promise.all([
      // Remove old successful emails
      EmailQueue.deleteMany({
        status: 'sent',
        createdAt: { $lt: successfulCutoff }
      }),
      // Remove old failed emails
      EmailQueue.deleteMany({
        status: 'failed',
        createdAt: { $lt: failedCutoff }
      })
    ]);
  } catch (error) {
    console.error('Error cleaning up old emails:', error);
  }
});