'use strict';
const moment = require('moment-timezone');

function getFormattedTimestamp(timestamp) {
  const cstOffset = getNormalizeOffset(timestamp, 'America/Chicago');
  console.info('🙂 -> file: helper.js:6 -> getFormattedTimestamp -> cstOffset:', cstOffset);
  return moment(timestamp).format('YYYYMMDDHHmmss') + cstOffset;
}

function getNormalizeOffset(timestamp, timezone) {
  try {
    return moment.tz(timestamp, 'YYYY-MM-DD HH:mm', timezone).format('ZZ');
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function getExpirationTimestamp(days) {
  const dayMilliseconds = 86400000;
  const expiration = Date.now() + days * dayMilliseconds;
  return Math.floor(expiration / 1000);
}

const statuses = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

const equipmentTypeMapping = {
  UNKNOWN: 'O',
  VAN: 'V',
  REFRIGERATED: 'R',
  CONTAINER: 'C',
  FLAT_BED: 'F',
  POWER_ONLY: 'PO',
  DECK: 'SD',
  TAUTLINER: 'O',
  TANKER: 'O',
  CONESTOGA: 'CN',
  MEGATRAILER: 'O',
  ROADTRAIN: 'O',
  JUMBO: 'O',
  TILT: 'O',
  BOX: 'SB',
  DRY: 'V',
  FLATBED: 'F',
  DRYVAN: 'V',
};

module.exports = {
  getFormattedTimestamp,
  getExpirationTimestamp,
  statuses,
  equipmentTypeMapping,
};
