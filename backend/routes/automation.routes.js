const express = require('express');
const automationService = require('../services/automation.service');
const { verifyToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/automation/rules
 * Get all automation rules
 */
router.get('/rules', async (req, res) => {
  try {
    const rules = await automationService.getRules();

    res.json({
      success: true,
      rules
    });
  } catch (error) {
    logger.error('Error getting automation rules:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching automation rules'
    });
  }
});

/**
 * POST /api/automation/rules
 * Add or update automation rule
 */
router.post('/rules', async (req, res) => {
  try {
    const rule = req.body;

    const savedRule = await automationService.addOrUpdateRule(rule);

    res.json({
      success: true,
      rule: savedRule
    });
  } catch (error) {
    logger.error('Error saving automation rule:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error saving automation rule'
    });
  }
});

/**
 * DELETE /api/automation/rules/:id
 * Delete automation rule
 */
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await automationService.deleteRule(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Rule deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
  } catch (error) {
    logger.error('Error deleting automation rule:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting automation rule'
    });
  }
});

/**
 * GET /api/automation/status
 * Get automation engine status
 */
router.get('/status', (req, res) => {
  try {
    const status = automationService.getStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting automation status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching automation status'
    });
  }
});

module.exports = router;
