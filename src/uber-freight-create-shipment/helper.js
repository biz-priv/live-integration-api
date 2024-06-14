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

const referenceNumberMapping = {
  'PRIMARY REFERENCE': 'SI',
  'PICKUP NUMBER': 'PU',
  'PO NUMBER': 'PO',
  'PRO NUMBER': 'CN',
  'NAVIS IDENTIFICATION NUMBER': 'AO',
  'SHIPMENT NUMBER': 'CR',
};

const chargeCodeMapping = {
  60: 'Freight_Charge',
  19: 'FSP',
};

function getCustomerCode(name) {
  const customerName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  console.info('🙂 -> file: helper.js:68 -> getCustomerCode -> customerName:', customerName);

  if (customerName.includes('RRDONNELLEY')) {
    return 'RRDOCHIL';
  } else if (customerName.includes('UHAUL')) {
    return 'UHAU85AZ';
  } else if (customerName.includes('FIRSTBRANDS')) {
    return 'FIRSCLOH';
  } else if (customerName.includes('KIND')) {
    return 'KINDFRTX';
  }
  return name;
}

module.exports = {
  getFormattedTimestamp,
  getExpirationTimestamp,
  statuses,
  equipmentTypeMapping,
  referenceNumberMapping,
  chargeCodeMapping,
  getCustomerCode,
};
