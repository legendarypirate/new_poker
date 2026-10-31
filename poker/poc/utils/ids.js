const PUBLIC_ID_OFFSET = 100000;

function toPublicId(dbId) {
  const n = Number(dbId);
  return Number.isFinite(n) && n > 0 ? n + PUBLIC_ID_OFFSET : null;
}

function fromPublicId(publicId) {
  const n = Number(publicId);
  if (!Number.isFinite(n) || n <= PUBLIC_ID_OFFSET) return null;
  return n - PUBLIC_ID_OFFSET;
}

module.exports = { PUBLIC_ID_OFFSET, toPublicId, fromPublicId };
