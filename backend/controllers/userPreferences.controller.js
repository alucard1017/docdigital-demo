const service = require("../services/userPreferences.service");

async function getMyPreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const data = await service.getByUserId(userId);

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function updateMyPreferences(req, res, next) {
  try {
    const userId = req.user.id;
    const { language, theme_mode } = req.body;

    const data = await service.upsert(userId, {
      language,
      theme_mode,
    });

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};