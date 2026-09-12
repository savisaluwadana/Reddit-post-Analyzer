import express from 'express';
import mongoose from 'mongoose';
import { createOpportunityOsRouter } from './opportunityOsRoutes.js';
import { createQualityIntelligenceRouter } from './qualityIntelligenceRoutes.js';
import { createScrapeIntelligenceRouter } from './scrapeIntelligenceRoutes.js';

const COLLECTION_CLOSED_STATUSES = new Set(['semantic-analysis', 'opportunity-validation', 'complete', 'failed']);

function model(name) {
  const found = mongoose.models[name];
  if (!found) throw new Error(`${name} model is not initialized`);
  return found;
}

function serializeJob(job) {
  const raw = job?.toObject ? job.toObject() : job;
  return { ...raw, _id: String(raw._id), hostRunId: raw.hostRunId ? String(raw.hostRunId) : '' };
}

export function createIntegrityGuardRouter() {
  const router = express.Router();

  // The integrity router is already mounted at /api before the feature routers, so it
  // also provides the intelligence extensions without changing the stable bootstrap order.
  router.use('/quality-intelligence', createQualityIntelligenceRouter());
  router.use('/opportunity-os', createOpportunityOsRouter());
  router.use('/scrape-intelligence', createScrapeIntelligenceRouter());

  // Coverage is a collection-phase operation. Once semantic work starts, refreshing
  // coverage must never rewind the persisted lifecycle back to gap-research.
  router.post('/research-jobs/:id/coverage', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid research job id' });
      const job = await model('ResearchJob').findById(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      if (!COLLECTION_CLOSED_STATUSES.has(job.status)) return next();
      return res.json({
        job: serializeJob(job),
        coverage: job.coverage || {},
        readyForSemantic: ['semantic-analysis', 'opportunity-validation', 'complete'].includes(job.status),
        readOnly: true,
        message: `Coverage collection is closed while the job is ${job.status}; persisted lifecycle state was not changed.`,
      });
    } catch (error) {
      console.error('Failed to guard late-stage coverage refresh:', error);
      return res.status(500).json({ message: 'Failed to validate research job state' });
    }
  });

  // A linked host run is part of a job's durable audit trail. Prevent deleting it
  // independently and leaving a dangling hostRunId.
  router.delete('/host-intelligence/runs/:id', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return next();
      const linkedJob = await model('ResearchJob').findOne({ hostRunId: String(req.params.id) }).select({ _id: 1, name: 1, status: 1 }).lean();
      if (!linkedJob) return next();
      return res.status(409).json({
        message: 'This semantic run is linked to a research job and cannot be deleted independently.',
        linkedJobId: String(linkedJob._id),
        linkedJobName: linkedJob.name,
        linkedJobStatus: linkedJob.status,
      });
    } catch (error) {
      console.error('Failed to guard host research run deletion:', error);
      return res.status(500).json({ message: 'Failed to validate host research run references' });
    }
  });

  // Shared evidence can participate in multiple jobs through batch memberships. Deleting
  // a referenced evidence record would invalidate historical coverage, annotations and
  // provenance, so require callers to remove/restart the owning research workflow first.
  router.delete('/evidence/:id', async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return next();
      const evidence = await model('EvidenceItem').findById(req.params.id).select({ _id: 1, batchId: 1 }).lean();
      if (!evidence) return next();
      const Membership = mongoose.models.EvidenceBatchMembership;
      const membershipCount = Membership ? await Membership.countDocuments({ evidenceId: evidence._id }) : 0;
      if (!membershipCount && !evidence.batchId) return next();
      return res.status(409).json({
        message: 'This evidence is referenced by research history and cannot be deleted directly.',
        membershipCount,
        legacyBatchId: evidence.batchId || '',
      });
    } catch (error) {
      console.error('Failed to guard evidence deletion:', error);
      return res.status(500).json({ message: 'Failed to validate evidence references' });
    }
  });

  return router;
}
