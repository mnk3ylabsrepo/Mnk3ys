/** Preview UI deploy — auto-detect preview-ui branch (no extra env vars). */

const PREVIEW_BRANCH = 'preview-ui';

function isPreviewSite() {
  return process.env.VERCEL_GIT_COMMIT_REF === PREVIEW_BRANCH;
}

module.exports = { isPreviewSite, PREVIEW_BRANCH };
