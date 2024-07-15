'use strict';
const moment = require('moment-timezone');
const { dbRead } = require('../shared/dynamo');
const _ = require('lodash');

const { STAGE, LOG_TABLE } = process.env;

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
  } else if (customerName.includes('TRUEVALUE')) {
    return 'TRUEELIL';
  } else if (customerName.includes('VESUVIUS')) {
    return 'VESULOAR';
  } else if (customerName.includes('AMERICANRAILCARINDUSTRIES')) {
    return 'AMERLOAR';
  } else if (customerName.includes('ALLNEX')) {
    return 'ALLNCHIL';
  }
  return null;
}

function getEmailBody({ uberPayload, livePayload, subjectLine, payloadDiffs, errorMessage }) {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Simple HTML Email with JSON Data</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
        }
        .container {
            width: 100%;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .content {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-top: 20px;
        }
        .code-block {
            background: #f9f9f9;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <h3>Hello,</h3>
            <p>${subjectLine}</p>
          ${
            errorMessage
              ? `<h3>Error message:</h3>
      <div class="code-block">
                  <code >
                      ${JSON.stringify(errorMessage, null, 2)}
                  </code>
                  </div>`
              : ''
          }
                ${
                  payloadDiffs
                    ? `<h3>Difference in Live Payload:</h3>
      <div class="code-block">
                  <code >
                      ${JSON.stringify(payloadDiffs, null, 2)}
                  </code>
                  </div>`
                    : ''
                }
                ${
                  uberPayload
                    ? `<h3>Uber Payload:</h3>
      <div class="code-block">
                  <code >
                      ${JSON.stringify(uberPayload, null, 2)}
                  </code>
                  </div>`
                    : ''
                }
            ${
              livePayload
                ? `
                <h3>Live Payload:</h3>
                <div class="code-block">
                  <code >
                      ${JSON.stringify(livePayload, null, 2)}
                  </code>
                  </div>`
                : ''
            }
        </div>
        <div class="footer">
            <p>&copy; 2024 Omni Logistics. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;
}

function getEmailSubject({ freightId, type }) {
  return `UberFreight - LiVe create shipment - ${type} - Bill No: ${freightId} - ${STAGE}`;
}

async function getExistingPayload({ freightId }) {
  const orderParam = {
    TableName: LOG_TABLE,
    KeyConditionExpression: 'FreightId = :freightId',
    FilterExpression: '#Status = :Status',
    ExpressionAttributeNames: {
      '#Status': 'Status',
    },
    ExpressionAttributeValues: {
      ':freightId': freightId,
      ':Status': statuses.SUCCESS,
    },
    // ScanIndexForward: false, // Retrieves the latest item first
    // Limit: 1, // Limits the result to the latest item
  };
  console.info('🙂 -> file: helper.js:160 -> getExistingPayload -> orderParam:', orderParam);
  try {
    const response = await dbRead(orderParam);
    console.info('🙂 -> file: helper.js:165 -> getExistingPayload -> response:', response);
    return _.get(response, 'Items[0]', {});
  } catch (error) {
    console.error('🙂 -> file: helper.js:160 -> getExistingPayload -> error:', error);
    throw error;
  }
}

function getDifferentFields({ previousPayload, currentPayload }) {
  const differences = [];

  function compare(object1, object2, path) {
    const keys = _.union(_.keys(object1), _.keys(object2));

    keys.forEach((key) => {
      const newPath = path ? `${path}.${key}` : key;
      if (_.isObject(object1[key]) && _.isObject(object2[key])) {
        compare(object1[key], object2[key], newPath);
      } else if (!_.isEqual(object1[key], object2[key])) {
        differences.push({
          [newPath]: { previousValue: object1[key], currentValue: object2[key] },
        });
      }
    });
  }

  compare(previousPayload, currentPayload, '');
  return differences;
}

function getCustomerDetails({ customerDetails }) {
  const salespersonId = _.get(customerDetails, 'salesperson_id');
  const operationsRep = _.get(customerDetails, 'operations_rep');
  const operationsRep2 = _.get(customerDetails, 'operations_rep2');
  return { salespersonId, operationsRep, operationsRep2 };
}

module.exports = {
  getFormattedTimestamp,
  getExpirationTimestamp,
  statuses,
  equipmentTypeMapping,
  referenceNumberMapping,
  chargeCodeMapping,
  getCustomerCode,
  getEmailBody,
  getEmailSubject,
  getExistingPayload,
  getDifferentFields,
  getCustomerDetails,
};
