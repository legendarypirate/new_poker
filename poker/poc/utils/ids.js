const PUBLIC_ID_OFFSET = 100000;

function toPublicId(dbId) {
  const n = Number(dbId);
  return Number.isFinite(n) && n > 0 ? n + PUBLIC_ID_OFFSET : null;
}

module.exports = { PUBLIC_ID_OFFSET, toPublicId };
